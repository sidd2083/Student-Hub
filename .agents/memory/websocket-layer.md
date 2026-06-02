---
name: WebSocket Layer
description: Socket.io replaces high-frequency Firestore operations in study rooms; hybrid WS+Firestore architecture with graceful fallback.
---

## What moved to WebSocket

| Feature | Before | After |
|---|---|---|
| Chat messages | Firestore `onSnapshot` (N reads per message per subscriber) | WS relay; backend writes to Firestore for persistence |
| Emoji reactions | Firestore write + onSnapshot read per subscriber | WS relay only — completely ephemeral, zero Firestore |
| Presence heartbeat | Firestore write every 15 s per user | WS ping every 15 s + Firestore write every 60 s |

## What stays on Firestore
- Room doc (timer/phase/status) — `onSnapshot` in `ActiveRoomContext`
- Participants subcollection — `onSnapshot` in `ActiveRoomContext`
- Votes — `onSnapshot` in `StudyRoomLive`
- Message history (written by backend on every WS chat message)
- Study time saves — still backend API writes

## Architecture

**Backend** (`artifacts/api-server/src/lib/socket.ts`):
- `initSocketServer(httpServer)` — call after `createServer(app)`, before `httpServer.listen()`
- In-memory `roomRoster: Map<roomId, Map<uid, WsMember>>` — no DB
- Events handled: `join-room`, `heartbeat`, `send-message`, `send-reaction`, `leave-room`, `disconnect`
- `send-message`: rate-limited (500ms), broadcasts `chat-message`, writes to Firestore async
- `send-reaction`: broadcasts `reaction` only — no Firestore write

**Frontend** (`artifacts/student-hub/src/lib/socket.ts`):
- `getSocket()` — singleton; `io({ path: "/socket.io" })`
- `isSocketConnected()` — used in `handleSend`/`handleReaction` to pick WS vs Firestore path
- Vite proxy: `/socket.io` → `http://localhost:8080` with `ws: true`

**StudyRoomLive.tsx** (`src/pages/StudyRoomLive.tsx`):
- On `joined=true`: `getRecentMessages()` (one-time getDocs), then WS listeners for `chat-message` and `reaction`
- 3-second fallback timer: if socket doesn't connect → `wsUnavailable=true` → triggers Firestore `subscribeMessages`
- `handleSend`: `isSocketConnected()` → `socket.emit("send-message")` else `sendMessage()` Firestore
- `handleReaction`: `isSocketConnected()` → `socket.emit("send-reaction")` else Firestore write

**ActiveRoomContext.tsx** (`src/context/ActiveRoomContext.tsx`):
- Heartbeat: WS `sock.emit("heartbeat")` every 15 s + Firestore `updatePresence` every 60 s

## Key constraints
- Socket.io does NOT work on Vercel serverless — fallback activates automatically after 3 s
- `getSocket()` is a singleton per browser tab; call `disconnectSocket()` only on app unmount
- Server roster is in-memory only — resets on server restart (acceptable; Firestore is source of truth)
- `index.ts` must use `createServer(app)` + `initSocketServer(httpServer)` before `httpServer.listen()`
- `handler.ts` (Vercel) does NOT initialize socket server — it just exports the Express app
