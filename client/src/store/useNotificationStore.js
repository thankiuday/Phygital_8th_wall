import { create } from 'zustand';
import { notificationService } from '../services/notificationService';

const TOAST_SEEN_KEY = 'phygital_toast_seen_notifications';

const loadToastSeenIds = () => {
  try {
    const raw = sessionStorage.getItem(TOAST_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveToastSeenIds = (ids) => {
  try {
    sessionStorage.setItem(TOAST_SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* ignore quota */
  }
};

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  toasts: [],
  loading: false,
  pollTimer: null,

  fetchNotifications: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true });
    try {
      const data = await notificationService.list({ limit: 40 });
      const notifications = data.notifications || [];
      const unreadCount = data.unreadCount ?? 0;

      const seenIds = new Set(loadToastSeenIds());
      const unread = notifications.filter((n) => !n.readAt);
      const newToasts = unread.filter((n) => !seenIds.has(String(n._id)));

      if (newToasts.length) {
        const nextSeen = [...seenIds];
        newToasts.forEach((n) => {
          const id = String(n._id);
          if (!nextSeen.includes(id)) nextSeen.push(id);
        });
        saveToastSeenIds(nextSeen);

        set((state) => ({
          notifications,
          unreadCount,
          loading: false,
          toasts: [
            ...state.toasts,
            ...newToasts.filter(
              (t) => !state.toasts.some((x) => String(x._id) === String(t._id))
            ),
          ],
        }));
      } else {
        set({ notifications, unreadCount, loading: false });
      }
    } catch {
      if (!silent) set({ loading: false });
    }
  },

  startPolling: () => {
    const existing = get().pollTimer;
    if (existing) return;

    get().fetchNotifications({ silent: true });

    const pollTimer = window.setInterval(() => {
      get().fetchNotifications({ silent: true });
    }, 25_000);

    set({ pollTimer });
  },

  stopPolling: () => {
    const timer = get().pollTimer;
    if (timer) window.clearInterval(timer);
    set({ pollTimer: null, toasts: [] });
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => String(t._id) !== String(id)),
    }));
  },

  markRead: async (id) => {
    try {
      const data = await notificationService.markRead(id);
      set((state) => ({
        unreadCount: data.unreadCount ?? Math.max(0, state.unreadCount - 1),
        notifications: state.notifications.map((n) =>
          String(n._id) === String(id) ? { ...n, readAt: n.readAt || new Date().toISOString() } : n
        ),
        toasts: state.toasts.filter((t) => String(t._id) !== String(id)),
      }));
    } catch {
      /* ignore */
    }
  },

  markAllRead: async () => {
    try {
      await notificationService.markAllRead();
      set((state) => ({
        unreadCount: 0,
        notifications: state.notifications.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        })),
        toasts: [],
      }));
    } catch {
      /* ignore */
    }
  },
}));

export default useNotificationStore;
