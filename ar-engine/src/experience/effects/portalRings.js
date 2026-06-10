/**
 * portalRings — concentric glowing rings lying flat on the card surface,
 * slowly counter-rotating with a gentle breathing pulse.
 */

import { createRingTexture, createGlowTexture, additiveMaterial } from './textures.js';

export const createPortalRings = (THREE) => {
  const group = new THREE.Group();

  const glowTex = createGlowTexture(THREE);
  const glowMat = additiveMaterial(THREE, glowTex, 0.4);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const rings = [
    { size: 0.88, thickness: 0.1, speed: 0.25, opacity: 0.9 },
    { size: 0.68, thickness: 0.14, speed: -0.4, opacity: 0.7 },
    { size: 0.5, thickness: 0.2, speed: 0.6, opacity: 0.55 },
  ].map((cfg, i) => {
    const tex = createRingTexture(THREE, cfg.thickness);
    const mat = additiveMaterial(THREE, tex, cfg.opacity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size, cfg.size), mat);
    mesh.position.z = 0.002 + i * 0.001;
    group.add(mesh);
    return { mesh, speed: cfg.speed };
  });

  return {
    group,
    materials: [glowMat, ...rings.map((r) => r.mesh.material)],
    update(elapsed) {
      const pulse = 1 + Math.sin(elapsed * 1.6) * 0.04;
      rings.forEach(({ mesh, speed }) => {
        mesh.rotation.z = elapsed * speed;
        mesh.scale.setScalar(pulse);
      });
      glow.scale.setScalar(1 + Math.sin(elapsed * 1.6 + 0.6) * 0.06);
    },
  };
};
