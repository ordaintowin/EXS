'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/app/lib/auth';
import {
  NotificationType,
  NOTIFICATION_POLL_INTERVAL_MS,
  NOTIFICATION_DISPLAY_LIMIT,
  timeAgo,
} from '@/app/lib/notificationUtils';

const SOUND_PREF_KEY = 'exspend_notification_sound';

function playNotificationBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // silently fail if audio is not supported
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevUnreadCountRef = useRef<number>(0);
  const initialLoadRef = useRef(true);

  // Load sound preference from localStorage using lazy initializer
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(SOUND_PREF_KEY);
    return stored === null ? true : stored === 'true';
  });

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_PREF_KEY, String(next));
      return next;
    });
  }

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const incoming: NotificationType[] = data.notifications ?? [];

      const newUnread = incoming.filter((n) => !n.isRead).length;
      const oldUnread = prevUnreadCountRef.current;

      // Play sound when new unread notifications arrive (skip on first load)
      if (!initialLoadRef.current && newUnread > oldUnread && soundEnabled) {
        playNotificationBeep();
      }

      prevUnreadCountRef.current = newUnread;
      initialLoadRef.current = false;
      setNotifications(incoming);
    } catch {
      // silently fail
    }
  }, [soundEnabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIFICATION_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const recent = notifications.slice(0, NOTIFICATION_DISPLAY_LIMIT);

  async function markAllRead() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // silently fail
    }
  }

  async function markRead(id: string) {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // silently fail
    }
  }

  async function handleNotificationClick(notification: NotificationType) {
    if (!notification.isRead) {
      await markRead(notification.id);
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-green-100 transition-colors hover:border-lime-300/40 hover:bg-white/10 hover:text-lime-200"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-green-950 bg-lime-300 px-1 text-[10px] font-bold text-green-950 shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed right-4 top-[4.75rem] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]"
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-green-950 px-4 py-3">
            <div>
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-2 text-xs text-lime-400">{unreadCount} unread</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-lime-400 hover:text-lime-200 font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
              <button
                onClick={toggleSound}
                title={soundEnabled ? 'Mute notification sounds' : 'Unmute notification sounds'}
                className="text-white hover:text-lime-400 transition-colors"
                aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
              >
                {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No notifications</p>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-100 last:border-0 ${
                    !n.isRead ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex-1 min-w-0 ${n.link ? 'cursor-pointer' : ''}`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="flex-shrink-0 text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

