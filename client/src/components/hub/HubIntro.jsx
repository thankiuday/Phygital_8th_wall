/**
 * Generic intro block for public hub pages (no owner/system campaign name).
 */
const HubIntro = ({
  title = 'Connect with us',
  subtitle = 'Tap a link below to get in touch.',
}) => (
  <div className="mb-6 text-center md:mb-8">
    <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] sm:text-xl md:text-2xl lg:text-[1.75rem]">
      {title}
    </h1>
    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)] md:text-base">
      {subtitle}
    </p>
  </div>
);

export default HubIntro;
