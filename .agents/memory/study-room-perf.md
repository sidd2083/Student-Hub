---
name: Study Room Performance — Timer Context Split
description: How the every-second re-render bottleneck was fixed in StudyRoomLive and ClassroomView.
---

## The Problem
`StudyRoomLive` (1524-line component) was calling `useRoomTimer()` which ticked every second → entire component re-rendered every second → all inline function components (ChatPanel, StudyFlow, HostBar, AnnouncementBanner) re-ran every second.

## The Fix — TimerDisplayContext split

### ActiveRoomContext.tsx
- Added `TimerDisplayContext` with `{ remainingSeconds }` — updates every second
- Changed `RoomTimerContext` to ONLY carry `{ studyMinsInSession }` — updates at most once per minute (guarded by `prevStudyMinsRef.current !== newMins`)
- Exported `useTimerDisplay()` for components that need the per-second clock
- `useRoomTimer()` now returns only `{ studyMinsInSession }`

### ClassroomView.tsx
- Removed `timerDisplay` prop entirely — component reads `useTimerDisplay()` internally
- Computes `timerDisplay = formatTime(remainingSeconds)` from context
- Only re-renders every second (for the blackboard clock) — parent StudyRoomLive doesn't trigger it

### StudyRoomLive.tsx
- No longer calls `useRoomTimer()` for `remainingSeconds` — only reads `studyMinsInSession` (once/min)
- Three isolated module-level components read timer from context:
  - `RoomTimerBadge` — header clock badge
  - `RoomProgressBar` — phase progress bar
  - `MobileTimerClock` — mobile layout large timer
- `StudyRoomLive` parent re-renders ≤ once per minute instead of 60× per minute

**Why:** 60 re-renders/minute × 1524-line component = major lag, especially with chat + animations.
**How to apply:** Any new component that shows a live countdown must use `useTimerDisplay()` NOT `useRoomTimer()`. Only ClassroomView and the three isolated timer components should call `useTimerDisplay()`.

## Profile Modal Cache Removed
`profileCache` Map with 2-minute TTL was showing stale stats. Removed entirely — `getDoc` is ~50ms, always fresh. No cache needed.
