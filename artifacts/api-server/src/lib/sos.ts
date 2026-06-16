/**
 * Get Help — Server-Side In-Memory Engine
 *
 * ZERO Firestore reads/writes. All state lives in volatile RAM and is
 * purged the moment a session ends or the process restarts.
 *
 * Grades: "9" | "10" | "11" | "12" | "cee" | "ioe"
 * Rank:    0      1      2      3      4       4
 * A helper can assist with content at their rank or lower.
 */

import type { Server as SocketServer, Socket } from "socket.io";
import { logger } from "./logger";

// ── Grade system ───────────────────────────────────────────────────────────────

const VALID_GRADES = new Set(["9", "10", "11", "12", "cee", "ioe"]);
const GRADE_RANK: Record<string, number> = {
  "9": 0, "10": 1, "11": 2, "12": 3, "cee": 4, "ioe": 4,
};

function parseGrade(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase().trim();
  return VALID_GRADES.has(s) ? s : "10";
}

function gradeRank(g: string): number {
  return GRADE_RANK[g.toLowerCase()] ?? 1;
}

// ── Type Definitions ───────────────────────────────────────────────────────────

export interface ActiveUser {
  uid: string;
  socketId: string;
  name: string;
  photoURL?: string;
  /** "9" | "10" | "11" | "12" | "cee" | "ioe" */
  grade: string;
  todayStudyMinutes: number;
  streakDays: number;
  subjectMastery: Record<string, number>;
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
  /** Grade of content they need help with */
  helpGrade: string;
  topicTitle: string;
  subject: string;
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
  endRequestedBy: string | null;
  createdAt: number;
}

// ── In-Memory State ────────────────────────────────────────────────────────────

const activeUsers       = new Map<string, ActiveUser>();
const pendingSosRequests = new Map<string, SosRequest>();
const activeSessions    = new Map<string, SosSession>();
const socketToUid       = new Map<string, string>();
const userToSession     = new Map<string, string>();

// ── Cooldown Constants ─────────────────────────────────────────────────────────
const POPUP_TIMEOUT_MS   = 30_000;
const REJECT_COOLDOWN_MS = 3 * 60_000;
const GOOD_SAMARITAN_MS  = 7 * 60_000;

// ── Scoring ────────────────────────────────────────────────────────────────────

function computeScore(user: ActiveUser, subject: string): number {
  const mastery = user.subjectMastery[subject.toLowerCase()] ?? 0;
  return (user.todayStudyMinutes * 0.4) + (user.streakDays * 0.3) + (mastery * 0.3);
}

function isUserLocked(user: ActiveUser): boolean {
  if (user.currentStatus === "in_sos_popup" || user.currentStatus === "busy_helping") return true;
  if (user.cooldownUntil !== null && Date.now() < user.cooldownUntil) return true;
  return false;
}

// ── Matchmaking ────────────────────────────────────────────────────────────────
/**
 * Find up to 3 optimal candidates for a SOS request.
 *
 * Tier 1 — helpers whose grade rank ≥ helpGrade rank (can actually answer the question),
 *           sorted by weighted score desc. Prefers helpers at exactly rank+1 ("just graduated").
 * Tier 2 — same rank (peers who may still know), sorted by score.
 * Tier 3 — any non-locked, non-excluded user (last resort), random order.
 */
function findCandidates(
  requesterUid: string,
  helpGrade: string,
  subject: string,
  alreadyNotified: string[],
): ActiveUser[] {
  const requestRank = gradeRank(helpGrade);
  const excluded    = new Set([requesterUid, ...alreadyNotified]);

  const seniors: ActiveUser[] = [];   // rank > requestRank
  const peers: ActiveUser[]   = [];   // rank === requestRank
  const anyone: ActiveUser[]  = [];   // any rank (fallback)

  for (const user of activeUsers.values()) {
    if (excluded.has(user.uid)) continue;
    if (isUserLocked(user)) continue;

    const rank = gradeRank(user.grade);
    if (rank > requestRank)      seniors.push(user);
    else if (rank === requestRank) peers.push(user);
    else                           anyone.push(user);
  }

  // Tier 1 — seniors ranked by score
  if (seniors.length > 0) {
    const candidates = seniors
      .sort((a, b) => computeScore(b, subject) - computeScore(a, subject))
      .slice(0, 3);
    logger.info({ count: candidates.length, helpGrade, subject, tier: 1 }, "[SOS] match tier 1 (seniors)");
    return candidates;
  }

  // Tier 2 — peers ranked by score
  if (peers.length > 0) {
    const candidates = peers
      .sort((a, b) => computeScore(b, subject) - computeScore(a, subject))
      .slice(0, 3);
    logger.info({ count: candidates.length, helpGrade, subject, tier: 2 }, "[SOS] match tier 2 (peers)");
    return candidates;
  }

  // Tier 3 — anyone at all (lower rank; random order)
  if (anyone.length > 0) {
    const candidates = anyone
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    logger.info({ count: candidates.length, helpGrade, subject, tier: 3 }, "[SOS] match tier 3 (anyone)");
    return candidates;
  }

  return [];
}

// ── ID generator ───────────────────────────────────────────────────────────────
function newId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Core SOS Event Handlers ────────────────────────────────────────────────────

export function initSosHandlers(io: SocketServer, socket: Socket): void {
  const uid = (): string | null => socketToUid.get(socket.id) ?? null;

  // ── Register / Update user metadata ─────────────────────────────────────
  socket.on(
    "sos_register",
    (data: {
      uid?: string;
      name?: string;
      photoURL?: string;
      grade?: unknown;
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
        grade: parseGrade(data.grade),
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

  // ── Update live study status ──────────────────────────────────────────────
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

  // ── Student sends SOS request ────────────────────────────────────────────
  socket.on(
    "client_sos_request",
    (data: { topicTitle?: string; subject?: string; helpGrade?: unknown }) => {
      const userId = uid();
      if (!userId) return;
      const requester = activeUsers.get(userId);
      if (!requester) return;

      if (userToSession.has(userId)) {
        socket.emit("sos_error", { message: "You are already in a session." });
        return;
      }

      const topicTitle = String(data?.topicTitle ?? "").slice(0, 120).trim();
      const subject    = String(data?.subject ?? "general").slice(0, 50).toLowerCase();
      const helpGrade  = parseGrade(data?.helpGrade ?? requester.grade);

      if (!topicTitle) {
        socket.emit("sos_error", { message: "Please enter a topic title." });
        return;
      }

      const requestId  = newId();
      const candidates = findCandidates(userId, helpGrade, subject, []);

      if (candidates.length === 0) {
        socket.emit("sos_no_helpers", { message: "No helpers available right now. Try again soon!" });
        return;
      }

      for (const c of candidates) c.currentStatus = "in_sos_popup";

      const req: SosRequest = {
        requestId,
        requesterUid: userId,
        requesterSocketId: socket.id,
        requesterName: requester.name,
        helpGrade,
        topicTitle,
        subject,
        notifiedUids: candidates.map(c => c.uid),
        cascadeTimer: null,
        createdAt: Date.now(),
      };

      const popupPayload = {
        requestId,
        topicTitle,
        subject,
        requesterName: requester.name,
        requesterGrade: helpGrade,
        timeoutMs: POPUP_TIMEOUT_MS,
      };

      for (const c of candidates) {
        io.to(c.socketId).emit("sos_popup", popupPayload);
      }

      req.cascadeTimer = setTimeout(() => cascadeSos(io, requestId), POPUP_TIMEOUT_MS);
      pendingSosRequests.set(requestId, req);
      socket.emit("sos_searching", { requestId, helperCount: candidates.length });
      logger.info({ requestId, helpGrade, candidates: candidates.length, topicTitle }, "[SOS] request dispatched");
    },
  );

  // ── Helper accepts ───────────────────────────────────────────────────────
  socket.on("sos_accept", (data: { requestId?: string }) => {
    const helperUid = uid();
    if (!helperUid) return;
    const helper = activeUsers.get(helperUid);
    if (!helper) return;

    const requestId = String(data?.requestId ?? "");
    const req = pendingSosRequests.get(requestId);
    if (!req) {
      socket.emit("sos_popup_expired", {});
      return;
    }

    if (req.cascadeTimer) clearTimeout(req.cascadeTimer);

    for (const nUid of req.notifiedUids) {
      if (nUid === helperUid) continue;
      const nUser = activeUsers.get(nUid);
      if (!nUser) continue;
      io.to(nUser.socketId).emit("sos_popup_clear", { requestId });
      nUser.currentStatus = "idle";
    }

    pendingSosRequests.delete(requestId);
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

    const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);
    if (requesterSocket) requesterSocket.join(sessionId);
    socket.join(sessionId);

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
      grade: req.helpGrade,
    };

    const sessionPayload = { sessionId, topicTitle: req.topicTitle, subject: req.subject };

    if (requesterSocket) {
      requesterSocket.emit("sos_session_start", { ...sessionPayload, role: "requester", partner: helperPayload });
    }
    socket.emit("sos_session_start", { ...sessionPayload, role: "helper", partner: requesterPayload });

    logger.info({ sessionId, requesterUid: req.requesterUid, helperUid }, "[SOS] session started");
  });

  // ── Helper rejects ───────────────────────────────────────────────────────
  socket.on("sos_reject", (data: { requestId?: string }) => {
    const helperUid = uid();
    if (!helperUid) return;
    const helper = activeUsers.get(helperUid);
    if (!helper) return;

    const requestId = String(data?.requestId ?? "");
    const req = pendingSosRequests.get(requestId);
    if (!req) return;

    helper.cooldownUntil = Date.now() + REJECT_COOLDOWN_MS;
    helper.currentStatus = "idle";
    req.notifiedUids = req.notifiedUids.filter(u => u !== helperUid);

    if (req.notifiedUids.length === 0) {
      if (req.cascadeTimer) clearTimeout(req.cascadeTimer);
      cascadeSos(io, requestId);
    }
    logger.debug({ requestId, helperUid }, "[SOS] helper rejected");
  });

  // ── In-session chat ──────────────────────────────────────────────────────
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

  // ── Canvas draw ──────────────────────────────────────────────────────────
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

      socket.to(sessionId).emit("sos_canvas_draw", {
        points: data.points.slice(0, 2000).map(p => ({
          x: Math.max(0, Number(p.x) || 0),
          y: Math.max(0, Number(p.y) || 0),
        })),
        tool:         String(data.tool  ?? "pen").slice(0, 20),
        color:        String(data.color ?? "#000000").slice(0, 20),
        size:         Math.max(1, Math.min(100, Number(data.size) || 3)),
        canvasWidth:  Math.max(1, Number(data.canvasWidth)  || 800),
        canvasHeight: Math.max(1, Number(data.canvasHeight) || 600),
      });
    },
  );

  // ── Canvas image ─────────────────────────────────────────────────────────
  socket.on("sos_canvas_image", (data: { dataUrl?: string; canvasWidth?: number; canvasHeight?: number }) => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    if (!data?.dataUrl) return;

    socket.to(sessionId).emit("sos_canvas_image", {
      dataUrl: data.dataUrl,
      canvasWidth:  Math.max(1, Number(data.canvasWidth)  || 800),
      canvasHeight: Math.max(1, Number(data.canvasHeight) || 600),
    });
  });

  // ── Canvas clear ─────────────────────────────────────────────────────────
  socket.on("sos_canvas_clear", () => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    io.to(sessionId).emit("sos_canvas_clear", {});
  });

  // ── End session request ──────────────────────────────────────────────────
  socket.on("sos_end_request", () => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    const session = activeSessions.get(sessionId);
    if (!session) return;
    session.endRequestedBy = userId;
    io.to(sessionId).emit("sos_end_confirm_prompt", { requestedByUid: userId });
  });

  // ── Confirm end ──────────────────────────────────────────────────────────
  socket.on("sos_end_confirm", () => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    const session = activeSessions.get(sessionId);
    if (!session) return;

    io.to(sessionId).emit("sos_session_ended", { sessionId });

    const helper    = activeUsers.get(session.helperUid);
    const requester = activeUsers.get(session.requesterUid);
    if (helper)    { helper.currentStatus    = "idle"; helper.cooldownUntil = Date.now() + GOOD_SAMARITAN_MS; }
    if (requester)   requester.currentStatus = "idle";

    activeSessions.delete(sessionId);
    userToSession.delete(session.requesterUid);
    userToSession.delete(session.helperUid);
    io.socketsLeave(sessionId);
    logger.info({ sessionId }, "[SOS] session ended");
  });

  // ── Cancel end ───────────────────────────────────────────────────────────
  socket.on("sos_end_cancel", () => {
    const userId = uid();
    if (!userId) return;
    const sessionId = userToSession.get(userId);
    if (!sessionId) return;
    const session = activeSessions.get(sessionId);
    if (!session) return;
    session.endRequestedBy = null;
    io.to(sessionId).emit("sos_end_cancelled", {});
  });

  // ── Rating (ephemeral) ───────────────────────────────────────────────────
  socket.on("sos_rating", (data: { rating?: string }) => {
    const allowed = ["great", "decent", "bad"];
    const rating  = String(data?.rating ?? "").toLowerCase();
    if (!allowed.includes(rating)) return;
    logger.debug({ uid: uid(), rating }, "[SOS] rating submitted");
  });

  // ── Disconnect cleanup ───────────────────────────────────────────────────
  socket.on("disconnect", () => {
    cleanupUser(io, socket.id);
  });
}

// ── Cascade to next batch ──────────────────────────────────────────────────────

function cascadeSos(io: SocketServer, requestId: string): void {
  const req = pendingSosRequests.get(requestId);
  if (!req) return;

  for (const nUid of req.notifiedUids) {
    const user = activeUsers.get(nUid);
    if (user && user.currentStatus === "in_sos_popup") {
      user.currentStatus = "idle";
      user.cooldownUntil = Date.now() + REJECT_COOLDOWN_MS;
    }
    const sock = activeUsers.get(nUid)?.socketId ?? "";
    if (sock) io.to(sock).emit("sos_popup_clear", { requestId });
  }

  const allNotified    = [...req.notifiedUids];
  const nextCandidates = findCandidates(req.requesterUid, req.helpGrade, req.subject, allNotified);

  if (nextCandidates.length === 0) {
    const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);
    if (requesterSocket) {
      requesterSocket.emit("sos_no_helpers", {
        message: "No more helpers found. Please try again later.",
      });
    }
    pendingSosRequests.delete(requestId);
    logger.info({ requestId }, "[SOS] cascade exhausted");
    return;
  }

  for (const c of nextCandidates) c.currentStatus = "in_sos_popup";

  req.notifiedUids  = nextCandidates.map(c => c.uid);
  req.cascadeTimer  = setTimeout(() => cascadeSos(io, requestId), POPUP_TIMEOUT_MS);

  const popupPayload = {
    requestId,
    topicTitle:     req.topicTitle,
    subject:        req.subject,
    requesterName:  req.requesterName,
    requesterGrade: req.helpGrade,
    timeoutMs:      POPUP_TIMEOUT_MS,
  };
  for (const c of nextCandidates) {
    io.to(c.socketId).emit("sos_popup", popupPayload);
  }

  const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);
  if (requesterSocket) {
    requesterSocket.emit("sos_searching", { requestId, helperCount: nextCandidates.length });
  }
  logger.info({ requestId, nextCount: nextCandidates.length }, "[SOS] cascade round");
}

// ── Disconnect / cleanup ───────────────────────────────────────────────────────

function cleanupUser(io: SocketServer, socketId: string): void {
  const userId = socketToUid.get(socketId);
  if (!userId) return;
  socketToUid.delete(socketId);

  const user = activeUsers.get(userId);
  if (user) {
    // If they were showing a popup, revert their status
    if (user.currentStatus === "in_sos_popup") {
      user.currentStatus = "idle";
    }
    activeUsers.delete(userId);
  }

  // If they were in a session, notify their partner
  const sessionId = userToSession.get(userId);
  if (sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      io.to(sessionId).emit("sos_partner_disconnected", {});
      const otherUid =
        session.requesterUid === userId ? session.helperUid : session.requesterUid;
      const otherUser = activeUsers.get(otherUid);
      if (otherUser) otherUser.currentStatus = "idle";
      activeSessions.delete(sessionId);
      userToSession.delete(session.requesterUid);
      userToSession.delete(session.helperUid);
      io.socketsLeave(sessionId);
    }
  }

  logger.debug({ userId }, "[SOS] user cleaned up on disconnect");
}
