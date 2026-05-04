/**
 * Route guards for Student Hub.
 *
 * Uses declarative <Redirect> (not useEffect) so redirects happen
 * synchronously on render — no intermediate flicker or race conditions.
 *
 * PublicRoute   — /login           — redirect to /dashboard if already authenticated
 * SetupRoute    — /setup-profile   — only allow user-without-profile; else /dashboard
 * PrivateRoute  — all app pages    — require user + profile; else /login or /setup-profile
 * AdminDashboardRoute — /admin/dashboard — require admin session or admin role
 */

import { Redirect } from "wouter";
import { useAuth } from "@/context/AuthContext";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading your session…</p>
    </div>
  );
}

/** /login — redirect logged-in users away */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user && profile) {
    console.log("[Route] PublicRoute → /dashboard");
    return <Redirect to="/dashboard" />;
  }
  if (user && !profile) {
    console.log("[Route] PublicRoute → /setup-profile");
    return <Redirect to="/setup-profile" />;
  }
  return <>{children}</>;
}

/** /setup-profile — only for user with no profile */
export function SetupRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) {
    console.log("[Route] SetupRoute → no user, /");
    return <Redirect to="/" />;
  }
  if (profile) {
    console.log("[Route] SetupRoute → profile exists, /dashboard");
    return <Redirect to="/dashboard" />;
  }
  return <>{children}</>;
}

/** All private pages — require user + profile */
export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) {
    console.log("[Route] PrivateRoute → no user, /");
    return <Redirect to="/" />;
  }
  if (!profile) {
    console.log("[Route] PrivateRoute → no profile, /setup-profile");
    return <Redirect to="/setup-profile" />;
  }
  return <>{children}</>;
}

const ADMIN_SESSION = "admin_session_v1";

/** /admin/dashboard — admin role OR hardcoded session */
export function AdminDashboardRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const hasSession = sessionStorage.getItem(ADMIN_SESSION) === "1";

  if (loading && !hasSession) return <LoadingScreen />;

  const isAdmin =
    hasSession ||
    (user && profile?.role === "admin");

  if (!isAdmin) {
    console.log("[Route] AdminDashboardRoute → no access, /admin");
    return <Redirect to="/admin" />;
  }
  return <>{children}</>;
}
