import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MapPin, ExternalLink } from 'lucide-react';
import publicApi from '../services/publicApi';

const GEO_CONSENT_VERSION = 'browser-geolocation-v1';

const deviceTypeGuess = () => {
  const ua = navigator.userAgent || '';
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return 'mobile';
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  return 'desktop';
};

/** Mirror server `HUB_CAMPAIGN_TYPES` — QR with precise geo uses `/open/:slug` for these. */
const HUB_CAMPAIGN_TYPES = new Set([
  'multiple-links-qr',
  'links-video-qr',
  'links-doc-video-qr',
]);

const isHubCampaignType = (ct) => HUB_CAMPAIGN_TYPES.has(ct);

/**
 * Bridge for dynamic QR with precise geo enabled:
 * - single-link → external URL (after optional scan POST)
 * - all hub types (multiple-links, links-video, links-doc-video) → POST scan then /l/:slug
 */
const OpenSingleLinkBridgePage = () => {
  const { slug } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | ready | error | redirecting
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [geoStatus, setGeoStatus] = useState('');
  const visitorHashRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await publicApi.get(
          `/public/dynamic-qr/${encodeURIComponent(slug)}/meta`
        );
        const data = res.data?.data;
        if (!data?.campaignType) throw new Error('Invalid response');
        if (isHubCampaignType(data.campaignType) && (data.paused || data.status === 'paused')) {
          window.location.replace(`${window.location.origin}/l/${slug}`);
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
  }, [slug]);

  const redirectTo = useCallback((url) => {
    setPhase('redirecting');
    window.location.assign(url);
  }, []);

  const postSingleScanAndRedirect = useCallback(
    async (body) => {
      setGeoStatus('');
      try {
        const res = await publicApi.post(
          `/public/single-link/${encodeURIComponent(slug)}/scan`,
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
    [slug, redirectTo]
  );

  const postMultiScanAndGoHub = useCallback(
    async (body) => {
      setGeoStatus('');
      try {
        const vh = visitorHashRef.current;
        await publicApi.post(`/public/multi-link/${encodeURIComponent(slug)}/scan`, {
          visitorHash: vh,
          deviceType: deviceTypeGuess(),
          browser: /Chrome/i.test(navigator.userAgent) ? 'Chrome' : 'Other',
          ...body,
        });
        sessionStorage.setItem(`p8w_vh_${slug}`, vh);
        sessionStorage.setItem(`p8w_scan_done_${slug}`, '1');
        redirectTo(`${window.location.origin}/l/${slug}`);
      } catch (e) {
        setGeoStatus(
          e?.response?.data?.message
          || e?.message
          || 'Could not continue. Please try again.'
        );
      }
    },
    [slug, redirectTo]
  );

  const handleSkipGeo = () => {
    if (meta?.campaignType && isHubCampaignType(meta.campaignType)) {
      return postMultiScanAndGoHub({});
    }
    return postSingleScanAndRedirect({});
  };

  const handleShareGeo = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Location is not supported on this device.');
      return;
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
        if (meta?.campaignType && isHubCampaignType(meta.campaignType)) {
          postMultiScanAndGoHub(body);
        } else {
          postSingleScanAndRedirect(body);
        }
      },
      (err) => {
        setGeoStatus(err?.message || 'Location permission denied.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

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
    <div className="mx-auto max-w-md px-6 py-12">
      <div className="mb-6 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
          <MapPin size={28} aria-hidden />
        </div>
      </div>
      <h1 className="text-center text-xl font-bold text-[var(--text-primary)]">
        {meta?.campaignName || 'Continue'}
      </h1>
      <p className="mt-3 text-center text-sm text-[var(--text-secondary)]">
        {isHub
          ? precise
            ? 'Continue to your link page, or optionally share your device location once for richer analytics.'
            : 'Tap below to open your link page. We record approximate scan analytics from your network.'
          : precise
            ? 'You can continue immediately, or optionally share your device location once to improve scan analytics. Location is never required to open your link.'
            : 'Tap below to open your link. We record approximate scan analytics from your network.'}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {precise && (
          <button
            type="button"
            onClick={handleShareGeo}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-500"
          >
            <MapPin size={18} aria-hidden />
            Share location (optional)
          </button>
        )}
        <button
          type="button"
          onClick={handleSkipGeo}
          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-2)] ${
            precise ? '' : 'bg-brand-600 border-transparent text-white hover:bg-brand-500'
          }`}
        >
          <ExternalLink size={18} aria-hidden />
          {precise ? 'Continue without location' : isHub ? 'Open link page' : 'Continue'}
        </button>
      </div>

      {geoStatus && (
        <p className="mt-4 text-center text-xs text-amber-400/90">{geoStatus}</p>
      )}
    </div>
  );
};

export default OpenSingleLinkBridgePage;
