/**
 * Responsive content wrapper for public hub pages.
 * Mobile: flat (no extra chrome). Tablet/desktop: unified glass panel.
 */
const HubContentPanel = ({ children, className = '' }) => (
  <div
    className={`w-full max-md:contents md:glass-card md:rounded-2xl md:border md:p-6 md:shadow-[0_8px_40px_rgba(0,0,0,0.25)] lg:p-8 ${className}`}
  >
    {children}
  </div>
);

export default HubContentPanel;
