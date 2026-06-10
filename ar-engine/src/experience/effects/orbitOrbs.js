/**
 * orbitOrbs — three glowing orbs (cyan, magenta, gold) orbiting the hologram
 * base at staggered radii, heights and speeds, over a soft blue-white glow.
 * Orbs are THREE.Sprite instances, so they always face the camera.
 */

import { createGlowTexture, additiveMaterial } from './textures.js';

const BASE_RGB = '180, 220, 255';

const ORBS = [
  { rgb: '110, 215, 255', radius: 0.34, z: 0.18, speed: 0.9,  size: 0.16, phase: 0 },
  { rgb: '255, 120, 235', radius: 0.42, z: 0.38, speed: -0.65, size: 0.13, phase: 2.1 },
  { rgb: '255, 200, 110', radius: 0.27, z: 0.56, speed: 1.25, size: 0.11, phase: 4.2 },
];

export const createOrbitOrbs = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE, 256, BASE_RGB), 0.4);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const orbs = ORBS.map((cfg) => {
    const mat = new THREE.SpriteMaterial({
      map: createGlowTexture(THREE, 128, cfg.rgb),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(cfg.size, cfg.size, 1);
    group.add(sprite);
    return { sprite, mat, ...cfg };
  });

  return {
    group,
    materials: [glowMat, ...orbs.map((o) => o.mat)],
    update(elapsed) {
      for (const orb of orbs) {
        const a = elapsed * orb.speed + orb.phase;
        orb.sprite.position.set(
          Math.cos(a) * orb.radius,
          Math.sin(a) * orb.radius,
          orb.z + Math.sin(elapsed * 1.3 + orb.phase) * 0.05,
        );
      }
      glow.scale.setScalar(1 + Math.sin(elapsed * 1.5) * 0.05);
    },
  };
};
