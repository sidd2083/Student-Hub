import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { PublicLayout } from "@/components/PublicLayout";

interface AppShellProps {
  children: React.ReactNode;
}

// Read once at module load — synchronous, costs nothing.
// Set by AuthContext the moment Firebase confirms login (before any Firestore fetch).
// Cleared only on explicit logout or when Firebase says the user is signed out.
// This means a returning logged-in user sees the authenticated layout on the
// very first render, with zero flicker.
const AUTH_HINT = (() => {
  try { return localStorage.getItem("sh_authed") === "1"; } catch { return false; }
})();

export function AppShell({ children }: AppShellProps) {
  const { user, profile, loading } = useAuth();

  // Authenticated if Firebase user or Firestore profile is loaded,
  // OR if the auth hint says this device had a confirmed login last time.
  const isAuthenticated = !!(user || profile) || AUTH_HINT;

  // Still waiting for Firebase to resolve AND we have no hint either way.
  // Show a neutral screen that matches the app background — never the wrong layout.
  // This only happens on the very first-ever session on a device (no flags set yet).
  if (loading && !isAuthenticated) {
    return <div className="min-h-dvh bg-[#f9fafb] dark:bg-[#030712]" />;
  }

  if (isAuthenticated) return <Layout>{children}</Layout>;
  return <PublicLayout>{children}</PublicLayout>;
}
