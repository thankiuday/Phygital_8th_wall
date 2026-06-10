/**
 * emberRise — warm gold/amber embers drifting up from the card surface with
 * a gentle sideways sway and flicker, over an amber base glow.
 */

import { createGlowTexture, createSparkTexture, additiveMaterial } from './textures.js';

const GOLD_RGB = '255, 186, 92';
const COUNT = 110;
const MAX_HEIGHT = 1.1;
const SPREAD = 0.38;
const SWAY = 0.045;

export const createEmberRise = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE, 256, GOLD_RGB), 0.55);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const positions = new Float32Array(COUNT * 3);
  const base = new Float32Array(COUNT * 2);      // resting x/y per ember
  const velocities = new Float32Array(COUNT);
  const swayPhase = new Float32Array(COUNT);

  const respawn = (i, z = 0) => {
    const r = Math.sqrt(Math.random()) * SPREAD;
    const a = Math.random() * Math.PI * 2;
    base[i * 2] = Math.cos(a) * r;
    base[i * 2 + 1] = Math.sin(a) * r;
    positions[i * 3] = base[i * 2];
    positions[i * 3 + 1] = base[i * 2 + 1];
    positions[i * 3 + 2] = z;
  };

  for (let i = 0; i < COUNT; i += 1) {
    respawn(i, Math.random() * MAX_HEIGHT);
    velocities[i] = 0.1 + Math.random() * 0.2;
    swayPhase[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const emberMat = new THREE.PointsMaterial({
    map: createSparkTexture(THREE, 64, GOLD_RGB),
    size: 0.045,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, emberMat);
  group.add(points);

  let lastElapsed = 0;

  return {
    group,
    materials: [glowMat],
    // Ember opacity flickers inside the master fade envelope.
    dynamicMaterials: [{ material: emberMat, baseOpacity: 0.9 }],
    update(elapsed, masterOpacity = 1) {
      const dt = Math.min(0.05, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;

      const pos = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i += 1) {
        pos[i * 3 + 2] += velocities[i] * dt;
        if (pos[i * 3 + 2] > MAX_HEIGHT) {
          respawn(i, 0);
        } else {
          // Sideways sway grows with height (embers caught in updraft)
          const h = pos[i * 3 + 2] / MAX_HEIGHT;
          const sway = Math.sin(elapsed * 2 + swayPhase[i]) * SWAY * h;
          pos[i * 3] = base[i * 2] + sway;
          pos[i * 3 + 1] = base[i * 2 + 1] + Math.cos(elapsed * 1.7 + swayPhase[i]) * SWAY * h * 0.6;
        }
      }
      geo.attributes.position.needsUpdate = true;

      emberMat.opacity = (0.78 + Math.sin(elapsed * 6.5) * 0.12) * masterOpacity;
      glow.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.08);
    },
  };
};
