import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Room, RoomParticipant, subscribeRoom, subscribeParticipants,
  leaveRoom, updatePresence, syncStudyTimeToLeaderboard,
  pauseTimer, resumeTimer, startTimer, skipPhase, endRoom,
  advancePhase, getRemainingSeconds, transferHost, purgeStaleParticipants,
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
  const { user } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [studyMinsInSession, setStudyMinsInSession] = useState(0);

  const studySecondsRef  = useRef(0);
  const syncedMinsRef    = useRef(0);
  const lastSyncRef      = useRef(Date.now());
  const roomRef          = useRef<Room | null>(null);
  const advancingRef     = useRef(false);
  const unsubRoomRef     = useRef<(() => void) | null>(null);
  const unsubPartsRef    = useRef<(() => void) | null>(null);
  // Track if we've already fired the leave on unload
  const unloadedRef      = useRef(false);

  roomRef.current = room;

  const isHost = !!(room && user && room.hostUid === user.uid);

  // ── Room + participant subscriptions ────────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId) return;
    unsubRoomRef.current?.();
    unsubPartsRef.current?.();

    unsubRoomRef.current = subscribeRoom(activeRoomId, (r) => {
      setRoom(r);
      if (r) setRemainingSeconds(getRemainingSeconds(r));
    });
    unsubPartsRef.current = subscribeParticipants(activeRoomId, setParticipants);

    return () => {
      unsubRoomRef.current?.();
      unsubPartsRef.current?.();
    };
  }, [activeRoomId]);

  // ── Timer tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const r = roomRef.current;
      if (!r) return;

      const rem = getRemainingSeconds(r);
      setRemainingSeconds(rem);

      if (r.status === "active") {
        const phase = r.studyFlow[r.currentPhaseIndex];
        if (phase?.type === "study") {
          studySecondsRef.current += 1;
        }

        // Sync every 60 seconds
        const now = Date.now();
        if (now - lastSyncRef.current >= 60_000 && user) {
          const minsToSync = Math.floor(studySecondsRef.current / 60);
          if (minsToSync > 0) {
            syncStudyTimeToLeaderboard(user.uid, minsToSync).catch(() => {});
            syncedMinsRef.current += minsToSync;
            studySecondsRef.current -= minsToSync * 60;
          }
          lastSyncRef.current = now;
        }

        setStudyMinsInSession(syncedMinsRef.current + Math.floor(studySecondsRef.current / 60));

        // Host auto-advances phase at 0
        if (rem <= 0 && r.currentPhaseIndex < r.studyFlow.length - 1 && !advancingRef.current) {
          if (user && r.hostUid === user.uid) {
            advancingRef.current = true;
            advancePhase(r.id, r).catch(() => {}).finally(() => { advancingRef.current = false; });
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  // ── Presence heartbeat — every 15s for fast disconnect detection ─────────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    const interval = setInterval(() => {
      updatePresence(activeRoomId, user.uid).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, [activeRoomId, user]);

  // ── Host: purge stale participants every 60s ─────────────────────────────────
  useEffect(() => {
    if (!activeRoomId || !user || !isHost) return;
    const interval = setInterval(() => {
      purgeStaleParticipants(activeRoomId).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [activeRoomId, user, isHost]);

  // ── Sync + leave on tab/window close ─────────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    unloadedRef.current = false;

    const handleUnload = () => {
      if (unloadedRef.current) return;
      unloadedRef.current = true;

      const remainderMins = Math.floor(studySecondsRef.current / 60);
      if (remainderMins > 0) {
        const body = JSON.stringify({ uid: user.uid, mins: remainderMins });
        navigator.sendBeacon?.("/api/study/sync", body);
      }
      // Best-effort: remove participant doc on unload
      // (sendBeacon can't do Firestore, so we do a synchronous XHR or just rely
      //  on stale-participant cleanup to handle it within 90s)
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Re-ping presence immediately when tab comes back
        updatePresence(activeRoomId, user.uid).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeRoomId, user]);

  // ── Public API ───────────────────────────────────────────────────────────────
  const joinActiveRoom = useCallback((roomId: string) => {
    studySecondsRef.current = 0;
    syncedMinsRef.current   = 0;
    lastSyncRef.current     = Date.now();
    advancingRef.current    = false;
    unloadedRef.current     = false;
    setStudyMinsInSession(0);
    setActiveRoomId(roomId);
  }, []);

  const leaveActiveRoom = useCallback(async () => {
    if (!activeRoomId || !user) return;

    const remainderMins = Math.floor(studySecondsRef.current / 60);
    if (remainderMins > 0) {
      await syncStudyTimeToLeaderboard(user.uid, remainderMins).catch(() => {});
    }
    const totalSessionMins = syncedMinsRef.current + remainderMins;

    const r = roomRef.current;
    if (r && r.hostUid === user.uid && participants.length > 1) {
      const next = participants.find(p => p.uid !== user.uid);
      if (next) await transferHost(activeRoomId, next.uid, next.name).catch(() => {});
    }

    await leaveRoom(activeRoomId, user.uid, totalSessionMins).catch(() => {});

    unsubRoomRef.current?.();
    unsubPartsRef.current?.();
    studySecondsRef.current = 0;
    syncedMinsRef.current   = 0;
    setStudyMinsInSession(0);
    setActiveRoomId(null);
    setRoom(null);
    setParticipants([]);
  }, [activeRoomId, user, participants]);

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
