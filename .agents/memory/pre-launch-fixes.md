---
name: Pre-launch critical bug fixes
description: 8 bugs fixed before production launch — root causes and patterns worth remembering.
---

## Ghost Rooms
**Root cause:** `createRoom` + `joinRoom` in StudyRoomCreate.tsx were sequential in a single try block; if `joinRoom` threw, the room doc was already written with no participants.
**Fix:** Track `roomId` outside try block; on catch, call `deleteRoomCascade(roomId)` if roomId is set.

## Host Transfer on Tab Close
**Root cause:** `/api/study/leave` (called via `keepalive: true` on `beforeunload`) deleted the participant doc but never checked if the leaver was the host.
**Fix:** Read room doc before deleting participant, compare `roomData.hostUid === uid`. If true and remaining > 0, sort remaining participants by `joinedAt` and transfer host in a batch write with a system message. Eliminates the previous 30-second claim-host polling delay.

## Double Timer Exploit
**Root cause:** `TimerContext.saveMinutes` called `/api/study/save` regardless of whether user was in a study room. `ActiveRoomContext` also called `/api/study/save` independently — two contexts saving minutes simultaneously.
**Fix:** Created `lib/studyRoomState.ts` with module-level `_inActiveRoom` flag (avoids React context cycle since `TimerProvider` wraps `ActiveRoomProvider`). `ActiveRoomContext` calls `setInActiveRoom(true/false)` on join/leave/kick. `TimerContext.saveMinutes` checks `isInActiveRoom()` and returns early.

## Photo Upload Logging
**Why:** `updateDoc` in Firestore fallback threw "No document to update" for new users without a doc.
**Fix:** Changed `updateDoc` → `setDoc(..., { merge: true })` in the Firestore data-URL fallback path; also in `removeProfilePhoto`. Added `console.log` at every step so failures are traceable in DevTools.

## Grade Labels (gradeUtils.ts)
**Pattern:** Grades 13/14/15 were displayed as "Grade 13/14/15" everywhere.
**Fix:** Created `lib/gradeUtils.ts` with `gradeLabel(n)` → 13="CEE", 14="IOE", 15="Bachelor's", 0="Others". Applied to: Leaderboard (filter buttons + rows), RoomCard, VotingPanel kick picker, Layout sidebar, StudentProfileModal. Also added 13/14/15 to Leaderboard grade filter buttons.

## What was already correct (no changes needed)
- **Voting with ghost users** — `subscribeParticipants` already filters stale participants; VotingPanel already syncs `totalParticipants`; `resolveVote` uses `Math.max` for effective totals.
- **Pomodoro anti-cheat** — `StudyGuardian.tsx` already pauses timer when popup appears and resumes when dismissed.
- **Personalized daily tasks** — `useDailyMissions.ts` already has grade-specific content for 13/14/15.
