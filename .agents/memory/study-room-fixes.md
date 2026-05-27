---
name: Study Room Bug Fixes
description: Root causes and fixes for Virtual Study Room system issues (ghost rooms, ghost users, duplicate listeners, admin delete, reactions, profile cache, study tracking)
---

## Key fixes applied

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
