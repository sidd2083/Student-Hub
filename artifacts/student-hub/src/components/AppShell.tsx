import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { PublicLayout } from "@/components/PublicLayout";
import { LoadingScreen } from "@/components/ProtectedRoute";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, profile, loading } = useAuth();

  if (loading && !profile) return <LoadingScreen />;
  if (user || profile) return <Layout>{children}</Layout>;
  return <PublicLayout>{children}</PublicLayout>;
}
