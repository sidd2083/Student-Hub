import { useState } from "react";

const IS_PWA =
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true);

const SPLASH_KEY = "sh_splash_v1";

const alreadyShown =
  typeof sessionStorage !== "undefined" &&
  sessionStorage.getItem(SPLASH_KEY) === "1";

export function PwaSplash() {
  const [gone, setGone] = useState(false);

  if (!IS_PWA || alreadyShown || gone) return null;

  function handleAnimationEnd() {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setGone(true);
  }

  return (
    <div
      className="pwa-splash"
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="pwa-splash-logo">
        <div
          style={{
            width: 80,
            height: 80,
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 60px rgba(59,130,246,0.45)",
          }}
        >
          <svg width="46" height="46" viewBox="0 0 180 180" fill="none">
            <path
              d="M90 44 C90 44 56 39 36 48 L36 136 C56 127 90 132 90 132 L90 44Z"
              fill="white"
              fillOpacity="0.95"
            />
            <path
              d="M90 44 C90 44 124 39 144 48 L144 136 C124 127 90 132 90 132 L90 44Z"
              fill="white"
              fillOpacity="0.70"
            />
            <line
              x1="90" y1="44" x2="90" y2="132"
              stroke="#93c5fd"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p
          style={{
            marginTop: 16,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "#111827",
          }}
        >
          Student Hub
        </p>
        <p
          style={{
            marginTop: 4,
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          Study smarter. Rank higher.
        </p>
      </div>
    </div>
  );
}
