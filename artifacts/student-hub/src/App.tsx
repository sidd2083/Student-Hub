import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import {
  PrivateRoute,
  AdminDashboardRoute,
  LoadingScreen,
} from "@/components/ProtectedRoute";

import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Notes from "@/pages/Notes";
import NotePage from "@/pages/NotePage";
import McqPractice from "@/pages/McqPractice";
import Pyqs from "@/pages/Pyqs";
import PyqPage from "@/pages/PyqPage";
import Todo from "@/pages/Todo";
import Pomodoro from "@/pages/Pomodoro";
import NepAi from "@/pages/NepAi";
import Leaderboard from "@/pages/Leaderboard";
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

function RootGate() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Login />;
}

function Router() {
  return (
    <Switch>
      {/* Root — spinner → login */}
      <Route path="/" component={RootGate} />
      <Route path="/login" component={RootGate} />

      {/* Setup */}
      <Route path="/setup-profile" component={Onboarding} />
      <Route path="/onboarding" component={Onboarding} />

      {/* Public pages — no login required */}
      <Route path="/notes/:id" component={NotePage} />
      <Route path="/pyq/:id" component={PyqPage} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />

      {/* Semi-public: notes & pyqs list — accessible without login */}
      <Route path="/notes" component={Notes} />
      <Route path="/pyqs" component={Pyqs} />

      {/* Private pages */}
      <Route path="/dashboard">
        <PrivateRoute><Dashboard /></PrivateRoute>
      </Route>
      <Route path="/mcq">
        <PrivateRoute><McqPractice /></PrivateRoute>
      </Route>
      <Route path="/todo">
        <PrivateRoute><Todo /></PrivateRoute>
      </Route>
      <Route path="/pomodoro">
        <PrivateRoute><Pomodoro /></PrivateRoute>
      </Route>
      <Route path="/ai">
        <PrivateRoute><NepAi /></PrivateRoute>
      </Route>
      <Route path="/leaderboard">
        <PrivateRoute><Leaderboard /></PrivateRoute>
      </Route>
      <Route path="/settings">
        <PrivateRoute><Settings /></PrivateRoute>
      </Route>

      {/* Admin */}
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard">
        <AdminDashboardRoute><Admin /></AdminDashboardRoute>
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
