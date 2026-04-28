import { Link } from 'react-router-dom';
import { Zap, Code2, MessageCircle, Briefcase } from 'lucide-react';

/**
 * Footer — site-wide footer with links + brand info.
 */
const Footer = () => {
  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--surface-1)]">
      <div className="content-width section-padding py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand column */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
                <Zap size={16} className="text-white" />
              </span>
              <span className="gradient-text text-lg font-bold">Phygital8ThWall</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
              Turn any business card into an immersive AR experience. Create, share, and track your
              holographic brand story.
            </p>
            <div className="mt-4 flex items-center gap-3">
              {[
                { Icon: MessageCircle, href: '#', label: 'Twitter' },
                { Icon: Code2, href: '#', label: 'GitHub' },
                { Icon: Briefcase, href: '#', label: 'LinkedIn' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] transition-colors hover:border-brand-500 hover:text-brand-400"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Product</h4>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              {['Features', 'Pricing', 'Demo'].map((item) => (
                <li key={item}>
                  <Link
                    to={`/${item.toLowerCase()}`}
                    className="transition-colors hover:text-[var(--brand)]"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Company</h4>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              {['About', 'Contact', 'Privacy', 'Terms'].map((item) => (
                <li key={item}>
                  <Link
                    to={`/${item.toLowerCase()}`}
                    className="transition-colors hover:text-[var(--brand)]"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--border-color)] pt-6 text-center text-xs text-[var(--text-muted)]">
          © {new Date().getFullYear()} Phygital8ThWall. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
