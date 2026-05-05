import { Link } from "wouter";
import { BookOpen, Menu, X, UserPlus } from "lucide-react";
import { useState } from "react";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-semibold text-gray-900">Student Hub</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
            <Link href="/notes" className="hover:text-blue-600 transition-colors">Notes</Link>
            <Link href="/pyqs" className="hover:text-blue-600 transition-colors">PYQ</Link>
            <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
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

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-1">
            {[
              { href: "/",        label: "Home"                   },
              { href: "/notes",   label: "Notes"                  },
              { href: "/pyqs",    label: "PYQ"                    },
              { href: "/about",   label: "About"                  },
              { href: "/contact", label: "Contact"                },
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

      <main>{children}</main>

      <div className="bg-blue-600 py-10 mt-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Get Full Access — Free</h2>
          <p className="text-blue-100 text-sm mb-5">
            MCQ practice, AI study assistant, progress tracking, and more — all free.
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

      <footer className="bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
              <BookOpen className="w-3 h-3 text-white" />
            </div>
            <span className="text-white font-medium text-sm">Student Hub</span>
          </div>
          <nav className="flex gap-5 text-xs text-gray-400">
            <Link href="/"        className="hover:text-white transition-colors">Home</Link>
            <Link href="/notes"   className="hover:text-white transition-colors">Notes</Link>
            <Link href="/pyqs"    className="hover:text-white transition-colors">PYQ</Link>
            <Link href="/about"   className="hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </nav>
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Student Hub. Built by Siddhant Lamichhane.</p>
        </div>
      </footer>
    </div>
  );
}
