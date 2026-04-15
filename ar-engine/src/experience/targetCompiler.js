/**
 * targetCompiler.js
 *
 * Compiles a Cloudinary image URL into a MindAR .mind binary in the browser.
 *
 * WHY BROWSER COMPILATION?
 * - 8th Wall and other platforms require images to be pre-compiled on a server.
 * - MindAR is unique: it ships a TF.js + WASM compiler that runs on the device.
 * - This means every user-uploaded business card image works as a target
 *   immediately — no backend compilation step needed.
 *
 * CACHING STRATEGY
 * - Compiled buffers are stored in sessionStorage (keyed by image URL hash).
 * - Subsequent visits in the same session skip recompilation (~15s → <0.5s).
 * - For production upgrade: pre-compile on the server after campaign creation
 *   and store the .mind file URL on the Campaign model.
 *
 * GLOBAL DEPENDENCY
 * - window.MINDAR.IMAGE.Compiler is loaded via CDN script tag in index.html
 *   (mind-ar@latest/dist/mindar-image.prod.js)
 *   This avoids Vite WASM/worker bundler complexity.
 */

/**
 * compileMindTarget
 *
 * @param {string}   imageUrl          Cloudinary URL of the business card image
 * @param {Function} onProgress        Called with 0-100 percentage during compilation
 * @returns {Promise<string>}          Blob object URL pointing to the .mind buffer
 */
export const compileMindTarget = async (imageUrl, onProgress) => {
  const Compiler = window?.MINDAR?.IMAGE?.Compiler;
  if (!Compiler) {
    throw new Error('MindAR Compiler not available. Check CDN script in index.html.');
  }

  // Check session cache first
  const cacheKey = `p8w_mind_${hashString(imageUrl)}`;
  const cached = getCachedTarget(cacheKey);
  if (cached) {
    onProgress?.(100);
    return cached;
  }

  // Load the image into an HTMLImageElement
  const imageElement = await loadImage(imageUrl);

  // Compile using MindAR browser compiler
  const compiler = new Compiler();
  await compiler.compileImageTargets([imageElement], (progress) => {
    // MindAR reports 0–1 internally
    onProgress?.(Math.round(progress * 100));
  });

  // Export to ArrayBuffer
  const exportedBuffer = await compiler.exportData();

  // Convert buffer to a blob URL that MindARThree can download
  const blob = new Blob([exportedBuffer]);
  const blobUrl = URL.createObjectURL(blob);

  // Cache in sessionStorage (store as base64 to survive navigation)
  cacheTarget(cacheKey, blobUrl, exportedBuffer);

  return blobUrl;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Loads an image URL into an HTMLImageElement with CORS enabled. */
const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

/** Simple djb2 string hash → hex string for cache keys. */
const hashString = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

/**
 * Retrieve a cached .mind blob URL from sessionStorage.
 * We store the raw ArrayBuffer as base64 and recreate the blob URL each load
 * (blob URLs are not persistent across page reloads).
 */
const getCachedTarget = (key) => {
  try {
    const b64 = sessionStorage.getItem(key);
    if (!b64) return null;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes.buffer]);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

const cacheTarget = (key, _blobUrl, buffer) => {
  try {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    sessionStorage.setItem(key, btoa(binary));
  } catch {
    // sessionStorage may be full on low-memory devices — silently skip
  }
};
