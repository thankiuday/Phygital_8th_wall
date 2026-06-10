/**
 * textures.js — canvas-generated textures shared by the hologram base effects.
 *
 * All textures are procedural (no network fetches) so effects are ready the
 * moment the scene boots — critical for zero-delay show on re-detection.
 */

/** Default cyan-blue hologram palette. Effects may pass their own RGB. */
export const HOLO_RGB = '120, 205, 255';

const makeCanvas = (size) => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
};

const toTexture = (THREE, canvas) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
};

/** Soft radial glow disc — bright core fading to transparent. */
export const createGlowTexture = (THREE, size = 256, rgb = HOLO_RGB) => {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, `rgba(${rgb}, 0.85)`);
  grad.addColorStop(0.35, `rgba(${rgb}, 0.35)`);
  grad.addColorStop(0.7, `rgba(${rgb}, 0.08)`);
  grad.addColorStop(1.0, `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return toTexture(THREE, canvas);
};

/**
 * Glowing ring (annulus) with soft inner/outer falloff.
 * @param {number} thickness ring thickness as a fraction of the radius (0..1)
 */
export const createRingTexture = (THREE, thickness = 0.16, size = 256, rgb = HOLO_RGB) => {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const rMid = half * 0.78;
  const rHalf = (half * thickness) / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  const stop = (r) => Math.min(1, Math.max(0, r / half));
  grad.addColorStop(stop(rMid - rHalf * 2), `rgba(${rgb}, 0)`);
  grad.addColorStop(stop(rMid - rHalf * 0.5), `rgba(${rgb}, 0.9)`);
  grad.addColorStop(stop(rMid), 'rgba(225, 248, 255, 1)');
  grad.addColorStop(stop(rMid + rHalf * 0.5), `rgba(${rgb}, 0.9)`);
  grad.addColorStop(stop(rMid + rHalf * 2), `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return toTexture(THREE, canvas);
};

/** Tiny bright spark dot for particle systems. */
export const createSparkTexture = (THREE, size = 64, rgb = HOLO_RGB) => {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 252, 245, 1)');
  grad.addColorStop(0.3, `rgba(${rgb}, 0.9)`);
  grad.addColorStop(1.0, `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return toTexture(THREE, canvas);
};

/**
 * Vertical gradient for the light-pillar cylinder: opaque at the bottom
 * (v = 0) fading to fully transparent at the top (v = 1).
 */
export const createPillarTexture = (THREE, size = 128, rgb = HOLO_RGB) => {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, size, 0, 0);
  grad.addColorStop(0.0, `rgba(${rgb}, 0.55)`);
  grad.addColorStop(0.4, `rgba(${rgb}, 0.22)`);
  grad.addColorStop(1.0, `rgba(${rgb}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return toTexture(THREE, canvas);
};

/**
 * Segmented "magic circle" ring — evenly spaced glowing arc segments with a
 * thin continuous inner circle. Used by the rune-circle effect.
 */
export const createSegmentedRingTexture = (
  THREE,
  { segments = 8, thickness = 0.07, rgb = HOLO_RGB, size = 256 } = {},
) => {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const radius = half * 0.78;
  const gap = 0.35;   // fraction of each segment left empty

  ctx.lineCap = 'round';
  ctx.shadowColor = `rgba(${rgb}, 0.9)`;
  ctx.shadowBlur = size * 0.04;

  // Outer segmented arcs
  ctx.strokeStyle = `rgba(${rgb}, 0.95)`;
  ctx.lineWidth = half * thickness;
  const span = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i += 1) {
    const start = i * span;
    ctx.beginPath();
    ctx.arc(half, half, radius, start, start + span * (1 - gap));
    ctx.stroke();
  }

  // Thin continuous inner circle
  ctx.strokeStyle = `rgba(${rgb}, 0.55)`;
  ctx.lineWidth = half * thickness * 0.4;
  ctx.beginPath();
  ctx.arc(half, half, radius * 0.82, 0, Math.PI * 2);
  ctx.stroke();

  return toTexture(THREE, canvas);
};

/** Additive, depth-safe sprite material used by every effect layer. */
export const additiveMaterial = (THREE, texture, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
