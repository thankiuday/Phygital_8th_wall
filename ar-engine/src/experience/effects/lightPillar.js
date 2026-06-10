/**
 * lightPillar — vertical light beam rising from a glowing base ring.
 *
 * The beam is a "billboard cross": vertical gradient planes intersecting at
 * the axis at 60° steps. Unlike the old open cylinder (which read as a faint
 * see-through sheet at glancing angles), at least one plane of the cross is
 * always near-perpendicular to the camera, so the beam stays crisp and
 * vertical from every viewing angle. A narrower, brighter inner cross gives
 * the beam a hot core.
 */

import {
  createRingTexture,
  createGlowTexture,
  createPillarTexture,
  additiveMaterial,
} from './textures.js';

const BEAM_HEIGHT = 0.85;   // ends around the hologram's waist
const BEAM_WIDTH  = 0.4;
const CORE_HEIGHT = 0.7;
const CORE_WIDTH  = 0.14;
const BLADES = 3;           // planes at 60° steps

export const createLightPillar = (THREE) => {
  const group = new THREE.Group();

  const glowMat = additiveMaterial(THREE, createGlowTexture(THREE), 0.45);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), glowMat);
  glow.position.z = 0.001;
  group.add(glow);

  const ringMat = additiveMaterial(THREE, createRingTexture(THREE, 0.12), 0.85);
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), ringMat);
  ring.position.z = 0.002;
  group.add(ring);

  // Vertical-gradient plane geometry, base pinned at z = 0. PlaneGeometry is
  // built in XY with height on Y; translating by h/2 then rotating the mesh
  // 90° about X stands it up along anchor +Z.
  const makeBladeGeo = (w, h) => {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    return geo;
  };

  const pillarTex = createPillarTexture(THREE);
  const beamMat = additiveMaterial(THREE, pillarTex, 0.42);
  const coreMat = additiveMaterial(THREE, pillarTex, 0.85);

  const beamGeo = makeBladeGeo(BEAM_WIDTH, BEAM_HEIGHT);
  const coreGeo = makeBladeGeo(CORE_WIDTH, CORE_HEIGHT);

  // Cross sub-group rotates slowly around the beam axis for shimmer.
  const cross = new THREE.Group();
  group.add(cross);

  for (let i = 0; i < BLADES; i += 1) {
    const holder = new THREE.Object3D();
    holder.rotation.z = (i / BLADES) * Math.PI;

    const blade = new THREE.Mesh(beamGeo, beamMat);
    blade.rotation.x = Math.PI / 2;
    holder.add(blade);

    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.x = Math.PI / 2;
    holder.add(core);

    cross.add(holder);
  }

  return {
    group,
    materials: [glowMat, ringMat, beamMat, coreMat],
    update(elapsed) {
      cross.rotation.z = elapsed * 0.35;
      const pulse = 1 + Math.sin(elapsed * 1.4) * 0.05;
      ring.scale.setScalar(pulse);
      glow.scale.setScalar(1 + Math.sin(elapsed * 1.4 + 0.8) * 0.07);
    },
  };
};
