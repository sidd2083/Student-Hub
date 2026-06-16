/**
 * SOS Network — Server-Side In-Memory Engine
 *
 * ZERO Firestore reads/writes. All state lives in volatile RAM and is
 * purged the moment a session ends or the process restarts.
 */

import type { Server as SocketServer, Socket } from "socket.io";
import { logger } from "./logger";

// ── Type Definitions ──────────────────────────────────────────────────────────

export interface ActiveUser {
  uid: string;
  socketId: string;
  name: string;
  photoURL?: string;
  grade: number;
  todayStudyMinutes: number;
  streakDays: number;
  /** subject slug → mastery points, e.g. { math: 120, science: 85 } */
  subjectMastery: Record<string, number>;
  /** Timestamp — if in the future, user cannot receive popups */
  cooldownUntil: number | null;
  currentStatus: "idle" | "pomodoro" | "study_room" | "in_sos_popup" | "busy_helping";
  instagramHandle?: string;
  tiktokHandle?: string;
}

interface SosRequest {
  requestId: string;
  requesterUid: string;
  requesterSocketId: string;
  requesterName: string;
  requesterGrade: number;
  topicTitle: string;
  subject: string;
  /** UIDs currently showing the popup — up to 3 */
  notifiedUids: string[];
  cascadeTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

interface SosSession {
  sessionId: string;
  requesterUid: string;
  helperUid: string;
  topicTitle: string;
  subject: string;
  /** UID of whoever clicked End first; null if neither */
  endRequestedBy: string | null;
  createdAt: number;
}

// ── In-Memory State ───────────────────────────────────────────────────────────

/** uid → ActiveUser metadata */
const activeUsers = new Map<string, ActiveUser>();
/** requestId → pending SOS request */
const pendingSosRequests = new Map<string, SosRequest>();
/** sessionId → live session */
const activeSessions = new Map<string, SosSession>();
/** socketId → uid (for fast disconnect lookups) */
const socketToUid = new Map<string, string>();
/** uid → active sessionId */
const userToSession = new Map<string, string>();

// ── Cooldown Constants ────────────────────────────────────────────────────────
const POPUP_TIMEOUT_MS        = 30_000; // 30 s before cascade
const REJECT_COOLDOWN_MS      = 3 * 60_000;  // 3 min reject/ignore penalty
const GOOD_SAMARITAN_MS       = 7 * 60_000;  // 7 min rest after helping

// ── Matchmaking Logic ─────────────────────────────────────────────────────────

function computeScore(user: ActiveUser, subject: string): number {
  const mastery = user.subjectMastery[subject] ?? 0;
  return (user.todayStudyMinutes * 0.4) + (user.streakDays * 0.3) + (mastery * 0.3);
}

function isUserLocked(user: ActiveUser): boolean {
  if (user.currentStatus === "in_sos_popup" || user.currentStatus === "busy_helping") return true;
  if (user.cooldownUntil !== null && Date.now() < user.cooldownUntil) return true;
  return false;
}

/**
 * Find up to 3 optimal candidates for a given SOS request.
 * Tier 1: same/adjacent grade, weighted score ranking.
 * Tier 2 fallback: any same-grade peer not locked.
 */
function findCandidates(
  requesterUid: string,
  grade: number,
  subject: string,
  alreadyNotified: string[],
): ActiveUser[] {
  const excluded = new Set([requesterUid, ...alreadyNotified]);
  const eligible: ActiveUser[] = [];

  for (const user of activeUsers.values()) {
    if (excluded.has(user.uid)) continue;
    if (isUserLocked(user)) continue;
    eligible.push(user);
  }

  // Tier 1 — same or adjacent grade, ranked by weighted score
  const tier1 = eligible
    .filter(u =>
      (u.grade === grade || u.grade === grade + 1) &&
      (u.currentStatus === "idle" || u.currentStatus === "pomodoro" || u.currentStatus === "study_room"),
    )
    .sort((a, b) => computeScore(b, subject) - computeScore(a, subject))
    .slice(0, 3);

  if (tier1.length >= 1) {
    logger.info({ count: tier1.length, grade, subject }, "[SOS] Tier 1 match");
    return tier1;
  }

  // Tier 2 fallback — any same-grade peer, random order
  const tier2 = eligible
    .filter(u => u.grade === grade)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  logger.info({ count: tier2.length, grade, subject }, "[SOS] Tier 2 fallback match");
  return tier2;
}

// ── Session ID generator ──────────────────────────────────────────────────────
function newId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Core SOS Event Handlers ───────────────────────────────────────────────────

export function initSosHandlers(io: SocketServer, socket: Socket): void {
  const uid = (): string | null => socketToUid.get(socket.id) ?? null;

  // ── Register / Update user metadata ──────────────────────────────────────
  socket.on(
    "sos_register",
    (data: {
      uid?: string;
      name?: string;
      photoURL?: string;
      grade?: number;
      todayStudyMinutes?: number;
      streakDays?: number;
      subjectMastery?: Record<string, number>;
      instagramHandle?: string;
      tiktokHandle?: string;
    }) => {
      if (!data?.uid || !data?.name) return;
      const userId = String(data.uid).slice(0, 128);

      const existing = activeUsers.get(userId);
      const user: ActiveUser = {
        uid: userId,
        socketId: socket.id,
        name: String(data.name).slice(0, 80),
        photoURL: typeof data.photoURL === "string" ? data.photoURL.slice(0, 512) : undefined,
        grade: Math.max(9, Math.min(12, Number(data.grade) || 10)),
        todayStudyMinutes: Math.max(0, Math.min(600, Number(data.todayStudyMinutes) || 0)),
        streakDays: Math.max(0, Math.min(3650, Number(data.streakDays) || 0)),
        subjectMastery:
          data.subjectMastery && typeof data.subjectMastery === "object"
            ? Object.fromEntries(
                Object.entries(data.subjectMastery)
                  .slice(0, 20)
                  .map(([k, v]) => [String(k).slice(0, 32), Math.max(0, Math.min(9999, Number(v) || 0))]),
              )
            : {},
        cooldownUntil: existing?.cooldownUntil ?? null,
        currentStatus: existing?.currentStatus ?? "idle",
        instagramHandle:
          typeof data.instagramHandle === "string" ? data.instagramHandle.slice(0, 64) : undefined,
        tiktokHandle:
          typeof data.tiktokHandle === "string" ? data.tiktokHandle.slice(0, 64) : undefined,
      };

      activeUsers.set(userId, user);
      socketToUid.set(socket.id, userId);
      logger.debug({ uid: userId, grade: user.grade }, "[SOS] user registered");
    },
  );

  // ── Update live study status ───────────────────────────────────────────────
  socket.on(
    "sos_update_status",
    (data: { status?: ActiveUser["currentStatus"]; todayStudyMinutes?: number; streakDays?: number }) => {
      const userId = uid();
      if (!userId) return;
      const user = activeUsers.get(userId);
      if (!user) return;

      const allowed: ActiveUser["currentStatus"][] = [
        "idle", "pomodoro", "study_room", "in_sos_popup", "busy_helping",
      ];
      if (data.status && allowed.includes(data.status)) {
        // Don't let client override a server-managed status
        if (user.currentStatus !== "in_sos_popup" && user.currentStatus !== "busy_helping") {
          user.currentStatus = data.status;
        }
      }
      if (typeof data.todayStudyMinutes === "number") {
        user.todayStudyMinutes = Math.max(0, Math.min(600, data.todayStudyMinutes));
      }
      if (typeof data.streakDays === "number") {
        user.streakDays = Math.max(0, Math.min(3650, data.streakDays));
      }
    },
  );

  // ── Student sends SOS request ─────────────────────────────────────────────
  socket.on(
    "client_sos_request",
    (data: { topicTitle?: string; subject?: string; grade?: number }) => {
      const userId = uid();
      if (!userId) return;
      const requester = activeUsers.get(userId);
      if (!requester) return;

      // Prevent spamming — requester must not already be in a session
      if (userToSession.has(userId)) {
        socket.emit("sos_error", { message: "You are already in an SOS session." });
        return;
      }

      const topicTitle = String(data?.topicTitle ?? "").slice(0, 120).trim();
      const subject    = String(data?.subject ?? "general").slice(0, 50).toLowerCase();
      const grade      = Math.max(9, Math.min(12, Number(data?.grade) || requester.grade));

      if (!topicTitle) {
        socket.emit("sos_error", { message: "Please enter a topic title." });
        return;
      }

      const requestId = newId();
      const candidates = findCandidates(userId, grade, subject, []);

      if (candidates.length === 0) {
        socket.emit("sos_no_helpers", { message: "No helpers available right now. Try again soon!" });
        return;
      }

      // Lock candidates immediately to prevent double-dispatch
      for (const c of candidates) {
        c.currentStatus = "in_sos_popup";
      }

      const req: SosRequest = {
        requestId,
        requesterUid: userId,
        requesterSocketId: socket.id,
        requesterName: requester.name,
        requesterGrade: grade,
        topicTitle,
        subject,
        notifiedUids: candidates.map(c => c.uid),
        cascadeTimer: null,
        createdAt: Date.now(),
      };

      // Send popup to each candidate
      const popupPayload = {
        requestId,
        topicTitle,
        subject,
        requesterName: requester.name,
        requesterGrade: grade,
        timeoutMs: POPUP_TIMEOUT_MS,
      };
      for (const c of candidates) {
        io.to(c.socketId).emit("sos_popup", popupPayload);
      }

      // 30-second cascade timeout
      req.cascadeTimer = setTimeout(() => {
        cascadeSos(io, requestId);
      }, POPUP_TIMEOUT_MS);

      pendingSosRequests.set(requestId, req);
      socket.emit("sos_searching", { requestId, helperCount: candidates.length });
      logger.info({ requestId, candidates: candidates.length, topicTitle }, "[SOS] request dispatched");
    },
  );

  // ── Helper accepts SOS popup ───────────────────────────────────────────────
  socket.on("sos_accept", (data: { requestId?: string }) => {
    const helperUid = uid();
    if (!helperUid) return;
    const helper = activeUsers.get(helperUid);
    if (!helper) return;

    const requestId = String(data?.requestId ?? "");
    const req = pendingSosRequests.get(requestId);
    if (!req) {
      // Request was already handled (accepted by someone else, or expired)
      socket.emit("sos_popup_expired", {});
      return;
    }

    // Clear cascade timer
    if (req.cascadeTimer) clearTimeout(req.cascadeTimer);

    // Clear popup from all other notified users
    for (const nUid of req.notifiedUids) {
      if (nUid === helperUid) continue;
      const nUser = activeUsers.get(nUid);
      if (!nUser) continue;
      io.to(nUser.socketId).emit("sos_popup_clear", { requestId });
      // Revert their status to idle (they were locked)
      nUser.currentStatus = "idle";
    }

    pendingSosRequests.delete(requestId);

    // Update both parties' statuses
    helper.currentStatus = "busy_helping";
    const requester = activeUsers.get(req.requesterUid);
    if (requester) requester.currentStatus = "busy_helping";

    const sessionId = newId();
    const session: SosSession = {
      sessionId,
      requesterUid: req.requesterUid,
      helperUid,
      topicTitle: req.topicTitle,
      subject: req.subject,
      endRequestedBy: null,
      createdAt: Date.now(),
    };
    activeSessions.set(sessionId, session);
    userToSession.set(req.requesterUid, sessionId);
    userToSession.set(helperUid, sessionId);

    // Join both sockets to the private session room
    const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);
    if (requesterSocket) requesterSocket.join(sessionId);
    socket.join(sessionId);

    // Build profile payloads for both sides
    const helperPayload = {
      uid: helperUid,
      name: helper.name,
      photoURL: helper.photoURL,
      instagramHandle: helper.instagramHandle,
      tiktokHandle: helper.tiktokHandle,
      grade: helper.grade,
    };
    const requesterPayload = {
      uid: req.requesterUid,
      name: req.requesterName,
      photoURL: requester?.photoURL,
      grade: req.requesterGrade,
    };

    const sessionPayload = {
      sessionId,
      topicTitle: req.topicTitle,
      subject: req.subject,
    };

    // Tell requester the session started with helper info
    if (requesterSocket) {
      requesterSocket.emit("sos_session_start", {
        ...sessionPayload,
        role: "requester",
        partner: helperPayload,
      });
    }

    // Tell helper the session started with requester info
    socket.emit("sos_session_start", {
      ...sessionPayload,
      role: "helper",
      partner: requesterPayload,
    });

    logger.info({ sessionId, requesterUid: req.requesterUid, helperUid }, "[SOS] session started");
  });

  // ── Helper rejects SOS popup ───────────────────────────────────────────────
  socket.on("sos_reject", (data: { requestId?: string }) => {
    const helperUid = uid();
    if (!helperUid) return;
    const helper = activeUsers.get(helperUid);
    if (!helper) return;

    const requestId = String(data?.requestId ?? "");
    const req = pendingSosRequests.get(requestId);
    if (!req) return;

    // Apply reject cooldown
    helper.cooldownUntil = Date.now() + REJECT_COOLDOWN_MS;
    helper.currentStatus = "idle";

    // Remove from notified list
    req.notifiedUids = req.notifiedUids.filter(u => u !== helperUid);

    // If all 3 rejected, don't wait for the timer — cascade immediately
    if (req.notifiedUids.length === 0) {
      if (req.cascadeTimer) clearTimeout(req.cascadeTimer);
      cascadeSos(io, requestId);
    }

    logger.debug({ requestId, helperUid }, "[SOS] helper rejected");
  });

  // ── In-session chat ───────────────────────────────────────────────────────
  socket.on("sos_chat_message", (data: { text?: string }) => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    const session = activeSessions.get(sessionId);
    if (!session) return;
    const user = activeUsers.get(userId);
    if (!user) return;

    const text = String(data?.text ?? "").slice(0, 1000).trim();
    if (!text) return;

    io.to(sessionId).emit("sos_chat_message", {
      id: `${Date.now()}_${userId.slice(0, 6)}`,
      uid: userId,
      name: user.name,
      photoURL: user.photoURL,
      text,
      createdAtMs: Date.now(),
    });
  });

  // ── Canvas draw stream ────────────────────────────────────────────────────
  socket.on(
    "sos_canvas_draw",
    (data: {
      points?: { x: number; y: number }[];
      tool?: string;
      color?: string;
      size?: number;
      canvasWidth?: number;
      canvasHeight?: number;
    }) => {
      const userId = uid();
      if (!userId) return;
      const sessionId = userToSession.get(userId);
      if (!sessionId) return;

      if (!Array.isArray(data?.points) || data.points.length === 0) return;

      // Relay directly to the other participant(s) in the session
      socket.to(sessionId).emit("sos_canvas_draw", {
        points: data.points.slice(0, 2000).map(p => ({
          x: Math.max(0, Number(p.x) || 0),
          y: Math.max(0, Number(p.y) || 0),
        })),
        tool: String(data.tool ?? "pen").slice(0, 20),
        color: String(data.color ?? "#000000").slice(0, 20),
        size: Math.max(1, Math.min(100, Number(data.size) || 3)),
        canvasWidth: Math.max(1, Number(data.canvasWidth) || 800),
        canvasHeight: Math.max(1, Number(data.canvasHeight) || 600),
      });
    },
  );

  // ── Canvas background image ───────────────────────────────────────────────
  socket.on("sos_canvas_image", (data: { dataUrl?: string; canvasWidth?: number; canvasHeight?: number }) => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    if (!data?.dataUrl) return;

    socket.to(sessionId).emit("sos_canvas_image", {
      dataUrl: data.dataUrl, // base64 — size capped by socket maxHttpBufferSize (5MB)
      canvasWidth: Math.max(1, Number(data.canvasWidth) || 800),
      canvasHeight: Math.max(1, Number(data.canvasHeight) || 600),
    });
  });

  // ── Canvas clear ──────────────────────────────────────────────────────────
  socket.on("sos_canvas_clear", () => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    io.to(sessionId).emit("sos_canvas_clear", {});
  });

  // ── End session request ───────────────────────────────────────────────────
  socket.on("sos_end_request", () => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    const session = activeSessions.get(sessionId);
    if (!session) return;

    session.endRequestedBy = userId;
    // Show the "End?" confirm modal on BOTH screens
    io.to(sessionId).emit("sos_end_confirm_prompt", { requestedByUid: userId });
  });

  // ── User confirms end ─────────────────────────────────────────────────────
  socket.on("sos_end_confirm", () => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    const session = activeSessions.get(sessionId);
    if (!session) return;

    // End confirmed — notify both parties to show rating modal
    io.to(sessionId).emit("sos_session_ended", { sessionId });

    // Apply Good Samaritan rest to helper
    const helper = activeUsers.get(session.helperUid);
    if (helper) {
      helper.currentStatus = "idle";
      helper.cooldownUntil = Date.now() + GOOD_SAMARITAN_MS;
    }
    const requester = activeUsers.get(session.requesterUid);
    if (requester) requester.currentStatus = "idle";

    // Purge session from RAM
    activeSessions.delete(sessionId);
    userToSession.delete(session.requesterUid);
    userToSession.delete(session.helperUid);

    // Remove both sockets from the session room
    io.socketsLeave(sessionId);
    logger.info({ sessionId }, "[SOS] session ended");
  });

  // ── User cancels end ──────────────────────────────────────────────────────
  socket.on("sos_end_cancel", () => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    const session = activeSessions.get(sessionId);
    if (!session) return;

    session.endRequestedBy = null;
    // Tell both parties to dismiss the prompt and resume
    io.to(sessionId).emit("sos_end_cancelled", {});
  });

  // ── Rating submitted (informational only — not stored) ───────────────────
  socket.on("sos_rating", (data: { rating?: string }) => {
    const allowed = ["great", "decent", "bad"];
    const rating = String(data?.rating ?? "").toLowerCase();
    if (!allowed.includes(rating)) return;
    // Currently ephemeral; could be extended to track in-memory leaderboard
    logger.debug({ uid: uid(), rating }, "[SOS] rating submitted");
  });

  // ── Disconnect cleanup ────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    cleanupUser(io, socket.id);
  });
}

// ── Cascade SOS to next batch of helpers ─────────────────────────────────────
function cascadeSos(io: SocketServer, requestId: string): void {
  const req = pendingSosRequests.get(requestId);
  if (!req) return;

  // Revert anyone still showing the popup
  for (const nUid of req.notifiedUids) {
    const user = activeUsers.get(nUid);
    if (user && user.currentStatus === "in_sos_popup") {
      user.currentStatus = "idle";
      user.cooldownUntil = Date.now() + REJECT_COOLDOWN_MS; // timeout penalty
    }
    io.to(activeUsers.get(nUid)?.socketId ?? "").emit("sos_popup_clear", { requestId });
  }

  const allNotified = [...req.notifiedUids]; // already tried, exclude from next round
  const nextCandidates = findCandidates(
    req.requesterUid,
    req.requesterGrade,
    req.subject,
    allNotified,
  );

  if (nextCandidates.length === 0) {
    // Nobody left — inform requester
    const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);
    if (requesterSocket) {
      requesterSocket.emit("sos_no_helpers", {
        message: "No more available helpers found. Please try again later.",
      });
    }
    pendingSosRequests.delete(requestId);
    logger.info({ requestId }, "[SOS] cascade exhausted — no helpers found");
    return;
  }

  // Lock new candidates
  for (const c of nextCandidates) c.currentStatus = "in_sos_popup";

  req.notifiedUids = nextCandidates.map(c => c.uid);
  req.cascadeTimer = setTimeout(() => cascadeSos(io, requestId), POPUP_TIMEOUT_MS);

  const popupPayload = {
    requestId,
    topicTitle: req.topicTitle,
    subject: req.subject,
    requesterName: req.requesterName,
    requesterGrade: req.requesterGrade,
    timeoutMs: POPUP_TIMEOUT_MS,
  };
  for (const c of nextCandidates) {
    io.to(c.socketId).emit("sos_popup", popupPayload);
  }

  logger.info({ requestId, nextCandidates: nextCandidates.length }, "[SOS] cascaded to next batch");
}

// ── Cleanup on socket disconnect ──────────────────────────────────────────────
function cleanupUser(io: SocketServer, socketId: string): void {
  const userId = socketToUid.get(socketId);
  if (!userId) return;
  socketToUid.delete(socketId);

  // If user was in a session, close it
  const sessionId = userToSession.get(userId);
  if (sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      io.to(sessionId).emit("sos_partner_disconnected", {});
      // Clean up both parties
      const otherUid =
        session.requesterUid === userId ? session.helperUid : session.requesterUid;
      const otherUser = activeUsers.get(otherUid);
      if (otherUser) {
        otherUser.currentStatus = "idle";
        otherUser.cooldownUntil = null;
      }
      userToSession.delete(session.requesterUid);
      userToSession.delete(session.helperUid);
      activeSessions.delete(sessionId);
      io.socketsLeave(sessionId);
    }
  }

  // If user had a pending SOS request, cancel it
  for (const [reqId, req] of pendingSosRequests.entries()) {
    if (req.requesterUid === userId) {
      if (req.cascadeTimer) clearTimeout(req.cascadeTimer);
      for (const nUid of req.notifiedUids) {
        const u = activeUsers.get(nUid);
        if (u) {
          u.currentStatus = "idle";
          io.to(u.socketId).emit("sos_popup_clear", { requestId: reqId });
        }
      }
      pendingSosRequests.delete(reqId);
      break;
    }
    // If user was a notified helper, remove them from the list
    if (req.notifiedUids.includes(userId)) {
      req.notifiedUids = req.notifiedUids.filter(u => u !== userId);
      if (req.notifiedUids.length === 0) {
        if (req.cascadeTimer) clearTimeout(req.cascadeTimer);
        cascadeSos(io, reqId);
      }
    }
  }

  activeUsers.delete(userId);
  logger.debug({ userId }, "[SOS] user deregistered");
}
