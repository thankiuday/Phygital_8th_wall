import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import BrandWord from './BrandWord';
import { BRAND_MARK_SRC } from './brandAssets';

const VARIANT = {
  header: {
    markBox:
      'h-11 w-11 sm:h-12 sm:w-12 md:h-[52px] md:w-[52px] rounded-xl',
    /** `leading-none` clips descenders (g, y); keep tight but >= ~1.18 */
    word:
      'text-[1.3125rem] font-bold leading-[1.22] tracking-tight sm:text-[1.5rem] sm:leading-[1.2] md:text-[1.6875rem] md:leading-[1.18]',
    gap: 'gap-0',
  },
  footer: {
    markBox: 'h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 rounded-xl',
    word: 'text-lg font-bold tracking-tight sm:text-xl md:text-2xl',
    gap: 'gap-2 sm:gap-2.5',
  },
  auth: {
    markBox: 'h-12 w-12 sm:h-14 sm:w-14 rounded-2xl',
    word: 'text-2xl font-bold tracking-tight sm:text-3xl',
    gap: 'gap-3 sm:gap-4',
  },
  sidebar: {
    markBox: 'h-9 w-9 rounded-lg',
    word: 'text-sm font-bold tracking-tight',
    gap: 'gap-2.5',
  },
  /** Inline “Powered by” / AR footer */
  compact: {
    markBox: 'h-6 w-6 sm:h-7 sm:w-7 rounded-md',
    word: 'text-xs font-bold tracking-tight sm:text-sm',
    gap: 'gap-1.5',
  },
};

/**
 * Horizontal brand: 3D mark (left) + neon gradient “Phygital” (right).
 * Uses theme surfaces behind it — use a transparent PNG for the mark.
 */
const BrandLockup = ({
  variant = 'header',
  to = '/',
  onClick,
  className,
  /** Icon only (e.g. collapsed sidebar) */
  markOnly = false,
}) => {
  const v = VARIANT[variant] ?? VARIANT.header;
  const showWord = !markOnly;

  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label="Phygital home"
      className={cn(
        'inline-flex min-w-0 max-w-full items-center overflow-visible',
        v.gap ?? 'gap-2 sm:gap-2.5 md:gap-3',
        markOnly ? 'justify-center' : 'justify-start',
        className,
      )}
    >
      <span
        className={cn(
          'relative inline-flex shrink-0 overflow-hidden bg-transparent',
          v.markBox,
        )}
      >
        <img
          src={BRAND_MARK_SRC}
          alt=""
          aria-hidden
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover object-center"
        />
      </span>
      {showWord && <BrandWord className={cn('shrink-0', v.word)} />}
    </Link>
  );
};

export default BrandLockup;
