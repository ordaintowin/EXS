'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout } from '@/app/lib/auth';
import AdminSidebar from './components/AdminSidebar';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;  // 5 minutes
const WARN_BEFORE_MS  = 60 * 1000;      // show warning 1 minute before logout
const CHECK_INTERVAL_MS = 10 * 1000;    // poll every 10 seconds

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const lastActiveRef = useRef<number>(Date.now());

  const doLogout = useCallback(() => {
    logout();
    router.replace('/login');
  }, [router]);

  const resetActivity = useCallback(() => {
    lastActiveRef.current = Date.now();
    setShowWarning(false);
    setCountdown(60);
  }, []);

  useEffect(() => {
    const user = getCurrentUser();

    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.isAdmin) {
      router.replace('/spend');
      return;
    }
    setIsAdmin(true);
    setChecked(true);
  }, [router]);

  // Attach activity listeners and idle-check interval once admin is confirmed
  useEffect(() => {
    if (!checked || !isAdmin) return;

    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetActivity, { passive: true })
    );

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActiveRef.current;

      if (idleMs >= IDLE_TIMEOUT_MS) {
        clearInterval(interval);
        doLogout();
        return;
      }

      if (IDLE_TIMEOUT_MS - idleMs <= WARN_BEFORE_MS) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetActivity));
      clearInterval(interval);
    };
  }, [checked, isAdmin, resetActivity, doLogout]);

  // 1-second countdown ticker while the warning is visible
  useEffect(() => {
    if (!showWarning) return;

    const tick = setInterval(() => {
      const remaining = Math.ceil((IDLE_TIMEOUT_MS - (Date.now() - lastActiveRef.current)) / 1000);
      if (remaining <= 0) {
        clearInterval(tick);
        doLogout();
        return;
      }
      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(tick);
  }, [showWarning, doLogout]);

  if (!checked || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400 text-sm">Checking access...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 text-center">
            <div className="text-4xl mb-3">⏱️</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Session Expiring Soon</h2>
            <p className="text-sm text-gray-600 mb-6">
              You&apos;ve been inactive. Your session will expire in{' '}
              <span className="font-bold text-red-600">{countdown}</span>{' '}
              second{countdown !== 1 ? 's' : ''}.
            </p>
            <button
              onClick={resetActivity}
              className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl py-3 font-semibold transition-colors"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}