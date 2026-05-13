import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Target, Megaphone, Layers, MousePointerClick } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import Icon3D, { ICON3D_PRESETS } from '../../components/ui/Icon3D';

const NotificationCard = ({ icon, accent, title, body }) => (
  <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4">
    <div className="mb-2 flex items-center gap-2">
      <Icon3D icon={icon} size={12} className="h-7 w-7" accent={accent} rounded="rounded-lg" />
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
    </div>
    <p className="text-xs leading-5 text-[var(--text-secondary)]">{body}</p>
  </div>
);

const NotificationsPage = () => {
  const { pendingWelcomeNotification, markWelcomeNotificationSeen } = useAuthStore();

  useEffect(() => {
    if (pendingWelcomeNotification) {
      markWelcomeNotificationSeen();
    }
  }, [pendingWelcomeNotification, markWelcomeNotificationSeen]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-5">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-500/10 via-transparent to-cyan-500/10 p-4 sm:p-5"
      >
        <div className="mb-4 flex items-start gap-3">
          <Icon3D icon={Sparkles} size={16} className="h-10 w-10" accent={ICON3D_PRESETS.violet} />
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] sm:text-lg">
              Welcome to Phygital.zone
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              We are a phygital growth platform helping brands convert physical interactions into measurable digital engagement.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <NotificationCard
            icon={Target}
            accent={ICON3D_PRESETS.emerald}
            title="Our Aim"
            body="Bridge physical and digital customer touchpoints through high-converting QR and AR experiences."
          />
          <NotificationCard
            icon={Megaphone}
            accent={ICON3D_PRESETS.amber}
            title="Campaigns We Provide"
            body="Single Link QR, Multiple Links QR, Links + Video QR, Links + Docs + Video QR, and AR Digital Business Card."
          />
          <NotificationCard
            icon={Layers}
            accent={ICON3D_PRESETS.cyan}
            title="Steps to Create Campaign"
            body="Click Phygitalize now, choose campaign type, add links/docs/video/content, customize design, then publish and share."
          />
          <NotificationCard
            icon={MousePointerClick}
            accent={ICON3D_PRESETS.rose}
            title="Other Features"
            body="Live analytics, campaign management, QR customization, profile/security controls, and share-ready destination pages."
          />
        </div>
      </motion.section>
    </div>
  );
};

export default NotificationsPage;
