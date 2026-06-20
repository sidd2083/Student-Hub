import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StudyGuardian } from "@/components/StudyGuardian";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { TimerProvider } from "@/context/TimerContext";
import { ActiveRoomProvider } from "@/context/ActiveRoomContext";
import { SosProvider } from "@/context/SosContext";
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
const NepaliTyping        = lazy(() => import("@/pages/NepaliTyping"));
const Badges              = lazy(() => import("@/pages/Badges"));
const PartnerCreators     = lazy(() => import("@/pages/PartnerCreators"));
const SiddhantProfile     = lazy(() => import("@/pages/SiddhantProfile"));
const AarogyaProfile      = lazy(() => import("@/pages/AarogyaProfile"));
const DailyMissions       = lazy(() => import("@/pages/DailyMissions"));
const StudyRooms          = lazy(() => import("@/pages/StudyRooms"));
const StudyRoomCreate     = lazy(() => import("@/pages/StudyRoomCreate"));
const StudyRoomLive       = lazy(() => import("@/pages/StudyRoomLive"));
const SosNetwork          = lazy(() => import("@/pages/SosNetwork"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

// ── Idle-time route prefetching ────────────────────────────────────────────────
// Preloads the JS chunks for the most-visited pages while the browser is idle,
// so navigation feels instant rather than waiting for a chunk download.
if (typeof requestIdleCallback !== "undefined") {
  // Priority 1: SEO-critical tool pages + most-visited logged-out pages
  requestIdleCallback(() => {
    void import("@/pages/GpaCalculator");
    void import("@/pages/AttendanceCalculator");
    void import("@/pages/Notes");
  }, { timeout: 2000 });
  // Priority 2: Common navigation targets after login
  requestIdleCallback(() => {
    void import("@/pages/Dashboard");
    void import("@/pages/DailyMissions");
    void import("@/pages/Pyqs");
  }, { timeout: 4000 });
  // Priority 3: Secondary pages + study rooms (heavy but commonly visited)
  requestIdleCallback(() => {
    void import("@/pages/Pomodoro");
    void import("@/pages/NepAi");
    void import("@/pages/Tools");
    void import("@/pages/StudyRooms");
    void import("@/pages/StudyRoomLive");
  }, { timeout: 7000 });
}

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
// Minimal inline skeleton shown while a lazy chunk is downloading.
// Renders as a subtle pulsing bar at the top — visually communicates
// "loading" without layout shift, matches the app's white background.
function PageLoadingFallback() {
  return (
    <div style={{ minHeight: "100%" }}>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: "3px", background: "#e5e7eb", zIndex: 9998,
      }}>
        <div style={{
          height: "100%", width: "40%",
          background: "linear-gradient(90deg,#3b82f6,#60a5fa,#3b82f6)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.2s infinite linear",
          borderRadius: "0 2px 2px 0",
        }} />
      </div>
    </div>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    const raf = requestAnimationFrame(scrollToTop);
    return () => cancelAnimationFrame(raf);
  }, [location]);

  return (
    <div className="page-fade" style={{ minHeight: "100%" }}>
      <Suspense fallback={<PageLoadingFallback />}>
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
        <Route path="/tools/nepali-typing"         component={NepaliTyping} />
        <Route path="/tools"     component={Tools} />
        <Route path="/about"     component={About} />
        <Route path="/contact"   component={Contact} />
        <Route path="/privacy"   component={PrivacyPolicy} />
        <Route path="/terms"     component={Terms} />
        <Route path="/creators"  component={PartnerCreators} />
        <Route path="/siddhant-lamichhane" component={SiddhantProfile} />
        <Route path="/aarogya-sapkota"     component={AarogyaProfile} />

        <Route path="/ai"          component={NepAi} />
        <Route path="/report"      component={ReportCard} />
        <Route path="/todo"        component={Todo} />
        <Route path="/pomodoro"    component={Pomodoro} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/missions"    component={DailyMissions} />
        <Route path="/saved"       component={Saved} />
        <Route path="/mcq"         component={McqPractice} />

        <Route path="/badges"      component={Badges} />
        <Route path="/study-rooms/create" component={StudyRoomCreate} />
        <Route path="/study-rooms/:id"    component={StudyRoomLive} />
        <Route path="/study-rooms"        component={StudyRooms} />
        <Route path="/sos">
          <PrivateRoute><SosNetwork /></PrivateRoute>
        </Route>
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

// ── Backend keepalive ─────────────────────────────────────────────────────────
// Pings the Express backend every 10 min while any user is on the site.
// Prevents Render's free-tier from spinning down and causing a 30–60 s
// cold-start delay for the next visitor. No-op when VITE_WS_URL is not set
// (dev on Replit or same-origin deployment — backend is always up).
const KEEPALIVE_URL = import.meta.env.VITE_WS_URL
  ? `${import.meta.env.VITE_WS_URL}/health`
  : null;

function App() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Render keepalive: fire immediately, then every 10 min
  useEffect(() => {
    if (!KEEPALIVE_URL) return;
    const ping = () => fetch(KEEPALIVE_URL, { method: "GET", mode: "cors" }).catch(() => {});
    ping(); // immediate on page load
    const id = setInterval(ping, 10 * 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <TimerProvider>
                <ActiveRoomProvider>
                  <SosProvider>
                    <StudyGuardian />
                    <ErrorBoundary>
                      <Router />
                    </ErrorBoundary>
                  </SosProvider>
                </ActiveRoomProvider>
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
