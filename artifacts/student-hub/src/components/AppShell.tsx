import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { PublicLayout } from "@/components/PublicLayout";

interface AppShellProps {
  children: React.ReactNode;
}

// Read once at module load — synchronous, no render cost.
// This is the "auth hint" set by AuthContext when a user logs in and cleared
// on logout. It means "someone was logged in on this device last time", so we
// can show the authenticated layout immediately even before Firebase resolves.
const AUTH_HINT = (() => {
  try { return localStorage.getItem("sh_authed") === "1"; } catch { return false; }
})();

export function AppShell({ children }: AppShellProps) {
  const { user, profile } = useAuth();

  // Three sources that confirm the user is (or was) authenticated:
  //   1. user   — Firebase user object (available ~1s after mount)
  //   2. profile — Firestore profile from localStorage cache (instant)
  //   3. AUTH_HINT — lightweight flag set on login, cleared on logout (instant)
  // Using any one of them avoids showing the public layout for returning users.
  const isAuthenticated = !!(user || profile) || AUTH_HINT;

  if (isAuthenticated) return <Layout>{children}</Layout>;
  return <PublicLayout>{children}</PublicLayout>;
}
