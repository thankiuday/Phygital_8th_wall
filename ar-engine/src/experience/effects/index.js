/**
 * effects/index.js — hologram base effect factory for the AR experience.
 *
 * createArEffect(name, THREE) returns a controller:
 *   {
 *     group,            // THREE.Group — add to anchor.group once at boot
 *     show(),           // GSAP fade-in, synced with the video entrance
 *     hide(),           // GSAP fade-out on target lost
 *     update(elapsed),  // call from the render loop while visible
 *     dispose(),        // free geometries / materials / textures
 *   }
 * or `null` for 'none' / unknown names (zero overhead default).
 *
 * SYNC GUARANTEES
 * ───────────────
 * • All objects + canvas textures are built here, once, at boot — show()/
 *   hide() only toggle visibility and tween a master opacity. Nothing is
 *   allocated on the detection hot path, so the effect appears in the very
 *   same frame as the video entrance on every re-detection.
 * • The group is parented to the same MindAR anchor.group as the video
 *   plane, so one pose update moves both — alignment can never drift.
 * • show()/hide() kill in-flight tweens first, so rapid found→lost→found
 *   cycles never desync the master opacity.
 */

import { createPortalRings } from './portalRings.js';
import { createLightPillar } from './lightPillar.js';
import { createSparkles } from './sparkles.js';
import { createEnergySpiral } from './energySpiral.js';
import { createPulseGlow } from './pulseGlow.js';

const BUILDERS = {
  'portal-rings': createPortalRings,
  'light-pillar': createLightPillar,
  sparkles: createSparkles,
  'energy-spiral': createEnergySpiral,
  'pulse-glow': createPulseGlow,
};

// Matches the video entrance/exit timings in animations.js
const SHOW_DURATION = 0.5;
const HIDE_DURATION = 0.22;

export const createArEffect = (effectName, THREE) => {
  const build = BUILDERS[effectName];
  if (!build) return null;

  const effect = build(THREE);
  const { group, materials = [], dynamicMaterials = [] } = effect;

  group.visible = false;
  group.renderOrder = 0;
  group.traverse((obj) => {
    obj.renderOrder = 0;
  });

  // Remember each material's authored opacity; the master fade multiplies it.
  const tracked = materials.map((material) => ({
    material,
    baseOpacity: material.opacity,
  }));

  const master = { v: 0 };
  const applyMaster = () => {
    for (const { material, baseOpacity } of tracked) {
      material.opacity = baseOpacity * master.v;
    }
  };
  applyMaster();

  let startTs = 0;

  return {
    group,

    show() {
      const gsap = window.gsap;
      if (!startTs) startTs = performance.now();
      group.visible = true;
      if (!gsap) {
        master.v = 1;
        applyMaster();
        return;
      }
      gsap.killTweensOf(master);
      gsap.to(master, {
        v: 1,
        duration: SHOW_DURATION,
        ease: 'power2.out',
        onUpdate: applyMaster,
      });
    },

    hide() {
      const gsap = window.gsap;
      if (!gsap) {
        master.v = 0;
        applyMaster();
        group.visible = false;
        return;
      }
      gsap.killTweensOf(master);
      gsap.to(master, {
        v: 0,
        duration: HIDE_DURATION,
        ease: 'power2.in',
        onUpdate: applyMaster,
        onComplete: () => {
          group.visible = false;
        },
      });
    },

    update(nowMs) {
      if (!group.visible) return;
      if (!startTs) startTs = nowMs;
      const elapsed = (nowMs - startTs) / 1000;
      effect.update(elapsed, master.v);
      // Dynamic materials manage their own alpha inside the master envelope
      // (already multiplied in the effect's update), nothing more to do here.
      void dynamicMaterials;
    },

    dispose() {
      window.gsap?.killTweensOf(master);
      group.traverse((obj) => {
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (!m) return;
          m.map?.dispose?.();
          m.dispose?.();
        });
      });
      group.parent?.remove(group);
    },
  };
};

/** Effect names understood by the engine (mirrors the server enum). */
export const AR_EFFECT_NAMES = ['none', ...Object.keys(BUILDERS)];
