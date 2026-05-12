import { useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Smartphone, Monitor, BarChart3, ExternalLink,
} from 'lucide-react';
import useAnalyticsStore from '../../store/useAnalyticsStore';
import useIsMobile from '../../hooks/useIsMobile';
import Icon3D, { ICON3D_PRESETS } from '../../components/ui/Icon3D';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PERIODS = [
  { value: '7d',  label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const DEVICE_COLORS  = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b'];
const BROWSER_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: '10px',
  color: 'var(--chart-tooltip-color)',
  fontSize: 12,
};

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

const StatCard = ({ icon: Icon, label, value, sub, accent }) => (
  <div className="glass-card flex flex-col gap-3 p-4 sm:p-5">
    <div className="flex items-start justify-between">
      <Icon3D icon={Icon} size={16} className="h-10 w-10" accent={accent} />
    </div>
    <div>
      <p className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">{value ?? '—'}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>}
    </div>
  </div>
);

const SectionTitle = ({ children }) => (
  <h2 className="text-base font-semibold text-[var(--text-primary)]">{children}</h2>
);

const PeriodSelector = ({ value, onChange }) => (
  <div className="grid w-full grid-cols-3 gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1 sm:inline-grid sm:w-auto">
    {PERIODS.map((p) => (
      <button
        key={p.value}
        onClick={() => onChange(p.value)}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-2 py-2 text-xs font-semibold transition-all sm:px-3 sm:py-1.5 ${
          value === p.value
            ? 'bg-brand-600 text-white shadow-glow'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
        aria-pressed={value === p.value}
      >
        {p.label}
      </button>
    ))}
  </div>
);

// Skeleton loader for a chart block
const ChartSkeleton = ({ h = 'h-48' }) => (
  <div className={`${h} animate-pulse rounded-xl bg-[var(--surface-2)]`} />
);

// ---------------------------------------------------------------------------
// Hourly heatmap
// ---------------------------------------------------------------------------
const HourlyHeatmap = ({ data }) => {
  if (!data?.length) return <ChartSkeleton h="h-16" />;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    // Negative margin + horizontal scroll lets phones swipe through the
    // 24 buckets instead of squeezing each into a 4-pixel sliver.
    <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide" title="Hourly scan distribution">
      <div className="flex items-end gap-0.5">
        {data.map(({ hour, count }) => (
          <div key={hour} className="group flex min-w-[14px] flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${Math.max(4, (count / max) * 48)}px`,
                background: count > 0
                  ? `rgba(124,58,237,${0.2 + (count / max) * 0.8})`
                  : 'var(--chart-heatmap-empty)',
              }}
              title={`${hour}:00 — ${count} scans`}
            />
            {hour % 6 === 0 && (
              <span className="text-[11px] text-[var(--text-muted)]">{hour}h</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const AnalyticsPage = () => {
  const { overview, period, isLoading, error, fetchOverview, setPeriod } = useAnalyticsStore();
  const isMobile = useIsMobile();

  // Margins / Y-axis width are tighter on mobile so the plot uses every pixel
  const chartMargin = isMobile
    ? { top: 4, right: 4, bottom: 0, left: 0 }
    : { top: 4, right: 4, bottom: 0, left: -20 };
  const yAxisWidth = isMobile ? 36 : 60;

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const stats = overview?.allTime || {};
  const period_stats = overview?.periodStats || {};
  const scanTrend    = overview?.scanTrend || [];
  const devices      = overview?.deviceBreakdown || [];
  const browsers     = overview?.browserBreakdown || [];
  const topCampaigns = overview?.topCampaigns || [];
  const hourly       = overview?.hourlyHeatmap || [];

  const fmtDuration = (ms) => {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-6xl space-y-6 p-4 sm:space-y-8 sm:p-6"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Performance insights across all your campaigns
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── All-time stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card h-32 animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              icon={ScanLine}
              label="Total Scans"
              value={stats.totalScans?.toLocaleString()}
              sub={`+${period_stats.scans?.toLocaleString() || 0} this period`}
              accent={ICON3D_PRESETS.violet}
            />
            <StatCard
              icon={Users}
              label="Unique Visitors"
              value={stats.uniqueVisitors?.toLocaleString()}
              sub={`+${period_stats.uniqueVisitors?.toLocaleString() || 0} this period`}
              accent={ICON3D_PRESETS.cyan}
            />
            <StatCard
              icon={Clock}
              label="Avg Session"
              value={fmtDuration(stats.avgSessionDuration)}
              sub="Time spent in AR"
              accent={ICON3D_PRESETS.emerald}
            />
            <StatCard
              icon={PlayCircle}
              label="Video Completion"
              value={stats.avgVideoWatchPercent ? `${stats.avgVideoWatchPercent}%` : '—'}
              sub="Average watch %"
              accent={ICON3D_PRESETS.amber}
            />
          </>
        )}
      </div>

      {/* ── Scan trend chart ────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Scan Trend</SectionTitle>
          <span className="text-xs text-[var(--text-muted)]">Last {period}</span>
        </div>
        {isLoading ? (
          <ChartSkeleton h="h-56" />
        ) : !scanTrend.length ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] text-center">
            <BarChart3 size={28} className="text-[var(--text-muted)]/60" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No scans yet for this period</p>
            <p className="max-w-xs text-xs text-[var(--text-muted)]">
              Once visitors scan your campaign QR, the trend will populate here.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={scanTrend} margin={chartMargin}>
              <defs>
                <linearGradient id="gradScans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradUnique" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => d.slice(5)}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                width={yAxisWidth}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={{ color: '#a78bfa', marginBottom: 4 }}
              />
              {!isMobile && (
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="scans"
                stroke="#7c3aed"
                strokeWidth={2}
                fill="url(#gradScans)"
                name="Total Scans"
                dot={false}
                activeDot={{ r: 4, fill: '#7c3aed' }}
              />
              <Area
                type="monotone"
                dataKey="uniqueScans"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#gradUnique)"
                name="Unique Visitors"
                dot={false}
                activeDot={{ r: 4, fill: '#06b6d4' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Device + Browser breakdown ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Device pie */}
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Icon3D icon={Smartphone} size={12} className="h-7 w-7" accent={ICON3D_PRESETS.violet} rounded="rounded-lg" />
            <SectionTitle>Device Types</SectionTitle>
          </div>
          {isLoading || !devices.length ? (
            <ChartSkeleton h="h-48" />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={devices}
                    dataKey="count"
                    nameKey="device"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    strokeWidth={0}
                  >
                    {devices.map((_, i) => (
                      <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v, n) => [v, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex min-w-0 flex-1 flex-col gap-2">
                {devices.map((d, i) => (
                  <li key={d.device} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }}
                      />
                      <span className="truncate text-xs capitalize text-[var(--text-secondary)]">
                        {d.device}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[var(--text-primary)]">
                      {d.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Browser bar chart */}
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Icon3D icon={Monitor} size={12} className="h-7 w-7" accent={ICON3D_PRESETS.cyan} rounded="rounded-lg" />
            <SectionTitle>Browsers</SectionTitle>
          </div>
          {isLoading || !browsers.length ? (
            <ChartSkeleton h="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={browsers}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                barCategoryGap="30%"
              >
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="browser"
                  type="category"
                  width={52}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
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
          <Icon3D icon={BarChart3} size={12} className="h-7 w-7" accent={ICON3D_PRESETS.brand} rounded="rounded-lg" />
          <SectionTitle>Scans by Hour of Day</SectionTitle>
        </div>
        {isLoading ? <ChartSkeleton h="h-16" /> : <HourlyHeatmap data={hourly} />}
      </div>

      {/* ── Top campaigns ───────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden p-5">
        <SectionTitle>Top Campaigns</SectionTitle>
        <p className="mb-4 text-xs text-[var(--text-muted)]">Ranked by scans in period</p>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : topCampaigns.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No scan data yet for this period.</p>
        ) : (
          <>
            {/* Mobile cards (below md:) */}
            <div className="space-y-3 md:hidden">
              {topCampaigns.map((c, i) => (
                <article
                  key={c._id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 shrink-0 text-xs text-[var(--text-muted)]">{i + 1}</span>
                    {c.thumbnailUrl ? (
                      <img
                        src={c.thumbnailUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-xs font-bold text-brand-400">
                        AR
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{c.campaignName}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--text-primary)]">{c.scans}</span> scans · {c.uniqueVisitors} unique
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        c.status === 'active'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-yellow-500/15 text-yellow-400'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <Link
                    to={`/dashboard/campaigns/${c._id}/analytics`}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-1)] px-3 text-xs font-medium text-brand-400 hover:border-brand-500/50"
                    aria-label={`View analytics for ${c.campaignName}`}
                  >
                    View Details <ExternalLink size={12} />
                  </Link>
                </article>
              ))}
            </div>

            {/* Desktop table (md: and up) */}
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-muted)]">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 text-right font-medium">Scans</th>
                  <th className="pb-2 text-right font-medium">Unique</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                  <th className="pb-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {topCampaigns.map((c, i) => (
                  <tr key={c._id} className="group">
                    <td className="py-3 text-[var(--text-muted)]">{i + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {c.thumbnailUrl ? (
                          <img
                            src={c.thumbnailUrl}
                            alt=""
                            className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 text-xs font-bold text-brand-400">
                            AR
                          </div>
                        )}
                        <span className="font-medium text-[var(--text-primary)]">
                          {c.campaignName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right font-semibold text-[var(--text-primary)]">
                      {c.scans}
                    </td>
                    <td className="py-3 text-right text-[var(--text-secondary)]">
                      {c.uniqueVisitors}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          c.status === 'active'
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-yellow-500/15 text-yellow-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/dashboard/campaigns/${c._id}/analytics`}
                        className="inline-flex min-h-[44px] items-center gap-1 text-xs text-brand-400 opacity-100 transition-opacity hover:underline md:opacity-0 md:group-hover:opacity-100"
                        aria-label={`View analytics for ${c.campaignName}`}
                      >
                        Details <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default AnalyticsPage;
