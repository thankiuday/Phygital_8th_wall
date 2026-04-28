import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  QrCode,
  ScanLine,
  TrendingUp,
  Calendar,
  ArrowRight,
  PlusCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import useAuthStore from '../../store/useAuthStore';
import useDashboardStore from '../../store/useDashboardStore';
import useIsMobile from '../../hooks/useIsMobile';

/* ── Animation variants ──────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut', delay },
});

/* ── Greeting based on time of day ──────────────────────────────── */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

/* ── Stat card ───────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, sub, color, delay }) => (
  <motion.div {...fadeUp(delay)} className="glass-card p-4 sm:p-5">
    <div className="flex items-start justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:mt-1.5 sm:text-3xl">
          {value ?? <Skeleton w="w-16" />}
        </p>
        {sub && (
          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{sub}</p>
        )}
      </div>
      <div className={`ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${color}`}>
        <Icon size={18} className="opacity-90 sm:text-[20px]" />
      </div>
    </div>
  </motion.div>
);

/* ── Inline skeleton ─────────────────────────────────────────────── */
const Skeleton = ({ w = 'w-24', h = 'h-4' }) => (
  <div className={`${w} ${h} animate-shimmer rounded bg-[var(--surface-3)]`} />
);

/* ── Status badge ────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    active: 'bg-green-500/15 text-green-400',
    paused: 'bg-yellow-500/15 text-yellow-400',
    draft: 'bg-surface-500/15 text-[var(--text-muted)]',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] || map.draft}`}>
      {status}
    </span>
  );
};

/* ── Custom chart tooltip ────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="mb-1 text-[var(--text-muted)]">{label}</p>
      <p className="font-bold text-brand-400">{payload[0].value} scans</p>
    </div>
  );
};

/* ── Dashboard Page ──────────────────────────────────────────────── */
const DashboardPage = () => {
  const { user } = useAuthStore();
  const { stats, recentCampaigns, scanTrend, isLoading, fetchStats } = useDashboardStore();
  const isMobile = useIsMobile();
  const chartMargin = isMobile
    ? { top: 4, right: 4, left: 0, bottom: 0 }
    : { top: 4, right: 4, left: -24, bottom: 0 };

  useEffect(() => {
    fetchStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const STAT_CARDS = [
    {
      icon: QrCode,
      label: 'Campaigns',
      value: stats?.totalCampaigns,
      sub: `${stats?.activeCampaigns ?? '—'} active`,
      color: 'bg-brand-500/15 text-brand-400',
      delay: 0.05,
    },
    {
      icon: ScanLine,
      label: 'Total Scans',
      value: stats?.totalScans,
      sub: 'All time',
      color: 'bg-accent-500/15 text-accent-400',
      delay: 0.1,
    },
    {
      icon: Calendar,
      label: "Today",
      value: stats?.todayScans,
      sub: 'Last 24 hours',
      color: 'bg-green-500/15 text-green-400',
      delay: 0.15,
    },
    {
      icon: TrendingUp,
      label: 'This Week',
      value: stats?.weekScans,
      sub: 'Last 7 days',
      color: 'bg-orange-500/15 text-orange-400',
      delay: 0.2,
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* ── Welcome card ─────────────────────────────────────────── */}
      <motion.div
        {...fadeUp(0)}
        className="relative overflow-hidden rounded-2xl bg-gradient-brand p-5 text-white shadow-glow sm:p-6"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent)]" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/70">
              {getGreeting()},{' '}
              <span className="font-bold text-white">{user?.name?.split(' ')[0] || 'there'}</span> 👋
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug sm:text-xl">
              {stats?.totalCampaigns === 0
                ? 'Create your first AR campaign!'
                : `You have ${stats?.activeCampaigns ?? '—'} active AR campaign${stats?.activeCampaigns !== 1 ? 's' : ''}.`}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {stats?.todayScans
                ? `${stats.todayScans} scan${stats.todayScans !== 1 ? 's' : ''} today — keep sharing!`
                : 'Share your QR codes to start collecting scans.'}
            </p>
          </div>

          <Link
            to="/dashboard/campaigns/new"
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-700 shadow-lg transition-all hover:shadow-xl"
          >
            <PlusCircle size={16} />
            New Campaign
          </Link>
        </div>

        <Sparkles
          size={64}
          className="pointer-events-none absolute -right-4 -top-4 text-white/10"
        />
      </motion.div>

      {/* ── Stat cards grid — 2×2 on mobile, 4 cols on lg ─────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Chart + Recent campaigns ───────────────────────────────── */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
        {/* Scan trend chart — full width on mobile, 3/5 on lg */}
        <motion.div {...fadeUp(0.25)} className="glass-card p-4 sm:p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Scan Trend</h3>
              <p className="text-xs text-[var(--text-muted)]">Daily scans — last 7 days</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="loader-spinner" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={scanTrend} margin={chartMargin}>
                <defs>
                  <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="scans"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#scanGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#8b5cf6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Recent campaigns — full width on mobile, 2/5 on lg */}
        <motion.div {...fadeUp(0.3)} className="glass-card p-4 sm:p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Recent Campaigns</h3>
              <p className="text-xs text-[var(--text-muted)]">Last 5 created</p>
            </div>
            <Link
              to="/dashboard/campaigns"
              className="flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
            >
              All <ArrowRight size={12} />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton w="w-9" h="h-9" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton w="w-3/4" h="h-3" />
                    <Skeleton w="w-1/2" h="h-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10">
                <QrCode size={24} className="text-brand-400" />
              </div>
              <p className="text-sm text-[var(--text-muted)]">No campaigns yet</p>
              <Link
                to="/dashboard/campaigns/new"
                className="text-xs font-medium text-brand-400 hover:text-brand-300 hover:underline"
              >
                Create your first →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentCampaigns.map((campaign) => (
                <div
                  key={campaign._id}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--surface-3)] sm:p-2.5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-500/10">
                    {campaign.thumbnailUrl ? (
                      <img
                        src={campaign.thumbnailUrl}
                        alt={campaign.campaignName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <QrCode size={16} className="text-brand-400" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {campaign.campaignName}
                    </p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={campaign.status} />
                      <span className="text-xs text-[var(--text-muted)]">
                        {campaign.analytics?.totalScans ?? 0} scans
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/dashboard/campaigns/${campaign._id}`}
                    aria-label={`Open ${campaign.campaignName}`}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-brand-400"
                    title="View campaign"
                  >
                    <ExternalLink size={16} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
