---
name: Firestore Optimization & Timer Fixes
description: Read audit results, key limits added, timer partial-minute flush, security hardening, report card graph fix.
---

## Firestore Read Limits Added
- `studyRooms.ts` — `subscribePublicRooms`: `limit(60)` → `limit(20)`
- `Home.tsx` — notes/pyqs preview: added `limit(8)` (no orderBy — avoids composite index requirement)
- `Dashboard.tsx` — announcements: added `limit(3)` at Firestore level (was slicing client-side); tasks: added `limit(50)`
- `PartnerCreators.tsx` — added `where("visible","==",true)` server-side filter

**Why:** With 100 concurrent users, unbounded getDocs on the home page could exhaust the 50k daily read quota. Each page now caps its reads server-side.

**How to apply:** Always add a `limit()` to any `getDocs` that could return variable-sized collections. Use Firestore-level filter for boolean fields (`visible`) to avoid fetching and discarding documents client-side.

## Timer Partial-Minute Flush
- `TimerContext.tsx` — `pause()`: now flushes remaining unsaved minutes on every explicit pause
- `TimerContext.tsx` — `reset()`: flushes before zeroing refs so restart saves all earned time

**Why:** The 5-min auto-save fires in the interval. On pause/restart, the interval stops. Any minutes earned after the last 5-min mark were silently discarded. With 100 active Pomodoro users losing 1-4 min on each pause/restart, study tracking was unreliable.

**How to apply:** Pattern: `earnedMins - savedMinutes = wholeDiff`; save wholeDiff if > 0, else save 1 if partial ≥ 30s. Call `saveMinutes()` BEFORE zeroing refs, add to deps array.

## Save Boundary Fix
- `TimerContext.tsx` — interval save: now uses `nextMark = (floor(savedMinutes/5)+1)*5` so saves always land on 5/10/15/20... min marks regardless of flush amounts.

## Security Hardening
- `users.ts` + `creators.ts` — removed `?? "siddhant2078"` default for ADMIN_KEY
- `creators.ts` — `requireAdminKey` now checks `!ADMIN_KEY` first (fail-secure when env var missing)
- `socket.ts` — Socket.io CORS changed from `origin: "*"` to `origin: process.env.CORS_ORIGIN ?? true`

**Why:** Hardcoded admin key means anyone who reverse-engineers the key string gets admin access. Without ADMIN_KEY env var set, both `!ADMIN_KEY` guards now reject all admin requests instead of accepting requests with no key (the `undefined !== undefined` = false bug).

## Report Card 30-Day Graph
- `ReportCard.tsx` — `StudyBar`: wrapped month view in `overflow-x-auto`, set `minWidth: 600px` so 30 bars are always ≥20px wide on mobile.

**Why:** 30 bars in a flex container on 375px mobile = ~10px/bar — unreadable. Horizontal scroll preserves data density without squishing.
