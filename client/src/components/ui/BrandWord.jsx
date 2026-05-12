import { cn } from '../../utils/cn';

/**
 * BrandWord — consistent brand styling for the word "Phygital".
 * Uses a fixed gradient so it stays identical across all themes.
 */
const BrandWord = ({ className = '' }) => (
  <span className={cn('brand-word', className)}>
    Phygital
  </span>
);

export default BrandWord;
