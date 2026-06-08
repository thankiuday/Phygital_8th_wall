import { BRAND_MARK_SRC } from '../ui/brandAssets';
import BrandWord from '../ui/BrandWord';

/**
 * "Powered by Phygital" attribution row for campaign hub pages.
 * Links externally to https://phygital.zone for marketing purposes.
 *
 * @param {'light'|'dark'} theme - controls text colour
 * @param {boolean} pinned - when true, styles for a viewport-bottom footer bar
 */
const PoweredByPhygitalFooter = ({ theme = 'light', pinned = false }) => {
  const textCls = theme === 'dark' ? 'text-white/30' : 'text-[var(--text-muted)]';
  const borderCls = theme === 'dark' ? 'border-white/10' : 'border-[var(--border-color)]';

  return (
    <div className={pinned ? 'relative' : undefined}>
      {pinned && (
        <div
          className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-[var(--bg-primary)] to-transparent"
          aria-hidden
        />
      )}
      <p
        className={`flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-[11px] ${textCls} ${
          pinned
            ? `border-t ${borderCls} px-4 py-4 pb-[max(0.875rem,env(safe-area-inset-bottom))]`
            : 'mt-8'
        }`}
      >
        <span>Powered by</span>
        <a
          href="https://phygital.zone"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Phygital — visit platform"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 py-1 opacity-80 transition-opacity hover:opacity-100"
        >
          <span className="relative inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-md bg-transparent">
            <img
              src={BRAND_MARK_SRC}
              alt=""
              aria-hidden
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover object-center"
            />
          </span>
          <BrandWord className={`text-[11px] font-bold tracking-tight ${theme === 'dark' ? 'brightness-110' : ''}`} />
        </a>
      </p>
    </div>
  );
};

export default PoweredByPhygitalFooter;
