import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Room, RoomParticipant, subscribeRoom, subscribeParticipants,
  leaveRoom, updatePresence, syncStudyTimeToLeaderboard, updateParticipantStudyMins,
  pauseTimer, resumeTimer, startTimer, skipPhase, endRoom,
  advancePhase, getRemainingSeconds, transferHost, purgeStaleParticipants,
} from "@/lib/studyRooms";
import { playBell } from "@/hooks/useAmbientSound";

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
  const [room,         setRoom]          = useState<Room | null>(null);
  const [participants, setParticipants]  = useState<RoomParticipant[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [studyMinsInSession, setStudyMinsInSession] = useState(0);

  const studySecondsRef  = useRef(0);
  const syncedMinsRef    = useRef(0);
  const lastSyncRef      = useRef(Date.now());
  const roomRef          = useRef<Room | null>(null);
  const prevPhaseRef     = useRef<string | null>(null); // tracks phase type for bell
  const prevStatusRef    = useRef<string | null>(null);
  const advancingRef     = useRef(false);
  const unsubRoomRef     = useRef<(() => void) | null>(null);
  const unsubPartsRef    = useRef<(() => void) | null>(null);
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

  // ── Phase-change bells ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!room) return;
    const phase  = room.studyFlow[room.currentPhaseIndex];
    const status = room.status;
    const phaseKey = `${room.currentPhaseIndex}-${status}`;

    if (prevPhaseRef.current !== null && prevPhaseRef.current !== phaseKey) {
      if (status === "active" && phase?.type === "study")  playBell("study");
      if (status === "active" && phase?.type === "break")  playBell("break");
    }
    prevPhaseRef.current = phaseKey;

    // Start bell when host starts
    if (prevStatusRef.current === "waiting" && status === "active") playBell("study");
    prevStatusRef.current = status;
  }, [room]);

  // ── Timer tick — runs for EVERY participant (not just host) ─────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const r = roomRef.current;
      if (!r) return;

      const rem = getRemainingSeconds(r);
      setRemainingSeconds(rem);

      // Accumulate study seconds for THIS user individually
      if (r.status === "active") {
        const phase = r.studyFlow[r.currentPhaseIndex];
        if (phase?.type === "study") {
          studySecondsRef.current += 1;
        }

        // Sync to leaderboard + update classroom badge every 60s
        const now = Date.now();
        if (now - lastSyncRef.current >= 60_000 && user) {
          const minsToSync = Math.floor(studySecondsRef.current / 60);
          if (minsToSync > 0) {
            syncStudyTimeToLeaderboard(user.uid, minsToSync).catch(() => {});
            syncedMinsRef.current   += minsToSync;
            studySecondsRef.current -= minsToSync * 60;
          }
          // Push live study time to participant doc so other members see badge
          const totalMins = syncedMinsRef.current + Math.floor(studySecondsRef.current / 60);
          updateParticipantStudyMins(r.id, user.uid, totalMins).catch(() => {});
          lastSyncRef.current = now;
        }

        setStudyMinsInSession(syncedMinsRef.current + Math.floor(studySecondsRef.current / 60));

        // Only the current host auto-advances the phase at 0
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

  // ── Presence heartbeat — every 15s ──────────────────────────────────────────
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

  // ── Kicked detection — if our participant doc disappears, auto-leave ──────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    // Already handled by subscribeParticipants — if our own uid disappears we leave
    const currentUid = user.uid;
    const unsub = unsubPartsRef.current;
    // We monitor via the participants state below
    return () => { void unsub; };
  }, [activeRoomId, user]);

  useEffect(() => {
    if (!activeRoomId || !user) return;
    const isStillIn = participants.some(p => p.uid === user.uid);
    if (participants.length > 0 && !isStillIn) {
      // We were kicked — perform clean local leave without Firestore writes
      studySecondsRef.current = 0;
      syncedMinsRef.current   = 0;
      setStudyMinsInSession(0);
      setActiveRoomId(null);
      setRoom(null);
      setParticipants([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  // ── Sync study time + leave on tab/window close ───────────────────────────────
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
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Re-ping presence immediately when tab comes back
        updatePresence(activeRoomId, user.uid).catch(() => {});
        // Also sync any accumulated study time
        const minsToSync = Math.floor(studySecondsRef.current / 60);
        if (minsToSync > 0) {
          syncStudyTimeToLeaderboard(user.uid, minsToSync).catch(() => {});
          syncedMinsRef.current   += minsToSync;
          studySecondsRef.current -= minsToSync * 60;
          lastSyncRef.current = Date.now();
        }
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
    prevPhaseRef.current    = null;
    prevStatusRef.current   = null;
    setStudyMinsInSession(0);
    setActiveRoomId(roomId);
  }, []);

  const leaveActiveRoom = useCallback(async () => {
    if (!activeRoomId || !user) return;

    // 1. Sync remaining study time
    const remainderMins = Math.floor(studySecondsRef.current / 60);
    if (remainderMins > 0) {
      await syncStudyTimeToLeaderboard(user.uid, remainderMins).catch(() => {});
    }
    const totalSessionMins = syncedMinsRef.current + remainderMins;

    // 2. Transfer host if needed (oldest active non-self participant)
    const r = roomRef.current;
    if (r && r.hostUid === user.uid && participants.length > 1) {
      const next = participants
        .filter(p => p.uid !== user.uid)
        .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))[0];
      if (next) {
        await transferHost(activeRoomId, user.uid, next.uid, next.name).catch(() => {});
      }
    }

    // 3. Remove from room
    await leaveRoom(activeRoomId, user.uid, totalSessionMins).catch(() => {});

    // 4. Cleanup
    unsubRoomRef.current?.();
    unsubPartsRef.current?.();
    studySecondsRef.current = 0;
    syncedMinsRef.current   = 0;
    setStudyMinsInSession(0);
    setActiveRoomId(null);
    setRoom(null);
    setParticipants([]);
  }, [activeRoomId, user, participants]);

  const onHostStart  = useCallback(async () => {
    if (activeRoomId) await startTimer(activeRoomId);
  }, [activeRoomId]);

  const onHostPause  = useCallback(async () => {
    if (activeRoomId) await pauseTimer(activeRoomId, remainingSeconds);
  }, [activeRoomId, remainingSeconds]);

  const onHostResume = useCallback(async () => {
    if (activeRoomId && room) await resumeTimer(activeRoomId, room.pausedRemaining ?? remainingSeconds);
  }, [activeRoomId, room, remainingSeconds]);

  const onHostSkip   = useCallback(async () => {
    if (activeRoomId && room) await skipPhase(activeRoomId, room);
  }, [activeRoomId, room]);

  const onHostEnd    = useCallback(async () => {
    if (activeRoomId) await endRoom(activeRoomId);
  }, [activeRoomId]);

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
