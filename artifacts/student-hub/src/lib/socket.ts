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

// ── URL Resolution Helpers ───────────────────────────────────────────────────

function cleanUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  // socket.io client connects over HTTP/HTTPS and upgrades to WebSocket
  u = u.replace(/^ws:\/\//i, "http://").replace(/^wss:\/\//i, "https://");
  return u;
}

export function getConfiguredWsUrl(): string {
  if (typeof window === "undefined") return "";
  const local = localStorage.getItem("sh_ws_url")?.trim();
  if (local) return cleanUrl(local);
  const envUrl = (
    (import.meta.env.VITE_WS_URL as string | undefined) ||
    (import.meta.env.WS_URL as string | undefined) ||
    (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
    (typeof window !== "undefined" && (window as any).__WS_URL__) ||
    ""
  ).trim();
  return envUrl ? cleanUrl(envUrl) : "";
}

export function setWsUrlOverride(url: string) {
  if (typeof window === "undefined") return;
  const cleaned = url.trim();
  if (cleaned) {
    localStorage.setItem("sh_ws_url", cleaned);
  } else {
    localStorage.removeItem("sh_ws_url");
  }
  disconnectSocket();
  getSocket();
}

// ── Socket configuration ──────────────────────────────────────────────────────

const SOCKET_OPTS = {
  path: "/socket.io",
  transports: ["polling", "websocket"] as string[], // start with polling for instant cold-start handshake, then upgrade
  reconnection: true,
  reconnectionAttempts: Infinity, // never give up retrying when backend is sleeping
  reconnectionDelay: 2_000,
  reconnectionDelayMax: 8_000,
  timeout: 45_000, // 45s timeout to allow Render free tier to wake up
};

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    const targetUrl = getConfiguredWsUrl();
    _socket = targetUrl ? io(targetUrl, SOCKET_OPTS) : io(SOCKET_OPTS);
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
