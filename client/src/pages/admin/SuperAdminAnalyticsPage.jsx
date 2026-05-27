import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { adminService } from '../../services/adminService';
import { AdminChartSkeleton } from '../../components/ui/AdminSkeleton';
import ErrorBoundary from '../../components/ui/ErrorBoundary';

const ADMIN_QUERY = { staleTime: 60_000, refetchOnWindowFocus: false };
const DAY_OPTIONS = [7, 30, 60, 90];
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: '10px',
  color: 'var(--chart-tooltip-color)',
  fontSize: 12,
};
const PIE_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const maxHeat = (cells) => Math.max(1, ...cells.map((c) => c.count || 0));

const SuperAdminAnalyticsPage = () => {
  const [days, setDays] = useState(30);
  const qOpts = { ...ADMIN_QUERY };

  const kpisQ = useQuery({ queryKey: ['admin', 'kpis'], queryFn: adminService.getPlatformKPIs, ...qOpts });
  const signupsQ = useQuery({ queryKey: ['admin', 'signups', days], queryFn: () => adminService.getSignupsTrend(days), ...qOpts });
  const scansQ = useQuery({ queryKey: ['admin', 'scans', days], queryFn: () => adminService.getScansTrend(days), ...qOpts });
  const typesQ = useQuery({ queryKey: ['admin', 'campaign-types'], queryFn: adminService.getCampaignTypeBreakdown, ...qOpts });
  const devicesQ = useQuery({ queryKey: ['admin', 'devices', days], queryFn: () => adminService.getDeviceBreakdown(days), ...qOpts });
  const geoQ = useQuery({ queryKey: ['admin', 'geo', days], queryFn: () => adminService.getGeoBreakdown(days), ...qOpts });
  const topQ = useQuery({ queryKey: ['admin', 'top-campaigns', days], queryFn: () => adminService.getTopCampaigns(days), ...qOpts });
  const engagementQ = useQuery({ queryKey: ['admin', 'engagement', days], queryFn: () => adminService.getEngagementStats(days), ...qOpts });
  const retentionQ = useQuery({ queryKey: ['admin', 'retention', days], queryFn: () => adminService.getRetentionBreakdown(days), ...qOpts });
  const heatmapQ = useQuery({ queryKey: ['admin', 'heatmap', days], queryFn: () => adminService.getHourlyHeatmap(days), ...qOpts });

  const heatCells = useMemo(() => {
    const map = new Map();
    (heatmapQ.data?.heatmap || []).forEach(({ hour, dayOfWeek, count }) => {
      map.set(`${dayOfWeek}-${hour}`, count);
    });
    const cells = [];
    for (let dow = 1; dow <= 7; dow += 1) {
      for (let h = 0; h < 24; h += 1) {
        cells.push({ key: `${dow}-${h}`, dow, hour: h, count: map.get(`${dow}-${h}`) || 0 });
      }
    }
    return cells;
  }, [heatmapQ.data]);

  const heatMax = maxHeat(heatCells);
  const geoMax = Math.max(1, ...(geoQ.data?.countries || []).map((g) => g.count));
  const radarData = (typesQ.data?.breakdown || []).map((t) => ({
    type: (t.type || 'unknown').replace(/_/g, ' '),
    count: t.count,
  }));

  const statusPie = [
    { name: 'Active', value: kpisQ.data?.campaigns?.active || 0 },
    { name: 'Draft', value: kpisQ.data?.campaigns?.draft || 0 },
    {
      name: 'Other',
      value: Math.max(
        0,
        (kpisQ.data?.campaigns?.total || 0) -
          (kpisQ.data?.campaigns?.active || 0) -
          (kpisQ.data?.campaigns?.draft || 0)
      ),
    },
  ].filter((s) => s.value > 0);

  const eng = engagementQ.data || {};
  const ret = retentionQ.data || {};

  const DAY_LABELS = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Platform trends and engagement</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                days === d ? 'bg-brand-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Avg session', value: `${eng.avgSessionSeconds ?? 0}s` },
          { label: 'Video play rate', value: `${eng.videoPlayRate ?? 0}%` },
          { label: 'Avg watch', value: `${eng.avgVideoWatchSeconds ?? 0}s` },
          { label: 'Avg watch %', value: `${eng.avgVideoWatchPercent ?? 0}%` },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card p-4">
            <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{value}</p>
            <p className="text-xs text-[var(--text-muted)]">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ErrorBoundary>
          <div className="glass-card p-5">
            <h2 className="mb-4 text-base font-semibold">Signups ({days}d)</h2>
            {signupsQ.isLoading ? <AdminChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={signupsQ.data?.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="count" stroke="#7c3aed" fill="#7c3aed33" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="glass-card p-5">
            <h2 className="mb-4 text-base font-semibold">Scans ({days}d)</h2>
            {scansQ.isLoading ? <AdminChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={scansQ.data?.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="scans" stroke="#06b6d4" fill="#06b6d433" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </ErrorBoundary>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-5 lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold">Campaign status</h2>
          {kpisQ.isLoading ? <AdminChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {statusPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold">Campaign types (radar)</h2>
          {typesQ.isLoading ? <AdminChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border-color)" />
                <PolarAngleAxis dataKey="type" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                <PolarRadiusAxis tick={{ fontSize: 9 }} />
                <Radar dataKey="count" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.4} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-5">
          <h2 className="mb-4 text-base font-semibold">Devices</h2>
          {devicesQ.isLoading ? <AdminChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={devicesQ.data?.devices || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="device" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-4 text-base font-semibold">Visitor retention</h2>
          <div className="flex gap-6 py-6">
            <div>
              <p className="font-mono text-3xl font-bold text-[var(--text-primary)]">{ret.newVisitors ?? 0}</p>
              <p className="text-xs text-[var(--text-muted)]">New visitors</p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold text-brand-400">{ret.returningVisitors ?? 0}</p>
              <p className="text-xs text-[var(--text-muted)]">Returning</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="mb-4 text-base font-semibold">Scan heatmap (day × hour)</h2>
        {heatmapQ.isLoading ? (
          <AdminChartSkeleton height="h-40" />
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: '48px repeat(24, minmax(12px, 1fr))', minWidth: '640px' }}
            >
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-center text-[9px] text-[var(--text-muted)]">{h}</div>
              ))}
              {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
                <Fragment key={dow}>
                  <div className="pr-2 text-right text-[10px] text-[var(--text-muted)]">
                    {DAY_LABELS[dow]}
                  </div>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const count = heatCells.find((c) => c.dow === dow && c.hour === h)?.count || 0;
                    const opacity = 0.08 + (count / heatMax) * 0.92;
                    return (
                      <div
                        key={`${dow}-${h}`}
                        title={`${DAY_LABELS[dow]} ${h}:00 — ${count} scans`}
                        className="aspect-square min-h-[10px] rounded-sm"
                        style={{ backgroundColor: `rgba(124, 58, 237, ${opacity})` }}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card overflow-hidden p-5">
          <h2 className="mb-4 text-base font-semibold">Top countries</h2>
          {geoQ.isLoading ? (
            <AdminChartSkeleton height="h-48" />
          ) : (geoQ.data?.countries || []).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No geo data</p>
          ) : (
            <ul className="space-y-2">
              {(geoQ.data?.countries || []).slice(0, 15).map((row) => (
                <li key={row.country} className="flex items-center gap-3 text-sm">
                  <span className="w-10 shrink-0 font-mono text-xs text-[var(--text-muted)]">{row.country}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${(row.count / geoMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-xs">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card overflow-hidden p-5">
          <h2 className="mb-4 text-base font-semibold">Top campaigns ({days}d)</h2>
          {topQ.isLoading ? (
            <AdminChartSkeleton height="h-48" />
          ) : (topQ.data?.campaigns || []).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No campaigns</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)]">
                    <th className="pb-2">Campaign</th>
                    <th className="pb-2">Owner</th>
                    <th className="pb-2 text-right">Scans</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {(topQ.data?.campaigns || []).map((row) => (
                    <tr key={String(row.campaignId)}>
                      <td className="py-2 pr-2">
                        <p className="truncate font-medium">{row.campaignName || '—'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{row.campaignType}</p>
                      </td>
                      <td className="py-2 text-xs text-[var(--text-muted)]">{row.ownerEmail}</td>
                      <td className="py-2 text-right font-mono">{row.scans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminAnalyticsPage;
