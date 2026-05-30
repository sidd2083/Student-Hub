---
name: Mission Level Progression
description: How student level (beginner/intermediate/advanced) is computed and stored in useDailyMissions.ts
---

## The Rule
Level is based on `missionCompletedDays` — the count of unique calendar days where ALL daily missions were completed.
- Beginner → Intermediate: 5 days
- Intermediate → Advanced: 15 days

**Why:** Old system (streak >= 7 or study time >= 300 min) let students jump level by accident. New system requires consistent daily completion.

## Storage
- localStorage key: `sh_mcd_${uid}` → `{ days: number, lastDate: string }`
- `lastDate` is the Nepali calendar date string. `incrementMissionCompletedDays` is idempotent: same date = no increment.
- Background-syncs to `users/{uid}.missionCompletedDays` in Firestore for cross-device persistence.

## How to Apply
- `getMissionCompletedDays(uid)` — synchronous read from localStorage
- `incrementMissionCompletedDays(uid, date)` — idempotent increment
- `getUserLevel(mcd)` — exported pure function  
- Hook uses `mcdIncrementedRef` to prevent double-counting within a session; also resets on date change.
