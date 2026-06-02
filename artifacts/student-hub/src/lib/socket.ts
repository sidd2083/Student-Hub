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

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      timeout: 10_000,
    });
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
