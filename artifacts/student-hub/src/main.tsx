import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

// Suppress Firebase WebChannel reconnection noise.
// Firebase's Firestore SDK uses long-polling/WebSocket internally and
// aborts/retries connections automatically — these are NOT real errors.
// Without this, Vite's dev-mode error overlay fires on every reconnect.
// Use `capture: true` so this runs before Vite's error-overlay plugin listener.
window.addEventListener("unhandledrejection", (e) => {
  const msg: string = e.reason?.message ?? "";
  if (
    msg === "The user aborted a request." ||
    msg.includes("signal is aborted") ||
    msg.includes("aborted without reason") ||
    msg.includes("primary lease") ||
    msg.includes("Failed to obtain")
  ) {
    e.preventDefault();
  }
}, { capture: true });

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("[SW] Registration failed:", err));
  });
}
