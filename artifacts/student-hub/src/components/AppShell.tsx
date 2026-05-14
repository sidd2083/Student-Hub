import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { PublicLayout } from "@/components/PublicLayout";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, profile } = useAuth();

  // Never block public pages with a loading screen.
  // PrivateRoute handles auth-gating for protected pages.
  if (user || profile) return <Layout>{children}</Layout>;
  return <PublicLayout>{children}</PublicLayout>;
}
