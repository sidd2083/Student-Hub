import {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import { setInActiveRoom } from "@/lib/studyRoomState";
import { useAuth } from "@/context/AuthContext";
import {
  Room, RoomParticipant, subscribeRoom, subscribeParticipants,
  leaveRoom, updatePresence, syncStudyTimeToLeaderboard, updateParticipantStudyMins,
  updateParticipantStudyStart, updateParticipantStudyEnd,
  pauseTimer, resumeTimer, startTimer, skipPhase, endRoom, restartRoom,
  advancePhase, getRemainingSeconds, transferHost, purgeStaleParticipants,
  getLiveStudyMins, isParticipantActive, syncParticipantCount,
} from "@/lib/studyRooms";
import { playBell } from "@/hooks/useAmbientSound";
import { getSocket } from "@/lib/socket";

interface ActiveRoomContextType {
  activeRoomId: string | null;
  room: Room | null;
  participants: RoomParticipant[];
  isHost: boolean;
  wasKicked: boolean;
  joinActiveRoom: (roomId: string) => void;
  leaveActiveRoom: () => Promise<void>;
  onHostStart: () => Promise<void>;
  onHostPause: () => Promise<void>;
  onHostResume: () => Promise<void>;
  onHostSkip: () => Promise<void>;
  onHostEnd: () => Promise<void>;
  onHostRestart: () => Promise<void>;
  /** @deprecated use useRoomTimer() instead — avoids 1-second re-renders */
  remainingSeconds: number;
  /** @deprecated use useRoomTimer() instead — avoids 1-second re-renders */
  studyMinsInSession: number;
}

interface RoomTimerContextType {
  studyMinsInSession: number;
}

interface TimerDisplayContextType {
  remainingSeconds: number;
}

const ActiveRoomContext    = createContext<ActiveRoomContextType | null>(null);
const RoomTimerContext     = createContext<RoomTimerContextType>({ studyMinsInSession: 0 });
const TimerDisplayContext  = createContext<TimerDisplayContextType>({ remainingSeconds: 0 });

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
  const prevStudyMinsRef = useRef(0);
  const [wasKicked, setWasKicked] = useState(false);

  // ── Wall-clock study tracking ─────────────────────────────────────────────
  // studyWallStartRef  — Date.now() when the current study segment began (null = not studying)
  // studyAccumulatedRef — seconds already elapsed from past study segments this session
  // lastSyncedSecsRef  — total seconds already sent to the backend
  const studyWallStartRef   = useRef<number | null>(null);
  const studyAccumulatedRef = useRef(0);
  const lastSyncedSecsRef   = useRef(0);
  const lastSyncTimeRef     = useRef(Date.now());
  const lastBadgeSyncRef    = useRef(Date.now());
  const lastFsBadgeSyncRef  = useRef(0); // Firestore-only persistence (every 5 min)
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
  // Guards kick detection from firing when the user deliberately leaves.
  // Without this, leaveRoom() deletes the participant doc → Firestore snapshot
  // fires before unsubscription → kick detection marks wasKicked = true →
  // rejoining is blocked (wasKicked redirect fires before joinActiveRoom resets it).
  const isLeavingRef       = useRef(false);

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

    unsubPartsRef.current = subscribeParticipants(activeRoomId, (ps) => {
      // Merge Firestore data with in-memory WS study mins.
      // Badge writes were reduced 30 s → 5 min, so Firestore can lag.
      // "Keep the higher value" is safe: study mins only ever increase.
      setParticipants(prev => ps.map(p => {
        const mem = prev.find(e => e.uid === p.uid);
        return mem && (mem.studyMinsInRoom ?? 0) > (p.studyMinsInRoom ?? 0)
          ? { ...p, studyMinsInRoom: mem.studyMinsInRoom }
          : p;
      }));
      const r = roomRef.current;
      if (r && r.id === activeRoomId && ps.length > 0 && r.participantCount !== ps.length) {
        syncParticipantCount(activeRoomId, ps.length).catch(() => {});
      }
    });

    // WS: receive live badge updates from other room members (zero Firestore reads).
    // Updates participant state in-memory so ClassroomView shows fresh study mins
    // without waiting for a Firestore onSnapshot.
    // CRITICAL: also null out studyStartedAt in-memory. If we only update studyMinsInRoom
    // but leave studyStartedAt pointing to the original phase start, getLiveStudyMins
    // computes studyMinsInRoom (already includes elapsed) + elapsed_since_T0 = DOUBLED.
    // Nulling studyStartedAt makes getLiveStudyMins return studyMinsInRoom directly.
    const sock = getSocket();
    const onMinsUpdate = ({ uid: pUid, mins }: { uid: string; mins: number }) => {
      setParticipants(prev => prev.map(p =>
        p.uid === pUid ? { ...p, studyMinsInRoom: mins, studyStartedAt: null } : p
      ));
    };
    sock.on("participant-mins-update", onMinsUpdate);

    return () => {
      unsubRoomRef.current?.();
      unsubPartsRef.current?.();
      sock.off("participant-mins-update", onMinsUpdate);
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

      // ── Study time display — always use LOCAL wall-clock for self ───────────
      // getLiveStudyMins(myParticipant) is designed for OTHER participants' badges.
      // For the current user it causes doubling: after a WebSocket badge broadcast
      // sets studyMinsInRoom = X (already includes elapsed), studyStartedAt is still
      // the original T0, so getLiveStudyMins returns X + elapsed_since_T0 = 2X.
      // getTotalStudySeconds() is immune: during study it accumulates wall-clock secs;
      // during breaks studyWallStartRef is null so it returns the banked total.
      // This is always correct regardless of Firestore/WS sync state.
      // Only update React state when the minute value actually changes — avoids
      // re-rendering every StudyRoomLive consumer on every 1-second tick.
      const newMins = Math.floor(getTotalStudySeconds() / 60);
      if (newMins !== prevStudyMinsRef.current) {
        prevStudyMinsRef.current = newMins;
        setStudyMinsInSession(newMins);
      }

      if (r.status === "active") {
        const now = Date.now();

        // Push live study time to participant badge every 30 s so other
        // members see fresh minutes without waiting a full minute.
        // ONLY run during study phases — running during breaks would write
        // studyStartedAt=now which makes getLiveStudyMins count break time as study time.
        if (now - lastBadgeSyncRef.current >= 30_000 && user && isRoomStudying(r)) {
          const totalMins = Math.floor(getTotalStudySeconds() / 60);
          // WS: broadcast live badge to room (zero Firestore cost)
          getSocket().emit("update-study-mins", { mins: totalMins });
          // Firestore: persist + reset studyStartedAt every 5 min to prevent
          // double-counting on page refresh (studyStartedAt must stay current)
          if (now - lastFsBadgeSyncRef.current >= 5 * 60_000) {
            updateParticipantStudyMins(r.id, user.uid, totalMins).catch(() => {});
            lastFsBadgeSyncRef.current = now;
          }
          lastBadgeSyncRef.current = now;
        }

        // Sync study minutes to backend in 5-minute batches (5× fewer API writes).
        // Short sessions (< 5 min) are NOT lost — leaveActiveRoom() always saves
        // whatever remainder wasn't flushed here, so 2 min or 7 min sessions are
        // fully recorded on leave. The leaderboard updates within 5 min for long
        // sessions; for short ones it updates the moment the user leaves the room.
        if (user) {
          const totalSecs  = getTotalStudySeconds();
          const minsEarned = Math.floor(totalSecs / 60);
          const minsToSync = minsEarned - Math.floor(lastSyncedSecsRef.current / 60);
          if (minsToSync >= 5) {
            lastSyncedSecsRef.current = minsEarned * 60;
            saveStudyMinutes(user.uid, () => user.getIdToken(), minsToSync).catch(() => {});
          }
        }

        // Only the current host auto-advances the phase at 0.
        // This also fires on the LAST phase — skipPhase() handles it by
        // setting status: "finished" when nextIndex >= studyFlow.length.
        // Previously had `r.currentPhaseIndex < r.studyFlow.length - 1` here
        // which prevented the final phase from ever completing (critical bug).
        if (rem <= 0 && !advancingRef.current) {
          if (user && r.hostUid === user.uid) {
            advancingRef.current = true;
            advancePhase(r.id, r).catch(() => {}).finally(() => { advancingRef.current = false; });
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user, getTotalStudySeconds]);

  // ── Presence heartbeat ─────────────────────────────────────────────────────
  // WS ping every 15 s → zero Firestore cost, just a tiny socket payload.
  // Firestore write every 3 min (was 2 min) — stale threshold is 6 min so we have
  // a full 3-min window before anyone is incorrectly purged. With 100 users in a
  // room this cuts presence reads from ~83/s to ~55/s (33% Firestore reduction).
  useEffect(() => {
    if (!activeRoomId || !user) return;
    const sock = getSocket();
    const wsInterval = setInterval(() => {
      sock.emit("heartbeat");
    }, 15_000);
    const fsInterval = setInterval(() => {
      updatePresence(activeRoomId, user.uid).catch(() => {});
    }, 180_000);
    return () => { clearInterval(wsInterval); clearInterval(fsInterval); };
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
    const STALE_MS = 360_000; // must match STALE_THRESHOLD_MS in studyRooms.ts

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

  // ── Kick detection — if our participant doc disappears, fully clean up ──────
  useEffect(() => {
    if (!activeRoomId || !user) return;
    // Skip when the user deliberately called leaveActiveRoom — in that path
    // we already unsubscribed listeners, but a queued Firestore snapshot can
    // still fire and falsely trigger the kick flow, setting wasKicked = true
    // and making rejoining impossible (the redirect fires before joinActiveRoom
    // resets wasKicked). The isLeavingRef flag prevents that race condition.
    if (isLeavingRef.current) return;
    const isStillIn = participants.some(p => p.uid === user.uid);
    if (participants.length > 0 && !isStillIn) {
      // Immediately unsubscribe all Firestore listeners so no further updates arrive
      unsubRoomRef.current?.();
      unsubPartsRef.current?.();
      unsubRoomRef.current  = null;
      unsubPartsRef.current = null;

      // Reset all tracking state
      studyWallStartRef.current   = null;
      studyAccumulatedRef.current = 0;
      lastSyncedSecsRef.current   = 0;

      // Signal the UI to redirect and clear room state
      setInActiveRoom(false);
      setStudyMinsInSession(0);
      setWasKicked(true);
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

        // If we were studying, bank the elapsed time and reset the wall-clock
        // start to now. This prevents background-tab throttling from causing
        // drift without losing any seconds that were genuinely accrued.
        // NOTE: do NOT clamp against phaseTotal here — that would erase minutes
        // banked from earlier phases, causing the "80 min → 50 min" drop bug.
        if (studyWallStartRef.current !== null && roomRef.current && isRoomStudying(roomRef.current)) {
          studyAccumulatedRef.current += Math.max(0, (Date.now() - studyWallStartRef.current) / 1000);
          studyWallStartRef.current = Date.now();
        }

        // Sync any outstanding whole minutes on tab return.
        // Use same 5-min batch threshold as the main interval — prevents a save
        // every time the user switches tabs for a few minutes.
        // Short sessions (< 5 min) are still captured by leaveActiveRoom() on exit.
        const totalSecs  = getTotalStudySeconds();
        const minsEarned = Math.floor(totalSecs / 60);
        const minsToSync = minsEarned - Math.floor(lastSyncedSecsRef.current / 60);
        if (minsToSync >= 5 && user) {
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
    setWasKicked(false);
    setInActiveRoom(true);
    setActiveRoomId(roomId);
  }, []);

  const leaveActiveRoom = useCallback(async () => {
    if (!activeRoomId || !user) return;

    // ── Guard: prevent kick-detection race condition ──────────────────────────
    // Set BEFORE any Firestore writes. leaveRoom() deletes the participant doc,
    // which causes a snapshot to fire. If the listener is still subscribed at
    // that moment, kick detection sees the user has disappeared and sets
    // wasKicked=true — making it impossible to rejoin. The flag short-circuits
    // that code path for the duration of the intentional leave.
    isLeavingRef.current = true;

    // ── Unsubscribe listeners BEFORE Firestore writes ─────────────────────────
    // This is the primary defence. Even if isLeavingRef is checked asynchronously,
    // unsubscribing first guarantees no stale snapshot can arrive.
    unsubRoomRef.current?.();
    unsubPartsRef.current?.();
    unsubRoomRef.current  = null;
    unsubPartsRef.current = null;

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

    // 5. Reset state — isLeavingRef must be cleared AFTER all state is reset
    //    so any in-flight React effects don't re-trigger with stale state.
    studyWallStartRef.current   = null;
    studyAccumulatedRef.current = 0;
    lastSyncedSecsRef.current   = 0;
    setInActiveRoom(false);
    setStudyMinsInSession(0);
    setActiveRoomId(null);
    setRoom(null);
    setParticipants([]);
    isLeavingRef.current = false;
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

  const onHostRestart = useCallback(async () => {
    if (!activeRoomId) return;
    // Reset all local tracking refs so the restarted session starts clean
    studyWallStartRef.current   = null;
    studyAccumulatedRef.current = 0;
    lastSyncedSecsRef.current   = 0;
    lastSyncTimeRef.current     = Date.now();
    lastBadgeSyncRef.current    = Date.now();
    lastFsBadgeSyncRef.current  = 0; // force Firestore write within first 5 min of restarted session
    prevStudyingRef.current     = false;
    advancingRef.current        = false;
    prevPhaseRef.current        = null;
    prevStatusRef.current       = null;
    setStudyMinsInSession(0);
    await restartRoom(activeRoomId);
  }, [activeRoomId]);

  // ── Stable context value — only recreates when non-timer fields change ──────
  // remainingSeconds / studyMinsInSession update every second; keeping them out
  // of this memo prevents every useActiveRoom() consumer from re-rendering on
  // each tick.  Components that need the live timer should call useRoomTimer().
  const ctxValue = useMemo<ActiveRoomContextType>(() => ({
    activeRoomId, room, participants, isHost, wasKicked,
    joinActiveRoom, leaveActiveRoom,
    onHostStart, onHostPause, onHostResume, onHostSkip, onHostEnd, onHostRestart,
    // Keep deprecated fields in the object so old call-sites don't break,
    // but they won't cause re-renders on stable consumers.
    remainingSeconds, studyMinsInSession,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    activeRoomId, room, participants, isHost, wasKicked,
    joinActiveRoom, leaveActiveRoom,
    onHostStart, onHostPause, onHostResume, onHostSkip, onHostEnd, onHostRestart,
  ]);

  const timerValue        = useMemo<RoomTimerContextType>(() => ({ studyMinsInSession }), [studyMinsInSession]);
  const timerDisplayValue = useMemo<TimerDisplayContextType>(() => ({ remainingSeconds }), [remainingSeconds]);

  return (
    <TimerDisplayContext.Provider value={timerDisplayValue}>
      <RoomTimerContext.Provider value={timerValue}>
        <ActiveRoomContext.Provider value={ctxValue}>
          {children}
        </ActiveRoomContext.Provider>
      </RoomTimerContext.Provider>
    </TimerDisplayContext.Provider>
  );
}

export function useActiveRoom() {
  const ctx = useContext(ActiveRoomContext);
  if (!ctx) throw new Error("useActiveRoom must be used within ActiveRoomProvider");
  return ctx;
}

/** Subscribe only to studyMinsInSession — re-renders at most once per minute. */
export function useRoomTimer(): RoomTimerContextType {
  return useContext(RoomTimerContext);
}

/** Subscribe to the per-second countdown — use only in components that render the clock.
 *  Keeps fast-ticking state isolated so the rest of the UI re-renders ≤ once/minute. */
export function useTimerDisplay(): TimerDisplayContextType {
  return useContext(TimerDisplayContext);
}
