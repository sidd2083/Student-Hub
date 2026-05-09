import { useEffect, useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Download, X, BookOpen, Star } from "lucide-react";

const DISMISSED_KEY = "pwa-banner-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function InstallBanner() {
  const { isInstallable, isInstalled, installApp } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  useEffect(() => {
    if (!isInstallable || isInstalled) return;

    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) {
      const dismissed = Number(raw);
      if (Date.now() - dismissed < DISMISS_DURATION_MS) return;
    }

    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled]);

  const dismiss = () => {
    setAnimateOut(true);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setTimeout(() => setVisible(false), 300);
  };

  const handleInstall = async () => {
    await installApp();
    dismiss();
  };

  if (!visible) return null;

  return (
    <>
      <div
        className="md:hidden fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
        onClick={dismiss}
        style={{
          animation: animateOut ? "fadeOut 0.3s ease forwards" : "fadeIn 0.3s ease forwards",
        }}
      />
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-[70] px-3 pb-3"
        style={{
          animation: animateOut
            ? "slideDown 0.3s ease forwards"
            : "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
      >
        <style>{`
          @keyframes slideUp   { from { opacity:0; transform:translateY(100%); } to { opacity:1; transform:translateY(0); } }
          @keyframes slideDown { from { opacity:1; transform:translateY(0); }    to { opacity:0; transform:translateY(100%); } }
          @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
          @keyframes fadeOut   { from { opacity:1; } to { opacity:0; } }
        `}</style>

        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-all"
            style={{ position: "absolute" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="px-5 pt-6 pb-5">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base font-bold text-gray-900">Student Hub</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Install for a faster, app-like experience — notes, PYQs, AI tutor & more, right on your home screen.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              {["Works offline", "No browser UI", "Faster loading"].map(f => (
                <span key={f} className="text-[10px] font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                  {f}
                </span>
              ))}
            </div>

            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-sm rounded-2xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-purple-200 active:scale-95"
            >
              <Download className="w-4 h-4" />
              Install App — It's Free
            </button>

            <button
              onClick={dismiss}
              className="w-full mt-2.5 py-2.5 text-sm text-gray-400 font-medium hover:text-gray-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
