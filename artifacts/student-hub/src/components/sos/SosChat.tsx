/**
 * SOS Chat Panel — live text + image chat, partner profile card with social links.
 *
 * Zero Firestore: all messages flow through Socket.io only, stored in local state.
 * - No optimistic add (server echoes back to sender) → no duplicates
 * - Messages survive mobile tab switches (component stays mounted in workspace)
 * - Image sharing: compress to 800×600 JPEG 0.75q before emitting
 * - Partner card shown for BOTH roles
 */

import { useEffect, useRef, useState } from "react";
import { Send, Instagram, Paperclip, X, ImageIcon } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/context/AuthContext";
import { useSos } from "@/context/SosContext";
import type { SosSession } from "@/context/SosContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  uid: string;
  name: string;
  photoURL?: string;
  text?: string;
  imageUrl?: string;
  createdAtMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.82 1.56V6.79a4.85 4.85 0 01-1.05-.1z"/>
    </svg>
  );
}

function Avatar({ name, photoURL, size = "sm" }: { name: string; photoURL?: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "w-7 h-7 text-xs" : size === "md" ? "w-9 h-9 text-sm" : "w-14 h-14 text-lg";
  if (photoURL) {
    return <img src={photoURL} alt={name} className={`${dims} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${dims} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function getGradeLabel(g: unknown): string {
  const s = String(g ?? "").toLowerCase();
  if (s === "cee" || s === "13") return "CEE / Medical";
  if (s === "ioe" || s === "14") return "IOE / Engineering";
  if (s === "15") return "Bachelor's";
  const n = Number(s);
  if (n >= 9 && n <= 12) return `Grade ${n}`;
  return s ? `Grade ${s}` : "—";
}

/** Compress image to max 800×600 JPEG 0.75q before sending over socket */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = evt => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX_W = 800, MAX_H = 600;
        let w = img.width, h = img.height;
        if (w > MAX_W || h > MAX_H) {
          const scale = Math.min(MAX_W / w, MAX_H / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = evt.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SosChat({ session }: { session: SosSession }) {
  const { user } = useAuth();
  const { sendChatMessage } = useSos();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft]       = useState("");
  const [sending, setSending]   = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages grow
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Listen for chat events — messages come from server for BOTH sender and receiver
  // so we do NOT add optimistically; the server echo is the source of truth.
  useEffect(() => {
    const socket = getSocket();

    const addMsg = (msg: ChatMsg) => {
      setMessages(prev => {
        // Deduplicate by id (in case of reconnect replays)
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on("sos_chat_message", addMsg);
    socket.on("sos_chat_file",    addMsg);

    return () => {
      socket.off("sos_chat_message", addMsg);
      socket.off("sos_chat_file",    addMsg);
    };
  }, []);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !user || sending) return;
    sendChatMessage(text); // server broadcasts back to entire session room incl. us
    setDraft("");
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Only image files can be shared in chat.");
      return;
    }
    setSending(true);
    try {
      const dataUrl = await compressImage(file);
      getSocket().emit("sos_chat_file", { dataUrl });
    } catch {
      // ignore compression errors silently
    } finally {
      setSending(false);
    }
  };

  const { partner } = session;
  const partnerGradeLabel = getGradeLabel(partner.grade);
  const partnerRoleLabel  = session.role === "requester" ? "Your Helper" : "Peer in Need";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">

      {/* ── Partner profile card (both roles see this) ───────────────────── */}
      <div className="shrink-0 p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={partner.name} photoURL={partner.photoURL} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{partner.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{partnerGradeLabel} · {partnerRoleLabel}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Online</span>
            </div>
          </div>
        </div>

        {/* Social handles */}
        {(partner.instagramHandle || partner.tiktokHandle) ? (
          <div className="flex gap-2 flex-wrap">
            {partner.instagramHandle && (
              <a
                href={`https://instagram.com/${partner.instagramHandle.replace(/^@/, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Instagram className="w-3.5 h-3.5" />
                @{partner.instagramHandle.replace(/^@/, "")}
              </a>
            )}
            {partner.tiktokHandle && (
              <a
                href={`https://tiktok.com/@${partner.tiktokHandle.replace(/^@/, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:opacity-80 transition-opacity shadow-sm"
              >
                <TikTokIcon className="w-3.5 h-3.5" />
                @{partner.tiktokHandle.replace(/^@/, "")}
              </a>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No social links shared</p>
        )}
      </div>

      {/* ── Message list ─────────────────────────────────────────────────── */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">Chat is live — say hello!</p>
            <p className="text-[11px] text-gray-300 dark:text-gray-600">Use the 📎 button to share images</p>
          </div>
        )}

        {messages.map(msg => {
          const isMine = msg.uid === user?.uid;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
              {!isMine && <Avatar name={msg.name} photoURL={msg.photoURL} size="sm" />}
              <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
                {!isMine && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">{msg.name}</span>
                )}
                {msg.imageUrl ? (
                  <button
                    className={`rounded-2xl overflow-hidden border-2 active:opacity-75 transition-opacity ${
                      isMine ? "border-blue-300 dark:border-blue-700" : "border-gray-200 dark:border-gray-700"
                    }`}
                    onClick={() => setLightbox(msg.imageUrl!)}
                    title="Click to expand"
                  >
                    <img
                      src={msg.imageUrl}
                      alt="shared"
                      className="max-w-[200px] max-h-[180px] object-contain block"
                    />
                    <div className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium ${
                      isMine ? "bg-blue-50 dark:bg-blue-950/40 text-blue-500" : "bg-gray-50 dark:bg-gray-800 text-gray-400"
                    }`}>
                      <ImageIcon className="w-3 h-3" />
                      Tap to expand
                    </div>
                  </button>
                ) : (
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                    isMine
                      ? "bg-blue-500 text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm"
                  }`}>
                    {msg.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <div className="shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-1">

          {/* Image attach */}
          <label
            title="Share image"
            className={`shrink-0 p-1.5 rounded-lg cursor-pointer transition-colors ${
              sending
                ? "opacity-40 pointer-events-none text-gray-400"
                : "text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFilePick}
            />
          </label>

          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={sending ? "Sending image…" : "Type a message…"}
            disabled={sending}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none py-2 disabled:opacity-50"
          />

          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="p-1.5 rounded-lg bg-blue-500 text-white disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-95 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Image lightbox ───────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox}
            alt="full size"
            className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
