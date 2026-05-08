import { useAuth } from "@/context/AuthContext";
import { LogIn, Lock } from "lucide-react";

interface SoftGateProps {
  children: React.ReactNode;
  feature?: string;
}

export function SoftGate({ children, feature = "this feature" }: SoftGateProps) {
  const { user, loading, signIn } = useAuth();

  if (loading) return null;
  if (user) return <>{children}</>;

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Blurred content behind */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: "blur(4px)", opacity: 0.5 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-start justify-center pt-20 sm:pt-28 px-4 z-10">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Login to unlock {feature}</h2>
          <p className="text-gray-500 text-sm mb-6">
            Create a free account to access Nep AI, Pomodoro timer, Report Card, and more.
          </p>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-blue-500 text-white rounded-2xl font-semibold text-sm hover:bg-blue-600 transition-all mb-3 shadow-lg shadow-blue-200"
          >
            <LogIn className="w-4 h-4" />
            Sign In — Free
          </button>
          <p className="text-xs text-gray-400">No credit card · Instant access</p>
        </div>
      </div>
    </div>
  );
}
