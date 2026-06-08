import { useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, AlertTriangle, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const ADMIN_SESSION = "admin_session_v1";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { user, profile, loading, signInWithGoogle } = useAuth();

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      sessionStorage.setItem(ADMIN_SESSION, "1");
      setLocation("/admin/dashboard");
    }
  }, [isAdmin, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user && !isAdmin && profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your account does not have admin privileges.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="text-sm text-purple-600 hover:underline"
          >
            ← Back to Student Hub
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
            <p className="text-gray-500 text-sm mt-1">
              Sign in with your administrator Google account
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <button
              onClick={() => signInWithGoogle()}
              className="w-full py-3 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600 transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In with Google
            </button>
            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <button
                type="button"
                onClick={() => setLocation("/")}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Back to Student Hub
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
