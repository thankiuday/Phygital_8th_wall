/**
 * 8th Wall's Threejs pipeline module reads `window.THREE` (not ES imports).
 * The standalone ar-engine HTML loads Three via CDN; the embedded React client
 * does not — so we must assign it before XR8.run().
 */

let loadPromise = null;

const resolveThreeModule = async () => {
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
    loadPromise = resolveThreeModule()
      .then((mod) => {
        const THREE = mod.default || mod;
        if (typeof window !== 'undefined') {
          window.THREE = THREE;
        }
        return THREE;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }

  return loadPromise;
};

export const isEighthWallThreeReady = () =>
  Boolean(typeof window !== 'undefined' && window.THREE);
