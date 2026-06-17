/**
 * loadEighthWallEngine — dynamic loader for 8th Wall SLAM binary + XRExtras.
 *
 * Loaded only on the eighthwall-slam surface path so WebXR Android users
 * do not download the binary.
 */

const ENGINE_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js';
const XREXTRAS_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1/dist/xrextras.js';

let loadPromise = null;

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
    script.async = true;
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
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    await injectScript(XREXTRAS_SCRIPT);
    await waitForGlobal('XRExtras', 'xrextrasloaded');

    await injectScript(ENGINE_SCRIPT, {
      'data-preload-chunks': 'slam',
    });
    const XR8 = await waitForGlobal('XR8', 'xrloaded');

    if (XR8.loadChunk) {
      await XR8.loadChunk('slam');
    }

    return { XR8, XRExtras: window.XRExtras };
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
};

export const resetEighthWallEngineLoader = () => {
  loadPromise = null;
};
