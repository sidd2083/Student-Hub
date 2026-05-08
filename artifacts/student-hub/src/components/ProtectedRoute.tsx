/**
 * Route guards for Student Hub.
 *
 * Navigation is primarily driven by onAuthStateChanged in AuthContext
 * (via window.location.replace). These guards are a safety net to prevent
 * rendering protected content while auth is still loading.
 */

import { useAuth } from "@/context/AuthContext";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Checking your session…</p>
    </div>
  );
}

/** All private pages — show spinner while auth loads, then render */
export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { loading, user, profile } = useAuth();

  // While auth is initialising, show spinner
  if (loading) return <LoadingScreen />;

  // Not logged in — auth listener will redirect away
  if (!user) return null;

  // Logged in but no profile yet — send to setup
  if (!profile) {
    window.location.replace("/setup-profile");
    return null;
  }

  return <>{children}</>;
}

const ADMIN_SESSION = "admin_session_v1";

/** /admin/dashboard — admin role OR hardcoded session */
export function AdminDashboardRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const hasSession = sessionStorage.getItem(ADMIN_SESSION) === "1";

  if (loading && !hasSession) return <LoadingScreen />;

  const isAdmin = hasSession || (user && profile?.role === "admin");
  if (!isAdmin) return null;

  return <>{children}</>;
}
