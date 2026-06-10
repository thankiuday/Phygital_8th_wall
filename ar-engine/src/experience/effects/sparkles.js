/**
 * sparkles — particles drifting up from the card surface with a soft base
 * glow. Particles recycle at the top so the stream is continuous.
 */

import { createGlowTexture, createSparkTexture, additiveMaterial } from './textures.js';

const COUNT = 140;
const MAX_HEIGHT = 1.25;
const SPREAD = 0.42;

export const createSparkles = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE), 0.5);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i += 1) {
    const r = Math.sqrt(Math.random()) * SPREAD;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(a) * r;
    positions[i * 3 + 2] = Math.random() * MAX_HEIGHT;
    velocities[i] = 0.12 + Math.random() * 0.22;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const sparkMat = new THREE.PointsMaterial({
    map: createSparkTexture(THREE),
    size: 0.035,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, sparkMat);
  group.add(points);

  let lastElapsed = 0;

  return {
    group,
    materials: [glowMat, sparkMat],
    update(elapsed) {
      const dt = Math.min(0.05, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;

      const pos = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i += 1) {
        pos[i * 3 + 2] += velocities[i] * dt;
        if (pos[i * 3 + 2] > MAX_HEIGHT) {
          const r = Math.sqrt(Math.random()) * SPREAD;
          const a = Math.random() * Math.PI * 2;
          pos[i * 3] = Math.cos(a) * r;
          pos[i * 3 + 1] = Math.sin(a) * r;
          pos[i * 3 + 2] = 0;
        }
      }
      geo.attributes.position.needsUpdate = true;

      glow.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.06);
    },
  };
};
