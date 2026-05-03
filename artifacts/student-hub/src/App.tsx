import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
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
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AuthRedirect() {
  const { user, profile, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user && profile) {
      setLocation("/dashboard");
    }
  }, [user, profile, loading]);

  return <Login />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthRedirect} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/notes">
        <ProtectedRoute><Notes /></ProtectedRoute>
      </Route>
      <Route path="/mcq">
        <ProtectedRoute><McqPractice /></ProtectedRoute>
      </Route>
      <Route path="/pyqs">
        <ProtectedRoute><Pyqs /></ProtectedRoute>
      </Route>
      <Route path="/todo">
        <ProtectedRoute><Todo /></ProtectedRoute>
      </Route>
      <Route path="/pomodoro">
        <ProtectedRoute><Pomodoro /></ProtectedRoute>
      </Route>
      <Route path="/ai">
        <ProtectedRoute><NepAi /></ProtectedRoute>
      </Route>
      <Route path="/leaderboard">
        <ProtectedRoute><Leaderboard /></ProtectedRoute>
      </Route>
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
