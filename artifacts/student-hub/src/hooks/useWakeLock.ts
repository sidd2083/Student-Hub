import { useEffect, useRef } from "react";

/**
 * useWakeLock — prevents the screen from dimming/locking while the user
 * is actively studying in a Study Room.
 *
 * Zero Firestore reads/writes. Pure browser Screen Wake Lock API.
 * Silently no-ops on browsers/devices that don't support it (iOS < 16.4,
 * Firefox, battery-saver mode, etc.).
 *
 * Re-acquires automatically if the browser releases the lock on its own
 * (e.g. when the tab comes back to the foreground after being hidden).
 *
 * @param active — true while the user should be kept awake
 */
export function useWakeLock(active: boolean) {
  const lockRef     = useRef<WakeLockSentinel | null>(null);
  const releasedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
      return;
    }

    if (!("wakeLock" in navigator)) return;

    releasedRef.current = false;

    const acquire = async () => {
      if (releasedRef.current) return;
      try {
        lockRef.current = await navigator.wakeLock.request("screen");
        lockRef.current.addEventListener("release", () => {
          // Browser released the lock (e.g. tab went hidden then came back).
          // Re-acquire on the next visibilitychange so we never fight the browser.
          lockRef.current = null;
        });
      } catch {
        // Silently ignore — battery saver, unsupported, permission denied, etc.
      }
    };

    acquire();

    // Re-acquire when the page becomes visible again (browser auto-releases
    // the wake lock when the tab is hidden, then restores when visible).
    const onVisible = () => {
      if (document.visibilityState === "visible" && !lockRef.current && !releasedRef.current) {
        acquire();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      releasedRef.current = true;
      document.removeEventListener("visibilitychange", onVisible);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
