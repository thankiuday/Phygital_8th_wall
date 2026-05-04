import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ExternalLink,
  Phone,
  MessageCircle,
  AtSign,
  Users,
  Feather,
  Briefcase,
  Globe,
  Music2,
  Link2,
} from 'lucide-react';
import publicApi from '../services/publicApi';
import SEOHead from '../components/ui/SEOHead';

const KIND_ICONS = {
  contact: Phone,
  whatsapp: MessageCircle,
  instagram: AtSign,
  facebook: Users,
  twitter: Feather,
  linkedin: Briefcase,
  website: Globe,
  tiktok: Music2,
  custom: Link2,
};

const configuredApiUrl = import.meta.env.VITE_API_URL;
const shouldForceRemoteInDev = import.meta.env.VITE_USE_REMOTE_API === 'true';

const publicApiBase = () => {
  if (import.meta.env.DEV && !shouldForceRemoteInDev) {
    return `${window.location.origin}/api`;
  }
  return (configuredApiUrl || `${window.location.origin}/api`).replace(/\/$/, '');
};

const deviceTypeGuess = () => {
  const ua = navigator.userAgent || '';
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return 'mobile';
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  return 'desktop';
};

/**
 * Public link-in-bio style page for multiple-links-qr campaigns.
 */
const LinkHubPage = () => {
  const { slug } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const visitorHashRef = useRef('');
  const sessionStartRef = useRef(0);
  const sessionFlushTimerRef = useRef(null);

  const visitorStorageKey = useMemo(() => `p8w_vh_${slug}`, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await publicApi.get(
          `/public/dynamic-qr/${encodeURIComponent(slug)}/meta`
        );
        const data = res.data?.data;
        if (!data) throw new Error('Invalid response');
        if (data.campaignType === 'single-link-qr' && data.destinationUrl) {
          window.location.replace(data.destinationUrl);
          return;
        }
        if (data.campaignType !== 'multiple-links-qr' || !Array.isArray(data.links)) {
          throw new Error('This page is not available.');
        }
        let vh = sessionStorage.getItem(visitorStorageKey);
        if (!vh) {
          vh = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem(visitorStorageKey, vh);
        }
        visitorHashRef.current = vh;
        sessionStartRef.current = Date.now();

        const scanDoneKey = `p8w_scan_done_${slug}`;
        const skipScan = sessionStorage.getItem(scanDoneKey) === '1';
        if (skipScan) {
          sessionStorage.removeItem(scanDoneKey);
        } else {
          await publicApi.post(`/public/multi-link/${encodeURIComponent(slug)}/scan`, {
            visitorHash: vh,
            deviceType: deviceTypeGuess(),
            browser: /Chrome/i.test(navigator.userAgent) ? 'Chrome' : 'Other',
          });
        }

        if (!cancelled) {
          setMeta(data);
          setPhase('ready');
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.response?.data?.message || e?.message || 'This link is not available.'
          );
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, visitorStorageKey]);

  const flushSession = useCallback(() => {
    const vh = visitorHashRef.current;
    if (!vh || !slug) return;
    const ms = Date.now() - (sessionStartRef.current || Date.now());
    const url = `${publicApiBase()}/public/multi-link/${encodeURIComponent(slug)}/session`;
    const body = JSON.stringify({
      visitorHash: vh,
      sessionDurationMs: Math.max(0, ms),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  }, [slug]);

  const scheduleSessionFlush = useCallback(() => {
    if (sessionFlushTimerRef.current) {
      clearTimeout(sessionFlushTimerRef.current);
    }
    sessionFlushTimerRef.current = setTimeout(() => {
      sessionFlushTimerRef.current = null;
      flushSession();
    }, 1600);
  }, [flushSession]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        scheduleSessionFlush();
      } else if (sessionFlushTimerRef.current) {
        clearTimeout(sessionFlushTimerRef.current);
        sessionFlushTimerRef.current = null;
      }
    };
    const onPageHide = () => {
      if (sessionFlushTimerRef.current) {
        clearTimeout(sessionFlushTimerRef.current);
        sessionFlushTimerRef.current = null;
      }
      flushSession();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      if (sessionFlushTimerRef.current) {
        clearTimeout(sessionFlushTimerRef.current);
        sessionFlushTimerRef.current = null;
      }
      flushSession();
    };
  }, [flushSession, scheduleSessionFlush]);

  const onLinkActivate = useCallback(
    (link) => {
      const vh = visitorHashRef.current;
      const url = `${publicApiBase()}/public/multi-link/${encodeURIComponent(slug)}/click`;
      const body = JSON.stringify({
        linkId: link.linkId,
        visitorHash: vh || undefined,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => {});
      }
      window.open(link.href, '_blank', 'noopener,noreferrer');
    },
    [slug]
  );

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-10 text-[var(--text-primary)]">
        <div className="mx-auto max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="h-7 w-48 animate-pulse rounded-lg bg-[var(--surface-2)]" />
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-3)]" />
          </div>
          <ul className="flex min-h-[22rem] flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="h-[4.25rem] animate-pulse rounded-2xl bg-[var(--surface-2)]"
              />
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-[var(--bg-primary)] px-6 text-center">
        <p className="text-[var(--text-primary)]">{error}</p>
      </div>
    );
  }

  const { campaignName, links } = meta;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <SEOHead title={campaignName || 'Links'} description="Quick links" />
      <div className="mx-auto max-w-md px-4 py-10">
        <header className="mb-8 text-center">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {campaignName}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Tap a link below</p>
        </header>

        <ul className="flex flex-col gap-3">
          {links.map((link) => {
            const Icon = KIND_ICONS[link.kind] || Link2;
            return (
              <li key={link.linkId}>
                <button
                  type="button"
                  onClick={() => onLinkActivate(link)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-4 text-left shadow-sm transition hover:border-brand-500/40 hover:bg-[var(--surface-2)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-[var(--text-primary)]">
                    {link.label}
                  </span>
                  <ExternalLink size={16} className="shrink-0 text-[var(--text-muted)]" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default LinkHubPage;
