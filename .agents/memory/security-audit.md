---
name: Security Audit Fixes
description: Pre-launch security audit — 7 vulnerabilities found and fixed across Firestore rules, Storage rules, backend upload validation, and client password handling.
---

## Fixes Applied

### 1. Private room passwords — SHA-256 hashed (CRITICAL)
- **Problem:** `password` field stored plaintext in Firestore; `studyRooms` is `allow read: if true` so anyone querying the collection could see passwords directly.
- **Fix:** Added `hashRoomPassword()` (Web Crypto SHA-256) in `studyRooms.ts`. `createRoom` now hashes before writing. Both password-check UIs (`StudyRoomLive.tsx`, `StudyRooms.tsx`) hash the user's input before comparing.
- **Note:** Rooms expire in 24h so no migration of legacy plaintext passwords was needed.

### 2. Study time leaderboard inflation — cap +480→+60 (HIGH)
- **Problem:** Firestore rules allowed `totalStudyTime` to increment by up to +480 min per client write, enabling a looping script to inflate leaderboard totals.
- **Fix:** `firestore.rules` changed cap from `+ 480` to `+ 60` for `totalStudyTime`.

### 3. Report card manipulation via study_logs — non-decreasing + cap (HIGH)
- **Problem:** `study_logs` update rule allowed setting `studyMinutes` to any value 0–1440 directly from the client.
- **Fix:** Added `>= resource.data.get('studyMinutes', 0)` (non-decreasing) and `<= ... + 60` (cap per write) to the update rule.

### 4. Storage — only jpeg/png/webp allowed (MEDIUM)
- **Problem:** `image/*` matched SVG (XSS vector), GIF, HEIC, BMP.
- **Fix:** `storage.rules` now uses explicit `image/jpeg|image/png|image/webp` pattern everywhere. Notes/PYQs also allow `application/pdf`. Avatars get a separate stricter path (2MB limit).
- **Backend:** `ALLOWED_TYPES` in `upload.ts` also trimmed (removed gif/heic/heif). Avatar endpoint changed from `startsWith("image/")` to an explicit allowlist.

### 5. Vote status forgery — restricted to room host (MEDIUM)
- **Problem:** Any authenticated user could update vote `status` to `passed`/`failed`, forging vote outcomes.
- **Fix:** Vote `update` rule split: voter arrays (`yesVoters`/`noVoters`) only allowed for any participant; `status` field updates additionally require `get(studyRooms/roomId).data.hostUid == request.auth.uid`.

### 6. Fake system messages — backend-only (MEDIUM)
- **Problem:** Any authenticated user could create messages with `type: 'system'`, posting fake host-transfer or kick notices that look official.
- **Fix:** Removed `|| request.resource.data.type == 'system'` from the messages `create` rule. Only Admin SDK (backend) can write system messages.

### 7. Beacon /study/leave — known limitation (LOW)
- **Problem:** `uid` trusted from request body; attacker could delete another user's participant doc.
- **Status:** Not fixable without breaking the beacon (no auth headers). Impact is low — only deletes a participant doc, never touches study time/streak. Documented here.

**Why:** These needed fixing before public launch to prevent leaderboard cheating, room password bypass, and malicious system message injection.
**How to apply:** Always run `pnpm --filter @workspace/api-server run build` after changing `upload.ts`. Firestore/Storage rules deploy separately via Firebase CLI or Firebase Console.
