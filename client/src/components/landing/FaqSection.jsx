import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const FAQS = [
  {
    q: 'Do users need to download an app to see my content?',
    a: 'No app required — ever. Everything runs directly in the phone\'s browser. When someone scans your QR code, it opens instantly in Safari or Chrome. For AR experiences, the camera activates in the browser itself.',
  },
  {
    q: 'What is an AR Digital Business Card?',
    a: 'It\'s a printed business card with a QR code on the back. When scanned on a mobile device, your uploaded video appears to "pop out" of the card in augmented reality — like a hologram floating above the print. It\'s the most memorable first impression you can make.',
  },
  {
    q: 'Can I change where a QR code points after I\'ve already printed it?',
    a: 'Yes — that\'s exactly what Dynamic QR campaigns are for. Your printed QR code stays identical forever, but you update the destination URL from your dashboard anytime. Perfect for seasonal menus, event pages, and rotating promotions.',
  },
  {
    q: 'What analytics will I see?',
    a: 'Every campaign tracks scans, unique visitors, device type, browser, and geo-location. AR and video campaigns additionally show session time, video completion percentage, and a 7-day heatmap. Digital business cards show action taps (call, WhatsApp, website, social) and print downloads.',
  },
  {
    q: 'Which campaign type should I start with?',
    a: 'If you hand out business cards, start with the AR Digital Business Card — it\'s the highest-impact option. If you manage a restaurant or event, the Multiple Links QR is the fastest win. Not sure? The Starter plan lets you try up to 3 different campaign types for free.',
  },
];

const FaqItem = ({ q, a, isOpen, onToggle }) => (
  <div className="border-b border-[var(--border-subtle)] last:border-b-0">
    <button
      type="button"
      onClick={onToggle}
      className="flex min-h-[52px] w-full items-start justify-between gap-4 py-4 text-left"
      aria-expanded={isOpen}
    >
      <span className="text-sm font-semibold text-[var(--text-primary)] sm:text-base">{q}</span>
      <span className="mt-0.5 shrink-0 text-[var(--brand)]">
        {isOpen ? <Minus size={16} /> : <Plus size={16} />}
      </span>
    </button>

    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="answer"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <p className="pb-4 text-sm leading-relaxed text-[var(--text-secondary)]">{a}</p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const FaqSection = () => {
  const [openIdx, setOpenIdx] = useState(0);

  const toggle = (i) => setOpenIdx((prev) => (prev === i ? -1 : i));

  return (
    <section
      id="faq"
      className="bg-[var(--bg-secondary)] px-4 py-16 sm:px-6 sm:py-20 md:px-8 lg:px-16 xl:px-24"
    >
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
            Frequently asked{' '}
            <span className="gradient-text">questions</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
            Everything you need to know before your first scan.
          </p>
        </motion.div>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-5 sm:px-8"
        >
          {FAQS.map((item, i) => (
            <FaqItem
              key={item.q}
              q={item.q}
              a={item.a}
              isOpen={openIdx === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FaqSection;
