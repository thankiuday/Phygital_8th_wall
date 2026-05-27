import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, QrCode, ScanLine, Ticket, TrendingUp, ExternalLink,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useCountUp } from '../../hooks/useCountUp';
import { AdminKpiSkeleton, AdminChartSkeleton } from '../../components/ui/AdminSkeleton';
import ErrorBoundary from '../../components/ui/ErrorBoundary';

const ADMIN_QUERY = { staleTime: 60_000, refetchOnWindowFocus: false };

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: '10px',
  color: 'var(--chart-tooltip-color)',
  fontSize: 12,
};

const PIE_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const KpiCard = ({ icon: Icon, label, value, sub, accent }) => {
  const animated = useCountUp(value);
  return (
    <div className="glass-card flex flex-col gap-3 p-5">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
      >
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
          {value != null ? animated.toLocaleString() : '—'}
        </p>
        <p className="mt-0.5 text-sm font-medium text-[var(--text-secondary)]">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</p>}
      </div>
    </div>
  );
};

const ChartSection = ({ title, children, onRetry }) => (
  <ErrorBoundary
    fallback={
      <div className="glass-card flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-red-400">Chart failed to load</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="text-xs text-brand-400 hover:underline">
            Retry
          </button>
        )}
      </div>
    }
  >
    <div className="glass-card p-5">
      <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {children}
    </div>
  </ErrorBoundary>
);

const SuperAdminDashboardPage = () => {
  const kpisQ = useQuery({
    queryKey: ['admin', 'kpis'],
    queryFn: adminService.getPlatformKPIs,
    ...ADMIN_QUERY,
  });

  const statsQ = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminService.getStats,
    ...ADMIN_QUERY,
  });

  const signupsQ = useQuery({
    queryKey: ['admin', 'signups', 30],
    queryFn: () => adminService.getSignupsTrend(30),
    ...ADMIN_QUERY,
  });

  const scansQ = useQuery({
    queryKey: ['admin', 'scans', 30],
    queryFn: () => adminService.getScansTrend(30),
    ...ADMIN_QUERY,
  });

  const typesQ = useQuery({
    queryKey: ['admin', 'campaign-types'],
    queryFn: adminService.getCampaignTypeBreakdown,
    ...ADMIN_QUERY,
  });

  const loading = kpisQ.isLoading;
  const kpis = kpisQ.data;
  const stats = statsQ.data;
  const error = kpisQ.error?.response?.data?.message || kpisQ.error?.message;

  const u = kpis?.users || {};
  const c = kpis?.campaigns || {};
  const s = kpis?.scans || {};
  const coupons = kpis?.coupons || {};

  const signupChart = signupsQ.data?.trend || [];
  const scanChart = scansQ.data?.trend || [];
  const typeChart = typesQ.data?.breakdown || [];
  const topUsers = stats?.topUsers || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Platform Overview</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Real-time KPIs and activity across the platform
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <AdminKpiSkeleton count={8} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={Users} label="Total Users" value={u.total} sub={`${u.active} active`} accent="#7c3aed" />
          <KpiCard icon={TrendingUp} label="New Users (7d)" value={u.new7d} sub={`${u.new30d} in 30d`} accent="#06b6d4" />
          <KpiCard icon={QrCode} label="Campaigns" value={c.total} sub={`${c.active} active · ${c.draft} draft`} accent="#10b981" />
          <KpiCard icon={ScanLine} label="Total Scans" value={s.total} sub={`${s.last7d} last 7d`} accent="#f59e0b" />
          <KpiCard icon={ScanLine} label="Scans (30d)" value={s.last30d} sub="rolling window" accent="#7c3aed" />
          <KpiCard icon={Ticket} label="Active Coupons" value={coupons.active} sub={`${coupons.totalRedemptions} redemptions`} accent="#06b6d4" />
          <KpiCard icon={Users} label="Active Users" value={u.active} accent="#10b981" />
          <KpiCard icon={QrCode} label="Active Campaigns" value={c.active} accent="#f59e0b" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSection title="Signups (30 days)" onRetry={() => signupsQ.refetch()}>
          {signupsQ.isLoading ? (
            <AdminChartSkeleton height="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={signupChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="count" stroke="#7c3aed" fill="url(#signupGrad)" name="Signups" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        <ChartSection title="Scans (30 days)" onRetry={() => scansQ.refetch()}>
          {scansQ.isLoading ? (
            <AdminChartSkeleton height="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={scanChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="scans" stroke="#06b6d4" fill="url(#scanGrad)" name="Scans" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSection title="Campaign types" onRetry={() => typesQ.refetch()}>
          {typesQ.isLoading ? (
            <AdminChartSkeleton height="h-56" />
          ) : typeChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">No campaign data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeChart} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, count }) => `${type}: ${count}`}>
                  {typeChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        <ChartSection title="Top users by scans">
          {statsQ.isLoading ? (
            <AdminChartSkeleton height="h-56" />
          ) : topUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">No scan data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topUsers} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="totalScans" fill="#7c3aed" name="Scans" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartSection>
      </div>

      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent campaigns</h2>
          <Link to="/admin/campaigns" className="text-xs text-brand-400 hover:underline">
            View all
          </Link>
        </div>
        {statsQ.isLoading ? (
          <AdminChartSkeleton height="h-32" />
        ) : (stats?.recentCampaigns || []).length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No recent campaigns</p>
        ) : (
          <ul className="divide-y divide-[var(--border-color)]">
            {(stats?.recentCampaigns || []).slice(0, 8).map((camp) => (
              <li key={camp._id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{camp.campaignName}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {camp.userId?.email || '—'} · {camp.status}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {new Date(camp.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-[var(--text-muted)]">
        <Link to="/admin/analytics" className="inline-flex items-center gap-1 text-brand-400 hover:underline">
          Deep analytics <ExternalLink size={12} />
        </Link>
      </p>
    </div>
  );
};

export default SuperAdminDashboardPage;
