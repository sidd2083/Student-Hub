import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
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
import { InstallBanner } from "@/components/InstallBanner";

// ── All pages eagerly loaded — zero Suspense flash on navigation ─────────────
import Home         from "@/pages/Home";
import Login        from "@/pages/Login";
import Dashboard    from "@/pages/Dashboard";
import Onboarding   from "@/pages/Onboarding";
import Notes        from "@/pages/Notes";
import NepAi        from "@/pages/NepAi";
import NotePage     from "@/pages/NotePage";
import Pyqs         from "@/pages/Pyqs";
import PyqPage      from "@/pages/PyqPage";
import Todo         from "@/pages/Todo";
import Pomodoro     from "@/pages/Pomodoro";
import Leaderboard  from "@/pages/Leaderboard";
import ReportCard   from "@/pages/ReportCard";
import Settings     from "@/pages/Settings";
import About        from "@/pages/About";
import Contact      from "@/pages/Contact";
import Saved        from "@/pages/Saved";
import McqPractice  from "@/pages/McqPractice";
import AdminLogin    from "@/pages/AdminLogin";
import Admin         from "@/pages/Admin";
import NotFound      from "@/pages/not-found";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Terms         from "@/pages/Terms";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

/**
 * PageWrapper — the div stays mounted forever.
 * On each navigation useLayoutEffect fires *before* the browser paints,
 * resets the CSS animation, and lets it replay from opacity:0 → opacity:1.
 * No key-based remount → zero white-flash gap between pages.
 */
function PageWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.animation = "none";
    void el.offsetHeight; // force reflow so the browser registers the reset
    el.style.animation = "";
  }, [location]);

  return (
    <div
      ref={ref}
      className="page-enter"
      style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}
    >
      {children}
    </div>
  );
}

function AppRoutes() {
  return (
    <PageWrapper>
      <Switch>
        <Route path="/" component={Home} />

        <Route path="/notes/:id" component={NotePage} />
        <Route path="/pyq/:id"   component={PyqPage} />
        <Route path="/notes"     component={Notes} />
        <Route path="/pyqs"      component={Pyqs} />
        <Route path="/about"     component={About} />
        <Route path="/contact"   component={Contact} />
        <Route path="/privacy"   component={PrivacyPolicy} />
        <Route path="/terms"     component={Terms} />

        <Route path="/ai"          component={NepAi} />
        <Route path="/report"      component={ReportCard} />
        <Route path="/todo"        component={Todo} />
        <Route path="/pomodoro"    component={Pomodoro} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/saved"       component={Saved} />
        <Route path="/mcq"         component={McqPractice} />

        <Route path="/dashboard">
          <PrivateRoute><Dashboard /></PrivateRoute>
        </Route>
        <Route path="/settings">
          <PrivateRoute><Settings /></PrivateRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </PageWrapper>
  );
}

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/admin" component={AdminLogin} />
        <Route path="/admin/dashboard">
          <AdminDashboardRoute><Admin /></AdminDashboardRoute>
        </Route>

        <Route path="/login"         component={Login} />
        <Route path="/setup-profile" component={Onboarding} />
        <Route path="/onboarding"    component={Onboarding} />

        <Route>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

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
          <InstallBanner />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
