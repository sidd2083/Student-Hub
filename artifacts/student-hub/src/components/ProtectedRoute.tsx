import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, redirectLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !redirectLoading) {
      if (!user) setLocation("/");
      else if (!profile) setLocation("/onboarding");
    }
  }, [user, profile, loading, redirectLoading]);

  if (loading || redirectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) return null;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, redirectLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !redirectLoading) {
      if (!user) setLocation("/");
      else if (!profile) setLocation("/onboarding");
      else if (profile.role !== "admin") setLocation("/dashboard");
    }
  }, [user, profile, loading, redirectLoading]);

  if (loading || redirectLoading || !user || !profile) return null;
  return <>{children}</>;
}
