import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import BrandWord from '../ui/BrandWord';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

const TESTIMONIALS = [
  {
    initials: 'MK',
    name: 'Maya Kline',
    role: 'Freelance Brand Designer',
    quote:
      "I switched from a paper business card to Phygital's AR card and clients are still messaging me about it. The hologram that plays my showreel blew everyone away at the last conference.",
    stars: 5,
  },
  {
    initials: 'RJ',
    name: 'Raj Johal',
    role: 'Restaurant Owner, Bombay Street Kitchen',
    quote:
      "Our QR menu link used to be a static PDF. Now it's a Phygital dynamic QR — we update the menu from the dashboard in seconds and track 400+ taps a week. No more reprinting.",
    stars: 5,
  },
  {
    initials: 'ST',
    name: 'Sofia Torres',
    role: 'Real Estate Agent',
    quote:
      "I put the Phygital QR on my yard signs. Each one links to a video walkthrough and my contact card. Scan-to-lead conversion is up 3x since I switched. The analytics alone are worth it.",
    stars: 5,
  },
];

const renderWithBrandWord = (text) => {
  const parts = text.split(/(Phygital)/g);
  return parts.map((part, idx) => (
    part === 'Phygital'
      ? <BrandWord key={`brand-${idx}`} />
      : <span key={`text-${idx}`}>{part}</span>
  ));
};

const Stars = ({ count }) => (
  <div className="mb-3 flex gap-0.5">
    {Array.from({ length: count }).map((_, i) => (
      <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
    ))}
  </div>
);

const TestimonialsSection = () => (
  <section className="bg-[var(--bg-secondary)] px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:px-16 xl:px-24">
    <div className="content-width">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center sm:mb-12"
      >
        <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
          People who already{' '}
          <span className="gradient-text">Phygitalized</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          From freelancers to restaurant owners — here's what they say.
        </p>
      </motion.div>

      {/* Cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
        className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      >
        {TESTIMONIALS.map(({ initials, name, role, quote, stars }) => (
          <motion.div
            key={name}
            variants={fadeUp}
            className="glass-card flex flex-col justify-between p-6"
          >
            <div>
              <Stars count={stars} />
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                &ldquo;{renderWithBrandWord(quote)}&rdquo;
              </p>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white shadow-glow">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
                <p className="text-xs text-[var(--text-muted)]">{role}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

export default TestimonialsSection;
