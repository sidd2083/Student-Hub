import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
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

// ── Eager: only the shell pages that must be instant ───────────────────────
import Home       from "@/pages/Home";
import Login      from "@/pages/Login";
import Dashboard  from "@/pages/Dashboard";
import Onboarding from "@/pages/Onboarding";

// ── Lazy: everything else — loaded on demand, cached by SW ─────────────────
const Notes       = lazy(() => import("@/pages/Notes"));
const NotePage    = lazy(() => import("@/pages/NotePage"));
const Pyqs        = lazy(() => import("@/pages/Pyqs"));
const PyqPage     = lazy(() => import("@/pages/PyqPage"));
const Todo        = lazy(() => import("@/pages/Todo"));
const Pomodoro    = lazy(() => import("@/pages/Pomodoro"));
const NepAi       = lazy(() => import("@/pages/NepAi"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const ReportCard  = lazy(() => import("@/pages/ReportCard"));
const Settings    = lazy(() => import("@/pages/Settings"));
const About       = lazy(() => import("@/pages/About"));
const Contact     = lazy(() => import("@/pages/Contact"));
const Saved       = lazy(() => import("@/pages/Saved"));
const McqPractice = lazy(() => import("@/pages/McqPractice"));
const AdminLogin    = lazy(() => import("@/pages/AdminLogin"));
const Admin         = lazy(() => import("@/pages/Admin"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Terms         = lazy(() => import("@/pages/Terms"));
const NotFound      = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.12, ease: "easeIn" } },
};

function AppRoutes() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}
      >
        <Switch>
          <Route path="/" component={Home} />

          <Route path="/notes/:id" component={NotePage} />
          <Route path="/pyq/:id" component={PyqPage} />
          <Route path="/notes" component={Notes} />
          <Route path="/pyqs" component={Pyqs} />
          <Route path="/about" component={About} />
          <Route path="/contact" component={Contact} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={Terms} />

          <Route path="/ai" component={NepAi} />
          <Route path="/report" component={ReportCard} />
          <Route path="/todo" component={Todo} />
          <Route path="/pomodoro" component={Pomodoro} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/saved" component={Saved} />
          <Route path="/mcq" component={McqPractice} />

          <Route path="/dashboard">
            <PrivateRoute><Dashboard /></PrivateRoute>
          </Route>
          <Route path="/settings">
            <PrivateRoute><Settings /></PrivateRoute>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
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

        <Route path="/login" component={Login} />
        <Route path="/setup-profile" component={Onboarding} />
        <Route path="/onboarding" component={Onboarding} />

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
