---
name: Study Room Bug Fixes
description: Root causes and fixes for Virtual Study Room system issues (ghost rooms, ghost users, duplicate listeners, admin delete, reactions, profile cache, study tracking, voting, rejoin, member count)
---

## Key fixes applied (earlier session)

**Ghost rooms**: `leaveRoom` now reads the current `participantCount` before decrementing. If it's the last person (count ≤ 1), the batch also sets `status: "finished"` and `timerStartedAt: null` — making the room vanish from listings immediately.

**Firestore rule** updated to allow: `affectedKeys().hasOnly(['participantCount', 'status', 'timerStartedAt']) && participantCount == 0 && status == 'finished'` for non-hosts.

**Ghost users**: `subscribeParticipants` filters client-side — any participant whose `lastSeen` is older than 90s is excluded. Heartbeat reduced from 30s → 15s. Host runs `purgeStaleParticipants` (Firestore delete) every 60s.

**Duplicate Firestore listeners**: `StudyRoomLive` used to always subscribe to room+participants. Now: only subscribes locally when `activeRoomId !== roomId` (pre-join). After join, consumes `ctxRoom`/`ctxParticipants` directly from `ActiveRoomContext`. This halves the Firestore read cost.

**Study tracking for ALL users**: Architecture was already correct (each user's context has its own timer tick + sync). The fix was making `joinActiveRoom` more robust (cancellable cleanup, dep array uses `room?.id` not full `room`). Study time uses `increment()` and syncs every 60s for every participant.

**Admin delete fail**: Firestore rule only allowed host to delete. Fixed rule: `resource.data.hostUid == request.auth.uid || isAdmin()`. Subcollection `participants` delete also now allows `isAdmin()`. Admin.tsx now uses `deleteRoomCascade()` (batched Firestore writes) instead of sequential deleteDoc calls.

**Reactions broken**: Firestore `messages` rule required `text is string` for ALL messages. Fixed: split rule into `type == 'message'` (needs text) vs `type == 'reaction'` (needs emoji) vs `type == 'system'`.

**Profile popup slow**: Added `Map<uid, UserStats>` module-level cache in `StudentProfileModal.tsx`. Second open of same user is instant.

**`totalStudyTime` increment bound**: Rule was `+240` max per write. Raised to `+480` to prevent silent failures during long syncs.

**Why:**
- Firestore Security Rules are the gating layer — client code silently fails when rules block writes, causing confusing "only host gets X" symptoms.
- Duplicate onSnapshot listeners are the main performance killer in study rooms.
- `FieldValue.increment()` in security rules: the rule engine evaluates `request.resource.data.field` as the resulting sum, not the delta.

---

## Production audit fixes (current session)

### Voting — strict democratic majority
**Root cause:** `resolveVote` used `yes > no` which passes with 1 yes vs 0 no (e.g. 2 users, only 1 votes yes → passes).
**Fix:** Changed to `yes * 2 > Math.max(vote.totalParticipants, yes + no)` — strict majority of ALL active participants.
Also: `VotingPanel` now has a `useEffect` that syncs `totalParticipants` on active votes when `participantCount` changes (people leaving mid-vote). Added early majority detection AND early defeat detection in auto-resolve interval. Progress bar now shows majority threshold marker + "needs N/M yes to pass" label.

### Rejoin bug — wasKicked false positive race condition
**Root cause:** Race in `leaveActiveRoom`. `leaveRoom()` deletes participant doc → Firestore snapshot fires BEFORE listeners unsubscribe → kick detection sees user missing → sets `wasKicked = true` → `StudyRoomLive` redirects away before `joinActiveRoom` resets `wasKicked`.
**Fix (two defences in `ActiveRoomContext.leaveActiveRoom`):**
1. `isLeavingRef.current = true` BEFORE any Firestore writes — kick detection returns early when this is set.
2. Unsubscribe listeners BEFORE `leaveRoom()` (primary defence — no snapshot can fire during the leave).
`isLeavingRef` cleared after all state is reset.

### Member count drift
**Root cause:** `participantCount` uses `increment(±1)` which drifts on crash/disconnect. Host purge corrects every 60s but not in real-time, and fails if host crashes.
**Fix:** In `subscribeParticipants` callback, when `ps.length !== room.participantCount`, call `syncParticipantCount(roomId, ps.length)`. Any participant can correct it (writes are idempotent). Added `syncParticipantCount` helper to `studyRooms.ts`.

### Profile photo upload
**Root cause:** Backend `/api/upload/avatar` requires `FIREBASE_SERVICE_ACCOUNT_JSON` for `requireAuth`. Without it → 503. Client-side fallback uses Firebase Storage JS SDK (storage rules allow authenticated writes to `avatars/{uid}.jpg`).
**Fix:** Added granular `try/catch` for each step (upload, getDownloadURL, Firestore update) with specific error messages. Detects `unauthorized/403` and surfaces a clear message. The proper fix for the backend path is setting the `FIREBASE_SERVICE_ACCOUNT_JSON` secret.

### Classroom UI depth
**Fix:** Student rows now use perspective depth scaling. Front row (highest array index, nearest viewer) at `scale(1.0)` full opacity. Back row (index 0, nearest blackboard) at `scale(0.82)` opacity `0.7`. `transformOrigin: "center bottom"` so seats appear to sit on the same floor plane.

### Performance note
Inner function components defined INSIDE `StudyRoomLive` (`ChatPanel`, `HostBar`, etc.) are called as functions `{ChatPanel()}` not as JSX `<ChatPanel />` — this avoids React unmounting them on every parent render but loses memoization. True fix would be to move them outside the component body and pass props. Not refactored in this session due to scope.
