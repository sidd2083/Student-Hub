import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { PublicLayout } from "@/components/PublicLayout";

interface AppShellProps {
  children: React.ReactNode;
}

// Read both hints once at module load — synchronous, zero cost.
// AUTH_HINT  = "1" → user was logged in on this device last time
// GUEST_HINT = "1" → user explicitly logged out on this device last time
// Both are written by AuthContext; cleared when the other is set.
const AUTH_HINT = (() => {
  try { return localStorage.getItem("sh_authed") === "1"; } catch { return false; }
})();
const GUEST_HINT = (() => {
  try { return localStorage.getItem("sh_guest") === "1"; } catch { return false; }
})();

export function AppShell({ children }: AppShellProps) {
  const { user, profile, loading } = useAuth();

  // Three sources confirm the user IS authenticated right now:
  //   1. user    — Firebase user object (resolves ~1 s after mount)
  //   2. profile — Firestore profile from localStorage cache (instant)
  //   3. AUTH_HINT — flag set at login, cleared at logout (instant)
  const isAuthenticated = !!(user || profile) || AUTH_HINT;

  // GUEST_HINT means the user explicitly signed out on this device —
  // we can show PublicLayout immediately without waiting for Firebase.
  const isDefinitelyGuest = GUEST_HINT && !AUTH_HINT;

  // True uncertainty: Firebase hasn't resolved yet and we have no hint in
  // either direction (brand new visitor, or localStorage was wiped).
  // Show a neutral screen — same background as the inline HTML splash —
  // instead of briefly rendering the wrong layout and then flipping.
  if (loading && !isAuthenticated && !isDefinitelyGuest) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950" />;
  }

  if (isAuthenticated) return <Layout>{children}</Layout>;
  return <PublicLayout>{children}</PublicLayout>;
}
