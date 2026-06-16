/**
 * Get Help — Server-Side In-Memory Engine
 *
 * ZERO Firestore. All state in RAM.
 *
 * Key design decisions:
 *  - Users are NOT deleted from activeUsers on disconnect.
 *    Instead their socketId is blanked and a GC timer purges them after 2 min.
 *    This prevents the common "reconnecting socket" race condition where a user
 *    sends a request right after a reconnect but before re-registration lands.
 *  - Requests with 0 immediate candidates enter a waitingQueue (up to 90 s).
 *    When any user registers / reconnects, the queue is checked and dispatched.
 *  - Online count is pushed to requesters so the UI can show "X students online".
 *
 * Grades: "9" | "10" | "11" | "12" | "cee" | "ioe"
 * Rank:    0      1      2      3      4       4
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

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ActiveUser {
  uid: string;
  /** Empty string = socket disconnected (pending GC) */
  socketId: string;
  name: string;
  photoURL?: string;
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
  helpGrade: string;
  topicTitle: string;
  subject: string;
  notifiedUids: string[];
  cascadeTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

interface WaitingRequest {
  requestId: string;
  requesterUid: string;
  requesterSocketId: string;
  requesterName: string;
  helpGrade: string;
  topicTitle: string;
  subject: string;
  expiresAt: number;
  expiryTimer: ReturnType<typeof setTimeout>;
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

const activeUsers         = new Map<string, ActiveUser>();
const pendingSosRequests  = new Map<string, SosRequest>();
/** Requests waiting because no candidates were available right now */
const waitingQueue        = new Map<string, WaitingRequest>();
const activeSessions      = new Map<string, SosSession>();
const socketToUid         = new Map<string, string>();
const userToSession       = new Map<string, string>();
/** uid → timestamp they disconnected (for GC) */
const disconnectedAt      = new Map<string, number>();

// ── Constants ──────────────────────────────────────────────────────────────────
const POPUP_TIMEOUT_MS      = 30_000;
const REJECT_COOLDOWN_MS    = 3 * 60_000;
const GOOD_SAMARITAN_MS     = 7 * 60_000;
const WAITING_QUEUE_TTL_MS  = 90_000; // 90 s waiting before giving up
const DISCONNECT_GC_MS      = 2 * 60_000; // purge after 2 min offline

// ── GC: purge users gone > 2 min ──────────────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - DISCONNECT_GC_MS;
  for (const [uid, ts] of disconnectedAt) {
    if (ts < cutoff) {
      activeUsers.delete(uid);
      disconnectedAt.delete(uid);
      logger.debug({ uid }, "[SOS] GC: user purged after 2 min offline");
    }
  }
}, 30_000);

// ── Online count ───────────────────────────────────────────────────────────────
function getOnlineCount(): number {
  let n = 0;
  for (const u of activeUsers.values()) {
    if (u.socketId) n++;
  }
  return n;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

function computeScore(user: ActiveUser, subject: string): number {
  const mastery = user.subjectMastery[subject.toLowerCase()] ?? 0;
  return (user.todayStudyMinutes * 0.4) + (user.streakDays * 0.3) + (mastery * 0.3);
}

function isUserLocked(user: ActiveUser): boolean {
  if (!user.socketId) return true; // disconnected
  if (user.currentStatus === "in_sos_popup" || user.currentStatus === "busy_helping") return true;
  if (user.cooldownUntil !== null && Date.now() < user.cooldownUntil) return true;
  return false;
}

// ── Matchmaking ────────────────────────────────────────────────────────────────
/**
 * Tier 1 — helpers with grade rank > helpGrade rank (seniors, sorted by score)
 * Tier 2 — helpers with same grade rank (peers, sorted by score)
 * Tier 3 — any non-locked, non-excluded user (cross-grade fallback, random)
 */
function findCandidates(
  requesterUid: string,
  helpGrade: string,
  subject: string,
  alreadyNotified: string[],
): ActiveUser[] {
  const requestRank = gradeRank(helpGrade);
  const excluded    = new Set([requesterUid, ...alreadyNotified]);

  const seniors: ActiveUser[] = [];
  const peers:   ActiveUser[] = [];
  const anyone:  ActiveUser[] = [];

  for (const user of activeUsers.values()) {
    if (excluded.has(user.uid)) continue;
    if (isUserLocked(user)) continue;

    const rank = gradeRank(user.grade);
    if (rank > requestRank)        seniors.push(user);
    else if (rank === requestRank) peers.push(user);
    else                           anyone.push(user);
  }

  if (seniors.length > 0) {
    logger.info({ count: seniors.length, helpGrade, tier: 1 }, "[SOS] match tier 1");
    return seniors.sort((a, b) => computeScore(b, subject) - computeScore(a, subject)).slice(0, 3);
  }
  if (peers.length > 0) {
    logger.info({ count: peers.length, helpGrade, tier: 2 }, "[SOS] match tier 2");
    return peers.sort((a, b) => computeScore(b, subject) - computeScore(a, subject)).slice(0, 3);
  }
  if (anyone.length > 0) {
    logger.info({ count: anyone.length, helpGrade, tier: 3 }, "[SOS] match tier 3");
    return anyone.sort(() => Math.random() - 0.5).slice(0, 3);
  }
  return [];
}

// ── ID generator ───────────────────────────────────────────────────────────────
function newId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Dispatch helpers (shared by immediate path and waiting-queue path) ─────────
function dispatchToHelpers(
  io: SocketServer,
  req: SosRequest,
  candidates: ActiveUser[],
): void {
  for (const c of candidates) c.currentStatus = "in_sos_popup";

  req.notifiedUids = candidates.map(c => c.uid);

  const popupPayload = {
    requestId:      req.requestId,
    topicTitle:     req.topicTitle,
    subject:        req.subject,
    requesterName:  req.requesterName,
    requesterGrade: req.helpGrade,
    timeoutMs:      POPUP_TIMEOUT_MS,
  };
  for (const c of candidates) {
    io.to(c.socketId).emit("sos_popup", popupPayload);
  }

  req.cascadeTimer = setTimeout(() => cascadeSos(io, req.requestId), POPUP_TIMEOUT_MS);
  pendingSosRequests.set(req.requestId, req);

  const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);
  if (requesterSocket) {
    requesterSocket.emit("sos_searching", { requestId: req.requestId, helperCount: candidates.length });
  }
  logger.info({ requestId: req.requestId, helpGrade: req.helpGrade, candidates: candidates.length }, "[SOS] dispatched");
}

// ── Try to serve any waiting requests for a newly-available user ───────────────
function tryFlushWaitingQueue(io: SocketServer, newUid: string): void {
  for (const [requestId, wReq] of waitingQueue) {
    if (wReq.requesterUid === newUid) continue; // can't help yourself
    const candidates = findCandidates(wReq.requesterUid, wReq.helpGrade, wReq.subject, []);
    if (candidates.length === 0) continue;

    // Found a match — promote from waiting queue to live request
    clearTimeout(wReq.expiryTimer);
    waitingQueue.delete(requestId);

    const req: SosRequest = {
      requestId:          wReq.requestId,
      requesterUid:       wReq.requesterUid,
      requesterSocketId:  wReq.requesterSocketId,
      requesterName:      wReq.requesterName,
      helpGrade:          wReq.helpGrade,
      topicTitle:         wReq.topicTitle,
      subject:            wReq.subject,
      notifiedUids:       [],
      cascadeTimer:       null,
      createdAt:          Date.now(),
    };
    dispatchToHelpers(io, req, candidates);
    logger.info({ requestId, newUid }, "[SOS] waiting queue flushed on new user");
    break; // dispatch one at a time to avoid race
  }
}

// ── Core SOS Event Handlers ────────────────────────────────────────────────────

export function initSosHandlers(io: SocketServer, socket: Socket): void {
  const uid = (): string | null => socketToUid.get(socket.id) ?? null;

  // ── Register / update user ──────────────────────────────────────────────
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
      const userId  = String(data.uid).slice(0, 128);
      const existing = activeUsers.get(userId);

      // If this user was previously disconnected, remove from GC queue
      disconnectedAt.delete(userId);

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
        // Preserve cooldown / session status across reconnects
        cooldownUntil: existing?.cooldownUntil ?? null,
        currentStatus:
          existing?.currentStatus === "busy_helping" || existing?.currentStatus === "in_sos_popup"
            ? existing.currentStatus
            : "idle",
        instagramHandle: typeof data.instagramHandle === "string" ? data.instagramHandle.slice(0, 64) : undefined,
        tiktokHandle:    typeof data.tiktokHandle    === "string" ? data.tiktokHandle.slice(0, 64)    : undefined,
      };

      // If the old socketId was different, clean up the old entry in socketToUid
      if (existing?.socketId && existing.socketId !== socket.id) {
        socketToUid.delete(existing.socketId);
      }

      activeUsers.set(userId, user);
      socketToUid.set(socket.id, userId);

      // Push current online count back to this socket
      socket.emit("sos_online_count", { count: getOnlineCount() });

      logger.debug({ uid: userId, grade: user.grade, onlineCount: getOnlineCount() }, "[SOS] user registered");

      // Check if any waiting request can now be served by this new user
      tryFlushWaitingQueue(io, userId);
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

  // ── Student sends SOS request ─────────────────────────────────────────────
  socket.on(
    "client_sos_request",
    (data: { topicTitle?: string; subject?: string; helpGrade?: unknown }) => {
      const userId = uid();
      if (!userId) return;
      const requester = activeUsers.get(userId);
      if (!requester) {
        socket.emit("sos_error", { message: "Please wait — still connecting. Try again in a second." });
        return;
      }

      if (userToSession.has(userId)) {
        socket.emit("sos_error", { message: "You are already in a session." });
        return;
      }

      // Block if requester already has a pending or waiting request
      for (const req of pendingSosRequests.values()) {
        if (req.requesterUid === userId) {
          socket.emit("sos_error", { message: "You already have an active request." });
          return;
        }
      }
      for (const wReq of waitingQueue.values()) {
        if (wReq.requesterUid === userId) {
          socket.emit("sos_error", { message: "You already have an active request." });
          return;
        }
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

      if (candidates.length > 0) {
        // Immediate dispatch
        const req: SosRequest = {
          requestId,
          requesterUid:       userId,
          requesterSocketId:  socket.id,
          requesterName:      requester.name,
          helpGrade,
          topicTitle,
          subject,
          notifiedUids:       [],
          cascadeTimer:       null,
          createdAt:          Date.now(),
        };
        dispatchToHelpers(io, req, candidates);
      } else {
        // Nobody available right now — enter waiting queue
        logger.info({ requestId, helpGrade, onlineCount: getOnlineCount() }, "[SOS] no candidates, entering waiting queue");

        const expiryTimer = setTimeout(() => {
          waitingQueue.delete(requestId);
          const requesterSocket = io.sockets.sockets.get(socket.id);
          if (requesterSocket) {
            requesterSocket.emit("sos_no_helpers", {
              message: "No helpers found after waiting. Please try again later.",
            });
          }
          logger.info({ requestId }, "[SOS] waiting request expired");
        }, WAITING_QUEUE_TTL_MS);

        const wReq: WaitingRequest = {
          requestId,
          requesterUid:       userId,
          requesterSocketId:  socket.id,
          requesterName:      requester.name,
          helpGrade,
          topicTitle,
          subject,
          expiresAt:   Date.now() + WAITING_QUEUE_TTL_MS,
          expiryTimer,
        };
        waitingQueue.set(requestId, wReq);

        // Tell the requester they're in the queue, with remaining wait time
        socket.emit("sos_waiting", {
          requestId,
          message: "No helpers are online right now. We'll notify you the moment someone comes online!",
          expiresInMs: WAITING_QUEUE_TTL_MS,
        });
      }
    },
  );

  // ── Cancel request (works for both pending and waiting) ──────────────────
  socket.on("sos_cancel_request", (data: { requestId?: string }) => {
    const userId    = uid();
    if (!userId) return;
    const requestId = String(data?.requestId ?? "");

    // Waiting queue
    const wReq = waitingQueue.get(requestId);
    if (wReq && wReq.requesterUid === userId) {
      clearTimeout(wReq.expiryTimer);
      waitingQueue.delete(requestId);
      logger.debug({ requestId }, "[SOS] waiting request cancelled");
      return;
    }

    // Pending request
    const req = pendingSosRequests.get(requestId);
    if (req && req.requesterUid === userId) {
      if (req.cascadeTimer) clearTimeout(req.cascadeTimer);
      for (const nUid of req.notifiedUids) {
        const u = activeUsers.get(nUid);
        if (u) {
          io.to(u.socketId).emit("sos_popup_clear", { requestId });
          u.currentStatus = "idle";
        }
      }
      pendingSosRequests.delete(requestId);
      logger.debug({ requestId }, "[SOS] pending request cancelled");
    }
  });

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

    // Clear popup from other notified users
    for (const nUid of req.notifiedUids) {
      if (nUid === helperUid) continue;
      const nUser = activeUsers.get(nUid);
      if (!nUser) continue;
      if (nUser.socketId) io.to(nUser.socketId).emit("sos_popup_clear", { requestId });
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
      topicTitle:   req.topicTitle,
      subject:      req.subject,
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
      uid: helperUid, name: helper.name, photoURL: helper.photoURL,
      instagramHandle: helper.instagramHandle, tiktokHandle: helper.tiktokHandle, grade: helper.grade,
    };
    const requesterPayload = {
      uid: req.requesterUid, name: req.requesterName, photoURL: requester?.photoURL, grade: req.helpGrade,
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
    (data: { points?: { x: number; y: number }[]; tool?: string; color?: string; size?: number; canvasWidth?: number; canvasHeight?: number }) => {
      const userId = uid();
      if (!userId) return;
      const sessionId = userToSession.get(userId);
      if (!sessionId) return;
      if (!Array.isArray(data?.points) || data.points.length === 0) return;

      socket.to(sessionId).emit("sos_canvas_draw", {
        points:      data.points.slice(0, 2000).map(p => ({ x: Math.max(0, Number(p.x) || 0), y: Math.max(0, Number(p.y) || 0) })),
        tool:        String(data.tool  ?? "pen").slice(0, 20),
        color:       String(data.color ?? "#000000").slice(0, 20),
        size:        Math.max(1, Math.min(100, Number(data.size) || 3)),
        canvasWidth: Math.max(1, Number(data.canvasWidth)  || 800),
        canvasHeight:Math.max(1, Number(data.canvasHeight) || 600),
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
      dataUrl:     data.dataUrl,
      canvasWidth: Math.max(1, Number(data.canvasWidth)  || 800),
      canvasHeight:Math.max(1, Number(data.canvasHeight) || 600),
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

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    cleanupOnDisconnect(io, socket.id);
  });
}

// ── Cascade to next batch ──────────────────────────────────────────────────────

function cascadeSos(io: SocketServer, requestId: string): void {
  const req = pendingSosRequests.get(requestId);
  if (!req) return;

  // Revert still-showing popups
  for (const nUid of req.notifiedUids) {
    const user = activeUsers.get(nUid);
    if (user) {
      if (user.currentStatus === "in_sos_popup") {
        user.currentStatus = "idle";
        user.cooldownUntil = Date.now() + REJECT_COOLDOWN_MS;
      }
      if (user.socketId) io.to(user.socketId).emit("sos_popup_clear", { requestId });
    }
  }

  const allNotified    = [...req.notifiedUids];
  const nextCandidates = findCandidates(req.requesterUid, req.helpGrade, req.subject, allNotified);

  if (nextCandidates.length === 0) {
    // Move to waiting queue instead of giving up entirely
    logger.info({ requestId }, "[SOS] cascade exhausted — moving to waiting queue");
    pendingSosRequests.delete(requestId);

    const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);

    const expiryTimer = setTimeout(() => {
      waitingQueue.delete(requestId);
      if (requesterSocket) {
        requesterSocket.emit("sos_no_helpers", {
          message: "No helpers found. Please try again later.",
        });
      }
    }, WAITING_QUEUE_TTL_MS);

    const wReq: WaitingRequest = {
      requestId:          req.requestId,
      requesterUid:       req.requesterUid,
      requesterSocketId:  req.requesterSocketId,
      requesterName:      req.requesterName,
      helpGrade:          req.helpGrade,
      topicTitle:         req.topicTitle,
      subject:            req.subject,
      expiresAt:          Date.now() + WAITING_QUEUE_TTL_MS,
      expiryTimer,
    };
    waitingQueue.set(requestId, wReq);

    if (requesterSocket) {
      requesterSocket.emit("sos_waiting", {
        requestId,
        message: "All helpers are busy. You're in the queue — we'll connect you the moment someone is free!",
        expiresInMs: WAITING_QUEUE_TTL_MS,
      });
    }
    return;
  }

  // Dispatch next batch
  for (const c of nextCandidates) c.currentStatus = "in_sos_popup";
  req.notifiedUids  = nextCandidates.map(c => c.uid);
  req.cascadeTimer  = setTimeout(() => cascadeSos(io, requestId), POPUP_TIMEOUT_MS);

  const popupPayload = {
    requestId:      req.requestId,
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

// ── Graceful disconnect (don't delete — mark offline, let GC handle it) ────────

function cleanupOnDisconnect(io: SocketServer, socketId: string): void {
  const userId = socketToUid.get(socketId);
  if (!userId) return;
  socketToUid.delete(socketId);

  const user = activeUsers.get(userId);
  if (user) {
    // Blank the socket ID — user is now "offline" but still in activeUsers for 2 min
    user.socketId = "";
    disconnectedAt.set(userId, Date.now());

    // If they were showing a popup, revert
    if (user.currentStatus === "in_sos_popup") {
      user.currentStatus = "idle";
    }
  }

  // Cancel any waiting requests from this user
  for (const [requestId, wReq] of waitingQueue) {
    if (wReq.requesterSocketId === socketId) {
      clearTimeout(wReq.expiryTimer);
      waitingQueue.delete(requestId);
      logger.debug({ requestId }, "[SOS] waiting request cleared on disconnect");
    }
  }

  // Notify partner if in session
  const sessionId = userToSession.get(userId);
  if (sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      io.to(sessionId).emit("sos_partner_disconnected", {});
      const otherUid = session.requesterUid === userId ? session.helperUid : session.requesterUid;
      const other    = activeUsers.get(otherUid);
      if (other) other.currentStatus = "idle";
      activeSessions.delete(sessionId);
      userToSession.delete(session.requesterUid);
      userToSession.delete(session.helperUid);
      io.socketsLeave(sessionId);
    }
  }

  logger.debug({ userId, onlineCount: getOnlineCount() }, "[SOS] user disconnected (not deleted yet)");
}
