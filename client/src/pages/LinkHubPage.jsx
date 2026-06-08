import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ExternalLink,
  PauseCircle,
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
  FileType,
  Zap,
} from 'lucide-react';
import publicApi from '../services/publicApi';
import SEOHead from '../components/ui/SEOHead';
import HubVideoPlayer from '../components/hub/HubVideoPlayer';
import HubPageShell from '../components/hub/HubPageShell';
import HubIntro from '../components/hub/HubIntro';
import HubLinkButton from '../components/hub/HubLinkButton';
import { resolvePlaybackMediaUrl } from '../utils/assetUrl';
import { isArMediaType } from '../constants/arMediaProducts';

const HUB_TYPES = new Set([
  'multiple-links-qr',
  'links-video-qr',
  'links-doc-video-qr',
  'ar-card',
  'ar-poster',
]);

const docIconForMime = (mime = '') => {
  if (mime === 'application/pdf') return FileText;
  if (mime.startsWith('image/')) return FileImage;
  if (mime.includes('spreadsheet') || mime.includes('excel')) return FileSpreadsheet;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return Presentation;
  if (mime.includes('word')) return FileType;
  return FileText;
};

const formatBytes = (bytes) => {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const HubSectionLabel = ({ children }) => (
  <p className="mb-3 inline-flex rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
    {children}
  </p>
);

const SIMPLE_HUB_MAX_WIDTH = 'max-w-md md:max-w-lg lg:max-w-xl';

/**
 * Public link-in-bio style page for multiple-links-qr campaigns.
 */
const LinkHubPage = () => {
  const { slug } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | ready | paused | error
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
        if (HUB_TYPES.has(data.campaignType) && (data.paused || data.status === 'paused')) {
          if (!cancelled) {
            setMeta(data);
            setPhase('paused');
          }
          return;
        }
        if (!HUB_TYPES.has(data.campaignType) || !Array.isArray(data.links)) {
          throw new Error('This page is not available.');
        }
        let vh = sessionStorage.getItem(visitorStorageKey);
        if (!vh) {
          vh = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem(visitorStorageKey, vh);
        }
        visitorHashRef.current = vh;
        sessionStartRef.current = Date.now();

        if (!cancelled) {
          const normalized = {
            ...data,
            videoUrl: resolvePlaybackMediaUrl(data.videoUrl),
            thumbnailUrl: resolvePlaybackMediaUrl(data.thumbnailUrl),
            videoItems: Array.isArray(data.videoItems)
              ? data.videoItems.map((vi) => ({
                ...vi,
                videoUrl: resolvePlaybackMediaUrl(vi.videoUrl),
                thumbnailUrl: resolvePlaybackMediaUrl(vi.thumbnailUrl),
              }))
              : data.videoItems,
            docItems: Array.isArray(data.docItems)
              ? data.docItems.map((di) => ({
                ...di,
                url: resolvePlaybackMediaUrl(di.url),
              }))
              : data.docItems,
          };
          setMeta(normalized);
          setPhase('ready');
        }

        const scanDoneKey = `p8w_scan_done_${slug}`;
        const skipScan = sessionStorage.getItem(scanDoneKey) === '1';
        if (skipScan) {
          sessionStorage.removeItem(scanDoneKey);
        } else {
          publicApi
            .post(`/public/multi-link/${encodeURIComponent(slug)}/scan`, {
              visitorHash: vh,
              deviceType: deviceTypeGuess(),
              browser: /Chrome/i.test(navigator.userAgent) ? 'Chrome' : 'Other',
            })
            .catch(() => {});
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

  const sendBeacon = useCallback((path, body) => {
    const url = `${publicApiBase()}${path}`;
    const payload = JSON.stringify(body);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      return;
    }
    fetch(url, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  }, []);

  const onLinkActivate = useCallback(
    (link) => {
      const vh = visitorHashRef.current;
      sendBeacon(`/public/multi-link/${encodeURIComponent(slug)}/click`, {
        linkId: link.linkId,
        kind: 'link',
        visitorHash: vh || undefined,
      });
      window.open(link.href, '_blank', 'noopener,noreferrer');
    },
    [slug, sendBeacon]
  );

  const onDocActivate = useCallback(
    (doc) => {
      const vh = visitorHashRef.current;
      sendBeacon(`/public/multi-link/${encodeURIComponent(slug)}/click`, {
        linkId: doc.docId,
        kind: 'document',
        visitorHash: vh || undefined,
      });
      window.open(doc.url, '_blank', 'noopener,noreferrer');
    },
    [slug, sendBeacon]
  );

  const sendVideoEvent = useCallback(
    (evt, videoId) => {
      const vh = visitorHashRef.current;
      if (!vh || !slug) return;
      sendBeacon(`/public/multi-link/${encodeURIComponent(slug)}/video`, {
        visitorHash: vh,
        event: evt?.event || 'progress',
        videoId: videoId || undefined,
        positionSec: typeof evt?.positionSec === 'number' ? evt.positionSec : undefined,
        durationSec: typeof evt?.durationSec === 'number' ? evt.durationSec : undefined,
        watchPercent: typeof evt?.watchPercent === 'number' ? evt.watchPercent : undefined,
      });
    },
    [slug, sendBeacon]
  );

  // Single-video hubs (links-video-qr) — no per-asset attribution.
  const onVideoEvent = useCallback((evt) => sendVideoEvent(evt), [sendVideoEvent]);

  // Multi-video hubs (links-doc-video-qr) — attribute each beacon to its videoId.
  const makeVideoEventHandler = useCallback(
    (videoId) => (evt) => sendVideoEvent(evt, videoId),
    [sendVideoEvent]
  );

  if (phase === 'loading') {
    return (
      <HubPageShell maxWidth={SIMPLE_HUB_MAX_WIDTH} centerMain panel>
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-[var(--surface-2)]" />
          <div className="h-4 w-56 animate-pulse rounded bg-[var(--surface-3)]" />
        </div>
        <ul className="flex w-full flex-col gap-3 max-md:glass-card max-md:p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="h-[3.25rem] animate-pulse rounded-2xl bg-[var(--surface-2)]"
            />
          ))}
        </ul>
      </HubPageShell>
    );
  }

  if (phase === 'error') {
    return (
      <HubPageShell maxWidth={SIMPLE_HUB_MAX_WIDTH} centerMain panel>
        <div className="text-center">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{error}</p>
        </div>
      </HubPageShell>
    );
  }

  if (phase === 'paused' && meta) {
    return (
      <HubPageShell maxWidth={SIMPLE_HUB_MAX_WIDTH} centerMain panel>
        <SEOHead title="Paused" description="This link page is temporarily unavailable." />
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
            <PauseCircle size={36} strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Link page paused</h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
            This link page is temporarily paused by the campaign owner. Check back later or contact them if you need access.
          </p>
        </div>
      </HubPageShell>
    );
  }

  if (!meta) {
    return (
      <HubPageShell maxWidth={SIMPLE_HUB_MAX_WIDTH} centerMain panel>
        <p className="text-center text-sm text-[var(--text-secondary)]">Loading…</p>
      </HubPageShell>
    );
  }

  const { campaignName, links } = meta;
  const hasHeroVideo = meta.campaignType === 'links-video-qr' || isArMediaType(meta.campaignType);
  const arPageUrl = isArMediaType(meta.campaignType) ? meta.arPageUrl : null;
  const isMultiAssetHub = meta.campaignType === 'links-doc-video-qr';
  const videoItems = Array.isArray(meta.videoItems) ? meta.videoItems : [];
  const docItems = Array.isArray(meta.docItems) ? meta.docItems : [];

  // 1 video → single hero column for max impact; 2+ → responsive grid (1 col
  // on mobile, 2 cols on tablet/desktop) so we never shrink to a tile so
  // small the play button overlaps the title.
  const videoGridClass = videoItems.length <= 1
    ? 'grid grid-cols-1 gap-4'
    : 'grid grid-cols-1 gap-4 md:grid-cols-2';

  const shouldCenterMain =
    !hasHeroVideo
    && !isMultiAssetHub
    && links.length <= 6
    && videoItems.length === 0
    && docItems.length === 0;

  const maxWidth = (() => {
    if (isMultiAssetHub) {
      return videoItems.length > 1 ? 'max-w-3xl lg:max-w-4xl' : 'max-w-3xl lg:max-w-4xl';
    }
    if (hasHeroVideo) {
      return 'max-w-md md:max-w-2xl lg:max-w-3xl';
    }
    if (shouldCenterMain) {
      return SIMPLE_HUB_MAX_WIDTH;
    }
    return SIMPLE_HUB_MAX_WIDTH;
  })();

  const showLinksSectionLabel = isMultiAssetHub && (videoItems.length > 0 || docItems.length > 0);
  const linksGridClass = links.length >= 4 ? 'md:grid md:grid-cols-2 md:gap-3' : '';

  return (
    <HubPageShell
      maxWidth={maxWidth}
      centerMain={shouldCenterMain}
      panel={shouldCenterMain}
    >
      <SEOHead title={campaignName || 'Links'} description="Quick links" />

      <HubIntro />

      {hasHeroVideo && (
        <div className="mb-5">
          <HubVideoPlayer
            source={meta.videoSource}
            videoUrl={meta.videoUrl}
            externalVideoUrl={meta.externalVideoUrl}
            embedSrc={meta.embedSrc}
            embedHost={meta.embedHost}
            thumbnailUrl={meta.thumbnailUrl}
            onEvent={onVideoEvent}
          />
        </div>
      )}

      {arPageUrl && (
        <a
          href={arPageUrl}
          className="mb-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm font-semibold text-brand-300 transition hover:bg-brand-500/20 active:scale-[0.98]"
        >
          <Zap size={18} aria-hidden />
          Launch hologram
        </a>
      )}

      {isMultiAssetHub && videoItems.length > 0 && (
        <section className="mb-6">
          <HubSectionLabel>Videos</HubSectionLabel>
          <div className={videoGridClass}>
            {videoItems.map((item) => (
              <div key={item.videoId} className="flex flex-col gap-2">
                <HubVideoPlayer
                  source={item.source}
                  videoUrl={item.videoUrl}
                  externalVideoUrl={item.externalVideoUrl}
                  embedSrc={item.embedSrc}
                  embedHost={item.embedHost}
                  thumbnailUrl={item.thumbnailUrl}
                  onEvent={makeVideoEventHandler(item.videoId)}
                />
                <p className="line-clamp-2 px-1 text-sm font-medium text-[var(--text-primary)]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {isMultiAssetHub && docItems.length > 0 && (
        <section className="mb-6">
          <HubSectionLabel>Documents</HubSectionLabel>
          <ul className="flex flex-col gap-3">
            {docItems.map((doc) => {
              const Icon = docIconForMime(doc.mimeType || '');
              return (
                <li key={doc.docId}>
                  <button
                    type="button"
                    onClick={() => onDocActivate(doc)}
                    className="flex w-full min-h-[52px] items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-3.5 text-left shadow-sm transition-all duration-200 hover:border-brand-500/40 hover:bg-[var(--surface-2)] hover:shadow-md active:scale-[0.98]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[var(--text-primary)]">
                        {doc.label}
                      </span>
                      {doc.bytes ? (
                        <span className="block truncate text-xs text-[var(--text-muted)]">
                          {formatBytes(doc.bytes)}
                        </span>
                      ) : null}
                    </span>
                    <ExternalLink size={16} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {showLinksSectionLabel && <HubSectionLabel>Links</HubSectionLabel>}

      <div className={shouldCenterMain ? 'w-full max-md:glass-card max-md:p-4 max-md:sm:p-5' : 'w-full'}>
        <ul className={`flex flex-col gap-3 ${linksGridClass}`}>
          {links.map((link, idx) => (
            <HubLinkButton
              key={link.linkId}
              link={link}
              index={idx}
              onActivate={onLinkActivate}
            />
          ))}
        </ul>
      </div>
    </HubPageShell>
  );
};

export default LinkHubPage;
