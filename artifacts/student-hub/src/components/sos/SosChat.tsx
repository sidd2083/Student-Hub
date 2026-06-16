/**
 * SOS Chat Panel — live chat + helper profile card with social links
 */

import { useEffect, useRef, useState } from "react";
import { Send, Instagram } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/context/AuthContext";
import { useSos } from "@/context/SosContext";
import type { SosSession } from "@/context/SosContext";

interface ChatMsg {
  id: string;
  uid: string;
  name: string;
  photoURL?: string;
  text: string;
  createdAtMs: number;
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.82 1.56V6.79a4.85 4.85 0 01-1.05-.1z"/>
    </svg>
  );
}

function Avatar({
  name,
  photoURL,
  size = "sm",
}: {
  name: string;
  photoURL?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "sm" ? "w-7 h-7 text-xs" : size === "md" ? "w-9 h-9 text-sm" : "w-14 h-14 text-lg";
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className={`${dims} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function SosChat({ session }: { session: SosSession }) {
  const { user } = useAuth();
  const { sendChatMessage } = useSos();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Listen for chat messages
  useEffect(() => {
    const socket = getSocket();
    const onMsg = (msg: ChatMsg) => {
      setMessages(prev => [...prev, msg]);
    };
    socket.on("sos_chat_message", onMsg);
    return () => { socket.off("sos_chat_message", onMsg); };
  }, []);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !user) return;

    // Optimistic local add
    setMessages(prev => [
      ...prev,
      {
        id: `local_${Date.now()}`,
        uid: user.uid,
        name: "You",
        text,
        createdAtMs: Date.now(),
      },
    ]);
    sendChatMessage(text);
    setDraft("");
  };

  const { partner } = session;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Helper profile card (always at top) */}
      {session.role === "requester" && (
        <div className="shrink-0 p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <Avatar name={partner.name} photoURL={partner.photoURL} size="lg" />
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">{partner.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Grade {partner.grade} · Your Helper</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Online now</span>
              </div>
            </div>
          </div>

          {/* Social links */}
          {(partner.instagramHandle || partner.tiktokHandle) && (
            <div className="flex gap-2 flex-wrap">
              {partner.instagramHandle && (
                <a
                  href={`https://instagram.com/${partner.instagramHandle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  Connect on Instagram
                </a>
              )}
              {partner.tiktokHandle && (
                <a
                  href={`https://tiktok.com/@${partner.tiktokHandle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:opacity-80 transition-opacity shadow-sm"
                >
                  <TikTokIcon className="w-3.5 h-3.5" />
                  Follow on TikTok
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Message list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm text-gray-400 dark:text-gray-500">Chat is live. Say hello!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMine = msg.uid === user?.uid;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
              {!isMine && (
                <Avatar name={msg.name} photoURL={msg.photoURL} size="sm" />
              )}
              <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                {!isMine && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">{msg.name}</span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                    isMine
                      ? "bg-blue-500 text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-1">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none py-2"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="p-1.5 rounded-lg bg-blue-500 text-white disabled:opacity-40 hover:bg-blue-600 transition-colors active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
