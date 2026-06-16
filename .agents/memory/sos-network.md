---
name: SOS Network feature
description: Architecture and key decisions for the zero-Firestore real-time peer-help feature
---

## Architecture

All SOS state lives in server RAM via Socket.io — zero Firestore reads/writes ever.

- **Backend engine**: `artifacts/api-server/src/lib/sos.ts` — three in-memory Maps:
  - `activeUsers: Map<uid, ActiveUser>` — registered peers with study stats
  - `pendingSosRequests: Map<requestId, SosRequest>` — requests awaiting a helper
  - `activeSessions: Map<sessionId, SosSession>` — live sessions
  - `socketToUid: Map<socketId, uid>` — fast disconnect lookups
  - `userToSession: Map<uid, sessionId>` — fast session lookups
- Integrated into `socket.ts` via `initSosHandlers(io, socket)` — called inside `io.on("connection")` after existing handlers

## Matchmaking

- Tier 1: same/adjacent grade, weighted score = `todayStudyMins×0.4 + streakDays×0.3 + subjectMastery×0.3`
- Tier 2 fallback: any same-grade peer, random order
- 3 candidates notified simultaneously; 30s cascade to next batch if all reject/time out
- Reject penalty: 3 min cooldown. Ignore/timeout: same 3 min penalty. Post-help rest: 7 min.

## Socket Events

Client → Server: `sos_register`, `sos_update_status`, `client_sos_request`, `sos_accept`, `sos_reject`, `sos_chat_message`, `sos_canvas_draw`, `sos_canvas_image`, `sos_canvas_clear`, `sos_end_request`, `sos_end_confirm`, `sos_end_cancel`, `sos_rating`

Server → Client: `sos_popup`, `sos_popup_clear`, `sos_popup_expired`, `sos_searching`, `sos_no_helpers`, `sos_session_start`, `sos_chat_message`, `sos_canvas_draw`, `sos_canvas_image`, `sos_canvas_clear`, `sos_end_confirm_prompt`, `sos_end_cancelled`, `sos_session_ended`, `sos_partner_disconnected`

## Frontend

- `SosContext.tsx` — global provider, listens to all events, renders popup/workspace/rating modal as portals
- `SosPopup.tsx` — 30s countdown floating alert in bottom-right, rendered via `createPortal`
- `SosCanvas.tsx` — HTML5 canvas with pen/marker/eraser/text, bezier smoothing, image upload/drop, coordinate normalization for proportional scaling
- `SosChat.tsx` — live chat + helper profile card with Instagram/TikTok follow buttons
- `SosWorkspace.tsx` — full-screen overlay (`z-[9996]`), desktop split / mobile tabs, uses `useTimer().pause()` on mount for helpers
- `SosNetwork.tsx` — `/sos` page, SOS form + social handles config + subject mastery sliders

## Key Decisions

**Why:** Portal overlays (`createPortal`) were used so the workspace and popup render above all other UI including active Study Room sessions — the study room socket stays connected throughout the SOS session.

**Why:** `SosWorkspace` pauses the Pomodoro timer (via `useTimer().pause()`) on mount for helpers only, and restores it on unmount — this prevents double-counting study time.

**How to apply:** Subject mastery and social handles are stored in localStorage keys `sh_subject_mastery` and `sh_social_handles`. The SosContext reads these on registration and sends to the server.

## Entry Points

- Dashboard: red SOS widget above Quick Access grid
- Sidebar nav: "SOS Network" entry (2nd item, AlertTriangle icon)
- Route: `/sos` (PrivateRoute)
