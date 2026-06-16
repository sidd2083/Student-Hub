import type { Server as HTTPServer } from "http";
import { Server as SocketServer } from "socket.io";
import { getAdminDb } from "./firebase-admin";
import { logger } from "./logger";
import { stats } from "./stats";
import { initSosHandlers } from "./sos";

interface WsMember {
  uid: string;
  name: string;
  socketId: string;
  lastSeen: number;
}

// In-memory room roster: roomId → Map<uid, WsMember>
const roomRoster = new Map<string, Map<string, WsMember>>();
// Per-user send rate-limit: uid → last send timestamp
const msgLastSent = new Map<string, number>();
const MSG_MIN_INTERVAL_MS = 500;

function getRoster(roomId: string): Map<string, WsMember> {
  if (!roomRoster.has(roomId)) roomRoster.set(roomId, new Map());
  return roomRoster.get(roomId)!;
}

function removeFromRoster(roomId: string, uid: string) {
  const roster = roomRoster.get(roomId);
  if (!roster) return;
  roster.delete(uid);
  if (roster.size === 0) roomRoster.delete(roomId);
}

function pushLiveStats() {
  let users = 0;
  for (const r of roomRoster.values()) users += r.size;
  stats.setLive(roomRoster.size, users);
}

export function initSocketServer(httpServer: HTTPServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? true, credentials: true },
    transports: ["websocket", "polling"],
    pingTimeout: 30_000,
    pingInterval: 10_000,
    // Allow up to 5 MB messages (base64 avatars can be large)
    maxHttpBufferSize: 5 * 1024 * 1024,
  });

  io.on("connection", (socket) => {
    let roomId: string | null = null;
    let uid: string | null = null;
    let displayName: string | null = null;

    stats.incWsConnections();

    // ── Join ───────────────────────────────────────────────────────────────────
    socket.on("join-room", (data: { roomId?: string; uid?: string; name?: string }) => {
      if (!data?.roomId || !data?.uid || !data?.name) return;
      roomId      = String(data.roomId).slice(0, 64);
      uid         = String(data.uid).slice(0, 128);
      displayName = String(data.name).slice(0, 80);

      socket.join(roomId);
      const roster = getRoster(roomId);
      roster.set(uid, { uid, name: displayName, socketId: socket.id, lastSeen: Date.now() });
      pushLiveStats();

      logger.info({ roomId, uid, members: roster.size }, "[WS] joined");
    });

    // ── Heartbeat ──────────────────────────────────────────────────────────────
    socket.on("heartbeat", () => {
      if (!roomId || !uid) return;
      const m = getRoster(roomId).get(uid);
      if (m) m.lastSeen = Date.now();
    });

    // ── Chat message ───────────────────────────────────────────────────────────
    socket.on("send-message", async (data: { text?: string }) => {
      if (!roomId || !uid || !displayName) return;
      const text = String(data?.text ?? "").slice(0, 500).trim();
      if (!text) return;

      // Per-user rate limit (server-side guard)
      const now = Date.now();
      if (now - (msgLastSent.get(uid) ?? 0) < MSG_MIN_INTERVAL_MS) return;
      msgLastSent.set(uid, now);

      const payload = {
        id: `ws_${now}_${uid.slice(0, 6)}`,
        uid,
        name: displayName,
        text,
        type: "message" as const,
        createdAtMs: now,
      };

      // Relay to everyone in the room immediately
      io.to(roomId).emit("chat-message", payload);
      stats.incWsMessages();

      // Persist to Firestore for history — fire-and-forget, never blocks relay
      const db = getAdminDb();
      if (db) {
        import("firebase-admin/firestore")
          .then(({ FieldValue }) =>
            db
              .collection("studyRooms")
              .doc(roomId!)
              .collection("messages")
              .add({ uid, name: displayName, text, type: "message", createdAt: FieldValue.serverTimestamp() })
          )
          .catch(() => {});
      }
    });

    // ── Live study-min badge (relay only — replaces 30s Firestore write) ─────────
    // Each client emits every 30 s while studying; server broadcasts to the room.
    // Eliminates onSnapshot cascade: 10 users × 100 rooms × 9 reads/write → 0.
    socket.on("update-study-mins", (data: { mins?: number }) => {
      if (!roomId || !uid) return;
      const mins = Math.max(0, Math.round(Number(data?.mins ?? 0)));
      io.to(roomId).emit("participant-mins-update", { uid, mins });
    });

    // ── Emoji reaction (ephemeral — no Firestore write) ────────────────────────
    socket.on("send-reaction", (data: { emoji?: string }) => {
      if (!roomId || !uid || !displayName) return;
      const emoji = String(data?.emoji ?? "").slice(0, 10).trim();
      if (!emoji) return;
      io.to(roomId).emit("reaction", { uid, name: displayName, emoji });
      stats.incWsReactions();
    });

    // ── Study Buddy request routing (zero Firestore cost) ─────────────────────
    // All request / accept / reject signals are routed directly to the target
    // user's socket via their socketId in the room roster — no DB writes needed.
    // Only the final setBuddyPair call (on accept, from the client) writes to Firestore.

    socket.on("buddy-request", (data: { targetUid?: string }) => {
      if (!roomId || !uid || !displayName) return;
      const targetUid = String(data?.targetUid ?? "").slice(0, 128);
      if (!targetUid || targetUid === uid) return;
      const target = getRoster(roomId).get(targetUid);
      if (!target) return;
      io.to(target.socketId).emit("buddy-invite", { fromUid: uid, fromName: displayName });
      logger.debug({ roomId, uid, targetUid }, "[WS] buddy-request");
    });

    socket.on("buddy-accept", (data: { targetUid?: string }) => {
      if (!roomId || !uid || !displayName) return;
      const targetUid = String(data?.targetUid ?? "").slice(0, 128);
      if (!targetUid) return;
      const target = getRoster(roomId).get(targetUid);
      if (!target) return;
      io.to(target.socketId).emit("buddy-accepted", { fromUid: uid, fromName: displayName });
    });

    socket.on("buddy-reject", (data: { targetUid?: string }) => {
      if (!roomId || !uid) return;
      const targetUid = String(data?.targetUid ?? "").slice(0, 128);
      if (!targetUid) return;
      const target = getRoster(roomId).get(targetUid);
      if (!target) return;
      io.to(target.socketId).emit("buddy-rejected", { fromUid: uid });
    });

    // ── Leave / disconnect ─────────────────────────────────────────────────────
    function handleLeave() {
      if (!roomId || !uid) return;
      removeFromRoster(roomId, uid);
      pushLiveStats();
      logger.info({ roomId, uid }, "[WS] left");
      roomId = null;
      uid = null;
      displayName = null;
    }

    socket.on("leave-room", handleLeave);
    socket.on("disconnect", handleLeave);

    // ── SOS Network handlers (zero-Firestore in-memory matching) ──────────
    initSosHandlers(io, socket);
  });

  logger.info("[WS] Socket.io server ready");
  return io;
}
