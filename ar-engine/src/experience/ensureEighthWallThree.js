/**
 * 8th Wall's Threejs pipeline reads `window.THREE` from a classic UMD build
 * (same as ar-engine/index.html). Vite-bundled ES module THREE can fail to
 * composite the camera feed on iOS Safari.
 */

const THREE_CDN =
  'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';

let loadPromise = null;

export const applyIosArTextureWorkarounds = () => {
  if (typeof window === 'undefined') return;
  const isIos =
    /^(iPad|iPhone|iPod)/.test(window.navigator.platform)
    || (/^Mac/.test(window.navigator.platform) && window.navigator.maxTouchPoints > 1);
  if (isIos) {
    // 8th Wall / WebKit: image bitmap bugs can yield black GL textures on iOS.
    window.createImageBitmap = undefined;
  }
};

const injectThreeUmd = () =>
  new Promise((resolve, reject) => {
    if (window.THREE) {
      resolve(window.THREE);
      return;
    }

    const existing = document.querySelector('script[data-phygital-three]');
    if (existing) {
      if (existing.dataset.loaded === 'true' && window.THREE) {
        resolve(window.THREE);
        return;
      }
      existing.addEventListener('load', () => resolve(window.THREE), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Three.js')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = THREE_CDN;
    script.async = false;
    script.crossOrigin = 'anonymous';
    script.dataset.phygitalThree = '1';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      if (!window.THREE) {
        reject(new Error('Three.js script loaded but window.THREE is missing'));
        return;
      }
      resolve(window.THREE);
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load Three.js')), {
      once: true,
    });
    document.head.appendChild(script);
  });

const resolveBundledThree = async () => {
  try {
    return await import('three-ar');
  } catch {
    return import('three');
  }
};

/**
 * @returns {Promise<object>} Three.js namespace on window.THREE
 */
export const ensureEighthWallThree = () => {
  if (typeof window !== 'undefined' && window.THREE) {
    return Promise.resolve(window.THREE);
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      applyIosArTextureWorkarounds();
      try {
        await injectThreeUmd();
      } catch {
        const mod = await resolveBundledThree();
        const THREE = mod.default || mod;
        window.THREE = THREE;
      }
      return window.THREE;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }

  return loadPromise;
};

export const isEighthWallThreeReady = () =>
  Boolean(typeof window !== 'undefined' && window.THREE);
