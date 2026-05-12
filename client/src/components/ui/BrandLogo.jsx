import { cn } from '../../utils/cn';
import { BRAND_MARK_SRC } from './brandAssets';

export const BRAND_LOGO_SRC = BRAND_MARK_SRC;
export const BRAND_LOGO_ALT = 'Phygital';

/**
 * Brand lockup image (mark + wordmark). Prefer this over Zap + BrandWord in headers
 * and footers. Use BrandWord for inline copy (e.g. “Join the Phygital Movement”).
 *
 * @param {'sm'|'md'|'lg'|'xl'|'inline'} size — preset heights; `inline` is text-line sized
 */
const SIZE_IMG = {
  inline: 'h-[1.05em] w-auto max-h-[1.15em] translate-y-[0.06em] object-contain object-bottom',
  sm: 'h-8 w-auto max-h-8 object-contain object-left',
  md: 'h-9 w-auto max-h-9 object-contain object-left sm:h-10 sm:max-h-10',
  lg: 'h-10 w-auto max-h-10 object-contain object-left sm:h-11 sm:max-h-11',
  xl: 'h-14 w-auto max-h-14 object-contain object-center sm:h-16 sm:max-h-16',
};

const BrandLogo = ({ className, imgClassName, size = 'md', draggable = false }) => (
  <span className={cn('inline-flex shrink-0 items-center', className)}>
    <img
      src={BRAND_LOGO_SRC}
      alt={BRAND_LOGO_ALT}
      draggable={draggable}
      decoding="async"
      className={cn(SIZE_IMG[size] ?? SIZE_IMG.md, imgClassName)}
    />
  </span>
);

export default BrandLogo;
