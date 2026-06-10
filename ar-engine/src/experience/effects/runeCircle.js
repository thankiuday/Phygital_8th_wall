/**
 * runeCircle — violet "magic circle": two counter-rotating segmented rings
 * flat on the card surface, a purple base glow, and a few glyph sparks
 * slowly rising off the circle.
 */

import {
  createGlowTexture,
  createSparkTexture,
  createSegmentedRingTexture,
  additiveMaterial,
} from './textures.js';

const PURPLE_RGB = '186, 130, 255';
const SPARK_COUNT = 18;
const SPARK_HEIGHT = 0.7;

export const createRuneCircle = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE, 256, PURPLE_RGB), 0.45);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const outerMat = additiveMaterial(
    THREE,
    createSegmentedRingTexture(THREE, { segments: 10, thickness: 0.07, rgb: PURPLE_RGB }),
    0.9,
  );
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), outerMat);
  outer.position.z = 0.002;
  group.add(outer);

  const innerMat = additiveMaterial(
    THREE,
    createSegmentedRingTexture(THREE, { segments: 6, thickness: 0.09, rgb: PURPLE_RGB }),
    0.7,
  );
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), innerMat);
  inner.position.z = 0.003;
  group.add(inner);

  // Sparse glyph sparks drifting up off the circle
  const positions = new Float32Array(SPARK_COUNT * 3);
  const velocities = new Float32Array(SPARK_COUNT);
  const respawn = (i, z = 0) => {
    const r = 0.18 + Math.random() * 0.2;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(a) * r;
    positions[i * 3 + 2] = z;
  };
  for (let i = 0; i < SPARK_COUNT; i += 1) {
    respawn(i, Math.random() * SPARK_HEIGHT);
    velocities[i] = 0.06 + Math.random() * 0.1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const sparkMat = new THREE.PointsMaterial({
    map: createSparkTexture(THREE, 64, PURPLE_RGB),
    size: 0.04,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sparks = new THREE.Points(geo, sparkMat);
  group.add(sparks);

  let lastElapsed = 0;

  return {
    group,
    materials: [glowMat, outerMat, innerMat, sparkMat],
    update(elapsed) {
      outer.rotation.z = elapsed * 0.5;
      inner.rotation.z = -elapsed * 0.8;

      const dt = Math.min(0.05, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;
      const pos = geo.attributes.position.array;
      for (let i = 0; i < SPARK_COUNT; i += 1) {
        pos[i * 3 + 2] += velocities[i] * dt;
        if (pos[i * 3 + 2] > SPARK_HEIGHT) respawn(i, 0);
      }
      geo.attributes.position.needsUpdate = true;

      glow.scale.setScalar(1 + Math.sin(elapsed * 1.6) * 0.06);
    },
  };
};
