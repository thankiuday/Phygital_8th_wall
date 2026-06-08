import BrandLockup from '../ui/BrandLockup';
import PublicQuickLinksMenu from './PublicQuickLinksMenu';
import PoweredByPhygitalFooter from './PoweredByPhygitalFooter';
import HubContentPanel from './HubContentPanel';

/**
 * Shared layout for public campaign hub pages: gradient bg, glass header,
 * flex main area, and viewport-pinned powered-by footer.
 */
const HubPageShell = ({
  children,
  footer,
  maxWidth = 'max-w-md',
  headerMaxWidth = 'max-w-6xl',
  mainClassName = '',
  centerMain = false,
  panel = false,
  theme = 'light',
  showDefaultHeader = true,
  headerExtra,
}) => {
  const mainJustify = centerMain ? 'max-md:justify-center md:justify-start md:pt-10 lg:pt-12' : '';
  const chromePadding = 'px-4 sm:px-6 lg:px-8';

  const mainContent = panel ? <HubContentPanel>{children}</HubContentPanel> : children;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Ambient background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 hidden opacity-40 md:block hub-ambient-grid"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -left-24 top-1/4 -z-10 h-64 w-64 rounded-full bg-brand-500/8 blur-3xl lg:h-96 lg:w-96 lg:-left-32"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -right-24 bottom-1/3 -z-10 h-48 w-48 rounded-full bg-accent-500/6 blur-3xl lg:h-72 lg:w-72 lg:-right-32"
        aria-hidden
      />

      {showDefaultHeader && (
        <header className="sticky top-0 z-30 shrink-0 border-b border-[var(--border-color)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] [-webkit-backdrop-filter:blur(var(--glass-blur))]">
          <div
            className={`mx-auto flex w-full items-center justify-between py-3 ${chromePadding} ${headerMaxWidth}`}
          >
            <BrandLockup variant="header" />
            <div className="flex items-center gap-2">
              {headerExtra}
              <PublicQuickLinksMenu theme={theme} />
            </div>
          </div>
        </header>
      )}

      <main
        className={`mx-auto flex w-full flex-1 flex-col py-6 sm:py-8 ${chromePadding} ${maxWidth} ${mainJustify} ${mainClassName}`}
      >
        {mainContent}
      </main>

      <footer className="relative shrink-0 bg-[var(--bg-primary)]">
        {footer ?? (
          <div className={`mx-auto w-full ${chromePadding} ${headerMaxWidth}`}>
            <PoweredByPhygitalFooter theme={theme} pinned />
          </div>
        )}
      </footer>
    </div>
  );
};

export default HubPageShell;
