import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit,
  serverTimestamp, Timestamp, addDoc, arrayUnion, arrayRemove,
  increment, writeBatch, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface StudyPhase {
  type: "study" | "break";
  label: string;
  durationMins: number;
}

export type RoomStatus = "waiting" | "active" | "paused" | "finished";

export type RoomTheme = "classic" | "night";

export interface Room {
  id: string;
  title: string;
  subject: string;
  description: string;
  isPrivate: boolean;
  password: string | null;
  hostUid: string;
  hostName: string;
  hostGrade: number;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  status: RoomStatus;
  maxParticipants: number;
  studyFlow: StudyPhase[];
  currentPhaseIndex: number;
  timerStartedAt: Timestamp | null;
  pausedRemaining: number | null;
  participantCount: number;
  ambientSound: string;
  inviteCode: string;
  theme: RoomTheme;
  /** Seconds each user must wait between messages. 0 = no cooldown. Default: 10 */
  chatCooldownSecs?: number;
  /** Whether chat is enabled. Default: true */
  chatEnabled?: boolean;
  /** Host-pinned announcement shown at the top of chat for all participants. */
  pinnedAnnouncement?: string | null;
}

export interface RoomParticipant {
  uid: string;
  name: string;
  grade: number;
  photoURL: string | null;
  joinedAt: Timestamp | null;
  lastSeen: Timestamp | null;
  isHost: boolean;
  studyMinsInRoom: number;
  /** Server timestamp written when this participant enters a study phase; cleared on pause/break/leave. */
  studyStartedAt: Timestamp | null;
  isActive: boolean;
}

/**
 * Compute a participant's live study minutes deterministically from Firestore data.
 * Uses studyStartedAt (server timestamp) so every device shows the same value.
 */
export function getLiveStudyMins(p: RoomParticipant): number {
  const base = p.studyMinsInRoom ?? 0;
  if (!p.studyStartedAt) return base;
  const extraSecs = Math.max(0, (Date.now() - p.studyStartedAt.toMillis()) / 1000);
  return base + Math.floor(extraSecs / 60);
}

export interface Vote {
  id: string;
  description: string;
  type: "extend" | "break" | "skip_break" | "end" | "custom" | "pause" | "unpause" | "kick" | "remove_host"
      | "enable_slow_mode" | "disable_slow_mode" | "disable_chat" | "enable_chat";
  addMinutes?: number;
  cooldownSecs?: number;
  targetUid?: string;
  targetName?: string;
  createdByUid: string;
  createdByName: string;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  status: "active" | "passed" | "failed" | "expired";
  yesVoters: string[];
  noVoters: string[];
  totalParticipants: number;
}

export interface RoomMessage {
  id: string;
  uid: string;
  name: string;
  text?: string;
  emoji?: string;
  createdAt: Timestamp | null;
  type: "message" | "reaction" | "system";
}

// ── Presence constants ────────────────────────────────────────────────────────
// A participant is considered "stale" if their lastSeen is older than this.
// Raised to 3 min so Firestore presence writes can drop from 60 s → 2 min (2× savings).
// Ghost-user window: a crashed/closed tab appears online for at most 3 min.
const STALE_THRESHOLD_MS = 360_000; // 6 minutes — allows up to two missed presence writes

export function isParticipantActive(p: RoomParticipant): boolean {
  if (!p.lastSeen) return true; // just joined, no lastSeen yet
  return Date.now() - p.lastSeen.toMillis() < STALE_THRESHOLD_MS;
}

// ── Timer Helpers ─────────────────────────────────────────────────────────────

export function getRemainingSeconds(room: Room): number {
  const phase = room.studyFlow[room.currentPhaseIndex];
  if (!phase) return 0;
  const totalSeconds = phase.durationMins * 60;
  if (room.status === "waiting") return totalSeconds;
  if (room.status === "finished") return 0;
  if (room.status === "paused") return room.pausedRemaining ?? totalSeconds;
  if (!room.timerStartedAt) return totalSeconds;
  const elapsed = (Date.now() - room.timerStartedAt.toMillis()) / 1000;
  const base = room.pausedRemaining ?? totalSeconds;
  return Math.max(0, base - elapsed);
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Password hashing ──────────────────────────────────────────────────────────
// Private room passwords are never stored in plaintext.
// We hash with SHA-256 via the Web Crypto API (available in all modern browsers
// and Node 16+). The hash is stored in Firestore; the plaintext never leaves
// the client. Because studyRooms are public-read in Firestore rules (needed so
// the lobby can list rooms), any plaintext password would be trivially visible
// to anyone querying the collection directly — the hash prevents that.
export async function hashRoomPassword(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain.trim());
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Room CRUD ─────────────────────────────────────────────────────────────────

export async function createRoom(data: {
  title: string;
  subject: string;
  description: string;
  isPrivate: boolean;
  password?: string;
  hostUid: string;
  hostName: string;
  hostGrade: number;
  maxParticipants: number;
  studyFlow: StudyPhase[];
  ambientSound: string;
  theme?: RoomTheme;
}): Promise<string> {
  const roomRef = doc(collection(db, "studyRooms"));
  const room: Record<string, unknown> = {
    title: data.title,
    subject: data.subject,
    description: data.description,
    isPrivate: data.isPrivate,
    password: (data.isPrivate && data.password) ? await hashRoomPassword(data.password) : null,
    hostUid: data.hostUid,
    hostName: data.hostName,
    hostGrade: data.hostGrade,
    maxParticipants: data.maxParticipants,
    studyFlow: data.studyFlow,
    ambientSound: data.ambientSound,
    theme: data.theme ?? "classic",
    status: "waiting" as RoomStatus,
    currentPhaseIndex: 0,
    timerStartedAt: null,
    pausedRemaining: null,
    participantCount: 0,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    inviteCode: generateInviteCode(),
  };
  await setDoc(roomRef, room);
  return roomRef.id;
}

/**
 * Join a room.
 * Writes participant doc first (always allowed by rules), then tries to
 * increment participantCount. If the count update is blocked by Firestore
 * rules (e.g. older rule set), the join still succeeds — count will be
 * corrected by the host's periodic purge sweep.
 */
export async function joinRoom(roomId: string, participant: {
  uid: string;
  name: string;
  grade: number;
  isHost: boolean;
  photoURL?: string | null;
}): Promise<void> {
  const pRef = doc(db, "studyRooms", roomId, "participants", participant.uid);

  // Check whether a participant doc already exists so we can decide whether
  // to count this as a fresh join or a reconnect (page refresh / tab reopen).
  const existing = await getDoc(pRef);
  const isNewJoin = !existing.exists();

  if (isNewJoin) {
    // Brand-new join: write full document and increment the room count.
    await setDoc(pRef, {
      uid:            participant.uid,
      name:           participant.name,
      grade:          participant.grade,
      isHost:         participant.isHost,
      photoURL:       participant.photoURL ?? null,
      joinedAt:       serverTimestamp(),
      lastSeen:       serverTimestamp(),
      studyMinsInRoom: 0,
      isActive:       true,
    });
    try {
      await updateDoc(doc(db, "studyRooms", roomId), { participantCount: increment(1) });
    } catch {
      // Non-fatal — host sweep corrects the count periodically
    }
  } else {
    // Reconnect (refresh / tab reopen): only freshen presence fields.
    // Do NOT increment participantCount — user was already counted.
    await updateDoc(pRef, {
      lastSeen:  serverTimestamp(),
      isHost:    participant.isHost,
      photoURL:  participant.photoURL ?? null,
      isActive:  true,
    });
  }
}

/**
 * Leave a room. If this is the last participant:
 *   1. Marks status → "finished" immediately (hides from lobby).
 *   2. Sets pendingDeleteAt 60 s in the future.
 *   3. Schedules a client-side timer to call deleteRoomCascade after 60 s.
 */
export async function leaveRoom(roomId: string, uid: string, studyMinsInRoom: number): Promise<void> {
  try {
    const roomRef    = doc(db, "studyRooms", roomId);
    const roomSnap   = await getDoc(roomRef);
    const currentCount = roomSnap.exists() ? (roomSnap.data().participantCount ?? 1) : 1;
    const isLastPerson = currentCount <= 1;

    // Delete own participant doc (always allowed by rules: own uid)
    await deleteDoc(doc(db, "studyRooms", roomId, "participants", uid));

    try {
      if (isLastPerson) {
        const deleteAt = Timestamp.fromMillis(Date.now() + 60_000);
        await updateDoc(roomRef, {
          participantCount: 0,
          status:           "finished",
          timerStartedAt:   null,
          pendingDeleteAt:  deleteAt,
        });
        // Best-effort client-side cascade: fires if the user keeps the tab open for 60 s.
        // Rooms are also deleted by sweepZombieRooms when other users browse the lobby.
        setTimeout(() => deleteRoomCascade(roomId), 62_000);
      } else {
        await updateDoc(roomRef, { participantCount: increment(-1) });
      }
    } catch {
      // Non-fatal — zombie filter hides the room from the lobby
    }
  } catch (err) {
    console.warn("[Room] leaveRoom error (non-fatal):", err);
  }

  if (studyMinsInRoom > 0) {
    try {
      await setDoc(doc(collection(db, "studyRoomSessions")), {
        roomId, uid, studyMins: studyMinsInRoom, leftAt: serverTimestamp(),
      });
    } catch {}
  }
}

export async function updatePresence(roomId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "studyRooms", roomId, "participants", uid), {
      lastSeen: serverTimestamp(), isActive: true,
    });
  } catch {}
}

/**
 * Purge stale participants (lastSeen > 90s ago) from Firestore.
 * Called periodically by the host. Also corrects participantCount.
 */
export async function purgeStaleParticipants(roomId: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, "studyRooms", roomId, "participants"));
    if (snap.empty) {
      // No participants at all — mark room finished
      try {
        await updateDoc(doc(db, "studyRooms", roomId), {
          participantCount: 0, status: "finished", timerStartedAt: null,
        });
      } catch {}
      return;
    }

    const now = Date.now();
    const staleUids: string[] = [];
    let activeCount = 0;

    for (const d of snap.docs) {
      const data = d.data() as RoomParticipant;
      if (data.lastSeen && now - data.lastSeen.toMillis() > STALE_THRESHOLD_MS) {
        staleUids.push(d.id);
      } else {
        activeCount++;
      }
    }

    if (staleUids.length === 0 && activeCount === snap.docs.length) return;

    // Delete stale participant docs (host can delete any participant doc per rules)
    if (staleUids.length > 0) {
      const batch = writeBatch(db);
      for (const uid of staleUids) {
        batch.delete(doc(db, "studyRooms", roomId, "participants", uid));
      }
      await batch.commit();
    }

    // If the host was among the stale participants, transfer host to the oldest active member
    const roomSnap = await getDoc(doc(db, "studyRooms", roomId)).catch(() => null);
    if (roomSnap?.exists()) {
      const roomData = roomSnap.data();
      const currentHostUid: string = roomData.hostUid ?? "";
      if (staleUids.includes(currentHostUid) && activeCount > 0) {
        const activeParts = snap.docs
          .map(d => ({ uid: d.id, ...d.data() } as RoomParticipant))
          .filter(p => !staleUids.includes(p.uid))
          .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0));
        if (activeParts.length > 0) {
          await transferHost(roomId, currentHostUid, activeParts[0].uid, activeParts[0].name).catch(() => {});
        }
      }
    }

    // Correct participantCount to match actual active participants
    try {
      if (activeCount === 0) {
        const deleteAt = Timestamp.fromMillis(Date.now() + 60_000);
        await updateDoc(doc(db, "studyRooms", roomId), {
          participantCount: 0, status: "finished", timerStartedAt: null,
          pendingDeleteAt: deleteAt,
        });
        setTimeout(() => deleteRoomCascade(roomId), 62_000);
      } else {
        await updateDoc(doc(db, "studyRooms", roomId), {
          participantCount: activeCount,
        });
      }
    } catch {}

    if (staleUids.length > 0) {
      console.log(`[Room] Purged ${staleUids.length} stale participant(s) from ${roomId}`);
    }
  } catch (err) {
    console.warn("[Room] purgeStaleParticipants error:", err);
  }
}

// ── Host Controls ─────────────────────────────────────────────────────────────

export async function startTimer(roomId: string): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "active", timerStartedAt: serverTimestamp(), pausedRemaining: null,
  });
}

export async function pauseTimer(roomId: string, remainingSeconds: number): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "paused", timerStartedAt: null, pausedRemaining: remainingSeconds,
  });
}

export async function resumeTimer(roomId: string, remainingSeconds: number): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "active", timerStartedAt: serverTimestamp(), pausedRemaining: remainingSeconds,
  });
}

export async function skipPhase(roomId: string, room: Room): Promise<void> {
  const nextIndex = room.currentPhaseIndex + 1;
  if (nextIndex >= room.studyFlow.length) {
    await updateDoc(doc(db, "studyRooms", roomId), {
      status: "finished", timerStartedAt: null, pausedRemaining: null,
    });
    return;
  }
  // Start the next phase fresh: null out pausedRemaining so getRemainingSeconds
  // uses the full phase duration rather than a stale leftover value.
  await updateDoc(doc(db, "studyRooms", roomId), {
    currentPhaseIndex: nextIndex,
    status:            "active",
    timerStartedAt:    serverTimestamp(),
    pausedRemaining:   null,
  });
}

export async function endRoom(roomId: string): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "finished", timerStartedAt: null,
  });
}

export async function setPinnedAnnouncement(roomId: string, text: string | null): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    pinnedAnnouncement: text ?? null,
  });
}

export async function restartRoom(roomId: string): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "waiting",
    currentPhaseIndex: 0,
    timerStartedAt: null,
    pausedRemaining: null,
  });
}

export async function advancePhase(roomId: string, room: Room): Promise<void> {
  await skipPhase(roomId, room);
}

// ── Voting ────────────────────────────────────────────────────────────────────

export async function createVote(roomId: string, vote: {
  description: string;
  type: Vote["type"];
  addMinutes?: number;
  targetUid?: string;
  targetName?: string;
  cooldownSecs?: number;
  createdByUid: string;
  createdByName: string;
  totalParticipants: number;
  expiresInSecs?: number;
}): Promise<string> {
  const voteRef = doc(collection(db, "studyRooms", roomId, "votes"));
  const expiresAt = new Date(Date.now() + (vote.expiresInSecs ?? 60) * 1000);
  await setDoc(voteRef, {
    description: vote.description,
    type: vote.type,
    addMinutes: vote.addMinutes ?? null,
    cooldownSecs: vote.cooldownSecs ?? null,
    targetUid: vote.targetUid ?? null,
    targetName: vote.targetName ?? null,
    createdByUid: vote.createdByUid,
    createdByName: vote.createdByName,
    totalParticipants: vote.totalParticipants,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    status: "active",
    yesVoters: [],
    noVoters: [],
  });
  return voteRef.id;
}

export async function castVote(roomId: string, voteId: string, uid: string, choice: "yes" | "no"): Promise<void> {
  const voteRef = doc(db, "studyRooms", roomId, "votes", voteId);
  const isYes = choice === "yes";
  await updateDoc(voteRef, {
    [isYes ? "yesVoters" : "noVoters"]: arrayUnion(uid),
    [isYes ? "noVoters" : "yesVoters"]: arrayRemove(uid),
  });
}

/**
 * Resolve a vote and apply its effect to the room.
 *
 * FIX: We execute the room action BEFORE marking the vote as resolved.
 * Previously, the vote status was set to "passed" first. If a non-host
 * client ran first it would mark the vote "passed" (Firestore allows this)
 * but the room-level write would fail silently (permission denied for non-host).
 * The host's subsequent resolveVote call would then see status !== "active"
 * and return early — so the room state NEVER updated.
 *
 * New order: execute room action first (host succeeds, others fail silently),
 * then mark vote as resolved (first writer wins, others fail silently).
 * The room is guaranteed to be updated by whoever has the write permission.
 */
export async function resolveVote(roomId: string, voteId: string, room: Room): Promise<void> {
  const voteRef = doc(db, "studyRooms", roomId, "votes", voteId);
  const snap = await getDoc(voteRef);
  if (!snap.exists()) return;
  const vote = snap.data() as Vote;

  // Allow re-execution if vote is already "passed" — the room action may
  // not have been applied yet (non-host marked it passed but couldn't write room).
  if (vote.status !== "active" && vote.status !== "passed") return;

  const yes = vote.yesVoters.length;
  const no  = vote.noVoters.length;
  const isExpired = vote.expiresAt && vote.expiresAt.toMillis() < Date.now();

  // ── DEMOCRATIC MAJORITY CHECK ─────────────────────────────────────────────
  // A vote passes only if YES has a STRICT majority of all active participants
  // (i.e. more than half). Using max(totalParticipants, yes+no) prevents the
  // count from going stale when participants leave mid-vote — whoever already
  // voted is always included in the denominator.
  // Example: 2 participants, 1 YES → 1*2=2 > max(2,1)=2 → FALSE. Correct.
  // Example: 3 participants, 2 YES → 2*2=4 > max(3,2)=3 → TRUE.  Correct.
  const effectiveTotal = Math.max(vote.totalParticipants, yes + no);
  const passed = vote.status === "passed" || yes * 2 > effectiveTotal;

  if (!passed) {
    // Vote did not pass — mark it resolved (failed or expired)
    if (vote.status === "active") {
      const failStatus = (isExpired && yes === 0 && no === 0) ? "expired" : "failed";
      await updateDoc(voteRef, { status: failStatus }).catch(() => {});
    }
    return;
  }

  // ── STEP 1: Execute room action (host succeeds; non-host fails silently) ──
  const roomRef = doc(db, "studyRooms", roomId);
  if (vote.type === "end") {
    await updateDoc(roomRef, { status: "finished", timerStartedAt: null }).catch(() => {});
  } else if (vote.type === "pause") {
    const remaining = getRemainingSeconds(room);
    await updateDoc(roomRef, { status: "paused", timerStartedAt: null, pausedRemaining: remaining }).catch(() => {});
  } else if (vote.type === "unpause") {
    const remaining = room.pausedRemaining ?? getRemainingSeconds(room);
    await updateDoc(roomRef, { status: "active", timerStartedAt: serverTimestamp(), pausedRemaining: remaining }).catch(() => {});
  } else if (vote.type === "extend" && vote.addMinutes) {
    const remaining = getRemainingSeconds(room);
    await updateDoc(roomRef, {
      pausedRemaining: remaining + vote.addMinutes * 60,
      timerStartedAt:  serverTimestamp(),
      status:          "active",
    }).catch(() => {});
  } else if (vote.type === "break") {
    const mins = vote.addMinutes ?? 10;
    const newFlow = [...room.studyFlow];
    newFlow.splice(room.currentPhaseIndex + 1, 0, { type: "break", label: "Voted Break", durationMins: mins });
    await updateDoc(roomRef, { studyFlow: newFlow }).catch(() => {});
    await skipPhase(roomId, { ...room, studyFlow: newFlow }).catch(() => {});
  } else if (vote.type === "skip_break") {
    await skipPhase(roomId, room).catch(() => {});
  } else if (vote.type === "kick" && vote.targetUid) {
    await kickParticipant(roomId, vote.targetUid, room).catch(() => {});
  } else if (vote.type === "enable_slow_mode") {
    const secs = vote.cooldownSecs ?? 10;
    await updateDoc(roomRef, { chatCooldownSecs: secs }).catch(() => {});
    await setDoc(doc(collection(db, "studyRooms", roomId, "messages")), {
      uid: "system", name: "System",
      text: `🐌 Slow mode enabled: 1 message every ${secs} seconds.`,
      type: "system", createdAt: serverTimestamp(),
    }).catch(() => {});
  } else if (vote.type === "disable_slow_mode") {
    await updateDoc(roomRef, { chatCooldownSecs: 0 }).catch(() => {});
    await setDoc(doc(collection(db, "studyRooms", roomId, "messages")), {
      uid: "system", name: "System",
      text: "💬 Slow mode disabled.",
      type: "system", createdAt: serverTimestamp(),
    }).catch(() => {});
  } else if (vote.type === "disable_chat") {
    await updateDoc(roomRef, { chatEnabled: false }).catch(() => {});
    await setDoc(doc(collection(db, "studyRooms", roomId, "messages")), {
      uid: "system", name: "System",
      text: "🔇 Chat has been disabled by vote.",
      type: "system", createdAt: serverTimestamp(),
    }).catch(() => {});
  } else if (vote.type === "enable_chat") {
    await updateDoc(roomRef, { chatEnabled: true }).catch(() => {});
    await setDoc(doc(collection(db, "studyRooms", roomId, "messages")), {
      uid: "system", name: "System",
      text: "💬 Chat has been re-enabled by vote.",
      type: "system", createdAt: serverTimestamp(),
    }).catch(() => {});
  } else if (vote.type === "remove_host") {
    const pSnap = await getDocs(collection(db, "studyRooms", roomId, "participants")).catch(() => null);
    if (pSnap) {
      const others = pSnap.docs
        .filter(d => d.id !== room.hostUid)
        .map(d => ({ uid: d.id, ...d.data() } as RoomParticipant))
        .filter(isParticipantActive)
        .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0));
      if (others.length > 0) {
        // Do NOT swallow this error — if the caller lacks host permission the
        // error propagates, the vote stays "active", and the host client retries.
        await transferHost(roomId, room.hostUid, others[0].uid, others[0].name);
      }
    }
  }

  // ── STEP 2: Mark vote as resolved (first writer wins; subsequent calls are no-ops) ──
  if (vote.status === "active") {
    await updateDoc(voteRef, { status: "passed" }).catch(() => {});
  }
}

export async function kickParticipant(roomId: string, targetUid: string, room: Room): Promise<void> {
  try {
    await deleteDoc(doc(db, "studyRooms", roomId, "participants", targetUid));
    try {
      await updateDoc(doc(db, "studyRooms", roomId), { participantCount: increment(-1) });
    } catch {}
    // Send a system message
    try {
      await setDoc(doc(collection(db, "studyRooms", roomId, "messages")), {
        uid: "system", name: "System",
        text: `A participant was removed by democratic vote.`,
        type: "system", createdAt: serverTimestamp(),
      });
    } catch {}
  } catch (err) {
    console.warn("[Room] kickParticipant error:", err);
  }
}

/** Correct the stored participantCount field when it drifts from reality.
 * Any active participant may call this — writes are idempotent and cheap. */
export async function syncParticipantCount(roomId: string, count: number): Promise<void> {
  try {
    await updateDoc(doc(db, "studyRooms", roomId), { participantCount: count });
  } catch { /* non-critical — host purge will also correct on next tick */ }
}

// ── Chat / Reactions ──────────────────────────────────────────────────────────

export async function sendMessage(roomId: string, msg: {
  uid: string;
  name: string;
  text?: string;
  emoji?: string;
  type: "message" | "reaction" | "system";
}): Promise<void> {
  const payload: Record<string, unknown> = {
    uid: msg.uid, name: msg.name, type: msg.type, createdAt: serverTimestamp(),
  };
  if (msg.text !== undefined) payload.text = msg.text;
  if (msg.emoji !== undefined) payload.emoji = msg.emoji;
  await setDoc(doc(collection(db, "studyRooms", roomId, "messages")), payload);
}

// ── Realtime Listeners ────────────────────────────────────────────────────────

export function subscribeRoom(roomId: string, cb: (room: Room | null) => void) {
  return onSnapshot(doc(db, "studyRooms", roomId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Room) : null);
  });
}

/**
 * Subscribe to participants.
 * Filters stale ones (lastSeen > 90s) client-side for instant effect.
 * No orderBy — avoids needing a Firestore composite index.
 */
export function subscribeParticipants(roomId: string, cb: (ps: RoomParticipant[]) => void) {
  return onSnapshot(
    collection(db, "studyRooms", roomId, "participants"),
    (snap) => {
      const active = snap.docs
        .map(d => d.data() as RoomParticipant)
        .filter(isParticipantActive)
        // Sort by joinedAt client-side (null = just joined = first)
        .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0));
      cb(active);
    },
    (err) => {
      // Permission denied: silently return empty list (user may not be signed in)
      if (err.code === "permission-denied") { cb([]); return; }
      console.warn("[Room] subscribeParticipants error:", err);
    }
  );
}

export function subscribeActiveVotes(roomId: string, cb: (votes: Vote[]) => void) {
  return onSnapshot(
    query(collection(db, "studyRooms", roomId, "votes"), where("status", "==", "active"), limit(5)),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vote))),
    (err) => {
      if (err.code === "permission-denied") { cb([]); return; }
      console.warn("[Room] subscribeActiveVotes error:", err);
    }
  );
}

export function subscribeMessages(roomId: string, cb: (msgs: RoomMessage[]) => void) {
  return onSnapshot(
    query(collection(db, "studyRooms", roomId, "messages"), orderBy("createdAt", "asc"), limit(100)),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomMessage))),
    (err) => {
      if (err.code === "permission-denied") { cb([]); return; }
      console.warn("[Room] subscribeMessages error:", err);
    }
  );
}

/**
 * One-time fetch of the most recent 50 chat messages.
 * Used on room join to populate history — WebSocket delivers everything
 * after that, so we don't need an ongoing onSnapshot listener.
 */
export async function getRecentMessages(roomId: string): Promise<RoomMessage[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "studyRooms", roomId, "messages"), orderBy("createdAt", "asc"), limit(50))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomMessage));
  } catch {
    return [];
  }
}

export async function isParticipant(roomId: string, uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "studyRooms", roomId, "participants", uid));
    return snap.exists();
  } catch {
    return false;
  }
}

// ── Shared public-rooms subscription (singleton cache) ───────────────────────
// Multiple components (StudyRooms page + Dashboard widget) share ONE listener.
// This eliminates duplicate Firestore connections that caused stream errors.

type RoomsCb = (rooms: Room[]) => void;
let _roomsCache: Room[] | null = null;
let _roomsCbs: Set<RoomsCb> = new Set();
let _roomsUnsub: (() => void) | null = null;

export function subscribePublicRooms(cb: RoomsCb): () => void {
  _roomsCbs.add(cb);

  // Deliver cached data immediately for instant renders (no Firestore round-trip)
  if (_roomsCache !== null) {
    const cached = _roomsCache;
    setTimeout(() => { if (_roomsCbs.has(cb)) cb(cached); }, 0);
  }

  // Start shared Firestore listener if not already running
  if (!_roomsUnsub) {
    _roomsUnsub = onSnapshot(
      query(
        collection(db, "studyRooms"),
        where("status", "in", ["waiting", "active", "paused"]),
        limit(20),
      ),
      (snap) => {
        const now = Date.now();
        _roomsCache = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Room))
          .filter(r => {
            // Hide expired rooms
            if (r.expiresAt && r.expiresAt.toMillis() <= now) return false;
            // Hide zombie rooms: active/paused but nobody is there
            if (r.participantCount <= 0 && r.status !== "waiting") return false;
            return true;
          })
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
          .slice(0, 40);
        for (const fn of _roomsCbs) fn(_roomsCache!);
      },
      (err) => {
        console.warn("[Room] subscribePublicRooms error:", err);
      }
    );
  }

  return () => {
    _roomsCbs.delete(cb);
    if (_roomsCbs.size === 0) {
      _roomsUnsub?.();
      _roomsUnsub = null;
      _roomsCache = null;
    }
  };
}

// ── Study Time Sync ───────────────────────────────────────────────────────────

/** NPT (Nepal Time) = UTC + 5:45 */
const NPT_MS = (5 * 60 + 45) * 60 * 1000;
function getNptDate(): string {
  return new Date(Date.now() + NPT_MS).toISOString().slice(0, 10);
}

/**
 * Sync study minutes earned in a study room to:
 *   1. users/{uid}  — totalStudyTime, todayStudyTime, weeklyStudyTime (leaderboard)
 *   2. study_logs/{uid_date} — studyMinutes (report card)
 *
 * Uses server-side increment() for totalStudyTime/weeklyStudyTime/studyMinutes so
 * each sync is ATOMIC — no stale-cache reads that would silently overwrite previous
 * increments and keep the total stuck at 1.
 * todayStudyTime is handled separately: same-day → increment(), new day → reset.
 */
export async function syncStudyTimeToLeaderboard(uid: string, additionalMins: number): Promise<void> {
  if (additionalMins <= 0 || !uid) return;
  const mins  = Math.round(additionalMins);
  const today = getNptDate();

  // ── 1. users/{uid} ────────────────────────────────────────────────────────
  try {
    const userRef  = doc(db, "users", uid);
    // Only read lastActiveDate — fine if slightly stale (just for day-reset logic)
    const snap       = await getDoc(userRef);
    const lastActive = snap.exists() ? ((snap.data().lastActiveDate as string) ?? "") : "";
    const sameDay    = lastActive === today;

    // Use setDoc+merge so this works even if the user doc doesn't exist yet.
    // increment() is supported inside setDoc({merge:true}) just like updateDoc.
    await setDoc(userRef, {
      totalStudyTime:  increment(mins),          // atomic — avoids stale-cache overwrite
      weeklyStudyTime: increment(mins),          // atomic
      todayStudyTime:  sameDay ? increment(mins) : mins,  // reset if new day
      lastActiveDate:  today,
    }, { merge: true });
  } catch (err) {
    console.warn("[StudyRoom] users sync:", err);
  }

  // ── 2. study_logs/{uid_date} ───────────────────────────────────────────────
  try {
    const logRef  = doc(db, "study_logs", `${uid}_${today}`);
    const logSnap = await getDoc(logRef);
    if (logSnap.exists()) {
      await updateDoc(logRef, { studyMinutes: increment(mins) }); // atomic
    } else {
      await setDoc(logRef, {
        uid, date: today,
        studyMinutes:   mins,
        tasksCompleted: 0,
        notesViewed:    0,
      });
    }
  } catch (err) {
    console.warn("[StudyRoom] study_logs sync:", err);
  }
}

/**
 * Update the participant doc's studyMinsInRoom so the classroom avatar
 * badge shows live study time to everyone in the room.
 *
 * CRITICAL: we also reset studyStartedAt to serverTimestamp() here.
 * getLiveStudyMins = studyMinsInRoom (banked total) + floor(elapsed since studyStartedAt).
 * Without resetting studyStartedAt, elapsed keeps growing from the original phase start,
 * so the total gets double-counted (e.g. 1 banked + 1 elapsed = 2 instead of 1).
 */
export async function updateParticipantStudyMins(
  roomId: string, uid: string, studyMins: number,
): Promise<void> {
  try {
    await updateDoc(doc(db, "studyRooms", roomId, "participants", uid), {
      studyMinsInRoom: Math.round(studyMins),
      studyStartedAt:  serverTimestamp(), // reset elapsed clock to prevent double-count
    });
  } catch {} // non-critical, ignore silently
}

/**
 * Mark the moment a participant enters a study phase.
 * Written as a server timestamp so any device can derive live study minutes
 * deterministically via: studyMinsInRoom + floor((now - studyStartedAt) / 60).
 */
export async function updateParticipantStudyStart(roomId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "studyRooms", roomId, "participants", uid), {
      studyStartedAt: serverTimestamp(),
    });
  } catch {}
}

/**
 * Bank accumulated study minutes and clear the running-clock marker.
 * Called when leaving a study phase (pause, break, leave).
 */
export async function updateParticipantStudyEnd(
  roomId: string, uid: string, totalMinsInRoom: number,
): Promise<void> {
  try {
    await updateDoc(doc(db, "studyRooms", roomId, "participants", uid), {
      studyMinsInRoom: Math.round(totalMinsInRoom),
      studyStartedAt:  null,
    });
  } catch {}
}

// ── Transfer Host ─────────────────────────────────────────────────────────────

export async function transferHost(roomId: string, oldHostUid: string, newHostUid: string, newHostName: string): Promise<void> {
  // This write requires host/admin permission — will THROW for non-hosts so that
  // resolveVote keeps the vote "active" until the actual host client runs it.
  await updateDoc(doc(db, "studyRooms", roomId), { hostUid: newHostUid, hostName: newHostName });
  // These participant writes are best-effort — errors are non-fatal.
  await updateDoc(doc(db, "studyRooms", roomId, "participants", newHostUid), { isHost: true }).catch(() => {});
  await updateDoc(doc(db, "studyRooms", roomId, "participants", oldHostUid), { isHost: false }).catch(() => {});
  // System message
  try {
    await setDoc(doc(collection(db, "studyRooms", roomId, "messages")), {
      uid: "system", name: "System",
      text: `${newHostName} is now the host.`,
      type: "system", createdAt: serverTimestamp(),
    });
  } catch {}
}

// ── Admin: cascade delete a room and all its subcollections ───────────────────

export async function deleteRoomCascade(roomId: string): Promise<void> {
  // Attempt to delete subcollection documents one collection at a time.
  // Each is wrapped individually — if the rules block deleting other users'
  // participant docs, that's OK; deleting the room document itself is enough
  // to make the room invisible from all queries.
  const subcolls = ["participants", "votes", "messages"];
  for (const sub of subcolls) {
    try {
      const snap = await getDocs(collection(db, "studyRooms", roomId, sub));
      if (snap.docs.length > 0) {
        // Delete in batches of 400 to stay under Firestore limits
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch {
      // Subcollection delete blocked by rules — non-fatal.
      // Orphaned subcollection data is invisible without the parent doc.
    }
  }
  // This is the critical delete — removes the room from all queries
  await deleteDoc(doc(db, "studyRooms", roomId));
}

/**
 * Admin: sweep all zombie/stale rooms and mark them finished.
 * For each non-finished room, checks the actual participants subcollection
 * to detect rooms where everyone left without properly leaving (tab close, etc).
 * Returns number of rooms cleaned up.
 */
export async function sweepZombieRooms(): Promise<number> {
  const now = Date.now();
  let count = 0;

  // ── Phase 1: hard-delete finished rooms past pendingDeleteAt ───────────────
  try {
    const finishedSnap = await getDocs(
      query(collection(db, "studyRooms"), where("status", "==", "finished"))
    );
    for (const d of finishedSnap.docs) {
      const data = d.data();
      const deleteAt: Timestamp | undefined = data.pendingDeleteAt;
      if (deleteAt && deleteAt.toMillis() <= now) {
        await deleteRoomCascade(d.id);
        count++;
      }
    }
  } catch (err) {
    console.warn("[Room] sweepZombieRooms phase-1 error:", err);
  }

  // ── Phase 2: mark stale active/waiting/paused rooms as finished ────────────
  const snap = await getDocs(
    query(collection(db, "studyRooms"), where("status", "in", ["waiting", "active", "paused"]))
  );

  for (const d of snap.docs) {
    const data = d.data();

    // Immediately mark expired rooms finished
    if (data.expiresAt && data.expiresAt.toMillis() <= now) {
      try {
        const deleteAt = Timestamp.fromMillis(now + 60_000);
        await updateDoc(d.ref, { status: "finished", participantCount: 0, timerStartedAt: null, pendingDeleteAt: deleteAt });
        count++;
      } catch {}
      continue;
    }

    // Check actual participants subcollection for active users
    try {
      const pSnap = await getDocs(collection(db, "studyRooms", d.id, "participants"));

      if (pSnap.empty) {
        // Absolutely no participants — definitely a zombie
        await updateDoc(d.ref, { status: "finished", participantCount: 0, timerStartedAt: null });
        count++;
        continue;
      }

      // Count participants whose lastSeen is recent enough to be "alive"
      const activePCount = pSnap.docs.filter(p => {
        const pd = p.data();
        // If no lastSeen, treat as recently joined (give benefit of doubt for < 5 min old docs)
        if (!pd.lastSeen) {
          const joinedAt = pd.joinedAt;
          return joinedAt && (now - joinedAt.toMillis() < 5 * 60 * 1000);
        }
        return now - pd.lastSeen.toMillis() < STALE_THRESHOLD_MS;
      }).length;

      if (activePCount === 0) {
        // All participants are stale / ghosts
        await updateDoc(d.ref, { status: "finished", participantCount: 0, timerStartedAt: null });
        count++;
      } else if (activePCount !== data.participantCount) {
        // Fix the stored count to match reality
        try {
          await updateDoc(d.ref, { participantCount: activePCount });
        } catch {}
      }
    } catch {
      // Read may fail (permissions) — skip this room
    }
  }
  return count;
}

export const SUBJECTS = [
  "Science", "Mathematics", "English", "Nepali", "Social Studies",
  "Optional Mathematics", "Computer Science", "Accounts", "Economics",
  "Physics", "Chemistry", "Biology", "General Science", "Other",
];

export const AMBIENT_SOUNDS = [
  { id: "none",       label: "No Sound",      emoji: "🔇" },
  { id: "rain",       label: "Rain",           emoji: "🌧️" },
  { id: "lofi",       label: "Lo-Fi",          emoji: "🎵" },
  { id: "lofirain",   label: "Lo-Fi + Rain",   emoji: "🎶" },
  { id: "cafe",       label: "Café",           emoji: "☕" },
  { id: "forest",     label: "Forest",         emoji: "🌿" },
  { id: "whitenoise", label: "White Noise",    emoji: "🔊" },
];
