import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayCircle } from 'lucide-react';

const emitProgressEveryMs = 5000;

const scriptRegistry = new Map();
const ensureScript = (key, src) => {
  if (scriptRegistry.has(key)) return scriptRegistry.get(key);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-p8w-script="${key}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${key}`)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.p8wScript = key;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${key}`));
    document.head.appendChild(s);
  });
  scriptRegistry.set(key, promise);
  return promise;
};

// Pull a YouTube video id from either an embed src (/embed/<id>) or the
// original watch URL (?v=<id> / youtu.be/<id>). Returns null on failure.
const extractYoutubeId = (input) => {
  if (!input || typeof input !== 'string') return null;
  try {
    const url = new URL(input);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed' && parts[1]) return parts[1];
    if (parts[0] === 'shorts' && parts[1]) return parts[1];
    const v = url.searchParams.get('v');
    if (v) return v;
    if (url.hostname.endsWith('youtu.be') && parts[0]) return parts[0];
    return null;
  } catch {
    return null;
  }
};

const appendQuery = (src, kv) => {
  if (!src) return src;
  try {
    const url = new URL(src);
    Object.entries(kv).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    return url.toString();
  } catch {
    const sep = src.includes('?') ? '&' : '?';
    const tail = Object.entries(kv).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return `${src}${sep}${tail}`;
  }
};

const HubVideoPlayer = ({
  source,
  videoUrl,
  externalVideoUrl,
  embedSrc,
  embedHost,
  thumbnailUrl,
  onEvent,
}) => {
  const nativeRef = useRef(null);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const [armed, setArmed] = useState(false);
  const playSentRef = useRef(false);

  const safeEmit = (payload) => {
    if (typeof onEvent === 'function') onEvent(payload);
  };

  const clearPoll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => () => clearPoll(), []);

  // Reset armed/play tracking when the video source changes.
  useEffect(() => {
    setArmed(false);
    playSentRef.current = false;
  }, [embedSrc, videoUrl, source, embedHost]);

  // Native HTML5 video telemetry.
  useEffect(() => {
    if (!(source === 'upload' && videoUrl && nativeRef.current)) return undefined;
    const node = nativeRef.current;
    const onPlay = () => {
      if (!playSentRef.current) {
        playSentRef.current = true;
        safeEmit({ event: 'play', positionSec: node.currentTime, durationSec: node.duration || undefined });
      }
    };
    const onProgress = () => {
      if (!node.duration || node.duration <= 0) return;
      safeEmit({
        event: 'progress',
        positionSec: node.currentTime,
        durationSec: node.duration,
        watchPercent: (node.currentTime / node.duration) * 100,
      });
    };
    const onEnded = () => {
      safeEmit({
        event: 'ended',
        positionSec: node.duration || node.currentTime,
        durationSec: node.duration || undefined,
        watchPercent: 100,
      });
    };
    node.addEventListener('play', onPlay);
    node.addEventListener('timeupdate', onProgress);
    node.addEventListener('ended', onEnded);
    return () => {
      node.removeEventListener('play', onPlay);
      node.removeEventListener('timeupdate', onProgress);
      node.removeEventListener('ended', onEnded);
    };
  }, [source, videoUrl]);

  // YouTube iframe instrumentation. Best-effort progress/ended layer; the
  // primary `play` beacon is sent on the user's poster click.
  useEffect(() => {
    if (!(armed && source === 'link' && embedHost === 'youtube' && iframeRef.current)) return undefined;
    let disposed = false;
    const mount = async () => {
      try {
        if (!window.YT || !window.YT.Player) {
          await ensureScript('yt-iframe-api', 'https://www.youtube.com/iframe_api');
          if (!window.YT || !window.YT.Player) {
            await new Promise((resolve) => {
              window.onYouTubeIframeAPIReady = resolve;
            });
          }
        }
        if (disposed || !iframeRef.current || !window.YT?.Player) return;
        playerRef.current = new window.YT.Player(iframeRef.current, {
          events: {
            onStateChange: (evt) => {
              if (!window.YT) return;
              if (evt.data === window.YT.PlayerState.PLAYING) {
                clearPoll();
                intervalRef.current = setInterval(() => {
                  const p = playerRef.current;
                  if (!p?.getCurrentTime || !p?.getDuration) return;
                  const cur = p.getCurrentTime();
                  const dur = p.getDuration();
                  if (!dur || dur <= 0) return;
                  safeEmit({
                    event: 'progress',
                    positionSec: cur,
                    durationSec: dur,
                    watchPercent: (cur / dur) * 100,
                  });
                }, emitProgressEveryMs);
              } else if (evt.data === window.YT.PlayerState.ENDED) {
                clearPoll();
                const p = playerRef.current;
                safeEmit({
                  event: 'ended',
                  positionSec: p?.getDuration ? p.getDuration() : undefined,
                  durationSec: p?.getDuration ? p.getDuration() : undefined,
                  watchPercent: 100,
                });
              } else if (evt.data === window.YT.PlayerState.PAUSED) {
                clearPoll();
              }
            },
          },
        });
      } catch {
        // SDK failed to attach — `play` beacon already fired on poster click.
      }
    };
    mount();
    return () => {
      disposed = true;
      clearPoll();
      if (playerRef.current?.destroy) playerRef.current.destroy();
      playerRef.current = null;
    };
  }, [armed, source, embedHost]);

  // Vimeo iframe instrumentation. Best-effort progress/ended layer.
  useEffect(() => {
    if (!(armed && source === 'link' && embedHost === 'vimeo' && iframeRef.current)) return undefined;
    let disposed = false;
    const mount = async () => {
      try {
        await ensureScript('vimeo-player-api', 'https://player.vimeo.com/api/player.js');
        if (disposed || !window.Vimeo?.Player || !iframeRef.current) return;
        const player = new window.Vimeo.Player(iframeRef.current);
        playerRef.current = player;
        let lastEmit = 0;
        player.on('timeupdate', ({ seconds, duration, percent }) => {
          const now = Date.now();
          if (now - lastEmit < emitProgressEveryMs) return;
          lastEmit = now;
          safeEmit({
            event: 'progress',
            positionSec: seconds,
            durationSec: duration,
            watchPercent: typeof percent === 'number' ? percent * 100 : undefined,
          });
        });
        player.on('ended', ({ duration }) => {
          safeEmit({
            event: 'ended',
            positionSec: duration,
            durationSec: duration,
            watchPercent: 100,
          });
        });
      } catch {
        // SDK failed to attach — `play` beacon already fired on poster click.
      }
    };
    mount();
    return () => {
      disposed = true;
      if (playerRef.current?.unload) playerRef.current.unload().catch(() => {});
      playerRef.current = null;
    };
  }, [armed, source, embedHost]);

  // Resolve the iframe src once armed: append autoplay so YouTube/Vimeo
  // start playing immediately after the user's click without an extra tap.
  const armedEmbedSrc = useMemo(() => {
    if (!embedSrc) return embedSrc;
    if (embedHost === 'youtube') return appendQuery(embedSrc, { autoplay: 1 });
    if (embedHost === 'vimeo') return appendQuery(embedSrc, { autoplay: 1 });
    return embedSrc;
  }, [embedSrc, embedHost]);

  // YouTube poster (free, no oEmbed round-trip). Falls back through hqdefault
  // → mqdefault if hqdefault is missing on shorts.
  const youtubePoster = useMemo(() => {
    if (embedHost !== 'youtube') return null;
    const id = extractYoutubeId(embedSrc) || extractYoutubeId(externalVideoUrl);
    if (!id) return null;
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }, [embedHost, embedSrc, externalVideoUrl]);

  const liteHost = source === 'link' && (embedHost === 'youtube' || embedHost === 'vimeo' || embedHost === 'facebook');
  const litePoster = embedHost === 'youtube' ? (thumbnailUrl || youtubePoster) : thumbnailUrl;

  // ── Render ─────────────────────────────────────────────────────────────

  if (source === 'upload' && videoUrl) {
    return (
      <video
        ref={nativeRef}
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        poster={thumbnailUrl || undefined}
        className="aspect-video w-full rounded-2xl border border-[var(--border-color)] bg-black object-contain"
      />
    );
  }

  if (liteHost && embedSrc) {
    const handlePosterClick = () => {
      if (!playSentRef.current) {
        playSentRef.current = true;
        safeEmit({ event: 'play' });
      }
      setArmed(true);
    };

    if (!armed) {
      return (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)]">
          <button
            type="button"
            onClick={handlePosterClick}
            aria-label="Play video"
            className="group relative flex aspect-video w-full items-center justify-center bg-[var(--surface-3)]"
          >
            {litePoster ? (
              <img
                src={litePoster}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-br from-brand-600/30 via-[var(--surface-3)] to-accent-500/20"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105">
              <PlayCircle size={18} />
              Play video
            </span>
          </button>
        </div>
      );
    }

    // Armed: render the iframe. For Facebook we don't attach an SDK (no
    // public progress events without FB SDK init); the `play` beacon on
    // poster click is sufficient for analytics.
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)]">
        <iframe
          ref={iframeRef}
          title="Embedded video"
          src={armedEmbedSrc}
          className="aspect-video w-full"
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  if (source === 'link' && externalVideoUrl) {
    return (
      <a
        href={externalVideoUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => safeEmit({ event: 'play' })}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-brand-400 hover:border-brand-500/40"
      >
        Watch video
      </a>
    );
  }

  return null;
};

export default HubVideoPlayer;
