import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MapPin, ExternalLink } from 'lucide-react';
import publicApi from '../services/publicApi';

const GEO_CONSENT_VERSION = 'browser-geolocation-v1';
const COUNTDOWN_SEC = 5;

const deviceTypeGuess = () => {
  const ua = navigator.userAgent || '';
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return 'mobile';
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  return 'desktop';
};

/** Mirror server `HUB_CAMPAIGN_TYPES` — hub types resolve to `/l/:redirectSlug`. */
const HUB_CAMPAIGN_TYPES = new Set([
  'multiple-links-qr',
  'links-video-qr',
  'links-doc-video-qr',
]);

const isHubCampaignType = (ct) => HUB_CAMPAIGN_TYPES.has(ct);

/**
 * Bridge for dynamic QR with precise geo:
 * - Legacy path `/open/:redirectSlug` (opaque nanoid)
 * - Vanity path `/open/:handle/:hubSlug` (same meta + scan APIs use `redirectSlug` from payload)
 *
 * Compact modal + countdown: iOS/Safari often requires HTTPS (secure context) for geolocation.
 * The first permission prompt may still need a user tap; the timer auto-continues without geo if
 * nothing is granted before it hits zero.
 */
const OpenSingleLinkBridgePage = () => {
  const { slug, handle, hubSlug } = useParams();
  const isVanity = Boolean(handle && hubSlug);
  const routeKey = isVanity ? `v:${handle}:${hubSlug}` : `s:${slug || ''}`;

  const [phase, setPhase] = useState('loading'); // loading | ready | error | redirecting
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [geoStatus, setGeoStatus] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SEC);
  const visitorHashRef = useRef('');
  const countdownTimerRef = useRef(null);
  const geoFlowStartedRef = useRef(false);
  const geoAttemptedRef = useRef(false);
  const tryGeoRef = useRef(() => {});

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setError('');
    setMeta(null);
    visitorHashRef.current = '';
    geoFlowStartedRef.current = false;
    geoAttemptedRef.current = false;

    (async () => {
      try {
        const metaPath = isVanity
          ? `/public/hub/${encodeURIComponent(handle)}/${encodeURIComponent(hubSlug)}/meta`
          : `/public/dynamic-qr/${encodeURIComponent(slug)}/meta`;

        const res = await publicApi.get(metaPath);
        const data = res.data?.data;
        if (!data?.campaignType) throw new Error('Invalid response');
        const redirectKey = data.slug || slug;
        if (isHubCampaignType(data.campaignType) && (data.paused || data.status === 'paused')) {
          window.location.replace(`${window.location.origin}/l/${redirectKey}`);
          return;
        }
        if (data.campaignType === 'single-link-qr') {
          if (!data.destinationUrl) throw new Error('Invalid response');
        } else if (data.campaignType === 'multiple-links-qr') {
          if (!Array.isArray(data.links)) throw new Error('Invalid response');
        } else if (data.campaignType === 'links-video-qr') {
          if (!Array.isArray(data.links)) throw new Error('Invalid response');
        } else if (data.campaignType === 'links-doc-video-qr') {
          if (
            !Array.isArray(data.links)
            || !Array.isArray(data.videoItems)
            || !Array.isArray(data.docItems)
          ) {
            throw new Error('Invalid response');
          }
        } else {
          throw new Error('Invalid response');
        }
        if (!visitorHashRef.current) {
          visitorHashRef.current =
            crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }
        if (!cancelled) {
          setMeta(data);
          setPhase('ready');
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.response?.data?.message
            || e?.message
            || 'This link is not available.'
          );
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeKey, slug, handle, hubSlug, isVanity]);

  const redirectTo = useCallback((url) => {
    setPhase('redirecting');
    window.location.assign(url);
  }, []);

  const scanSlug = meta?.slug || slug;

  const postSingleScanAndRedirect = useCallback(
    async (body) => {
      setGeoStatus('');
      if (!scanSlug) return;
      try {
        const res = await publicApi.post(
          `/public/single-link/${encodeURIComponent(scanSlug)}/scan`,
          body
        );
        const dest = res.data?.data?.destinationUrl;
        if (!dest) throw new Error('Missing destination');
        redirectTo(dest);
      } catch (e) {
        setGeoStatus(
          e?.response?.data?.message
          || e?.message
          || 'Could not continue. Please try again.'
        );
      }
    },
    [scanSlug, redirectTo]
  );

  const postMultiScanAndGoHub = useCallback(
    async (body) => {
      setGeoStatus('');
      if (!scanSlug) return;
      try {
        const vh = visitorHashRef.current;
        await publicApi.post(`/public/multi-link/${encodeURIComponent(scanSlug)}/scan`, {
          visitorHash: vh,
          deviceType: deviceTypeGuess(),
          browser: /Chrome/i.test(navigator.userAgent) ? 'Chrome' : 'Other',
          ...body,
        });
        sessionStorage.setItem(`p8w_vh_${scanSlug}`, vh);
        sessionStorage.setItem(`p8w_scan_done_${scanSlug}`, '1');
        redirectTo(`${window.location.origin}/l/${scanSlug}`);
      } catch (e) {
        setGeoStatus(
          e?.response?.data?.message
          || e?.message
          || 'Could not continue. Please try again.'
        );
      }
    },
    [scanSlug, redirectTo]
  );

  const handleSkipGeo = useCallback(() => {
    geoAttemptedRef.current = true;
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (meta?.campaignType && isHubCampaignType(meta.campaignType)) {
      return postMultiScanAndGoHub({});
    }
    return postSingleScanAndRedirect({});
  }, [meta?.campaignType, postMultiScanAndGoHub, postSingleScanAndRedirect]);

  const postWithOptionalCoords = useCallback(
    (coordsBody) => {
      if (meta?.campaignType && isHubCampaignType(meta.campaignType)) {
        return postMultiScanAndGoHub(coordsBody);
      }
      return postSingleScanAndRedirect(coordsBody);
    },
    [meta?.campaignType, postMultiScanAndGoHub, postSingleScanAndRedirect]
  );

  const tryGeolocationThenContinue = useCallback(() => {
    if (geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;
    const precise = !!meta?.preciseGeoAnalytics;
    if (!precise) {
      handleSkipGeo();
      return;
    }
    if (!window.isSecureContext) {
      setGeoStatus('Location needs HTTPS. Continuing without precise location.');
      handleSkipGeo();
      return;
    }
    if (!navigator.geolocation) {
      setGeoStatus('Location is not supported on this device. Continuing…');
      handleSkipGeo();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        postWithOptionalCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          consentVersion: GEO_CONSENT_VERSION,
        });
      },
      () => {
        handleSkipGeo();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [meta?.preciseGeoAnalytics, handleSkipGeo, postWithOptionalCoords]);

  useEffect(() => {
    tryGeoRef.current = tryGeolocationThenContinue;
  }, [tryGeolocationThenContinue]);

  const handleShareGeo = useCallback(() => {
    if (!window.isSecureContext) {
      setGeoStatus('Location requires a secure site (HTTPS). Continuing without it.');
      handleSkipGeo();
      return;
    }
    if (!navigator.geolocation) {
      setGeoStatus('Location is not supported on this device.');
      handleSkipGeo();
      return;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setGeoStatus('Waiting for permission…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const body = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          consentVersion: GEO_CONSENT_VERSION,
        };
        postWithOptionalCoords(body);
      },
      () => {
        handleSkipGeo();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [handleSkipGeo, postWithOptionalCoords]);

  useEffect(() => {
    if (phase !== 'ready') {
      geoFlowStartedRef.current = false;
      return undefined;
    }
    if (geoFlowStartedRef.current) return undefined;
    geoFlowStartedRef.current = true;
    geoAttemptedRef.current = false;
    setSecondsLeft(COUNTDOWN_SEC);
    countdownTimerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          tryGeoRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      geoFlowStartedRef.current = false;
    };
  }, [phase]);

  if (phase === 'loading' || phase === 'redirecting') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand-400" aria-hidden />
        <p className="text-sm text-[var(--text-secondary)]">
          {phase === 'redirecting' ? 'Taking you to your link…' : 'Loading…'}
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Link unavailable</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  const precise = !!meta?.preciseGeoAnalytics;
  const isHub = meta?.campaignType ? isHubCampaignType(meta.campaignType) : false;

  return (
    <div className="relative flex min-h-[100dvh] items-end justify-center bg-black/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:items-center sm:pb-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bridge-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--surface-solid)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
            <MapPin size={24} aria-hidden />
          </div>
        </div>
        <h1 id="bridge-title" className="text-center text-lg font-bold text-[var(--text-primary)]">
          {meta?.campaignName || 'Continue'}
        </h1>
        <p className="mt-2 text-center text-xs leading-relaxed text-[var(--text-secondary)]">
          {isHub
            ? precise
              ? 'Optional one-time location for analytics. You can cancel or wait — we continue automatically.'
              : 'Opening your link page…'
            : precise
              ? 'Optional location for scan analytics. Cancel anytime, or wait to continue automatically.'
              : 'Taking you to your link…'}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkipGeo}
            className="min-h-[44px] shrink-0 rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-2)]"
          >
            Cancel
          </button>
          <div className="flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-xl bg-[var(--surface-2)] px-3 py-2">
            <span className="text-2xl font-bold tabular-nums text-brand-400">{secondsLeft}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              sec
            </span>
          </div>
        </div>

        {precise && (
          <button
            type="button"
            onClick={handleShareGeo}
            className="mt-3 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-500"
          >
            <MapPin size={18} aria-hidden />
            Allow location
          </button>
        )}

        <button
          type="button"
          onClick={handleSkipGeo}
          className={`mt-2 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-2)] ${
            precise ? '' : 'bg-brand-600 border-transparent text-white hover:bg-brand-500'
          }`}
        >
          <ExternalLink size={18} aria-hidden />
          {precise ? 'Continue now' : isHub ? 'Open link page' : 'Continue'}
        </button>

        {geoStatus && (
          <p className="mt-3 text-center text-xs text-amber-400/90">{geoStatus}</p>
        )}
      </div>
    </div>
  );
};

export default OpenSingleLinkBridgePage;
