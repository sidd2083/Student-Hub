import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Room, RoomParticipant, subscribeRoom, subscribeParticipants,
  leaveRoom, updatePresence, syncStudyTimeToLeaderboard,
  pauseTimer, resumeTimer, startTimer, skipPhase, endRoom,
  advancePhase, getRemainingSeconds, transferHost,
} from "@/lib/studyRooms";

interface ActiveRoomContextType {
  activeRoomId: string | null;
  room: Room | null;
  participants: RoomParticipant[];
  isHost: boolean;
  remainingSeconds: number;
  studyMinsInSession: number;
  joinActiveRoom: (roomId: string) => void;
  leaveActiveRoom: () => Promise<void>;
  onHostStart: () => Promise<void>;
  onHostPause: () => Promise<void>;
  onHostResume: () => Promise<void>;
  onHostSkip: () => Promise<void>;
  onHostEnd: () => Promise<void>;
}

const ActiveRoomContext = createContext<ActiveRoomContextType | null>(null);

export function ActiveRoomProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [studyMinsInSession, setStudyMinsInSession] = useState(0);

  const studySecondsRef = useRef(0);
  const lastSyncRef = useRef(Date.now());
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRoomRef = useRef<(() => void) | null>(null);
  const unsubParticipantsRef = useRef<(() => void) | null>(null);
  const roomRef = useRef<Room | null>(null);

  roomRef.current = room;

  const isHost = !!(room && user && room.hostUid === user.uid);

  // ── Subscribe to room + participants ────────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId) return;

    unsubRoomRef.current?.();
    unsubParticipantsRef.current?.();

    unsubRoomRef.current = subscribeRoom(activeRoomId, (r) => {
      if (!r) {
        setRoom(null);
        return;
      }
      setRoom(r);
      setRemainingSeconds(getRemainingSeconds(r));
    });

    unsubParticipantsRef.current = subscribeParticipants(activeRoomId, setParticipants);

    return () => {
      unsubRoomRef.current?.();
      unsubParticipantsRef.current?.();
    };
  }, [activeRoomId]);

  // ── Local timer tick (client-side countdown, no Firestore writes) ────────────
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      const r = roomRef.current;
      if (!r) return;
      const rem = getRemainingSeconds(r);
      setRemainingSeconds(rem);

      // Track study seconds during active study phases
      if (r.status === "active") {
        const phase = r.studyFlow[r.currentPhaseIndex];
        if (phase?.type === "study") {
          studySecondsRef.current += 1;
          setStudyMinsInSession(Math.floor(studySecondsRef.current / 60));
        }

        // Sync study time to leaderboard every 5 minutes
        const now = Date.now();
        if (now - lastSyncRef.current >= 5 * 60_000 && user && studySecondsRef.current > 0) {
          const minsToSync = Math.floor(studySecondsRef.current / 60);
          syncStudyTimeToLeaderboard(user.uid, minsToSync).catch(() => {});
          studySecondsRef.current = 0;
          lastSyncRef.current = now;
        }

        // Auto-advance phase when timer hits 0
        if (rem <= 0 && r.currentPhaseIndex < r.studyFlow.length - 1) {
          // Only host should advance (prevents race conditions)
          if (user && r.hostUid === user.uid) {
            advancePhase(r.id, r).catch(() => {});
          }
        }
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [user]);

  // ── Presence heartbeat ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    presenceIntervalRef.current = setInterval(() => {
      updatePresence(activeRoomId, user.uid).catch(() => {});
    }, 30_000);
    return () => {
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
    };
  }, [activeRoomId, user]);

  // ── Leave on tab close ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    const handleUnload = () => {
      const mins = Math.floor(studySecondsRef.current / 60) + studyMinsInSession;
      // Best-effort sync before unload
      if (mins > 0) syncStudyTimeToLeaderboard(user.uid, mins).catch(() => {});
      leaveRoom(activeRoomId, user.uid, mins).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [activeRoomId, user, studyMinsInSession]);

  const joinActiveRoom = useCallback((roomId: string) => {
    setActiveRoomId(roomId);
    studySecondsRef.current = 0;
    setStudyMinsInSession(0);
    lastSyncRef.current = Date.now();
  }, []);

  const leaveActiveRoom = useCallback(async () => {
    if (!activeRoomId || !user) return;

    // Final sync
    const totalMins = Math.floor(studySecondsRef.current / 60) + studyMinsInSession;
    if (totalMins > 0) {
      await syncStudyTimeToLeaderboard(user.uid, totalMins).catch(() => {});
    }

    // If host and others remain, transfer host
    const r = roomRef.current;
    if (r && r.hostUid === user.uid && participants.length > 1) {
      const next = participants.find(p => p.uid !== user.uid);
      if (next) {
        await transferHost(activeRoomId, next.uid, next.name).catch(() => {});
      }
    }

    await leaveRoom(activeRoomId, user.uid, totalMins).catch(() => {});

    unsubRoomRef.current?.();
    unsubParticipantsRef.current?.();
    setActiveRoomId(null);
    setRoom(null);
    setParticipants([]);
    studySecondsRef.current = 0;
    setStudyMinsInSession(0);
  }, [activeRoomId, user, participants, studyMinsInSession]);

  const onHostStart  = useCallback(async () => { if (activeRoomId) await startTimer(activeRoomId); }, [activeRoomId]);
  const onHostPause  = useCallback(async () => { if (activeRoomId) await pauseTimer(activeRoomId, remainingSeconds); }, [activeRoomId, remainingSeconds]);
  const onHostResume = useCallback(async () => { if (activeRoomId && room) await resumeTimer(activeRoomId, room.pausedRemaining ?? remainingSeconds); }, [activeRoomId, room, remainingSeconds]);
  const onHostSkip   = useCallback(async () => { if (activeRoomId && room) await skipPhase(activeRoomId, room); }, [activeRoomId, room]);
  const onHostEnd    = useCallback(async () => { if (activeRoomId) await endRoom(activeRoomId); }, [activeRoomId]);

  return (
    <ActiveRoomContext.Provider value={{
      activeRoomId, room, participants, isHost, remainingSeconds,
      studyMinsInSession, joinActiveRoom, leaveActiveRoom,
      onHostStart, onHostPause, onHostResume, onHostSkip, onHostEnd,
    }}>
      {children}
    </ActiveRoomContext.Provider>
  );
}

export function useActiveRoom() {
  const ctx = useContext(ActiveRoomContext);
  if (!ctx) throw new Error("useActiveRoom must be used within ActiveRoomProvider");
  return ctx;
}
