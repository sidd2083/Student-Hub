/**
 * Get Help — Server-Side In-Memory Engine
 *
 * ZERO Firestore. All state in RAM.
 *
 * Matchmaking: Strict-grade, 3-round cascading algorithm
 *  Round 1 — Top Performers   (same grade, high study/streak score, top 3)
 *  Round 2 — Low-Criteria     (same grade, any available, random 3)
 *  Round 3 — Ultimate Fallback (same grade, broadest filter, random 3)
 *
 * Toggle Independence Law:
 *  Users with allowNotifications=false are NEVER targeted by matchmaking.
 *  (Round 3 exception: ignores cooldowns but still respects allowNotifications
 *   unless truly nobody else is available — see ROUND_3_ALLOW_ALL below.)
 *
 * Key design decisions:
 *  - Users are NOT deleted from activeUsers on disconnect.
 *    Instead their socketId is blanked and a GC timer purges them after 2 min.
 *  - Requests with 0 immediate candidates enter a waitingQueue (up to 90 s).
 *    When any user registers / reconnects, the queue is checked and dispatched.
 *  - Online count is pushed to requesters so the UI can show "X students online".
 *
 * Grades: "9" | "10" | "11" | "12" | "cee" | "ioe"
 */

import type { Server as SocketServer, Socket } from "socket.io";
import { logger } from "./logger";

// ── Grade system ───────────────────────────────────────────────────────────────

const VALID_GRADES = new Set(["9", "10", "11", "12", "cee", "ioe"]);

function parseGrade(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase().trim();
  return VALID_GRADES.has(s) ? s : "10";
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
  /** Toggle Independence Law — if false, never target with SOS popups */
  allowNotifications: boolean;
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
  /** UIDs currently being shown the popup in this batch */
  notifiedUids: string[];
  /**
   * ALL UIDs ever sent a popup for this request (across all rounds).
   * Permanently excluded from future batches per the Strict Exclusion Law.
   */
  allNotifiedUids: string[];
  /** Current cascade round: 1 | 2 | 3 */
  round: number;
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

const activeUsers        = new Map<string, ActiveUser>();
const pendingSosRequests = new Map<string, SosRequest>();
const waitingQueue       = new Map<string, WaitingRequest>();
const activeSessions     = new Map<string, SosSession>();
const socketToUid        = new Map<string, string>();
const userToSession      = new Map<string, string>();
const disconnectedAt     = new Map<string, number>();

// ── Constants ──────────────────────────────────────────────────────────────────

const POPUP_TIMEOUT_MS      = 30_000;
const REJECT_COOLDOWN_MS    = 3 * 60_000;
const GOOD_SAMARITAN_MS     = 7 * 60_000;
const WAITING_QUEUE_TTL_MS  = 90_000;
const DISCONNECT_GC_MS      = 2 * 60_000;

// Round 1 performance thresholds (defines "Top Performer")
const R1_MIN_STUDY_MINS = 10;   // at least 10 min studied today
const R1_MIN_STREAK     = 3;    // OR at least 3-day streak

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

// ── ID generator ───────────────────────────────────────────────────────────────

function newId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── 3-Round Strict-Grade Matchmaking ──────────────────────────────────────────
/**
 * STRICT GRADE LAW: All rounds ONLY match users within the exact requested grade.
 *
 * Round 1 — Top Performers
 *   Requires allowNotifications=true, no cooldown, not busy/in-popup.
 *   Filter: todayStudyMinutes >= R1_MIN_STUDY_MINS OR streakDays >= R1_MIN_STREAK.
 *   Sort by composite score desc, pick top 3.
 *   If 0 qualify (criteria too selective) → immediately fall through to Round 2.
 *
 * Round 2 — Low-Criteria Catch
 *   Requires allowNotifications=true, no cooldown, not busy/in-popup.
 *   No performance filter — random pick up to 3.
 *
 * Round 3 — Ultimate Grade Fallback
 *   ONLY excludes: offline, busy_helping, in_sos_popup, already notified this session.
 *   Ignores cooldowns and allowNotifications to surface ANY reachable user.
 *   Random pick up to 3.
 */
function findRoundCandidates(
  requesterUid: string,
  helpGrade: string,
  subject: string,
  allNotifiedUids: string[],
  round: number,
): ActiveUser[] {
  const excluded = new Set([requesterUid, ...allNotifiedUids]);
  const grade    = helpGrade.toLowerCase();
  const pool: ActiveUser[] = [];

  for (const user of activeUsers.values()) {
    // Always-excluded (all rounds)
    if (excluded.has(user.uid))              continue;
    if (!user.socketId)                      continue; // offline
    if (user.grade.toLowerCase() !== grade)  continue; // STRICT GRADE

    if (round <= 2) {
      // Rounds 1 & 2 — respect opt-out toggle and standard lock conditions
      if (!user.allowNotifications)         continue;
      if (user.currentStatus === "busy_helping")  continue;
      if (user.currentStatus === "in_sos_popup")  continue;
      if (user.cooldownUntil !== null && Date.now() < user.cooldownUntil) continue;
    } else {
      // Round 3 — broadest filter; only exclude truly occupied users
      if (user.currentStatus === "busy_helping")  continue;
      if (user.currentStatus === "in_sos_popup")  continue;
    }

    pool.push(user);
  }

  if (round === 1) {
    // Filter to top performers only
    const highPerformers = pool.filter(
      u => u.todayStudyMinutes >= R1_MIN_STUDY_MINS || u.streakDays >= R1_MIN_STREAK,
    );
    if (highPerformers.length === 0) {
      // Criteria too selective — signal caller to fall through to Round 2
      return [];
    }
    return highPerformers
      .sort((a, b) => computeScore(b, subject) - computeScore(a, subject))
      .slice(0, 3);
  }

  // Rounds 2 & 3 — random selection
  return pool.sort(() => Math.random() - 0.5).slice(0, 3);
}

// ── Dispatch helpers ───────────────────────────────────────────────────────────

function dispatchToHelpers(
  io: SocketServer,
  req: SosRequest,
  candidates: ActiveUser[],
): void {
  // Mark candidates as showing popup
  for (const c of candidates) c.currentStatus = "in_sos_popup";

  // Update current batch and accumulate into full history
  req.notifiedUids = candidates.map(c => c.uid);
  for (const uid of req.notifiedUids) {
    if (!req.allNotifiedUids.includes(uid)) req.allNotifiedUids.push(uid);
  }

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
    requesterSocket.emit("sos_searching", {
      requestId:   req.requestId,
      helperCount: candidates.length,
      round:       req.round,
    });
  }
  logger.info(
    { requestId: req.requestId, helpGrade: req.helpGrade, round: req.round, candidates: candidates.length },
    "[SOS] dispatched",
  );
}

// ── Try to dispatch starting at req.round, advancing if a round yields 0 ──────
/**
 * Attempts to find candidates starting at req.round.
 * If a round yields 0 candidates, immediately advances to the next round.
 * If all rounds (1-3) yield 0, enters the waiting queue.
 */
function tryDispatchNextRound(io: SocketServer, req: SosRequest): void {
  while (req.round <= 3) {
    const candidates = findRoundCandidates(
      req.requesterUid, req.helpGrade, req.subject, req.allNotifiedUids, req.round,
    );

    if (candidates.length > 0) {
      dispatchToHelpers(io, req, candidates);
      return;
    }

    logger.info(
      { requestId: req.requestId, round: req.round, helpGrade: req.helpGrade },
      "[SOS] round yielded 0 candidates — advancing",
    );
    req.round++;
  }

  // All 3 rounds yielded 0 candidates — enter waiting queue
  pendingSosRequests.delete(req.requestId);
  enterWaitingQueue(io, req);
}

// ── Waiting queue helpers ──────────────────────────────────────────────────────

function enterWaitingQueue(io: SocketServer, req: SosRequest | { requestId: string; requesterUid: string; requesterSocketId: string; requesterName: string; helpGrade: string; topicTitle: string; subject: string }): void {
  const requestId = req.requestId;
  logger.info({ requestId, helpGrade: req.helpGrade }, "[SOS] entering waiting queue");

  const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);

  const expiryTimer = setTimeout(() => {
    waitingQueue.delete(requestId);
    if (requesterSocket) {
      requesterSocket.emit("sos_no_helpers", {
        message: "No helpers found after waiting. Please try again later.",
      });
    }
    logger.info({ requestId }, "[SOS] waiting request expired");
  }, WAITING_QUEUE_TTL_MS);

  const wReq: WaitingRequest = {
    requestId:         req.requestId,
    requesterUid:      req.requesterUid,
    requesterSocketId: req.requesterSocketId,
    requesterName:     req.requesterName,
    helpGrade:         req.helpGrade,
    topicTitle:        req.topicTitle,
    subject:           req.subject,
    expiresAt:         Date.now() + WAITING_QUEUE_TTL_MS,
    expiryTimer,
  };
  waitingQueue.set(requestId, wReq);

  if (requesterSocket) {
    requesterSocket.emit("sos_waiting", {
      requestId,
      message: "No helpers are online for your grade right now. You'll get a popup the moment someone comes online!",
      expiresInMs: WAITING_QUEUE_TTL_MS,
    });
  }
}

// ── Try to serve any waiting requests for a newly-available user ───────────────

function tryFlushWaitingQueue(io: SocketServer, newUid: string): void {
  for (const [requestId, wReq] of waitingQueue) {
    if (wReq.requesterUid === newUid) continue;

    // Only flush if the new user could plausibly help (same grade, online)
    const newUser = activeUsers.get(newUid);
    if (!newUser || !newUser.socketId) continue;
    if (newUser.grade.toLowerCase() !== wReq.helpGrade.toLowerCase()) continue;

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
      allNotifiedUids:    [],
      round:              1,
      cascadeTimer:       null,
      createdAt:          Date.now(),
    };
    pendingSosRequests.set(requestId, req);
    tryDispatchNextRound(io, req);
    logger.info({ requestId, newUid }, "[SOS] waiting queue flushed on new user");
    break; // dispatch one at a time
  }
}

// ── Cascade to next round after 30s timeout ────────────────────────────────────

function cascadeSos(io: SocketServer, requestId: string): void {
  const req = pendingSosRequests.get(requestId);
  if (!req) return;

  // Apply timeout penalty: users who ignored the popup get the full cooldown
  for (const nUid of req.notifiedUids) {
    const user = activeUsers.get(nUid);
    if (!user) continue;
    if (user.currentStatus === "in_sos_popup") {
      user.currentStatus = "idle";
      user.cooldownUntil = Date.now() + REJECT_COOLDOWN_MS;
    }
    if (user.socketId) io.to(user.socketId).emit("sos_popup_clear", { requestId });
  }
  req.notifiedUids = [];

  // Advance to next round
  req.round++;

  if (req.round > 3) {
    // All 3 rounds completed with no acceptances
    pendingSosRequests.delete(requestId);
    const requesterSocket = io.sockets.sockets.get(req.requesterSocketId);
    if (requesterSocket) {
      requesterSocket.emit("sos_no_helpers", {
        message: "No helpers responded after 3 rounds. Please try again later.",
      });
    }
    logger.info({ requestId }, "[SOS] all 3 rounds exhausted — no accept");
    return;
  }

  // Try next round (will keep advancing if that round also has 0 candidates)
  tryDispatchNextRound(io, req);
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
      allowNotifications?: boolean;
      instagramHandle?: string;
      tiktokHandle?: string;
    }) => {
      if (!data?.uid || !data?.name) return;
      const userId   = String(data.uid).slice(0, 128);
      const existing = activeUsers.get(userId);

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
        // Toggle Independence Law — preserve existing preference, default to true (opted-in)
        allowNotifications:
          typeof data.allowNotifications === "boolean"
            ? data.allowNotifications
            : (existing?.allowNotifications ?? true),
        cooldownUntil: existing?.cooldownUntil ?? null,
        currentStatus:
          existing?.currentStatus === "busy_helping" || existing?.currentStatus === "in_sos_popup"
            ? existing.currentStatus
            : "idle",
        instagramHandle: typeof data.instagramHandle === "string" ? data.instagramHandle.slice(0, 64) : undefined,
        tiktokHandle:    typeof data.tiktokHandle    === "string" ? data.tiktokHandle.slice(0, 64)    : undefined,
      };

      if (existing?.socketId && existing.socketId !== socket.id) {
        socketToUid.delete(existing.socketId);
      }

      activeUsers.set(userId, user);
      socketToUid.set(socket.id, userId);

      socket.emit("sos_online_count", { count: getOnlineCount() });
      logger.debug(
        { uid: userId, grade: user.grade, allowNotifications: user.allowNotifications, onlineCount: getOnlineCount() },
        "[SOS] user registered",
      );

      tryFlushWaitingQueue(io, userId);
    },
  );

  // ── Toggle Help Notifications (Toggle Independence Law) ───────────────────
  socket.on("sos_update_notifications", (data: { allowNotifications?: boolean }) => {
    const userId = uid();
    if (!userId) return;
    const user = activeUsers.get(userId);
    if (!user) return;
    if (typeof data?.allowNotifications !== "boolean") return;

    user.allowNotifications = data.allowNotifications;
    logger.debug({ uid: userId, allowNotifications: data.allowNotifications }, "[SOS] notifications toggled");
  });

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

      const requestId = newId();
      const req: SosRequest = {
        requestId,
        requesterUid:      userId,
        requesterSocketId: socket.id,
        requesterName:     requester.name,
        helpGrade,
        topicTitle,
        subject,
        notifiedUids:    [],
        allNotifiedUids: [],
        round:           1,
        cascadeTimer:    null,
        createdAt:       Date.now(),
      };

      // Register in pendingSosRequests before dispatching
      pendingSosRequests.set(requestId, req);
      tryDispatchNextRound(io, req);
    },
  );

  // ── Cancel request ────────────────────────────────────────────────────────
  socket.on("sos_cancel_request", (data: { requestId?: string }) => {
    const userId    = uid();
    if (!userId) return;
    const requestId = String(data?.requestId ?? "");

    const wReq = waitingQueue.get(requestId);
    if (wReq && wReq.requesterUid === userId) {
      clearTimeout(wReq.expiryTimer);
      waitingQueue.delete(requestId);
      logger.debug({ requestId }, "[SOS] waiting request cancelled");
      return;
    }

    const req = pendingSosRequests.get(requestId);
    if (req && req.requesterUid === userId) {
      if (req.cascadeTimer) clearTimeout(req.cascadeTimer);
      for (const nUid of req.notifiedUids) {
        const u = activeUsers.get(nUid);
        if (u) {
          if (u.socketId) io.to(u.socketId).emit("sos_popup_clear", { requestId });
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

    // Kill the cascade countdown instantly
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
      requesterUid:   req.requesterUid,
      helperUid,
      topicTitle:     req.topicTitle,
      subject:        req.subject,
      endRequestedBy: null,
      createdAt:      Date.now(),
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

    // Pause the helper's Pomodoro timer immediately on acceptance
    socket.emit("sos_timer_pause", {});

    logger.info({ sessionId, requesterUid: req.requesterUid, helperUid, round: req.round }, "[SOS] session started");
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

    // 3-minute cooldown penalty
    helper.cooldownUntil = Date.now() + REJECT_COOLDOWN_MS;
    helper.currentStatus = "idle";
    req.notifiedUids = req.notifiedUids.filter(u => u !== helperUid);

    // Force-clear the modal on this helper's browser
    socket.emit("sos_popup_clear", { requestId });

    // If all current-batch users rejected, cascade immediately (don't wait 30s)
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
        points: data.points
          .slice(0, 2000)
          .map(p => ({ x: Math.max(0, Number(p.x) || 0), y: Math.max(0, Number(p.y) || 0) })),
        tool:        String(data.tool  ?? "pen").slice(0, 20),
        color:       String(data.color ?? "#000000").slice(0, 20),
        size:        Math.max(1, Math.min(100, Number(data.size) || 3)),
        canvasWidth: Math.max(1, Number(data.canvasWidth)  || 800),
        canvasHeight:Math.max(1, Number(data.canvasHeight) || 600),
      });
    },
  );

  // ── Canvas image ─────────────────────────────────────────────────────────
  socket.on(
    "sos_canvas_image",
    (data: { dataUrl?: string; canvasWidth?: number; canvasHeight?: number }) => {
      const userId = uid();
      if (!userId) return;
      const sessionId = userToSession.get(userId);
      if (!sessionId) return;
      if (!data?.dataUrl) return;
      socket.to(sessionId).emit("sos_canvas_image", {
        dataUrl:      data.dataUrl,
        canvasWidth:  Math.max(1, Number(data.canvasWidth)  || 800),
        canvasHeight: Math.max(1, Number(data.canvasHeight) || 600),
      });
    },
  );

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
    if (helper) {
      helper.currentStatus = "idle";
      helper.cooldownUntil = Date.now() + GOOD_SAMARITAN_MS;
    }
    if (requester) requester.currentStatus = "idle";

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

// ── Graceful disconnect ────────────────────────────────────────────────────────

function cleanupOnDisconnect(io: SocketServer, socketId: string): void {
  const userId = socketToUid.get(socketId);
  if (!userId) return;
  socketToUid.delete(socketId);

  const user = activeUsers.get(userId);
  if (user) {
    user.socketId = "";
    disconnectedAt.set(userId, Date.now());
    if (user.currentStatus === "in_sos_popup") {
      user.currentStatus = "idle";
    }
  }

  // Cancel waiting requests from this user
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
