import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading your session…</p>
    </div>
  );
}

/**
 * PublicRoute — for unauthenticated pages (login).
 * If user + profile exist → /dashboard
 * If user but no profile → /setup-profile
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      console.log("[Route] PublicRoute → redirecting to /dashboard");
      setLocation("/dashboard");
    } else if (user && !profile) {
      console.log("[Route] PublicRoute → redirecting to /setup-profile");
      setLocation("/setup-profile");
    }
  }, [user, profile, loading]);

  if (loading) return <LoadingScreen />;
  if (user) return null; // redirecting, show nothing
  return <>{children}</>;
}

/**
 * SetupRoute — for /setup-profile.
 * If no user → /
 * If profile exists → /dashboard
 */
export function SetupRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      console.log("[Route] SetupRoute → no user, redirecting to /");
      setLocation("/");
    } else if (profile) {
      console.log("[Route] SetupRoute → profile exists, redirecting to /dashboard");
      setLocation("/dashboard");
    }
  }, [user, profile, loading]);

  if (loading) return <LoadingScreen />;
  if (!user || profile) return null; // redirecting
  return <>{children}</>;
}

/**
 * PrivateRoute — for all authenticated pages.
 * If no user → /
 * If no profile → /setup-profile
 */
export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      console.log("[Route] PrivateRoute → no user, redirecting to /");
      setLocation("/");
    } else if (!profile) {
      console.log("[Route] PrivateRoute → no profile, redirecting to /setup-profile");
      setLocation("/setup-profile");
    }
  }, [user, profile, loading]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;
  if (!profile) return <LoadingScreen />;
  return <>{children}</>;
}

/**
 * AdminRoute — like PrivateRoute but also requires admin role.
 * Non-admins get the Admin component which shows its own login form.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      console.log("[Route] AdminRoute → no user, redirecting to /");
      setLocation("/");
    }
  }, [user, loading]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;
  if (!profile) return <LoadingScreen />;
  return <>{children}</>;
}
