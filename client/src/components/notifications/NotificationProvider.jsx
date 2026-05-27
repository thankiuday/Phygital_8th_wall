import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Sparkles, X } from 'lucide-react';
import useNotificationStore from '../../store/useNotificationStore';

const NotificationToast = ({ notification, onDismiss, onOpen }) => {
  const isAdminType = notification.type === 'ar_request_submitted';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-brand-500/30 bg-[var(--surface-1)] shadow-2xl"
      role="status"
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isAdminType ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'
        }`}>
          {isAdminType ? <Bell size={18} /> : <Sparkles size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{notification.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpen(notification)}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500"
            >
              View
            </button>
            <button
              type="button"
              onClick={() => onDismiss(notification._id)}
              className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(notification._id)}
          className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
};

const NotificationToastStack = () => {
  const navigate = useNavigate();
  const { toasts, dismissToast, markRead } = useNotificationStore();

  const handleOpen = async (notification) => {
    await markRead(notification._id);
    dismissToast(notification._id);
    if (notification.linkPath) navigate(notification.linkPath);
  };

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(100vw-2rem,24rem)] flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {toasts.map((notification) => (
          <NotificationToast
            key={notification._id}
            notification={notification}
            onDismiss={dismissToast}
            onOpen={handleOpen}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * Polls for notifications while the user is authenticated.
 */
const NotificationProvider = ({ children }) => {
  const { startPolling, stopPolling } = useNotificationStore();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  return (
    <>
      {children}
      <NotificationToastStack />
    </>
  );
};

export default NotificationProvider;
