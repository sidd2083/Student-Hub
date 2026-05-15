import { Link, useLocation } from "wouter";
import { BookOpen, Menu, X, UserPlus, Home, FileText, Wrench, User, ArrowLeft, Timer, CheckSquare, Trophy, MessageCircle, BarChart2 } from "lucide-react";
import { useState, useEffect } from "react";

const toolsMenu = [
  { href: "/ai",          icon: MessageCircle, label: "Nep AI",      color: "text-indigo-600 bg-indigo-50" },
  { href: "/pomodoro",    icon: Timer,         label: "Pomodoro",    color: "text-orange-600 bg-orange-50" },
  { href: "/todo",        icon: CheckSquare,   label: "To-do",       color: "text-green-600  bg-green-50"  },
  { href: "/leaderboard", icon: Trophy,        label: "Leaderboard", color: "text-yellow-600 bg-yellow-50" },
];

const mobileBottomNavBase = [
  { href: "/",      icon: Home,      label: "Home",    isTools: false },
  { href: "/notes", icon: BookOpen,  label: "Notes",   isTools: false },
  { href: "/pyqs",  icon: FileText,  label: "PYQ",     isTools: false },
  { href: "",       icon: Wrench,    label: "Tools",   isTools: true  },
  { href: "/login", icon: User,      label: "Profile", isTools: false },
];

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [location, setLocation] = useLocation();

  const isHome = location === "/" || location === "";
  const isActive = (href: string) =>
    href === "/" ? location === "/" || location === "" : location.startsWith(href);

  useEffect(() => { setToolsOpen(false); setMenuOpen(false); }, [location]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* ── Desktop + Mobile Header ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isHome && (
              <button
                onClick={() => window.history.back()}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl hover:bg-gray-100 transition-all"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-base font-semibold text-gray-900">Student Hub</span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="/"        className="hover:text-blue-600 transition-colors">Home</Link>
            <Link href="/notes"   className="hover:text-blue-600 transition-colors">Notes</Link>
            <Link href="/pyqs"    className="hover:text-blue-600 transition-colors">PYQ</Link>
            <Link href="/about"   className="hover:text-blue-600 transition-colors">About</Link>
            <Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register
            </Link>
            <button
              onClick={() => setMenuOpen(m => !m)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-all"
            >
              {menuOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-1">
            {[
              { href: "/",        label: "Home"    },
              { href: "/notes",   label: "Notes"   },
              { href: "/pyqs",    label: "PYQ"     },
              { href: "/about",   label: "About"   },
              { href: "/contact", label: "Contact" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 font-medium"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/login"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-blue-600 font-medium hover:bg-blue-50"
              onClick={() => setMenuOpen(false)}
            >
              <UserPlus className="w-4 h-4" />
              Register — It's Free
            </Link>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="pb-20 md:pb-0">{children}</main>

      {/* CTA section */}
      <div className="bg-blue-600 py-10 mt-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Get Full Access — Free</h2>
          <p className="text-blue-100 text-sm mb-5">
            AI study assistant, progress tracking, leaderboard, and more — all free for Nepal students.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-2xl font-semibold text-sm hover:bg-blue-50 transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Register — It's Free
          </Link>
        </div>
      </div>

      <footer className="bg-gray-900 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-white font-semibold text-sm">Student Hub</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Free study platform for Grade 9–12 students in Nepal. Notes, PYQs, AI tutor, and progress tracking — all in one place.
              </p>
            </div>

            <div>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Study</h4>
              <ul className="space-y-2">
                {[
                  { href: "/notes",       label: "Study Notes" },
                  { href: "/pyqs",        label: "PYQ Papers"  },
                  { href: "/mcq",         label: "MCQ Practice"},
                  { href: "/ai",          label: "Nep AI"      },
                  { href: "/leaderboard", label: "Leaderboard" },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-gray-400 text-xs hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Tools</h4>
              <ul className="space-y-2">
                {[
                  { href: "/pomodoro", label: "Pomodoro Timer" },
                  { href: "/todo",     label: "To-Do List"     },
                  { href: "/report",   label: "Report Card"    },
                  { href: "/saved",    label: "Saved Items"    },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-gray-400 text-xs hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Company</h4>
              <ul className="space-y-2">
                {[
                  { href: "/about",   label: "About Us" },
                  { href: "/contact", label: "Contact"  },
                  { href: "/privacy", label: "Privacy Policy" },
                  { href: "/terms",   label: "Terms of Service" },
                ].map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-gray-400 text-xs hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Student Hub. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy</Link>
              <Link href="/terms"   className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms</Link>
              <Link href="/contact" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Tools Bottom Sheet ── */}
      {toolsOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setToolsOpen(false)}
          />
          <div className="md:hidden fixed bottom-16 left-0 right-0 z-50 px-3 pb-2">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
              style={{ animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-900">Tools</p>
                <button onClick={() => setToolsOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-all">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="p-3 grid grid-cols-1 gap-1">
                {toolsMenu.map(({ href, icon: Icon, label, color }) => {
                  const [textCls, bgCls] = color.split(" ");
                  return (
                    <button
                      key={href}
                      onClick={() => { setLocation(href); setToolsOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 transition-all text-left w-full"
                    >
                      <div className={`w-9 h-9 rounded-xl ${bgCls} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${textCls}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-800">{label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-gray-50">
                <Link href="/login" onClick={() => setToolsOpen(false)} className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-500 text-white text-sm font-medium rounded-2xl hover:bg-blue-600 transition-all">
                  <UserPlus className="w-4 h-4" /> Register to unlock all tools — Free
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around h-16 px-2">
          {mobileBottomNavBase.map(({ href, icon: Icon, label, isTools }) => {
            const active = isTools
              ? toolsOpen
              : isActive(href);
            return (
              <button
                key={label}
                onClick={() => {
                  if (isTools) { setToolsOpen(o => !o); }
                  else { setLocation(href); setToolsOpen(false); }
                }}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[52px] ${
                  active ? "text-blue-600" : "text-gray-400"
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
