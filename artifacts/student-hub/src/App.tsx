import { lazy, Suspense, useEffect } from "react";
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
import { InstallBanner } from "@/components/InstallBanner";

// Lazy-loaded pages — chunks split for smaller initial bundle
const Home          = lazy(() => import("@/pages/Home"));
const Login         = lazy(() => import("@/pages/Login"));
const Onboarding    = lazy(() => import("@/pages/Onboarding"));
const Dashboard     = lazy(() => import("@/pages/Dashboard"));
const Notes         = lazy(() => import("@/pages/Notes"));
const NotePage      = lazy(() => import("@/pages/NotePage"));
const Pyqs          = lazy(() => import("@/pages/Pyqs"));
const PyqPage       = lazy(() => import("@/pages/PyqPage"));
const Todo          = lazy(() => import("@/pages/Todo"));
const Pomodoro      = lazy(() => import("@/pages/Pomodoro"));
const NepAi         = lazy(() => import("@/pages/NepAi"));
const Leaderboard   = lazy(() => import("@/pages/Leaderboard"));
const ReportCard    = lazy(() => import("@/pages/ReportCard"));
const Settings      = lazy(() => import("@/pages/Settings"));
const AdminLogin    = lazy(() => import("@/pages/AdminLogin"));
const Admin         = lazy(() => import("@/pages/Admin"));
const About         = lazy(() => import("@/pages/About"));
const Contact       = lazy(() => import("@/pages/Contact"));
const Saved         = lazy(() => import("@/pages/Saved"));
const McqPractice   = lazy(() => import("@/pages/McqPractice"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Terms         = lazy(() => import("@/pages/Terms"));
const NotFound      = lazy(() => import("@/pages/not-found"));

// Preload all chunks immediately after first render so navigation is instant
function preloadAllPages() {
  import("@/pages/Dashboard");
  import("@/pages/Notes");
  import("@/pages/Pyqs");
  import("@/pages/NepAi");
  import("@/pages/Todo");
  import("@/pages/Pomodoro");
  import("@/pages/ReportCard");
  import("@/pages/Leaderboard");
  import("@/pages/Settings");
  import("@/pages/NotePage");
  import("@/pages/PyqPage");
  import("@/pages/Saved");
  import("@/pages/McqPractice");
  import("@/pages/Login");
  import("@/pages/Onboarding");
  import("@/pages/About");
  import("@/pages/Contact");
  import("@/pages/PrivacyPolicy");
  import("@/pages/Terms");
  import("@/pages/AdminLogin");
  import("@/pages/Admin");
  import("@/pages/not-found");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
});

// Tiny invisible fallback — no spinner flash during navigation
const NavFallback = () => <div style={{ minHeight: "60vh" }} />;

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
            <Suspense fallback={<NavFallback />}>
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
            </Suspense>
          </AppShell>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  // Preload all page chunks 800ms after first render
  // By the time users click any link, chunks are already in browser cache
  useEffect(() => {
    const t = setTimeout(preloadAllPages, 800);
    return () => clearTimeout(t);
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
