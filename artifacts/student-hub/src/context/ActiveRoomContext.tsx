import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Room, RoomParticipant, subscribeRoom, subscribeParticipants,
  leaveRoom, updatePresence, syncStudyTimeToLeaderboard, updateParticipantStudyMins,
  updateParticipantStudyStart, updateParticipantStudyEnd,
  pauseTimer, resumeTimer, startTimer, skipPhase, endRoom,
  advancePhase, getRemainingSeconds, transferHost, purgeStaleParticipants,
  getLiveStudyMins, isParticipantActive,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRoomStudying(r: Room | null): boolean {
  if (!r || r.status !== "active") return false;
  const phase = r.studyFlow[r.currentPhaseIndex];
  return phase?.type === "study";
}

/** Save study minutes via the backend (handles streak correctly). Falls back
 *  to client-side Firestore write if the API call fails. */
async function saveStudyMinutes(uid: string, getIdToken: () => Promise<string>, mins: number): Promise<void> {
  if (mins <= 0) return;
  try {
    const token = await getIdToken();
    const res = await fetch("/api/study/save", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ minutes: mins }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // Fallback: client-side Firestore sync (no streak update, but preserves study time)
    console.warn("[ActiveRoom] Backend sync failed — falling back to Firestore:", err);
    await syncStudyTimeToLeaderboard(uid, mins).catch(() => {});
  }
}

export function ActiveRoomProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [room,         setRoom]          = useState<Room | null>(null);
  const [participants, setParticipants]  = useState<RoomParticipant[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [studyMinsInSession, setStudyMinsInSession] = useState(0);

  // ── Wall-clock study tracking ─────────────────────────────────────────────
  // studyWallStartRef  — Date.now() when the current study segment began (null = not studying)
  // studyAccumulatedRef — seconds already elapsed from past study segments this session
  // lastSyncedSecsRef  — total seconds already sent to the backend
  const studyWallStartRef   = useRef<number | null>(null);
  const studyAccumulatedRef = useRef(0);
  const lastSyncedSecsRef   = useRef(0);
  const lastSyncTimeRef     = useRef(Date.now());
  const lastBadgeSyncRef    = useRef(Date.now());
  const prevStudyingRef     = useRef(false);

  const remainingSecsRef   = useRef(0);  // always fresh for onHostPause
  const roomRef            = useRef<Room | null>(null);
  const participantsRef    = useRef<RoomParticipant[]>([]);
  const prevPhaseRef       = useRef<string | null>(null);
  const prevStatusRef      = useRef<string | null>(null);
  const advancingRef       = useRef(false);
  const unsubRoomRef       = useRef<(() => void) | null>(null);
  const unsubPartsRef      = useRef<(() => void) | null>(null);
  const unloadedRef        = useRef(false);

  roomRef.current         = room;
  participantsRef.current = participants;

  const isHost = !!(room && user && room.hostUid === user.uid);

  /** Total study seconds for the current session (live calculation). */
  const getTotalStudySeconds = useCallback((): number => {
    const base = studyAccumulatedRef.current;
    const wallStart = studyWallStartRef.current;
    if (wallStart === null) return base;
    return base + Math.max(0, (Date.now() - wallStart) / 1000);
  }, []);

  // ── Room + participant subscriptions ─────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId) return;
    unsubRoomRef.current?.();
    unsubPartsRef.current?.();

    unsubRoomRef.current = subscribeRoom(activeRoomId, (r) => {
      // Detect study-phase transitions to manage wall-clock tracking
      const nowStudying = isRoomStudying(r);

      if (!prevStudyingRef.current && nowStudying) {
        // Entered study phase — start wall clock AND write server timestamp to Firestore
        studyWallStartRef.current = Date.now();
        if (user) {
          updateParticipantStudyStart(activeRoomId, user.uid).catch(() => {});
        }
      } else if (prevStudyingRef.current && !nowStudying) {
        // Left study phase (paused / break / finished) — bank elapsed time and clear Firestore marker
        if (studyWallStartRef.current !== null) {
          studyAccumulatedRef.current += Math.max(0, (Date.now() - studyWallStartRef.current) / 1000);
          studyWallStartRef.current = null;
        }
        if (user) {
          const bankedMins = Math.floor(studyAccumulatedRef.current / 60);
          updateParticipantStudyEnd(activeRoomId, user.uid, bankedMins).catch(() => {});
        }
      }
      prevStudyingRef.current = nowStudying;

      setRoom(r);
      if (r) {
        const rem = getRemainingSeconds(r);
        setRemainingSeconds(rem);
        remainingSecsRef.current = rem;
      }
    });
    unsubPartsRef.current = subscribeParticipants(activeRoomId, setParticipants);

    return () => {
      unsubRoomRef.current?.();
      unsubPartsRef.current?.();
    };
  }, [activeRoomId]);

  // ── Phase-change bells ───────────────────────────────────────────────────
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

    if (prevStatusRef.current === "waiting" && status === "active") playBell("study");
    prevStatusRef.current = status;
  }, [room]);

  // ── Timer tick — runs for EVERY participant ───────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const r = roomRef.current;
      if (!r) return;

      // Recalculate remaining display seconds from wall clock (drift-free)
      const rem = getRemainingSeconds(r);
      setRemainingSeconds(rem);
      remainingSecsRef.current = rem;

      // Live study minute display — prefer Firestore participant data for cross-device
      // consistency (same source as avatar badges). Fall back to local wall-clock
      // on the first few ticks before Firestore data has arrived.
      // Use participantsRef (not the stale closure) so we always see fresh data.
      const myParticipant = user ? participantsRef.current.find(p => p.uid === user.uid) : undefined;
      const displayMins = (myParticipant && myParticipant.studyStartedAt != null)
        ? getLiveStudyMins(myParticipant)
        : Math.floor(getTotalStudySeconds() / 60);
      setStudyMinsInSession(displayMins);

      if (r.status === "active") {
        const now = Date.now();

        // Push live study time to participant badge every 30 s so other
        // members see fresh minutes without waiting a full minute.
        if (now - lastBadgeSyncRef.current >= 30_000 && user) {
          const totalMins = Math.floor(getTotalStudySeconds() / 60);
          updateParticipantStudyMins(r.id, user.uid, totalMins).catch(() => {});
          lastBadgeSyncRef.current = now;
        }

        // Sync study minutes to backend leaderboard every 60 s
        if (now - lastSyncTimeRef.current >= 60_000 && user) {
          const totalSecs  = getTotalStudySeconds();
          const minsEarned = Math.floor(totalSecs / 60);
          const minsToSync = minsEarned - Math.floor(lastSyncedSecsRef.current / 60);
          if (minsToSync >= 1) {
            lastSyncedSecsRef.current = minsEarned * 60;
            saveStudyMinutes(user.uid, () => user.getIdToken(), minsToSync).catch(() => {});
          }
          lastSyncTimeRef.current = now;
        }

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
  }, [user, getTotalStudySeconds]);

  // ── Presence heartbeat — every 15 s ──────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    const interval = setInterval(() => {
      updatePresence(activeRoomId, user.uid).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, [activeRoomId, user]);

  // ── Host: purge stale participants every 60 s ─────────────────────────────
  useEffect(() => {
    if (!activeRoomId || !user || !isHost) return;
    const interval = setInterval(() => {
      purgeStaleParticipants(activeRoomId).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [activeRoomId, user, isHost]);

  // ── Non-host: claim host if current host is stale (> 90 s since lastSeen) ──
  // Fixes the "host transfer broken on disconnect" bug. Only the host runs
  // purgeStaleParticipants, so if the host crashes or closes their tab without
  // calling leaveActiveRoom, no one transfers the host and the room is stuck.
  // All non-host participants now poll every 30 s and the oldest active one
  // calls the backend /api/study/claim-host endpoint (Admin SDK bypasses rules).
  useEffect(() => {
    if (!activeRoomId || !user || isHost) return;
    const STALE_MS = 90_000;

    const interval = setInterval(async () => {
      const r    = roomRef.current;
      const pArr = participantsRef.current; // always-fresh via ref — avoids interval restart on each join/leave
      if (!r || r.status === "finished" || r.status === "waiting") return;

      // Check if the current host is stale
      const hostParticipant = pArr.find(p => p.uid === r.hostUid);
      const isHostStale = !hostParticipant ||
        (hostParticipant.lastSeen && Date.now() - hostParticipant.lastSeen.toMillis() > STALE_MS);
      if (!isHostStale) return;

      // Only the oldest active non-host participant should claim
      const sorted = pArr
        .filter(p => p.uid !== r.hostUid && isParticipantActive(p))
        .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0));
      if (sorted[0]?.uid !== user.uid) return;

      try {
        const token = await user.getIdToken();
        await fetch("/api/study/claim-host", {
          method:  "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ roomId: activeRoomId }),
        });
      } catch { /* silent — will retry next tick */ }
    }, 30_000);

    return () => clearInterval(interval);
  }, [activeRoomId, user, isHost]);

  // ── Kick detection — if our participant doc disappears, auto-leave ─────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    const isStillIn = participants.some(p => p.uid === user.uid);
    if (participants.length > 0 && !isStillIn) {
      studyWallStartRef.current   = null;
      studyAccumulatedRef.current = 0;
      lastSyncedSecsRef.current   = 0;
      setStudyMinsInSession(0);
      setActiveRoomId(null);
      setRoom(null);
      setParticipants([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  // ── Sync study time + leave on tab/window close ───────────────────────────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    unloadedRef.current = false;

    const handleUnload = () => {
      if (unloadedRef.current) return;
      unloadedRef.current = true;

      // Bank any in-progress study segment before computing remainder
      if (studyWallStartRef.current !== null) {
        studyAccumulatedRef.current += Math.max(0, (Date.now() - studyWallStartRef.current) / 1000);
        studyWallStartRef.current = null;
      }

      const totalSecs  = studyAccumulatedRef.current;
      const minsEarned = Math.floor(totalSecs / 60);
      const minsAlreadySynced = Math.floor(lastSyncedSecsRef.current / 60);
      const remainderMins = minsEarned - minsAlreadySynced;

      if (remainderMins > 0) {
        // Beacon can't carry auth headers — use client-side Firestore fallback
        navigator.sendBeacon?.("/api/study/sync-anon", JSON.stringify({ uid: user.uid, mins: remainderMins }));
      }

      try {
        fetch("/api/study/leave", {
          method:    "POST",
          headers:   { "Content-Type": "application/json" },
          body:      JSON.stringify({ roomId: activeRoomId, uid: user.uid }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* silent */ }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Re-ping presence immediately when tab comes back
        updatePresence(activeRoomId, user.uid).catch(() => {});

        // If we were studying, reset the wall-clock start to now (avoids counting
        // time when tab was in background and the browser might have throttled)
        if (studyWallStartRef.current !== null && roomRef.current && isRoomStudying(roomRef.current)) {
          // Bank time up to when tab was hidden
          const r = roomRef.current;
          const phaseTotal = (r.studyFlow[r.currentPhaseIndex]?.durationMins ?? 0) * 60;
          const elapsed    = getRemainingSeconds(r);
          // Clamp accumulated so it can't exceed the phase total
          const maxAccum   = phaseTotal - elapsed;
          studyAccumulatedRef.current = Math.min(getTotalStudySeconds(), Math.max(studyAccumulatedRef.current, maxAccum));
          studyWallStartRef.current = Date.now();
        }

        // Sync any outstanding whole minutes
        const totalSecs  = getTotalStudySeconds();
        const minsEarned = Math.floor(totalSecs / 60);
        const minsToSync = minsEarned - Math.floor(lastSyncedSecsRef.current / 60);
        if (minsToSync >= 1 && user) {
          lastSyncedSecsRef.current = minsEarned * 60;
          saveStudyMinutes(user.uid, () => user.getIdToken(), minsToSync).catch(() => {});
          lastSyncTimeRef.current = Date.now();
        }
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeRoomId, user, getTotalStudySeconds]);

  // ── Public API ────────────────────────────────────────────────────────────
  const joinActiveRoom = useCallback((roomId: string) => {
    studyWallStartRef.current   = null;
    studyAccumulatedRef.current = 0;
    lastSyncedSecsRef.current   = 0;
    lastSyncTimeRef.current     = Date.now();
    prevStudyingRef.current     = false;
    advancingRef.current        = false;
    unloadedRef.current         = false;
    prevPhaseRef.current        = null;
    prevStatusRef.current       = null;
    setStudyMinsInSession(0);
    setActiveRoomId(roomId);
  }, []);

  const leaveActiveRoom = useCallback(async () => {
    if (!activeRoomId || !user) return;

    // 1. Bank any in-progress study segment
    if (studyWallStartRef.current !== null) {
      studyAccumulatedRef.current += Math.max(0, (Date.now() - studyWallStartRef.current) / 1000);
      studyWallStartRef.current = null;
    }

    // 2. Sync remaining unsent study time through backend (streak-aware)
    const totalSecs  = studyAccumulatedRef.current;
    // Round up any partial minute ≥ 30 seconds so short sessions still count.
    const minsEarned = totalSecs >= 30
      ? Math.max(1, Math.floor(totalSecs / 60))
      : Math.floor(totalSecs / 60);
    const minsAlreadySynced = Math.floor(lastSyncedSecsRef.current / 60);
    const remainderMins = minsEarned - minsAlreadySynced;
    if (remainderMins > 0) {
      await saveStudyMinutes(user.uid, () => user.getIdToken(), remainderMins).catch(() => {});
    }
    const totalSessionMins = minsEarned;

    // Clear Firestore study-clock marker so other participants see accurate final value
    await updateParticipantStudyEnd(activeRoomId, user.uid, totalSessionMins).catch(() => {});

    // 3. Transfer host if needed (oldest active non-self participant)
    const r = roomRef.current;
    if (r && r.hostUid === user.uid && participants.length > 1) {
      const next = participants
        .filter(p => p.uid !== user.uid)
        .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))[0];
      if (next) {
        await transferHost(activeRoomId, user.uid, next.uid, next.name).catch(() => {});
      }
    }

    // 4. Remove from room
    await leaveRoom(activeRoomId, user.uid, totalSessionMins).catch(() => {});

    // 5. Cleanup
    unsubRoomRef.current?.();
    unsubPartsRef.current?.();
    studyWallStartRef.current   = null;
    studyAccumulatedRef.current = 0;
    lastSyncedSecsRef.current   = 0;
    setStudyMinsInSession(0);
    setActiveRoomId(null);
    setRoom(null);
    setParticipants([]);
  }, [activeRoomId, user, participants]);

  const onHostStart  = useCallback(async () => {
    if (activeRoomId) await startTimer(activeRoomId);
  }, [activeRoomId]);

  const onHostPause  = useCallback(async () => {
    if (activeRoomId) await pauseTimer(activeRoomId, remainingSecsRef.current);
  }, [activeRoomId]);

  const onHostResume = useCallback(async () => {
    if (activeRoomId && room) await resumeTimer(activeRoomId, room.pausedRemaining ?? remainingSecsRef.current);
  }, [activeRoomId, room]);

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
