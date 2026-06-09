import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

const DISMISSED_KEY = "sh_install_banner_dismissed";

export function InstallBanner() {
  const { isInstallable, isInstalled, installApp } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
  });
  const [isMobile, setIsMobile] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia("(max-width: 768px)").matches;
    setIsMobile(mobile);
  }, []);

  useEffect(() => {
    if (isMobile && !dismissed && !isInstalled && isInstallable) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, [isMobile, dismissed, isInstalled, isInstallable]);

  function dismiss() {
    setVisible(false);
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
  }

  async function handleInstall() {
    await installApp();
    dismiss();
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
            Add to Home Screen
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Study faster — no browser needed
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
        <button
          onClick={dismiss}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
}
