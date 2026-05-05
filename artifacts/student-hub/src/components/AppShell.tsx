import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { PublicLayout } from "@/components/PublicLayout";
import { LoadingScreen } from "@/components/ProtectedRoute";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user) return <Layout>{children}</Layout>;
  return <PublicLayout>{children}</PublicLayout>;
}
