import { Link } from 'react-router-dom';
import { Heart, Mail, Phone, MapPin } from 'lucide-react';
import BrandWord from './BrandWord';
import BrandLockup from './BrandLockup';

/**
 * Footer — site-wide footer with brand, links, and contact details.
 */
const Footer = () => {
  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--surface-1)]">
      <div className="content-width section-padding py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <BrandLockup variant="footer" className="max-w-[min(100%,280px)] py-1" />

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
              Where the Physical World Meets Digital Storytelling. Join the <BrandWord /> Movement and
              transform how people connect with your creations.
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
              Your Vision. Our Innovation.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Product</h4>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li><Link to="/how-it-works" className="transition-colors hover:text-[var(--brand)]">How It Works</Link></li>
              <li><Link to="/dashboard" className="transition-colors hover:text-[var(--brand)]">Dashboard</Link></li>
              <li><Link to="/dashboard/analytics" className="transition-colors hover:text-[var(--brand)]">Analytics</Link></li>
              <li><Link to="/pricing" className="transition-colors hover:text-[var(--brand)]">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Company</h4>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li><Link to="/about" className="transition-colors hover:text-[var(--brand)]">About</Link></li>
              <li><Link to="/contact" className="transition-colors hover:text-[var(--brand)]">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 border-t border-[var(--border-color)] pt-8 lg:grid-cols-3">
          <div>
            <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Contact Us</h4>
            <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
              <li>
                <a href="mailto:hello@phygital.zone" className="inline-flex items-center gap-2 transition-colors hover:text-[var(--brand)]">
                  <Mail size={14} className="text-brand-400" />
                  hello@phygital.zone
                </a>
              </li>
              <li>
                <a href="tel:+17049667158" className="inline-flex items-center gap-2 transition-colors hover:text-[var(--brand)]">
                  <Phone size={14} className="text-brand-400" />
                  (704) 966-7158
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <MapPin size={14} className="text-brand-400" />
              Charlotte, NC
            </h4>
            <p className="text-sm text-[var(--text-muted)]">
              3440 Toringdon Way, #205
              <br />
              Charlotte, NC 28277
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">San Francisco, CA</h4>
            <p className="text-sm text-[var(--text-muted)]">
              490 Post St STE 500
              <br />
              San Francisco, CA 94102
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--border-color)] pt-5 text-center text-xs text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span>© 2026 <BrandWord />.</span>
            <span aria-hidden>•</span>
            <span>Your Vision. Our Innovation.</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
            <span>Made with</span>
            <Heart size={12} className="text-brand-400" />
            <span>for the <BrandWord /> Movement</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
