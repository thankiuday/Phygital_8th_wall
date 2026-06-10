/**
 * pulseGlow — breathing radial glow on the card surface with an expanding
 * shockwave ring every ~2.5 s.
 */

import { createRingTexture, createGlowTexture, additiveMaterial } from './textures.js';

const WAVE_PERIOD = 2.5;

export const createPulseGlow = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE), 0.65);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const waveMat = additiveMaterial(THREE, createRingTexture(THREE, 0.08), 0);
  const wave = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), waveMat);
  wave.position.z = 0.002;
  group.add(wave);

  // Base opacity that the fade controller multiplies; wave manages its own
  // life-cycle alpha inside that envelope via userData.
  waveMat.userData = waveMat.userData || {};

  return {
    group,
    materials: [glowMat],
    // Wave material handled manually each frame (its alpha is animation-driven)
    dynamicMaterials: [{ material: waveMat, baseOpacity: 0.9 }],
    update(elapsed, masterOpacity = 1) {
      glow.scale.setScalar(1 + Math.sin(elapsed * 2.0) * 0.1);

      const t = (elapsed % WAVE_PERIOD) / WAVE_PERIOD;   // 0 → 1 per cycle
      const scale = 0.35 + t * 1.05;
      wave.scale.setScalar(scale);
      // Fade in fast, fade out toward the end of the expansion
      const life = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
      waveMat.opacity = life * 0.9 * masterOpacity;
    },
  };
};
