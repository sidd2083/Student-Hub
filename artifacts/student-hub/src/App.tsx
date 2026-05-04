import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import {
  PublicRoute,
  SetupRoute,
  PrivateRoute,
  AdminRoute,
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
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/**
 * Root path "/" — smart gate:
 * Waits for loading, then dispatches based on auth state.
 */
function RootGate() {
  const { loading, user, profile } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading your session…</p>
      </div>
    );
  }

  if (user && profile) {
    console.log("[Route] RootGate → /dashboard");
    setLocation("/dashboard");
    return null;
  }

  if (user && !profile) {
    console.log("[Route] RootGate → /setup-profile");
    setLocation("/setup-profile");
    return null;
  }

  // No user — render login inline to avoid a redirect flash
  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootGate} />

      {/* Public — redirect logged-in users away */}
      <Route path="/login">
        <PublicRoute><Login /></PublicRoute>
      </Route>

      {/* Setup — only for users without a profile */}
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

      {/* Admin — requires user; Admin page handles role/hardcoded login internally */}
      <Route path="/admin">
        <AdminRoute><Admin /></AdminRoute>
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
