'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  HelpCircle,
  FileText,
  History,
  LogOut,
  User,
  Menu,
  X,
  Settings,
  Wallet,
  BookOpen,
} from 'lucide-react';
import { getCurrentUser, logout } from '@/app/lib/auth';
import NotificationBell from '@/app/components/NotificationBell';

const navItems = [
  { icon: ShoppingCart, label: 'Spend', href: '/spend' },
  { icon: TrendingUp, label: 'Buy', href: '/buy' },
  { icon: TrendingDown, label: 'Sell', href: '/sell' },
  { icon: ClipboardList, label: 'Orders', href: '/orders' },
  { icon: History, label: 'History', href: '/history' },
  { icon: Wallet, label: 'Wallets', href: '/wallets' },
  { icon: BookOpen, label: 'Learn', href: '/learn-wallets' },
  { icon: HelpCircle, label: 'Help', href: '/help' },
  { icon: FileText, label: 'Policies', href: '/policies' },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  const firstName = user?.name?.split(' ')[0] ?? null;

  if (pathname.startsWith('/admin')) {
    return null;
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-green-950/95 px-4 text-white shadow-[0_8px_30px_rgba(3,35,20,0.12)] backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between py-2.5">
        <Link href="/" className="flex items-center gap-1 font-bold text-2xl">
          {logoError ? (
            <>
              <span className="text-lime-400">Ex</span>
              <span>spend</span>
              <span className="ml-1">⚡</span>
            </>
          ) : (
            <img
              src="/logo.png"
              alt="Exspend"
              className="h-11 w-auto"
              onError={() => setLogoError(true)}
            />
          )}
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
              {navItems.map(({ icon: Icon, label, href }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-white/12 text-lime-300'
                        : 'text-green-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </Link>
                );
              })}

              {user?.isAdmin === true && (
                <Link
                  href="/admin"
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors ${
                    pathname.startsWith('/admin')
                       ? 'bg-white/12 text-lime-300'
                       : 'text-green-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                    <Settings size={16} />
                  <span>Admin</span>
                </Link>
              )}

              <NotificationBell />

               {firstName && (
                <Link
                  href="/profile"
                   className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-lime-300 transition-colors hover:bg-white/10 hover:text-lime-100"
                >
                   <User size={16} />
                  <span>{firstName}</span>
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-green-100 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:text-lime-400 hover:bg-green-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-lime-400 hover:bg-lime-300 text-green-900 transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {user && <NotificationBell />}
          <button
            className="rounded-xl p-2 text-green-100 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute left-0 right-0 top-full border-t border-white/10 bg-green-950 px-4 pb-4 pt-3 shadow-2xl md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
          {user ? (
            <>
              {navItems.map(({ icon: Icon, label, href }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                      active
                        ? 'text-lime-400 bg-green-800'
                        : 'text-white hover:text-lime-400 hover:bg-green-800'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                );
              })}

              {firstName && (
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium text-lime-300 hover:text-lime-100 hover:bg-green-800"
                >
                  <User size={18} />
                  <span>{firstName}</span>
                </Link>
              )}

              {user?.isAdmin === true && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                    pathname.startsWith('/admin')
                      ? 'text-lime-400 bg-green-800'
                      : 'text-white hover:text-lime-400 hover:bg-green-800'
                  }`}
                >
                  <Settings size={18} />
                  <span>Admin</span>
                </Link>
              )}

              <button
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium text-white hover:text-lime-400 hover:bg-green-800"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium text-white hover:text-lime-400 hover:bg-green-800"
              >
                <User size={18} />
                <span>Sign In</span>
              </Link>
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium bg-lime-400 hover:bg-lime-300 text-green-900 mx-4 rounded-lg"
              >
                <span>Sign Up</span>
              </Link>
            </>
          )}
          </div>
        </div>
      )}
    </nav>
  );
}