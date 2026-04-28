import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, QrCode, ScanLine, TrendingUp,
  UserCheck, Activity, Calendar, ExternalLink,
} from 'lucide-react';
import { adminService } from '../../services/adminService';

// ---------------------------------------------------------------------------
// Shared micro-components
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

const Skeleton = ({ h = 'h-20', className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-[var(--surface-2)] ${h} ${className}`} />
);

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(15,10,30,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#e2e8f0',
  fontSize: 12,
};

// ---------------------------------------------------------------------------
// AdminDashboardPage
// ---------------------------------------------------------------------------
const AdminDashboardPage = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    adminService.getStats()
      .then(setData)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  const s = data?.scans     || {};
  const u = data?.users     || {};
  const c = data?.campaigns || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Platform Overview</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Real-time stats across the entire platform</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h="h-32" />)
        ) : (
          <>
            <StatCard icon={Users}     label="Total Users"       value={u.total?.toLocaleString()}    sub={`${u.active} active`}          accent="#7c3aed" />
            <StatCard icon={UserCheck} label="New This Week"     value={u.newThisWeek}                sub={`${u.newToday} today`}          accent="#06b6d4" />
            <StatCard icon={QrCode}    label="Total Campaigns"   value={c.total?.toLocaleString()}    sub={`${c.active} active`}          accent="#10b981" />
            <StatCard icon={ScanLine}  label="Total Scans"       value={s.total?.toLocaleString()}    sub={`${s.today} today`}            accent="#f59e0b" />
            <StatCard icon={Activity}  label="Active Campaigns"  value={c.active}                     sub="currently running"             accent="#7c3aed" />
            <StatCard icon={TrendingUp} label="Scans Today"      value={s.today}                      sub="last 24 hours"                 accent="#06b6d4" />
            <StatCard icon={UserCheck} label="Active Users"      value={u.active}                     sub={`${u.total - u.active} suspended`} accent="#10b981" />
            <StatCard icon={Calendar}  label="New Users Today"   value={u.newToday}                   sub="registrations"                 accent="#f59e0b" />
          </>
        )}
      </div>

      {/* ── Weekly signups chart ────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">New User Registrations (7 days)</h2>
        {loading ? (
          <Skeleton h="h-48" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data?.weeklySignups || []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2}
                fill="url(#adminGrad)" name="New Users" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Top users ───────────────────────────────────────────────── */}
        <div className="glass-card overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Top Users by Scans</h2>
            <Link to="/admin/users" className="text-xs text-brand-400 hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="h-10" />)}</div>
          ) : (data?.topUsers?.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                <Users size={20} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">No scan data yet</p>
              <p className="max-w-xs text-xs text-[var(--text-muted)]">
                Top users by scan volume will appear here once campaigns start receiving traffic.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data?.topUsers?.map((u, i) => (
                <li key={u._id} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[var(--surface-2)]">
                  <span className="w-5 text-center text-xs text-[var(--text-muted)]">{i + 1}</span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
                    {u.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{u.name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{u.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{u.totalScans?.toLocaleString()}</p>
                    <p className="text-xs text-[var(--text-muted)]">scans</p>
                  </div>
                  {!u.isActive && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">Suspended</span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </div>

        {/* ── Recent campaigns ────────────────────────────────────────── */}
        <div className="glass-card overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent Campaigns</h2>
            <Link to="/admin/campaigns" className="text-xs text-brand-400 hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="h-12" />)}</div>
          ) : (data?.recentCampaigns?.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                <QrCode size={20} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">No campaigns yet</p>
              <p className="max-w-xs text-xs text-[var(--text-muted)]">
                The most recent published campaigns across the platform will show up here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data?.recentCampaigns?.map((c) => (
                <li key={c._id} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[var(--surface-2)]">
                  {c.thumbnailUrl ? (
                    <img src={c.thumbnailUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                      <QrCode size={14} className="text-brand-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{c.campaignName}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{c.userId?.name || 'Unknown'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                      {c.status}
                    </span>
                    {c.status === 'active' ? (
                      <a href={`/ar/${c._id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-brand-400"
                        aria-label="Preview AR experience"
                        title="Preview AR">
                        <ExternalLink size={16} />
                      </a>
                    ) : (
                      <span className="inline-flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-lg text-[var(--text-muted)] opacity-40" title="Activate campaign to preview AR">
                        <ExternalLink size={16} />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
