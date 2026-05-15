import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
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
import { PwaSplash } from "@/components/PwaSplash";

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
 * PageWrapper — single persistent div, never remounted.
 * On every navigation, useLayoutEffect fires before the browser paints,
 * resets the CSS animation, and lets it replay cleanly.
 * No key-based remount = no duplicate-render glitch = no vibration.
 */
function PageWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reset CSS animation so it replays on every route change
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = "";
    // Scroll the page content back to the top on every navigation
    const scrollArea = el.closest(".main-scroll-area") as HTMLElement | null;
    if (scrollArea) scrollArea.scrollTop = 0;
  }, [location]);

  return (
    <div ref={ref} className="page-enter" style={{ minHeight: "100%" }}>
      {children}
    </div>
  );
}

// ── PWA / returning-user flash fix ────────────────────────────────────────────
// If auth hint says the user was logged in (set by Firebase on last session),
// skip rendering the public Home page entirely and redirect straight to /dashboard.
// Firebase will confirm auth in the background — if the session expired, AuthContext
// will redirect back to /login. This removes the public-page flash on PWA cold start.
const AUTH_HINT_ACTIVE =
  typeof localStorage !== "undefined" && localStorage.getItem("sh_authed") === "1";

function SmartHome() {
  if (AUTH_HINT_ACTIVE) return <Redirect to="/dashboard" replace />;
  return <Home />;
}

function AppRoutes() {
  return (
    <PageWrapper>
      <Switch>
        <Route path="/" component={SmartHome} />

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
          <PwaSplash />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
