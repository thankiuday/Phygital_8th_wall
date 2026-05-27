export const AdminKpiSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="glass-card h-32 animate-pulse bg-[var(--surface-2)]" />
    ))}
  </div>
);

export const AdminChartSkeleton = ({ height = 'h-56' }) => (
  <div className={`glass-card ${height} animate-pulse rounded-xl bg-[var(--surface-2)]`} />
);

export const AdminTableSkeleton = ({ rows = 8, cols = 6 }) => (
  <div className="glass-card overflow-hidden">
    <div className="divide-y divide-[var(--border-color)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-4 flex-1 animate-pulse rounded bg-[var(--surface-3)]" />
          ))}
        </div>
      ))}
    </div>
  </div>
);
