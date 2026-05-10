/**
 * Route guards for Student Hub.
 *
 * Navigation is primarily driven by onAuthStateChanged in AuthContext
 * (via window.location.replace). These guards are a safety net to prevent
 * rendering protected content while auth is still loading.
 */

import { useAuth } from "@/context/AuthContext";

export function LoadingScreen() {
  const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  if (isDesktop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-800 tracking-tight">Student Hub</p>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mt-1" />
      </div>
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-1">
        <p className="text-[11px] text-gray-400 tracking-widest uppercase font-medium">By</p>
        <p className="text-sm font-semibold text-gray-500 tracking-wide">Tufan Production</p>
      </div>
    </div>
  );
}

/** All private pages — show spinner while auth loads, then render */
export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { loading, user, profile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return null;

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
