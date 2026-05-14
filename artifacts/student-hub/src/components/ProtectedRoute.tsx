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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5">
      <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
        <svg width="38" height="38" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M90 44 C90 44 56 39 36 48 L36 136 C56 127 90 132 90 132 L90 44Z" fill="white" fillOpacity="0.95"/>
          <path d="M90 44 C90 44 124 39 144 48 L144 136 C124 127 90 132 90 132 L90 44Z" fill="white" fillOpacity="0.70"/>
          <line x1="90" y1="44" x2="90" y2="132" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
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
