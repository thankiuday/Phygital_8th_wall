import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Loader2, Sparkles } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import useNotificationStore from '../../store/useNotificationStore';

const formatWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const NotificationRow = ({ notification, onOpen }) => {
  const isUnread = !notification.readAt;
  const isAdminType = notification.type === 'ar_request_submitted';

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        isUnread
          ? 'border-brand-500/30 bg-brand-500/5 hover:bg-brand-500/10'
          : 'border-[var(--border-color)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isAdminType ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'
        }`}>
          {isAdminType ? <Bell size={16} /> : <Sparkles size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</p>
            {isUnread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{notification.body}</p>
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">{formatWhen(notification.createdAt)}</p>
        </div>
      </div>
    </button>
  );
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { pendingWelcomeNotification, markWelcomeNotificationSeen } = useAuthStore();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (pendingWelcomeNotification) {
      markWelcomeNotificationSeen();
    }
  }, [pendingWelcomeNotification, markWelcomeNotificationSeen]);

  const handleOpen = async (notification) => {
    if (!notification.readAt) await markRead(notification._id);
    if (notification.linkPath) navigate(notification.linkPath);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Notifications</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-brand-500/50"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-brand-400" size={28} />
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Bell size={28} className="mx-auto text-[var(--text-muted)]" />
          <p className="mt-3 text-sm text-[var(--text-muted)]">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification._id}
              notification={notification}
              onOpen={handleOpen}
            />
          ))}
        </div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden rounded-2xl border border-brand-500/15 p-4 sm:p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          About Phygital
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          AR card requests notify our team when you submit. You will get a notification here when your card is ready.
          {' '}
          <Link to="/dashboard/campaigns/new/digital-business-card/ar" className="text-brand-400 hover:underline">
            Request an AR card
          </Link>
        </p>
      </motion.section>
    </div>
  );
};

export default NotificationsPage;
