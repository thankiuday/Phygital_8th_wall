/**
 * RouteSkeleton — lightweight, layout-shaped fallback used by the
 * inner-route `<Suspense>` while a lazy chunk is downloaded.
 *
 * Sized to live inside DashboardLayout / AdminLayout so the surrounding
 * shell (sidebar, top bar) stays visible during navigation. It renders a
 * stack of pulsing rows with `content-width` padding, mimicking the
 * structure most pages share (page header + a couple of cards + list).
 */
const SkeletonBar = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-xl bg-[var(--surface-2)] ${className}`}
  />
);

const RouteSkeleton = () => (
  <div
    role="status"
    aria-label="Loading"
    aria-live="polite"
    className="content-width flex h-full w-full flex-col gap-4 px-4 py-6 sm:px-6"
  >
    {/* Page header */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SkeletonBar className="h-7 w-48" />
      <SkeletonBar className="h-9 w-32 sm:w-36" />
    </div>

    {/* KPI / summary row */}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SkeletonBar className="h-24" />
      <SkeletonBar className="h-24" />
      <SkeletonBar className="h-24" />
      <SkeletonBar className="h-24" />
    </div>

    {/* Body — 12-row pulse list */}
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-3 sm:p-4">
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonBar className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <SkeletonBar className="h-3 w-3/5" />
              <SkeletonBar className="h-3 w-2/5" />
            </div>
            <SkeletonBar className="hidden h-8 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>

    <span className="sr-only">Loading page…</span>
  </div>
);

export default RouteSkeleton;
