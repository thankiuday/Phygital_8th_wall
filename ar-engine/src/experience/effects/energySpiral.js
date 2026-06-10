/**
 * energySpiral — two counter-rotating helix strands of spark particles
 * twisting upward from a glowing base ring (hologram "beam-up" look).
 *
 * Built from real 3D helix geometry (positions recomputed each frame), so it
 * projects as a spiral from any camera angle — unlike the old flat-ring
 * stack, which scattered into offset ellipses under perspective.
 */

import {
  createRingTexture,
  createGlowTexture,
  createSparkTexture,
  additiveMaterial,
} from './textures.js';

const STRANDS = 2;
const POINTS_PER_STRAND = 80;
const COUNT = STRANDS * POINTS_PER_STRAND;
const HEIGHT = 0.9;
const TURNS = 2.25;          // helix revolutions over the full height
const RADIUS_BOTTOM = 0.3;
const RADIUS_TOP = 0.1;
const SPIN_SPEED = 1.1;      // rad/s; strands counter-rotate

export const createEnergySpiral = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE), 0.4);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  // Single flat ring on the card surface (where flat planes look correct)
  const ringMat = additiveMaterial(THREE, createRingTexture(THREE, 0.1), 0.8);
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), ringMat);
  ring.position.z = 0.002;
  group.add(ring);

  const positions = new Float32Array(COUNT * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const sparkMat = new THREE.PointsMaterial({
    map: createSparkTexture(THREE),
    size: 0.04,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, sparkMat);
  group.add(points);

  const writeHelix = (elapsed) => {
    const pos = geo.attributes.position.array;
    let idx = 0;
    for (let s = 0; s < STRANDS; s += 1) {
      const dir = s % 2 === 0 ? 1 : -1;
      const phase = dir * elapsed * SPIN_SPEED + s * Math.PI;
      for (let i = 0; i < POINTS_PER_STRAND; i += 1) {
        const t = i / (POINTS_PER_STRAND - 1);           // 0 (base) → 1 (top)
        const r = RADIUS_BOTTOM + (RADIUS_TOP - RADIUS_BOTTOM) * t;
        const a = dir * t * TURNS * Math.PI * 2 + phase;
        pos[idx] = Math.cos(a) * r;
        pos[idx + 1] = Math.sin(a) * r;
        pos[idx + 2] = t * HEIGHT;
        idx += 3;
      }
    }
    geo.attributes.position.needsUpdate = true;
  };
  writeHelix(0);

  return {
    group,
    materials: [glowMat, ringMat, sparkMat],
    update(elapsed) {
      writeHelix(elapsed);
      ring.rotation.z = elapsed * 0.4;
      glow.scale.setScalar(1 + Math.sin(elapsed * 1.5) * 0.05);
    },
  };
};
