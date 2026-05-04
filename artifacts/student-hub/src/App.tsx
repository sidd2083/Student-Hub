import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import {
  PublicRoute,
  SetupRoute,
  PrivateRoute,
  AdminDashboardRoute,
  LoadingScreen,
} from "@/components/ProtectedRoute";

import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Notes from "@/pages/Notes";
import McqPractice from "@/pages/McqPractice";
import Pyqs from "@/pages/Pyqs";
import Todo from "@/pages/Todo";
import Pomodoro from "@/pages/Pomodoro";
import NepAi from "@/pages/NepAi";
import Leaderboard from "@/pages/Leaderboard";
import Settings from "@/pages/Settings";
import AdminLogin from "@/pages/AdminLogin";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/**
 * Root "/" — waits for auth then dispatches:
 *   user + profile  → /dashboard
 *   user + no prof  → /setup-profile
 *   no user         → render Login (no redirect flash)
 */
function RootGate() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user && profile) return <Redirect to="/dashboard" />;
  if (user && !profile) return <Redirect to="/setup-profile" />;
  return <Login />;
}

function Router() {
  return (
    <Switch>
      {/* Root — smart dispatch */}
      <Route path="/" component={RootGate} />

      {/* Public — logged-in users get redirected away */}
      <Route path="/login">
        <PublicRoute><Login /></PublicRoute>
      </Route>

      {/* Setup — only for user without profile */}
      <Route path="/setup-profile">
        <SetupRoute><Onboarding /></SetupRoute>
      </Route>
      <Route path="/onboarding">
        <SetupRoute><Onboarding /></SetupRoute>
      </Route>

      {/* Private — require user + profile */}
      <Route path="/dashboard">
        <PrivateRoute><Dashboard /></PrivateRoute>
      </Route>
      <Route path="/notes">
        <PrivateRoute><Notes /></PrivateRoute>
      </Route>
      <Route path="/mcq">
        <PrivateRoute><McqPractice /></PrivateRoute>
      </Route>
      <Route path="/pyqs">
        <PrivateRoute><Pyqs /></PrivateRoute>
      </Route>
      <Route path="/todo">
        <PrivateRoute><Todo /></PrivateRoute>
      </Route>
      <Route path="/pomodoro">
        <PrivateRoute><Pomodoro /></PrivateRoute>
      </Route>
      <Route path="/ai">
        <PrivateRoute><NepAi /></PrivateRoute>
      </Route>
      <Route path="/leaderboard">
        <PrivateRoute><Leaderboard /></PrivateRoute>
      </Route>
      <Route path="/settings">
        <PrivateRoute><Settings /></PrivateRoute>
      </Route>

      {/* Admin login — standalone, no auth required */}
      <Route path="/admin" component={AdminLogin} />

      {/* Admin dashboard — requires admin session or admin role */}
      <Route path="/admin/dashboard">
        <AdminDashboardRoute><Admin /></AdminDashboardRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
