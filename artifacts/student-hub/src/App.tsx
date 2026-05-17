import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StudyGuardian } from "@/components/StudyGuardian";
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

// ── Eager — shown immediately on first visit or common redirect ───────────────
import Home     from "@/pages/Home";
import Login    from "@/pages/Login";
import NotFound from "@/pages/not-found";

// ── Lazy — each page becomes its own chunk; loaded on demand ─────────────────
const Dashboard    = lazy(() => import("@/pages/Dashboard"));
const Onboarding   = lazy(() => import("@/pages/Onboarding"));
const Notes        = lazy(() => import("@/pages/Notes"));
const NepAi        = lazy(() => import("@/pages/NepAi"));
const NotePage     = lazy(() => import("@/pages/NotePage"));
const Pyqs         = lazy(() => import("@/pages/Pyqs"));
const PyqPage      = lazy(() => import("@/pages/PyqPage"));
const Todo         = lazy(() => import("@/pages/Todo"));
const Pomodoro     = lazy(() => import("@/pages/Pomodoro"));
const Leaderboard  = lazy(() => import("@/pages/Leaderboard"));
const ReportCard   = lazy(() => import("@/pages/ReportCard"));
const Settings     = lazy(() => import("@/pages/Settings"));
const About        = lazy(() => import("@/pages/About"));
const Contact      = lazy(() => import("@/pages/Contact"));
const Saved        = lazy(() => import("@/pages/Saved"));
const McqPractice  = lazy(() => import("@/pages/McqPractice"));
const AdminLogin   = lazy(() => import("@/pages/AdminLogin"));
const Admin        = lazy(() => import("@/pages/Admin"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Terms        = lazy(() => import("@/pages/Terms"));
const Tools               = lazy(() => import("@/pages/Tools"));
const GpaCalculator       = lazy(() => import("@/pages/GpaCalculator"));
const AttendanceCalculator = lazy(() => import("@/pages/AttendanceCalculator"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

function scrollToTop() {
  const scrollArea = document.querySelector(".main-scroll-area") as HTMLElement | null;
  if (scrollArea) {
    scrollArea.scrollTop = 0;
  } else {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }
}

/**
 * PageWrapper — page transitions with scroll restoration.
 *
 * Uses CSS `page-fade` keyframe (index.css) — zero JS overhead,
 * GPU-composited opacity + translate, instant on fast devices.
 * Scroll resets to top on every navigation.
 */
function PageWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    scrollToTop();
    const raf = requestAnimationFrame(scrollToTop);
    return () => cancelAnimationFrame(raf);
  }, [location]);

  return (
    <div key={location} className="page-fade" style={{ minHeight: "100%" }}>
      <Suspense fallback={<div style={{ minHeight: "100%" }} />}>
        {children}
      </Suspense>
    </div>
  );
}

// ── PWA / returning-user flash fix ────────────────────────────────────────────
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
        <Route path="/"          component={SmartHome} />

        <Route path="/notes/:id" component={NotePage} />
        <Route path="/pyq/:id"   component={PyqPage} />
        <Route path="/notes"     component={Notes} />
        <Route path="/pyqs"      component={Pyqs} />
        <Route path="/tools/gpa-calculator"        component={GpaCalculator} />
        <Route path="/tools/attendance-calculator" component={AttendanceCalculator} />
        <Route path="/tools"     component={Tools} />
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
                <StudyGuardian />
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
