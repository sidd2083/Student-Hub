import { lazy, Suspense } from "react";
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

const Home         = lazy(() => import("@/pages/Home"));
const Login        = lazy(() => import("@/pages/Login"));
const Onboarding   = lazy(() => import("@/pages/Onboarding"));
const Dashboard    = lazy(() => import("@/pages/Dashboard"));
const Notes        = lazy(() => import("@/pages/Notes"));
const NotePage     = lazy(() => import("@/pages/NotePage"));
const Pyqs         = lazy(() => import("@/pages/Pyqs"));
const PyqPage      = lazy(() => import("@/pages/PyqPage"));
const Todo         = lazy(() => import("@/pages/Todo"));
const Pomodoro     = lazy(() => import("@/pages/Pomodoro"));
const NepAi        = lazy(() => import("@/pages/NepAi"));
const Leaderboard  = lazy(() => import("@/pages/Leaderboard"));
const ReportCard   = lazy(() => import("@/pages/ReportCard"));
const Settings     = lazy(() => import("@/pages/Settings"));
const AdminLogin   = lazy(() => import("@/pages/AdminLogin"));
const Admin        = lazy(() => import("@/pages/Admin"));
const About        = lazy(() => import("@/pages/About"));
const Contact      = lazy(() => import("@/pages/Contact"));
const Saved        = lazy(() => import("@/pages/Saved"));
const McqPractice  = lazy(() => import("@/pages/McqPractice"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Terms        = lazy(() => import("@/pages/Terms"));
const NotFound     = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
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
            <Suspense fallback={<PageLoader />}>
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
