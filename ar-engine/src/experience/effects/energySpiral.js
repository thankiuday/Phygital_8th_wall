/**
 * energySpiral — ascending stack of thin glowing rings, shrinking and fading
 * with height, each rotating at a staggered speed (hologram "beam-up" look).
 */

import { createRingTexture, createGlowTexture, additiveMaterial } from './textures.js';

export const createEnergySpiral = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE), 0.4);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const ringTex = createRingTexture(THREE, 0.1);
  const LEVELS = [
    { size: 0.8, z: 0.02, speed: 0.5, opacity: 0.85 },
    { size: 0.62, z: 0.28, speed: -0.7, opacity: 0.6 },
    { size: 0.46, z: 0.55, speed: 0.9, opacity: 0.42 },
    { size: 0.32, z: 0.82, speed: -1.15, opacity: 0.28 },
  ];

  const rings = LEVELS.map((cfg) => {
    const mat = additiveMaterial(THREE, ringTex, cfg.opacity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size, cfg.size), mat);
    mesh.position.z = cfg.z;
    group.add(mesh);
    return { mesh, ...cfg };
  });

  return {
    group,
    materials: [glowMat, ...rings.map((r) => r.mesh.material)],
    update(elapsed) {
      rings.forEach(({ mesh, speed, z }, i) => {
        mesh.rotation.z = elapsed * speed;
        // Gentle vertical bobbing, staggered per level
        mesh.position.z = z + Math.sin(elapsed * 1.2 + i * 1.4) * 0.02;
      });
      glow.scale.setScalar(1 + Math.sin(elapsed * 1.5) * 0.05);
    },
  };
};
