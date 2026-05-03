import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!user) setLocation("/");
      else if (!profile) setLocation("/setup-profile");
    }
  }, [user, profile, loading]);

  if (loading || (user && !profile)) {
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
  const { user, profile, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!user) setLocation("/");
      else if (!profile) setLocation("/setup-profile");
      else if (profile.role !== "admin") setLocation("/dashboard");
    }
  }, [user, profile, loading]);

  if (loading || !user || !profile) return null;
  return <>{children}</>;
}
