import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTimer } from "@/context/TimerContext";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import {
  BookOpen, FileText, CheckSquare, Timer,
  MessageCircle, Trophy, LayoutDashboard, LogOut,
  Shield, Settings, User, Home, Wrench, ArrowLeft, X, BarChart2,
  Pause, Play, Bookmark, Download, Calculator,
} from "lucide-react";
import { useState, useEffect } from "react";

const sidebarNav = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard"  },
  { href: "/notes",       icon: BookOpen,         label: "Notes"      },
  { href: "/pyqs",        icon: FileText,         label: "PYQ"        },
  { href: "/saved",       icon: Bookmark,         label: "Saved"      },
  { href: "/ai",          icon: MessageCircle,    label: "Nep AI"     },
  { href: "/pomodoro",    icon: Timer,            label: "Pomodoro"   },
  { href: "/todo",        icon: CheckSquare,      label: "To-do"      },
  { href: "/report",      icon: BarChart2,        label: "Report Card"},
  { href: "/leaderboard", icon: Trophy,           label: "Leaderboard"},
];

const bottomNavItems = [
  { href: "/dashboard", icon: Home,     label: "Home",    isTools: false },
  { href: "/notes",     icon: BookOpen, label: "Notes",   isTools: false },
  { href: "/pyqs",      icon: FileText, label: "PYQ",     isTools: false },
  { href: "",           icon: Wrench,   label: "Tools",   isTools: true  },
  { href: "/settings",  icon: User,     label: "Profile", isTools: false },
];

const toolsMenu = [
  { href: "/ai",          icon: MessageCircle, label: "Nep AI",      color: "text-indigo-600 bg-indigo-50" },
  { href: "/pomodoro",    icon: Timer,         label: "Pomodoro",    color: "text-orange-600 bg-orange-50" },
  { href: "/todo",        icon: CheckSquare,   label: "To-do",       color: "text-green-600  bg-green-50"  },
  { href: "/saved",       icon: Bookmark,      label: "Saved",       color: "text-teal-600   bg-teal-50"   },
  { href: "/report",      icon: BarChart2,     label: "Report Card", color: "text-blue-600   bg-blue-50"   },
  { href: "/leaderboard", icon: Trophy,        label: "Leaderboard", color: "text-yellow-600 bg-yellow-50" },
];

interface LayoutProps { children: React.ReactNode }

function FloatingTimerBar() {
  const [location, setLocation] = useLocation();
  const { phase, seconds, running, pause, start } = useTimer();
  if (!running || location === "/pomodoro") return null;
  const mins  = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs  = (seconds % 60).toString().padStart(2, "0");
  const color = phase === "work" ? "bg-blue-500" : phase === "shortBreak" ? "bg-green-500" : "bg-purple-500";
  const label = phase === "work" ? "Focus"       : phase === "shortBreak" ? "Short Break"  : "Long Break";
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${color} text-white text-xs flex items-center justify-between px-4 py-1.5 shadow-md cursor-pointer`}
      onClick={() => setLocation("/pomodoro")}
    >
      <div className="flex items-center gap-2">
        <Timer className="w-3.5 h-3.5 animate-pulse" />
        <span className="font-semibold">{label}: {mins}:{secs}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={e => { e.stopPropagation(); running ? pause() : start(); }}
          className="hover:bg-white/20 rounded-full p-1 transition-colors"
        >
          {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        </button>
        <span className="opacity-75 text-[10px]">Tap to open</span>
      </div>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, profile, signOut } = useAuth();
  const [toolsOpen, setToolsOpen] = useState(false);
  const { isInstallable, installApp } = usePwaInstall();

  const isActive = (href: string) =>
    location === href || (href !== "/dashboard" && location.startsWith(href));

  const isHome  = location === "/dashboard";
  const showBack = !isHome;

  useEffect(() => { setToolsOpen(false); }, [location]);

  // iOS PWA critical fix: html/body must have height:100% + overflow:hidden
  // so iOS recognises the inner flex container (not the document) as the scroll root.
  // Without this, overflow-y:auto on <main> is silently ignored on iOS Safari/PWA.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlH: html.style.height,   htmlO: html.style.overflow,
      bodyH: body.style.height,   bodyO: body.style.overflow,
      rootH: root?.style.height ?? "", rootO: root?.style.overflow ?? "",
    };
    html.style.height = body.style.height = "100%";
    html.style.overflow = body.style.overflow = "hidden";
    if (root) { root.style.height = "100%"; root.style.overflow = "hidden"; }
    return () => {
      html.style.height = prev.htmlH; html.style.overflow = prev.htmlO;
      body.style.height = prev.bodyH; body.style.overflow = prev.bodyO;
      if (root) { root.style.height = prev.rootH; root.style.overflow = prev.rootO; }
    };
  }, []);

  return (
    <div
      className="flex bg-gray-50 dark:bg-gray-950"
      style={{ height: "100%", overflow: "hidden" }}
    >
      <FloatingTimerBar />

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col shadow-sm flex-shrink-0">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <Link href="/dashboard">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Student Hub</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {sidebarNav.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <div
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive(href)
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </div>
            </Link>
          ))}

          {user && profile?.role === "admin" && (
            <Link href="/admin">
              <div
                data-testid="nav-admin"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  location.startsWith("/admin")
                    ? "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <Shield className="w-4 h-4 flex-shrink-0" />
                Admin Panel
              </div>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <Link href="/settings">
            <div className="flex items-center gap-3 mb-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-sm flex-shrink-0">
                {profile?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{profile?.name || "Student"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">Grade {profile?.grade}</p>
              </div>
              <Settings className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
            </div>
          </Link>
          {isInstallable && (
            <button
              onClick={installApp}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 rounded-lg transition-all mb-1"
            >
              <Download className="w-4 h-4" />
              Install App
            </button>
          )}
          <button
            data-testid="btn-signout"
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 flex-shrink-0"
          style={{ height: "48px" }}
        >
          <div className="flex items-center gap-2">
            {showBack ? (
              <button
                onClick={() => window.history.back()}
                className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            ) : (
              <Link href="/dashboard">
                <div className="flex items-center gap-2 cursor-pointer">
                  <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
                    <BookOpen className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Student Hub</span>
                </div>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isInstallable && (
              <button
                onClick={installApp}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 rounded-lg transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
            )}
            <Link href="/settings">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-sm cursor-pointer">
                {profile?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            </Link>
          </div>
        </header>

        {/* Page content — this is the ONLY scroll container on mobile */}
        <main
          className="flex-1 min-h-0 overflow-y-auto main-scroll-area"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {children}
        </main>
      </div>

      {/* ── Tools Bottom Sheet ── */}
      {toolsOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setToolsOpen(false)}
          />
          <div
            className="md:hidden fixed left-0 right-0 z-50 px-3 pb-2"
            style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
              style={{ animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tools</p>
                <button onClick={() => setToolsOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              <div className="p-3 grid grid-cols-1 gap-1">
                {toolsMenu.map(({ href, icon: Icon, label, color }) => {
                  const [textCls, bgCls] = color.split(" ");
                  return (
                    <button
                      key={href}
                      onClick={() => { setLocation(href); setToolsOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left w-full"
                    >
                      <div className={`w-9 h-9 rounded-xl ${bgCls} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${textCls}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile Bottom Navigation ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-lg z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavItems.map(({ href, icon: Icon, label, isTools }) => {
            const active = isTools
              ? toolsOpen
              : location === href || (href !== "/dashboard" && href !== "/settings" && location.startsWith(href));
            return (
              <button
                key={label}
                onClick={() => {
                  if (isTools) { setToolsOpen(o => !o); }
                  else { setLocation(href); setToolsOpen(false); }
                }}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[52px] ${
                  active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-600"
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${active ? "scale-110" : ""}`} />
                <span className="text-[10px] font-medium leading-tight">{label}</span>
                {active && <span className="w-1 h-1 bg-blue-500 rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
