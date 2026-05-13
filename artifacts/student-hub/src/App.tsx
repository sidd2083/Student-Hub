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

// ── Eager imports (zero load delay on navigation) ──────────────────────────
import Home        from "@/pages/Home";
import Login       from "@/pages/Login";
import Onboarding  from "@/pages/Onboarding";
import Dashboard   from "@/pages/Dashboard";
import Notes       from "@/pages/Notes";
import NotePage    from "@/pages/NotePage";
import Pyqs        from "@/pages/Pyqs";
import PyqPage     from "@/pages/PyqPage";
import Todo        from "@/pages/Todo";
import Pomodoro    from "@/pages/Pomodoro";
import NepAi       from "@/pages/NepAi";
import Leaderboard from "@/pages/Leaderboard";
import ReportCard  from "@/pages/ReportCard";
import Settings    from "@/pages/Settings";
import About       from "@/pages/About";
import Contact     from "@/pages/Contact";
import Saved       from "@/pages/Saved";
import McqPractice from "@/pages/McqPractice";

// ── Lazy-only for rarely visited pages ─────────────────────────────────────
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
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.25, 0.1, 0.25, 1] } },
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
        style={{ willChange: "opacity, transform" }}
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
