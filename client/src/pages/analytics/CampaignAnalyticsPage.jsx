import { useEffect, useMemo } from 'react';
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
  ChevronRight, MapPin, MousePointerClick,
} from 'lucide-react';
import useAnalyticsStore from '../../store/useAnalyticsStore';
import useIsMobile from '../../hooks/useIsMobile';

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

const geoSourceLabel = (raw) => {
  const s = raw || 'ip';
  if (s === 'browser') return 'Precise (GPS)';
  if (s === 'hybrid') return 'Hybrid';
  return 'Approx (IP)';
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
    <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide">
      <div className="flex items-end gap-0.5">
        {data.map(({ hour, count }) => (
          <div key={hour} className="flex min-w-[14px] flex-1 flex-col items-center gap-1">
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
const CampaignAnalyticsPage = () => {
  const { id } = useParams();
  const isMobile = useIsMobile();
  const chartMargin = isMobile
    ? { top: 4, right: 4, bottom: 0, left: 0 }
    : { top: 4, right: 4, bottom: 0, left: -20 };
  const yAxisWidth = isMobile ? 36 : 60;
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
  const locations   = campaignData?.locationBreakdown || [];
  const campaign    = campaignData?.campaign;
  const multiLink   = campaignData?.multiLinkAnalytics;
  const isMultiLinkHub = campaign?.campaignType === 'multiple-links-qr';

  const periodLinkClicks = useMemo(() => {
    if (!multiLink?.clicksByLinkPeriod?.length) return 0;
    return multiLink.clicksByLinkPeriod.reduce((acc, r) => acc + (r.clicks || 0), 0);
  }, [multiLink]);

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
        <div className="mb-4 flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Link to="/dashboard/analytics" className="inline-flex shrink-0 items-center gap-1 hover:text-brand-400">
            <ArrowLeft size={12} /> Analytics
          </Link>
          <ChevronRight size={12} className="shrink-0" />
          <Link
            to={`/dashboard/campaigns/${id}`}
            className="block max-w-[12rem] truncate hover:text-brand-400"
          >
            {campaign?.campaignName || 'Campaign'}
          </Link>
          <ChevronRight size={12} className="shrink-0" />
          <span className="shrink-0">Analytics</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-[var(--text-primary)]">
              {campaign?.campaignName || 'Campaign Analytics'}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {isMultiLinkHub
                ? 'Hub visits, sessions, and outbound link taps'
                : 'Scan performance for this campaign'}
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriod(p.value)}
                className={`inline-flex min-h-[44px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
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
              label={isMultiLinkHub ? 'Hub visits' : 'Total scans'}
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
              sub={isMultiLinkHub ? 'Time on link page' : 'Time in AR'}
              accent="#10b981"
            />
            {isMultiLinkHub ? (
              <StatCard
                icon={MousePointerClick}
                label="Link clicks"
                value={periodLinkClicks.toLocaleString()}
                sub="Outbound taps (this period)"
                accent="#f59e0b"
              />
            ) : (
              <StatCard
                icon={PlayCircle}
                label="Video Completion"
                value={stats.avgVideoWatchPercent ? `${stats.avgVideoWatchPercent}%` : '—'}
                sub="Avg watch %"
                accent="#f59e0b"
              />
            )}
          </>
        )}
      </div>

      {/* ── Scan trend ─────────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Scan Trend</h2>
          <span className="text-xs text-[var(--text-muted)]">Last {period}</span>
        </div>
        {isLoadingCamp ? (
          <ChartSkeleton h="h-56" />
        ) : !scanTrend.length ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] text-center">
            <BarChart3 size={28} className="text-[var(--text-muted)]/60" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No scans yet for this period</p>
            <p className="max-w-xs text-xs text-[var(--text-muted)]">
              {isMultiLinkHub
                ? 'Visits appear after someone opens your link hub from the QR code.'
                : "Once someone scans this campaign's QR code, the trend will populate here."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={scanTrend} margin={chartMargin}>
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
                width={yAxisWidth}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {!isMobile && (
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              )}
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

      {/* ── Multi-link: clicks by link + click trend ───────────────────── */}
      {isMultiLinkHub && (
        <>
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <MousePointerClick size={16} className="text-brand-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Clicks by link</h2>
              <span className="ml-auto text-xs text-[var(--text-muted)]">Last {period}</span>
            </div>
            {isLoadingCamp || !multiLink ? (
              <ChartSkeleton h="h-48" />
            ) : !multiLink.clicksByLinkPeriod?.length ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] text-center">
                <MousePointerClick size={24} className="text-[var(--text-muted)]/60" />
                <p className="text-sm text-[var(--text-secondary)]">No link clicks in this period yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.min(360, multiLink.clicksByLinkPeriod.length * 36 + 40)}>
                <BarChart
                  data={multiLink.clicksByLinkPeriod}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
                  barCategoryGap="18%"
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={isMobile ? 100 : 140}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="clicks" name="Clicks" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Click trend</h2>
              <span className="text-xs text-[var(--text-muted)]">Last {period}</span>
            </div>
            {isLoadingCamp || !multiLink ? (
              <ChartSkeleton h="h-56" />
            ) : !multiLink.clickTrend?.length ? (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--text-muted)]/30 text-center">
                <BarChart3 size={28} className="text-[var(--text-muted)]/60" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">No click activity for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={multiLink.clickTrend} margin={chartMargin}>
                  <defs>
                    <linearGradient id="cGradClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#cGradClicks)"
                    name="Clicks"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

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
              <ul className="flex min-w-0 flex-1 flex-col gap-2">
                {devices.map((d, i) => (
                  <li key={d.device} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                      <span className="truncate text-xs capitalize text-[var(--text-secondary)]">{d.device}</span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[var(--text-primary)]">{d.count}</span>
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

      {/* ── Top locations ─────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-brand-400" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {isMultiLinkHub ? 'Top visitor locations' : 'Top scan locations'}
          </h2>
        </div>
        {isLoadingCamp ? (
          <ChartSkeleton h="h-40" />
        ) : !locations.length ? (
          <p className="text-sm text-[var(--text-muted)]">
            No location data available yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="py-2 pr-3 font-medium">City</th>
                  <th className="py-2 pr-3 font-medium">Region</th>
                  <th className="py-2 pr-3 font-medium">Country</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Scans</th>
                  <th className="py-2 font-medium">Unique</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((row, idx) => (
                  <tr key={`${row.city}-${row.region}-${row.country}-${row.geoSource}-${idx}`} className="border-b border-[var(--border-color)]/60">
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{row.city}</td>
                    <td className="py-2 pr-3 text-[var(--text-secondary)]">{row.region}</td>
                    <td className="py-2 pr-3 text-[var(--text-secondary)]">{row.country}</td>
                    <td className="py-2 pr-3 text-xs text-[var(--text-muted)]">{geoSourceLabel(row.geoSource)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{row.scans}</td>
                    <td className="py-2 text-[var(--text-secondary)]">{row.uniqueVisitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
