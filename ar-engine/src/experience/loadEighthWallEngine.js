/**
 * loadEighthWallEngine — loader for 8th Wall SLAM binary + XRExtras.
 *
 * Scripts are self-hosted under /xr/ (see client/scripts/sync-xr-assets.mjs)
 * so SLAM chunks resolve on the same origin as xr.js on iOS Safari.
 */

const scriptOrigin = () => {
  if (typeof window === 'undefined') return '';
  const base = import.meta.env?.BASE_URL || '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${window.location.origin}${normalized}xr`;
};

const ENGINE_SCRIPT = () => `${scriptOrigin()}/xr.js`;
const XREXTRAS_SCRIPT = () => `${scriptOrigin()}/xrextras.js`;

let loadPromise = null;
let loadedEngine = null;

const injectScript = (src, attrs = {}) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-phygital-xr="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.crossOrigin = 'anonymous';
    script.dataset.phygitalXr = src;
    Object.entries(attrs).forEach(([key, value]) => {
      script.setAttribute(key, value);
    });
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
      once: true,
    });
    document.head.appendChild(script);
  });

const waitForGlobal = (name, eventName) =>
  new Promise((resolve) => {
    if (window[name]) {
      resolve(window[name]);
      return;
    }
    window.addEventListener(eventName, () => resolve(window[name]), { once: true });
  });

/**
 * @returns {Promise<{ XR8: object, XRExtras: object }>}
 */
export const loadEighthWallEngine = () => {
  if (loadedEngine) return Promise.resolve(loadedEngine);
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    await injectScript(XREXTRAS_SCRIPT());
    await waitForGlobal('XRExtras', 'xrextrasloaded');

    await injectScript(ENGINE_SCRIPT(), {
      'data-preload-chunks': 'slam',
    });
    const XR8 = await waitForGlobal('XR8', 'xrloaded');

    if (XR8.loadChunk) {
      await XR8.loadChunk('slam');
    }

    loadedEngine = { XR8, XRExtras: window.XRExtras };
    return loadedEngine;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
};

export const preloadEighthWallEngine = () => loadEighthWallEngine();

export const isEighthWallEngineReady = () =>
  Boolean(window.XR8?.run && window.XRExtras && loadedEngine);

export const getEighthWallEngineSync = () => loadedEngine;

export const resetEighthWallEngineLoader = () => {
  loadPromise = null;
  loadedEngine = null;
};
