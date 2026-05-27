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

export interface Room {
  id: string;
  title: string;
  subject: string;
  description: string;
  isPrivate: boolean;
  password?: string;
  hostUid: string;
  hostName: string;
  hostGrade: number;
  createdAt: Timestamp | null;
  status: RoomStatus;
  maxParticipants: number;
  studyFlow: StudyPhase[];
  currentPhaseIndex: number;
  timerStartedAt: Timestamp | null;
  pausedRemaining: number | null;
  participantCount: number;
  ambientSound: string;
  inviteCode: string;
}

export interface RoomParticipant {
  uid: string;
  name: string;
  grade: number;
  photoURL?: string;
  joinedAt: Timestamp | null;
  lastSeen: Timestamp | null;
  isHost: boolean;
  studyMinsInRoom: number;
  isActive: boolean;
}

export interface Vote {
  id: string;
  description: string;
  type: "extend" | "break" | "skip_break" | "end" | "custom";
  addMinutes?: number;
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

// ── Timer Helpers ──────────────────────────────────────────────────────────────

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

// ── Firestore CRUD ─────────────────────────────────────────────────────────────

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
}): Promise<string> {
  const roomRef = doc(collection(db, "studyRooms"));
  const room: Omit<Room, "id"> = {
    ...data,
    status: "waiting",
    currentPhaseIndex: 0,
    timerStartedAt: null,
    pausedRemaining: null,
    participantCount: 0,
    createdAt: serverTimestamp() as unknown as Timestamp,
    inviteCode: generateInviteCode(),
  };
  await setDoc(roomRef, room);
  return roomRef.id;
}

export async function joinRoom(roomId: string, participant: {
  uid: string;
  name: string;
  grade: number;
  isHost: boolean;
}): Promise<void> {
  const batch = writeBatch(db);
  const participantRef = doc(db, "studyRooms", roomId, "participants", participant.uid);
  batch.set(participantRef, {
    ...participant,
    photoURL: null,
    joinedAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
    studyMinsInRoom: 0,
    isActive: true,
  });
  const roomRef = doc(db, "studyRooms", roomId);
  batch.update(roomRef, { participantCount: increment(1) });
  await batch.commit();
}

export async function leaveRoom(roomId: string, uid: string, studyMinsInRoom: number): Promise<void> {
  const batch = writeBatch(db);
  const participantRef = doc(db, "studyRooms", roomId, "participants", uid);
  batch.delete(participantRef);
  const roomRef = doc(db, "studyRooms", roomId);
  batch.update(roomRef, { participantCount: increment(-1) });
  await batch.commit();

  // Log session history
  if (studyMinsInRoom > 0) {
    const sessionRef = doc(collection(db, "studyRoomSessions"));
    await setDoc(sessionRef, {
      roomId,
      uid,
      studyMins: studyMinsInRoom,
      leftAt: serverTimestamp(),
    });
  }
}

export async function updatePresence(roomId: string, uid: string): Promise<void> {
  try {
    const participantRef = doc(db, "studyRooms", roomId, "participants", uid);
    await updateDoc(participantRef, { lastSeen: serverTimestamp(), isActive: true });
  } catch {}
}

// ── Host Controls ──────────────────────────────────────────────────────────────

export async function startTimer(roomId: string): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "active",
    timerStartedAt: serverTimestamp(),
    pausedRemaining: null,
  });
}

export async function pauseTimer(roomId: string, remainingSeconds: number): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "paused",
    timerStartedAt: null,
    pausedRemaining: remainingSeconds,
  });
}

export async function resumeTimer(roomId: string, remainingSeconds: number): Promise<void> {
  // Set timerStartedAt so elapsed = 0 and remaining = pausedRemaining
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "active",
    timerStartedAt: serverTimestamp(),
    pausedRemaining: remainingSeconds,
  });
}

export async function skipPhase(roomId: string, room: Room): Promise<void> {
  const nextIndex = room.currentPhaseIndex + 1;
  if (nextIndex >= room.studyFlow.length) {
    await updateDoc(doc(db, "studyRooms", roomId), {
      status: "finished",
      timerStartedAt: null,
      pausedRemaining: null,
    });
    return;
  }
  const nextDuration = room.studyFlow[nextIndex].durationMins * 60;
  await updateDoc(doc(db, "studyRooms", roomId), {
    currentPhaseIndex: nextIndex,
    status: "active",
    timerStartedAt: serverTimestamp(),
    pausedRemaining: nextDuration,
  });
}

export async function endRoom(roomId: string): Promise<void> {
  await updateDoc(doc(db, "studyRooms", roomId), {
    status: "finished",
    timerStartedAt: null,
  });
}

export async function advancePhase(roomId: string, room: Room): Promise<void> {
  await skipPhase(roomId, room);
}

// ── Voting ─────────────────────────────────────────────────────────────────────

export async function createVote(roomId: string, vote: {
  description: string;
  type: Vote["type"];
  addMinutes?: number;
  createdByUid: string;
  createdByName: string;
  totalParticipants: number;
}): Promise<string> {
  const voteRef = doc(collection(db, "studyRooms", roomId, "votes"));
  const expiresAt = new Date(Date.now() + 30_000); // 30s to vote
  await setDoc(voteRef, {
    ...vote,
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
  const snap = await getDoc(voteRef);
  if (!snap.exists()) return;
  const vote = snap.data() as Vote;
  const isYes = choice === "yes";
  const addField = isYes ? "yesVoters" : "noVoters";
  const removeField = isYes ? "noVoters" : "yesVoters";
  await updateDoc(voteRef, {
    [addField]: arrayUnion(uid),
    [removeField]: arrayRemove(uid),
  });
}

export async function resolveVote(roomId: string, voteId: string, room: Room): Promise<void> {
  const voteRef = doc(db, "studyRooms", roomId, "votes", voteId);
  const snap = await getDoc(voteRef);
  if (!snap.exists()) return;
  const vote = snap.data() as Vote;
  const yes = vote.yesVoters.length;
  const no = vote.noVoters.length;
  const passed = yes > no || (yes === no && yes > 0);
  await updateDoc(voteRef, { status: passed ? "passed" : "failed" });

  if (!passed) return;

  const roomRef = doc(db, "studyRooms", roomId);
  if (vote.type === "end") {
    await updateDoc(roomRef, { status: "finished", timerStartedAt: null });
  } else if (vote.type === "extend" && vote.addMinutes) {
    const remaining = getRemainingSeconds(room);
    const extended = remaining + vote.addMinutes * 60;
    await updateDoc(roomRef, {
      pausedRemaining: extended,
      timerStartedAt: serverTimestamp(),
      status: "active",
    });
  } else if (vote.type === "break") {
    const mins = vote.addMinutes ?? 10;
    const newFlow = [...room.studyFlow];
    newFlow.splice(room.currentPhaseIndex + 1, 0, { type: "break", label: "Voted Break", durationMins: mins });
    await updateDoc(roomRef, { studyFlow: newFlow });
    await skipPhase(roomId, { ...room, studyFlow: newFlow });
  } else if (vote.type === "skip_break") {
    await skipPhase(roomId, room);
  }
}

// ── Chat ───────────────────────────────────────────────────────────────────────

export async function sendMessage(roomId: string, msg: {
  uid: string;
  name: string;
  text?: string;
  emoji?: string;
  type: "message" | "reaction" | "system";
}): Promise<void> {
  const msgRef = doc(collection(db, "studyRooms", roomId, "messages"));
  await setDoc(msgRef, { ...msg, createdAt: serverTimestamp() });
}

// ── Realtime Listeners ─────────────────────────────────────────────────────────

export function subscribeRoom(roomId: string, cb: (room: Room | null) => void) {
  return onSnapshot(doc(db, "studyRooms", roomId), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    cb({ id: snap.id, ...snap.data() } as Room);
  });
}

export function subscribeParticipants(roomId: string, cb: (ps: RoomParticipant[]) => void) {
  return onSnapshot(
    query(collection(db, "studyRooms", roomId, "participants"), orderBy("joinedAt", "asc")),
    (snap) => cb(snap.docs.map(d => d.data() as RoomParticipant)),
  );
}

export function subscribeActiveVotes(roomId: string, cb: (votes: Vote[]) => void) {
  return onSnapshot(
    query(collection(db, "studyRooms", roomId, "votes"), where("status", "==", "active"), limit(5)),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vote))),
  );
}

export function subscribeMessages(roomId: string, cb: (msgs: RoomMessage[]) => void) {
  return onSnapshot(
    query(collection(db, "studyRooms", roomId, "messages"), orderBy("createdAt", "asc"), limit(50)),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomMessage))),
  );
}

export async function isParticipant(roomId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "studyRooms", roomId, "participants", uid));
  return snap.exists();
}

export function subscribePublicRooms(cb: (rooms: Room[]) => void) {
  // Only filter by status (single-field query — no composite index needed).
  // isPrivate is filtered client-side to avoid needing a composite index.
  return onSnapshot(
    query(
      collection(db, "studyRooms"),
      where("status", "in", ["waiting", "active", "paused"]),
      limit(60),
    ),
    (snap) => {
      const rooms = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Room))
        .filter(r => !r.isPrivate);
      rooms.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      cb(rooms.slice(0, 30));
    },
  );
}

// ── Study Time Sync ────────────────────────────────────────────────────────────
// Sync study room time to the user's main leaderboard stats

export async function syncStudyTimeToLeaderboard(uid: string, additionalMins: number): Promise<void> {
  if (additionalMins <= 0) return;
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      totalStudyTime: increment(additionalMins),
      todayStudyTime: increment(additionalMins),
    });
  } catch (err) {
    console.warn("[StudyRoom] Failed to sync study time:", err);
  }
}

// ── Transfer Host ──────────────────────────────────────────────────────────────

export async function transferHost(roomId: string, newHostUid: string, newHostName: string): Promise<void> {
  const batch = writeBatch(db);
  const roomRef = doc(db, "studyRooms", roomId);
  batch.update(roomRef, { hostUid: newHostUid, hostName: newHostName });
  const participantRef = doc(db, "studyRooms", roomId, "participants", newHostUid);
  batch.update(participantRef, { isHost: true });
  await batch.commit();
}

export async function getPublicRoomsOnce(): Promise<Room[]> {
  const snap = await getDocs(
    query(
      collection(db, "studyRooms"),
      where("isPrivate", "==", false),
      where("status", "in", ["waiting", "active", "paused"]),
      orderBy("createdAt", "desc"),
      limit(30),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
}

export const SUBJECTS = [
  "Science", "Mathematics", "English", "Nepali", "Social Studies",
  "Optional Mathematics", "Computer Science", "Accounts", "Economics",
  "Physics", "Chemistry", "Biology", "General Science", "Other",
];

export const AMBIENT_SOUNDS = [
  { id: "none",        label: "No Sound",      emoji: "🔇" },
  { id: "rain",        label: "Rain",           emoji: "🌧️" },
  { id: "cafe",        label: "Café Ambience",  emoji: "☕" },
  { id: "forest",      label: "Forest",         emoji: "🌿" },
  { id: "whitenoise",  label: "White Noise",    emoji: "🔊" },
  { id: "lofi",        label: "Lo-Fi Beats",    emoji: "🎵" },
];
