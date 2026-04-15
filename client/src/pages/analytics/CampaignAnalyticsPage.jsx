import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  ScanLine, Users, Clock, PlayCircle,
  Smartphone, Monitor, BarChart3, ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import useAnalyticsStore from '../../store/useAnalyticsStore';

// ---------------------------------------------------------------------------
// Constants (same as AnalyticsPage to keep brand consistent)
// ---------------------------------------------------------------------------
const PERIODS = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];
const DEVICE_COLORS  = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b'];
const BROWSER_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];
const TOOLTIP_STYLE  = {
  backgroundColor: 'rgba(15,10,30,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#e2e8f0',
  fontSize: 12,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatCard = ({ icon: Icon, label, value, sub, accent }) => (
  <div className="glass-card flex flex-col gap-3 p-5">
    <div
      className="flex h-10 w-10 items-center justify-center rounded-xl"
      style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
    >
      <Icon size={18} style={{ color: accent }} />
    </div>
    <div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value ?? '—'}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>}
    </div>
  </div>
);

const ChartSkeleton = ({ h = 'h-48' }) => (
  <div className={`${h} animate-pulse rounded-xl bg-[var(--surface-2)]`} />
);

const HourlyHeatmap = ({ data }) => {
  if (!data?.length) return <ChartSkeleton h="h-16" />;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-0.5">
      {data.map(({ hour, count }) => (
        <div key={hour} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm"
            style={{
              height: `${Math.max(4, (count / max) * 48)}px`,
              background: count > 0
                ? `rgba(124,58,237,${0.2 + (count / max) * 0.8})`
                : 'rgba(255,255,255,0.05)',
            }}
            title={`${hour}:00 — ${count} scans`}
          />
          {hour % 6 === 0 && (
            <span className="text-[9px] text-[var(--text-muted)]">{hour}h</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const CampaignAnalyticsPage = () => {
  const { id } = useParams();
  const {
    campaignData,
    period,
    isLoadingCamp,
    error,
    fetchCampaignAnalytics,
    setPeriod,
    clearCampaignData,
  } = useAnalyticsStore();

  useEffect(() => {
    fetchCampaignAnalytics(id);
    return () => clearCampaignData();
  }, [id, fetchCampaignAnalytics, clearCampaignData]);

  const handlePeriod = (p) => {
    setPeriod(p);
    fetchCampaignAnalytics(id, p);
  };

  const stats       = campaignData?.allTime    || {};
  const periodStats = campaignData?.periodStats || {};
  const scanTrend   = campaignData?.scanTrend   || [];
  const devices     = campaignData?.deviceBreakdown  || [];
  const browsers    = campaignData?.browserBreakdown || [];
  const hourly      = campaignData?.hourlyHeatmap    || [];
  const campaign    = campaignData?.campaign;

  const fmtDuration = (ms) => {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-6xl space-y-8 p-6"
    >
      {/* ── Breadcrumb + header ─────────────────────────────────────────── */}
      <div>
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Link to="/dashboard/analytics" className="flex items-center gap-1 hover:text-brand-400">
            <ArrowLeft size={12} /> Analytics
          </Link>
          <ChevronRight size={12} />
          <Link
            to={`/dashboard/campaigns/${id}`}
            className="hover:text-brand-400"
          >
            {campaign?.campaignName || 'Campaign'}
          </Link>
          <ChevronRight size={12} />
          <span>Analytics</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {campaign?.campaignName || 'Campaign Analytics'}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Scan performance for this campaign
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriod(p.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  period === p.value
                    ? 'bg-brand-600 text-white shadow-glow'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoadingCamp ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card h-32 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              icon={ScanLine}
              label="Total Scans"
              value={stats.totalScans?.toLocaleString()}
              sub={`+${periodStats.scans || 0} this period`}
              accent="#7c3aed"
            />
            <StatCard
              icon={Users}
              label="Unique Visitors"
              value={stats.uniqueVisitors?.toLocaleString()}
              sub={`+${periodStats.uniqueVisitors || 0} this period`}
              accent="#06b6d4"
            />
            <StatCard
              icon={Clock}
              label="Avg Session"
              value={fmtDuration(stats.avgSessionDuration)}
              sub="Time in AR"
              accent="#10b981"
            />
            <StatCard
              icon={PlayCircle}
              label="Video Completion"
              value={stats.avgVideoWatchPercent ? `${stats.avgVideoWatchPercent}%` : '—'}
              sub="Avg watch %"
              accent="#f59e0b"
            />
          </>
        )}
      </div>

      {/* ── Scan trend ─────────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Scan Trend</h2>
          <span className="text-xs text-[var(--text-muted)]">Last {period}</span>
        </div>
        {isLoadingCamp || !scanTrend.length ? (
          <ChartSkeleton h="h-56" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={scanTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="cGradScans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cGradUniq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => d.slice(5)}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area
                type="monotone" dataKey="scans"
                stroke="#7c3aed" strokeWidth={2} fill="url(#cGradScans)"
                name="Total Scans" dot={false} activeDot={{ r: 4 }}
              />
              <Area
                type="monotone" dataKey="uniqueScans"
                stroke="#06b6d4" strokeWidth={2} fill="url(#cGradUniq)"
                name="Unique" dot={false} activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Device + Browser ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Smartphone size={16} className="text-brand-400" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Device Types</h2>
          </div>
          {isLoadingCamp || !devices.length ? (
            <ChartSkeleton h="h-40" />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={devices} dataKey="count" nameKey="device" cx="50%" cy="50%"
                    innerRadius={36} outerRadius={54} strokeWidth={0}>
                    {devices.map((_, i) => (
                      <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex flex-1 flex-col gap-2">
                {devices.map((d, i) => (
                  <li key={d.device} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full"
                        style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                      <span className="text-xs capitalize text-[var(--text-secondary)]">{d.device}</span>
                    </div>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{d.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Monitor size={16} className="text-accent-400" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Browsers</h2>
          </div>
          {isLoadingCamp || !browsers.length ? (
            <ChartSkeleton h="h-40" />
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={browsers} layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false} />
                <YAxis dataKey="browser" type="category" width={50}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Scans" radius={[0, 4, 4, 0]}>
                  {browsers.map((_, i) => (
                    <Cell key={i} fill={BROWSER_COLORS[i % BROWSER_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Hourly heatmap ──────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-400" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Scans by Hour</h2>
        </div>
        {isLoadingCamp ? <ChartSkeleton h="h-16" /> : <HourlyHeatmap data={hourly} />}
      </div>

      {/* ── Back links ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pb-4 text-sm">
        <Link
          to={`/dashboard/campaigns/${id}`}
          className="text-brand-400 hover:text-brand-300 hover:underline"
        >
          ← Back to Campaign
        </Link>
        <Link
          to="/dashboard/analytics"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline"
        >
          View All Analytics
        </Link>
      </div>
    </motion.div>
  );
};

export default CampaignAnalyticsPage;
