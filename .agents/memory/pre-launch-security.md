---
name: Pre-Launch Security Fixes
description: Second security audit — hardcoded creds, unauthenticated study sync, grade limit bug, VotingPanel perf
---

## Fixes Applied

### 1. Hardcoded Admin Credentials Removed (CRITICAL)
- **Old**: `AdminLogin.tsx` had `ADMIN_USER = "siddhant"` / `ADMIN_PASS = "siddhant2078"` in plaintext — visible in browser DevTools → Sources by anyone.
- **Fix**: Removed password login entirely. `AdminLogin.tsx` now checks `profile?.role === "admin"` from Firebase Auth context. Admin → auto-redirects. Not admin → denial screen. Not logged in → Google Sign-In button.
- The admin panel data operations remain protected by Firestore rules + backend `isAdmin()` check.

### 2. Unauthenticated Study Time Inflation Removed (HIGH)
- **Old**: `/api/study/sync-anon` accepted any UID from body without auth. Anyone knowing a user's UID could call it 20x/min, adding 3min/call = 60 min/min of fake totalStudyTime.
- **Fix**: Deleted the endpoint entirely. Clients now use `keepalive: true` fetch with a cached Firebase ID token to the authenticated `/api/study/save` endpoint instead.
- Max ≤3 min of study time lost on sudden tab close — acceptable.

### 3. ID Token Cache for keepalive fetch (SECURITY PATTERN)
- Both `TimerContext.tsx` and `ActiveRoomContext.tsx` maintain `tokenRef` via `onIdTokenChanged`.
- `beforeunload` handler uses `fetch('/api/study/save', { keepalive: true, headers: { Authorization: 'Bearer ' + tokenRef.current } })` — authenticated, no sendBeacon.
- Auth header also forwarded to `/api/study/leave` keepalive fetch.

### 4. Firestore Grade Limit Bug Fixed (CRITICAL BUG)
- **Old**: CREATE rule had `grade <= 12` — users selecting grade 13 (CEE), 14 (IOE), or 15 (Bachelor's) couldn't create profiles (Firestore rejected the setDoc with PERMISSION_DENIED).
- **Fix**: Changed to `grade <= 15` in `firestore.rules`.

### 5. VotingPanel Unconditional 1-Second Tick Fixed (PERFORMANCE)
- **Old**: `forceUpdate` interval ran every second always — re-rendered VotingPanel 60x/min even with no active vote.
- **Fix**: Added `needsTick` guard — interval only starts when `hasActiveVote || (lastVoteAt > 0 && Date.now() - lastVoteAt < VOTE_COOLDOWN_MS)`.

**Why:** Hardcoded frontend creds are catastrophic even if DB access is separately guarded — they expose the admin UI and any future logic tied to it. Unauthenticated write endpoints at scale = leaderboard corruption.
