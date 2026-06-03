import { io, type Socket } from "socket.io-client";

// ── Typed socket event payloads ───────────────────────────────────────────────

export interface WsChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  type: "message";
  createdAtMs: number;
}

export interface WsReaction {
  uid: string;
  name: string;
  emoji: string;
}

// ── Singleton connection ──────────────────────────────────────────────────────
// One socket per browser tab, shared across all components.
//
// VITE_WS_URL — set this on Vercel (or any CDN host) when the WebSocket backend
// lives on a different origin, e.g. https://your-app.onrender.com
// Leave unset in dev (Vite proxies /socket.io → localhost:8080) and on Replit
// deployments where frontend + backend share the same origin.
const WS_URL = import.meta.env.VITE_WS_URL as string | undefined;

const SOCKET_OPTS = {
  path: "/socket.io",
  transports: ["websocket", "polling"] as string[],
  reconnectionAttempts: 10,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 5_000,
  timeout: 10_000,
};

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = WS_URL ? io(WS_URL, SOCKET_OPTS) : io(SOCKET_OPTS);
  }
  return _socket;
}

export function isSocketConnected(): boolean {
  return _socket?.connected ?? false;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
