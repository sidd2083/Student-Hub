import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { TimerProvider } from "@/context/TimerContext";
import {
  PrivateRoute,
  AdminDashboardRoute,
} from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Notes from "@/pages/Notes";
import NotePage from "@/pages/NotePage";
import Pyqs from "@/pages/Pyqs";
import PyqPage from "@/pages/PyqPage";
import Todo from "@/pages/Todo";
import Pomodoro from "@/pages/Pomodoro";
import NepAi from "@/pages/NepAi";
import Leaderboard from "@/pages/Leaderboard";
import ReportCard from "@/pages/ReportCard";
import Settings from "@/pages/Settings";
import AdminLogin from "@/pages/AdminLogin";
import Admin from "@/pages/Admin";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Router() {
  return (
    <Switch>
      {/* ── Admin — completely independent, no layout ── */}
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard">
        <AdminDashboardRoute><Admin /></AdminDashboardRoute>
      </Route>

      {/* ── Standalone pages — no layout shell ── */}
      <Route path="/login" component={Login} />
      <Route path="/setup-profile" component={Onboarding} />
      <Route path="/onboarding" component={Onboarding} />

      {/* ── All other routes — AppShell selects layout based on auth ── */}
      <Route>
        <AppShell>
          <Switch>
            <Route path="/" component={Home} />

            <Route path="/notes/:id" component={NotePage} />
            <Route path="/pyq/:id" component={PyqPage} />
            <Route path="/notes" component={Notes} />
            <Route path="/pyqs" component={Pyqs} />
            <Route path="/about" component={About} />
            <Route path="/contact" component={Contact} />

            <Route path="/ai" component={NepAi} />
            <Route path="/report" component={ReportCard} />
            <Route path="/todo" component={Todo} />
            <Route path="/pomodoro" component={Pomodoro} />
            <Route path="/leaderboard" component={Leaderboard} />

            <Route path="/dashboard">
              <PrivateRoute><Dashboard /></PrivateRoute>
            </Route>
            <Route path="/settings">
              <PrivateRoute><Settings /></PrivateRoute>
            </Route>

            <Route component={NotFound} />
          </Switch>
        </AppShell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <TimerProvider>
                <ErrorBoundary>
                  <Router />
                </ErrorBoundary>
              </TimerProvider>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
