import { useAuth } from "@/context/AuthContext";

export function LoadingScreen() {
  return <div className="min-h-screen bg-white dark:bg-gray-950" />;
}

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { loading, user, profile } = useAuth();

  if (loading && !profile) return <LoadingScreen />;
  if (!user && !profile) return null;

  if (!profile) {
    window.location.replace("/setup-profile");
    return null;
  }

  return <>{children}</>;
}

const ADMIN_SESSION = "admin_session_v1";

export function AdminDashboardRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const hasSession = sessionStorage.getItem(ADMIN_SESSION) === "1";

  if (loading && !hasSession) return <LoadingScreen />;

  const isAdmin = hasSession || (user && profile?.role === "admin");
  if (!isAdmin) return null;

  return <>{children}</>;
}
