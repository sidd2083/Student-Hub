import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  BookOpen, Brain, FileText, CheckSquare, Timer,
  MessageCircle, Trophy, LayoutDashboard, LogOut,
  Shield, Settings, ArrowLeft, User,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard"          },
  { href: "/notes",       icon: BookOpen,         label: "Notes"              },
  { href: "/mcq",         icon: Brain,            label: "MCQ Practice"       },
  { href: "/pyqs",        icon: FileText,         label: "Previous Questions" },
  { href: "/todo",        icon: CheckSquare,      label: "To-Do"              },
  { href: "/pomodoro",    icon: Timer,            label: "Pomodoro"           },
  { href: "/ai",          icon: MessageCircle,    label: "Nep AI"             },
  { href: "/leaderboard", icon: Trophy,           label: "Leaderboard"        },
];

const bottomNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home"    },
  { href: "/notes",     icon: BookOpen,         label: "Notes"  },
  { href: "/pyqs",      icon: FileText,         label: "PYQs"   },
  { href: "/mcq",       icon: Brain,            label: "MCQ"    },
  { href: "/settings",  icon: User,             label: "Profile"},
];

interface LayoutProps {
  children: React.ReactNode;
  hideBack?: boolean;
}

export function Layout({ children, hideBack = false }: LayoutProps) {
  const [location] = useLocation();
  const { profile, signOut } = useAuth();

  const isActive = (href: string) =>
    location === href || (href !== "/dashboard" && location.startsWith(href));

  const handleBack = () => window.history.back();

  const showBack = !hideBack && location !== "/dashboard";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-100 flex-col shadow-sm flex-shrink-0">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900">Student Hub</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <a
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(href)
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </a>
            </Link>
          ))}

          {profile?.role === "admin" && (
            <Link href="/admin">
              <a
                data-testid="nav-admin"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.startsWith("/admin")
                    ? "bg-purple-50 text-purple-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Shield className="w-4 h-4 flex-shrink-0" />
                Admin Panel
              </a>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <Link href="/settings">
            <a className="flex items-center gap-3 mb-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                {profile?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{profile?.name}</p>
                <p className="text-xs text-gray-500">Grade {profile?.grade}</p>
              </div>
              <Settings className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
            </a>
          </Link>
          <button
            data-testid="btn-signout"
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-12 bg-white border-b border-gray-100 flex items-center px-4 md:px-6 flex-shrink-0">
          {showBack ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>
          ) : (
            <span className="text-sm font-medium text-gray-400">
              {navItems.find((n) => isActive(n.href))?.label ?? "Student Hub"}
            </span>
          )}

          {/* Mobile: show user avatar on top right */}
          <div className="ml-auto md:hidden">
            <Link href="/settings">
              <a className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                {profile?.name?.charAt(0)?.toUpperCase() || "?"}
              </a>
            </Link>
          </div>
        </header>

        {/* Page content — with bottom padding on mobile for the nav */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-40 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavItems.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}>
                <a className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px] ${
                  active ? "text-blue-600" : "text-gray-400"
                }`}>
                  <Icon className={`w-5 h-5 transition-transform ${active ? "scale-110" : ""}`} />
                  <span className="text-[10px] font-medium leading-tight">{label}</span>
                  {active && (
                    <span className="w-1 h-1 bg-blue-500 rounded-full mt-0.5" />
                  )}
                </a>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
