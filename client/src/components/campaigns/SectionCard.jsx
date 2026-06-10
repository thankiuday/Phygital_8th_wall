/**
 * Consistent section wrapper for campaign detail panels.
 */
const SectionCard = ({
  icon: Icon,
  iconClassName = 'text-brand-400',
  title,
  badge,
  description,
  children,
  className = '',
}) => (
  <section className={`glass-card p-4 sm:p-5 ${className}`.trim()}>
    <div className="mb-4 flex flex-wrap items-start gap-2">
      {Icon && <Icon size={18} className={`shrink-0 ${iconClassName}`} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] sm:text-base">{title}</h3>
          {badge}
        </div>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)] sm:text-sm">{description}</p>
        )}
      </div>
    </div>
    {children}
  </section>
);

export default SectionCard;
