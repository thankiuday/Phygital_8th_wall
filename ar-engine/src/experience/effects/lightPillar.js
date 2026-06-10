/**
 * lightPillar — soft vertical light column rising from a glowing base ring,
 * fading to transparent toward the top (sits behind the video plane).
 */

import {
  createRingTexture,
  createGlowTexture,
  createPillarTexture,
  additiveMaterial,
} from './textures.js';

export const createLightPillar = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE), 0.45);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const ringMat = additiveMaterial(THREE, createRingTexture(THREE, 0.12), 0.85);
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), ringMat);
  ring.position.z = 0.002;
  group.add(ring);

  // Open-ended cylinder, axis rotated onto anchor +Z (out of the card).
  const pillarTex = createPillarTexture(THREE);
  const pillarMat = additiveMaterial(THREE, pillarTex, 0.5);
  const pillarGeo = new THREE.CylinderGeometry(0.3, 0.34, 1.15, 32, 1, true);
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.rotation.x = Math.PI / 2;
  pillar.position.z = 1.15 / 2;
  group.add(pillar);

  return {
    group,
    materials: [glowMat, ringMat, pillarMat],
    update(elapsed) {
      pillar.rotation.y = elapsed * 0.3;
      const pulse = 1 + Math.sin(elapsed * 1.4) * 0.05;
      ring.scale.setScalar(pulse);
      glow.scale.setScalar(1 + Math.sin(elapsed * 1.4 + 0.8) * 0.07);
    },
  };
};
