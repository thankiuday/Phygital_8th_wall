const STATS = [
  { value: '5,000+', label: 'Campaigns Created' },
  { value: '2M+',    label: 'Scans Tracked' },
  { value: '6',      label: 'Campaign Types' },
  { value: '0',      label: 'App Downloads Needed' },
];

const SocialProofStrip = () => (
  <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
    <div className="content-width px-4 py-8 sm:px-6 md:px-8">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {STATS.map(({ value, label }, i) => (
          <div
            key={label}
            className={`flex flex-col items-center text-center ${
              i < STATS.length - 1 ? 'lg:border-r lg:border-[var(--border-subtle)]' : ''
            }`}
          >
            <span className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {value}
            </span>
            <span className="mt-1 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] sm:text-sm">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default SocialProofStrip;
