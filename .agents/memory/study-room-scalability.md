---
name: Study Room Scalability
description: Production decisions for ClassroomView bench layout, Firestore presence tuning, room size cap, and focus mode.
---

## Bench Layout (ClassroomView.tsx)

**Rule:** Bench minimum is always `2` — same on mobile and desktop. The old `compact ? 2 : 3` caused the same room to show 2 benches on mobile and 3+ on desktop (inconsistent).

**How to apply:** `pairs` useMemo uses `while (p.length < 2)` — no `compact` branching. Height is dynamic: `compact ? 300 + pairs.length * 90 : 370 + pairs.length * 108`. Wainscoting uses fixed pixel `top` (not `%`) so it stays below the blackboard regardless of bench count.

**Why:** With `overflow-x-hidden` on the outer div, the classroom grows vertically to show all participants. The parent containers don't have `maxHeight` on the classroom column so all benches are always visible.

## Room Size Cap

**Rule:** Max participants is 20 (was 50). StudyRoomCreate.tsx slider `max={20}`. STALE_THRESHOLD_MS = 360_000 (6 min). Existing rooms created before this change will still show their old max.

**Why:** 20 participants = 10 benches maximum → all fit in the classroom without extreme scroll.

## Firestore Presence Tuning

**Rule:** Presence Firestore write interval: 180_000ms (3 min, was 120_000ms 2 min). Stale threshold: 360_000ms (6 min, was 180_000ms 3 min). WS heartbeat still every 15s.

**Why:** With 100 users in a room, presence writes trigger participant snapshots for all 100 users. 3-min writes = 33% fewer reads/second (~55/s vs ~83/s). Stale threshold raised in lockstep to allow 2 missed writes before purge. The STALE_MS in ActiveRoomContext.tsx host-claim check must also match (360_000).

## Focus Mode

**Rule:** `focusMode` state in StudyRoomLive.tsx. Desktop: toggled by Eye/EyeOff button in header bar, switches grid from `[1fr_48px_340px]` to `[1fr_48px]` and hides right panel. Mobile: MobileTabs filters to only "class" tab in focus mode.

**Why:** Distraction-free deep work; users want just the classroom + timer without chat/votes/participants visible.
