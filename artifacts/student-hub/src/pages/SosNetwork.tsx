/**
 * SOS Network page — students request live peer help here.
 * Also contains social handle configuration.
 */

import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  AlertTriangle, Send, Loader2, CheckCircle2,
  Instagram, Users, Zap, BookOpen,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSos } from "@/context/SosContext";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.82 1.56V6.79a4.85 4.85 0 01-1.05-.1z"/>
    </svg>
  );
}

const SUBJECTS = [
  "Math", "Physics", "Chemistry", "Biology",
  "English", "Nepali", "Social", "Computer",
  "Accounts", "Economics", "General",
];

const SUBJECT_MASTERY_KEY = "sh_subject_mastery";
const SOCIAL_HANDLES_KEY  = "sh_social_handles";

export default function SosNetwork() {
  const { profile } = useAuth();
  const { requestStatus, sendSosRequest, cancelSosRequest } = useSos();

  // Form state
  const [topicTitle, setTopicTitle] = useState("");
  const [subject, setSubject] = useState("Math");

  // Social handles (persisted locally)
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok]       = useState("");
  const [handlesSaved, setHandlesSaved] = useState(false);

  // Subject mastery config (simple slider per subject)
  const [mastery, setMastery] = useState<Record<string, number>>({});

  // Load persisted data
  useEffect(() => {
    try {
      const handles = localStorage.getItem(SOCIAL_HANDLES_KEY);
      if (handles) {
        const parsed = JSON.parse(handles) as { instagramHandle?: string; tiktokHandle?: string };
        setInstagram(parsed.instagramHandle ?? "");
        setTiktok(parsed.tiktokHandle ?? "");
      }
      const m = localStorage.getItem(SUBJECT_MASTERY_KEY);
      if (m) setMastery(JSON.parse(m) as Record<string, number>);
    } catch {}
  }, []);

  const saveHandles = () => {
    try {
      localStorage.setItem(
        SOCIAL_HANDLES_KEY,
        JSON.stringify({ instagramHandle: instagram.trim(), tiktokHandle: tiktok.trim() }),
      );
      setHandlesSaved(true);
      setTimeout(() => setHandlesSaved(false), 2000);
    } catch {}
  };

  const updateMastery = (sub: string, val: number) => {
    const next = { ...mastery, [sub.toLowerCase()]: val };
    setMastery(next);
    try { localStorage.setItem(SUBJECT_MASTERY_KEY, JSON.stringify(next)); } catch {}
  };

  const handleSendSos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim()) return;
    sendSosRequest(topicTitle.trim(), subject.toLowerCase());
  };

  const isSearching = requestStatus === "searching";
  const noHelpers   = requestStatus === "no_helpers";

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm">Please log in to use SOS Network.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Get Help – Student Hub</title>
        <meta name="description" content="Get instant live help from your peers when you're stuck." />
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 mb-3">
            <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Get Help</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Stuck on a problem? Get live help from a peer in seconds.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Send className="w-5 h-5" />, title: "Send SOS", desc: "Describe your topic", color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400" },
            { icon: <Zap className="w-5 h-5" />,  title: "Get Matched", desc: "Top 3 peers are alerted", color: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-400" },
            { icon: <Users className="w-5 h-5" />, title: "Collaborate", desc: "Chat + whiteboard live", color: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400" },
          ].map(step => (
            <div key={step.title} className="flex flex-col items-center text-center p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${step.color}`}>
                {step.icon}
              </div>
              <p className="font-semibold text-xs text-gray-900 dark:text-white">{step.title}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* SOS Request form */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-red-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Request Help</h2>
          </div>

          <form onSubmit={handleSendSos} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                What are you stuck on? *
              </label>
              <input
                value={topicTitle}
                onChange={e => setTopicTitle(e.target.value)}
                placeholder="e.g. Optics – Lens Formula Help"
                maxLength={120}
                required
                disabled={isSearching}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Subject
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubject(s)}
                    disabled={isSearching}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      subject === s
                        ? "bg-blue-500 text-white shadow-sm"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Status feedback */}
            {noHelpers && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                No helpers available right now. Try again in a moment!
              </div>
            )}

            {isSearching ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span className="text-sm font-medium">Searching for helpers…</span>
                </div>
                <button
                  type="button"
                  onClick={cancelSosRequest}
                  className="w-full py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!topicTitle.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white font-bold text-sm transition-colors active:scale-[0.99] shadow-lg shadow-red-500/20"
              >
                <AlertTriangle className="w-4 h-4" />
                Send SOS
              </button>
            )}
          </form>
        </div>

        {/* Social Handles Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Instagram className="w-5 h-5 text-pink-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">Your Social Handles</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            When you help others, they'll see buttons to follow you — a great way to grow your audience.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
                <Instagram className="w-4 h-4 text-white" />
              </div>
              <input
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                placeholder="Instagram username (e.g. @yourname)"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                <TikTokIcon className="w-4 h-4 text-white" />
              </div>
              <input
                value={tiktok}
                onChange={e => setTiktok(e.target.value)}
                placeholder="TikTok username (e.g. @yourname)"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={saveHandles}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 dark:bg-white hover:opacity-90 text-white dark:text-gray-900 font-semibold text-sm transition-all active:scale-[0.99]"
            >
              {handlesSaved
                ? <><CheckCircle2 className="w-4 h-4 text-green-400" /> Saved!</>
                : "Save Handles"
              }
            </button>
          </div>
        </div>

        {/* Subject Mastery */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 dark:text-white mb-1">Subject Strengths</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            This helps us match you with students in subjects you excel at.
          </p>
          <div className="space-y-3">
            {["Math", "Physics", "Chemistry", "Biology", "English", "Computer"].map(sub => {
              const val = mastery[sub.toLowerCase()] ?? 0;
              return (
                <div key={sub} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-20 shrink-0">{sub}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={val}
                    onChange={e => updateMastery(sub, Number(e.target.value))}
                    className="flex-1 h-1.5 accent-blue-500"
                  />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-8 text-right">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
