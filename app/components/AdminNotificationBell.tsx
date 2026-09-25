'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/app/lib/auth';
import {
  NotificationType,
  NOTIFICATION_POLL_INTERVAL_MS,
  NOTIFICATION_DISPLAY_LIMIT,
  timeAgo,
} from '@/app/lib/notificationUtils';

const BROWSER_ALERTS_KEY = 'exspend_admin_browser_alerts';

export default function AdminNotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [open, setOpen] = useState(false);
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(false);
  const [browserAlertMessage, setBrowserAlertMessage] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const seenNotificationIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBrowserAlertsEnabled(localStorage.getItem(BROWSER_ALERTS_KEY) === 'true');
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

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
      const seenIds = seenNotificationIdsRef.current;

      if (seenIds) {
        const freshUnread = incoming.filter((item) => !item.isRead && !seenIds.has(item.id));
        if (
          browserAlertsEnabled &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          for (const item of freshUnread) {
            try {
              const alert = new Notification(item.title, { body: item.message, tag: item.id });
              alert.onclick = () => {
                window.focus();
                if (item.link?.startsWith('/') && !item.link.startsWith('//')) router.push(item.link);
              };
            } catch {
              // The in-app notification remains available if browser alerts fail.
            }
          }
        }
        incoming.forEach((item) => seenIds.add(item.id));
        if (seenIds.size > 200) {
          seenNotificationIdsRef.current = new Set(Array.from(seenIds).slice(-100));
        }
      } else {
        // Do not show old notifications as new browser alerts on first load.
        seenNotificationIdsRef.current = new Set(incoming.map((item) => item.id));
      }
      setNotifications(incoming);
    } catch {
      // silently fail
    }
  }, [browserAlertsEnabled, router]);

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchNotifications, 0);
    const interval = setInterval(fetchNotifications, NOTIFICATION_POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialFetch);
      clearInterval(interval);
    };
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

  async function toggleBrowserAlerts() {
    setBrowserAlertMessage('');
    if (browserAlertsEnabled) {
      localStorage.setItem(BROWSER_ALERTS_KEY, 'false');
      setBrowserAlertsEnabled(false);
      setBrowserAlertMessage('Browser alerts are off. In-app notifications remain on.');
      return;
    }
    if (!('Notification' in window)) {
      setBrowserAlertMessage('This browser does not support desktop notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setBrowserAlertMessage('Allow notifications in your browser settings to receive desktop alerts.');
      return;
    }
    localStorage.setItem(BROWSER_ALERTS_KEY, 'true');
    setBrowserAlertsEnabled(true);
    setBrowserAlertMessage('Browser alerts are on while this admin app is open.');
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const recent = notifications.slice(0, NOTIFICATION_DISPLAY_LIMIT);

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
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-green-800 hover:text-lime-400 transition-colors relative w-full"
        aria-label="Notifications"
      >
        <Bell size={18} />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-green-900">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-2 text-xs text-lime-400">{unreadCount} unread</span>
            )}
          </div>
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <button
              type="button"
              onClick={() => void toggleBrowserAlerts()}
              className="text-xs font-semibold text-green-800 underline"
            >
              {browserAlertsEnabled ? 'Turn off browser alerts' : 'Enable browser alerts'}
            </button>
            <p className="mt-1 text-[11px] text-gray-600">
              Alerts are checked every 10 seconds while this admin app is open.
            </p>
            {browserAlertMessage && <p role="status" className="mt-1 text-[11px] text-gray-700">{browserAlertMessage}</p>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No notifications</p>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-100 last:border-0 ${
                    !n.isRead ? 'bg-lime-50' : 'bg-white'
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
