/**
 * animations.js — GSAP animations for the AR hologram
 *
 * HOW THE RISE-FROM-CARD MATH WORKS
 * ──────────────────────────────────
 * After rotation.x = Math.PI/2 in ARExperience.js, the plane stands upright.
 * In Three.js, TRS order is: translate → rotate → scale. So scale.y compresses
 * the plane in its local Y BEFORE the rotation is applied, which means scale.y
 * controls the plane's EFFECTIVE HEIGHT along the +Z (camera) axis in world
 * space.
 *
 * For the "grow from card surface" effect, the bottom edge must stay at z = 0
 * while scale.y grows from 0 → 1. Geometry spans y: [-H/2, +H/2] in model
 * space. After rotation, z spans [-k*H/2, +k*H/2] relative to position.z.
 * Setting position.z = k * restZ (where restZ = H/2) keeps the bottom at 0:
 *
 *   bottom_z = position.z − k*(H/2) = k*(H/2) − k*(H/2) = 0  ✓
 *   top_z    = position.z + k*(H/2) = k*H                      ✓
 *
 * Animation: animate the proxy scalar k from 0 → 1 and apply both transforms
 * in every onUpdate tick.
 *
 * GLOBAL DEPENDENCY: window.gsap — set in main.js from the gsap npm package.
 */

const g = () => window.gsap;

// ─────────────────────────────────────────────────────────────────────────────
// Entrance — target found
// ─────────────────────────────────────────────────────────────────────────────

/**
 * animateTargetFound
 *
 * @param {THREE.Mesh} plane     The upright video plane (rotation.x = π/2)
 * @param {THREE.Mesh} glow      Flat ellipse glow at the card base
 * @param {number}     restZ     plane.position.z when fully risen (= PLANE_HEIGHT/2)
 */
export const animateTargetFound = (plane, glow, restZ) => {
  const gsap = g();
  if (!gsap) return;

  // Kill any in-flight tweens to prevent conflicts
  gsap.killTweensOf([plane.scale, plane.position, plane.material,
                     glow.scale,  glow.material]);

  // Reset to "at card surface" start state
  plane.visible = true;
  glow.visible  = true;
  plane.material.opacity = 0;
  glow.material.opacity  = 0;
  plane.scale.set(1, 0, 1);        // collapsed (zero height)
  plane.position.set(0, 0, 0);     // bottom at card surface
  glow.scale.set(0, 1, 1);         // collapsed width-wise

  const tl = gsap.timeline();

  // ── Phase 1 (0 – 0.3 s): glow expands at the base ───────────────────────
  tl.to(glow.scale, {
    x: 1,
    duration: 0.3,
    ease: 'power2.out',
  }, 0);
  tl.to(glow.material, { opacity: 0.7, duration: 0.25 }, 0);

  // ── Phase 2 (0.05 – 0.7 s): video rises from card surface ───────────────
  // We animate a single proxy scalar k: 0 → 1 and derive both scale.y and
  // position.z from it every frame, keeping the bottom edge glued to z = 0.
  const proxy = { k: 0 };
  tl.to(proxy, {
    k: 1,
    duration: 0.65,
    ease: 'back.out(1.4)',
    onUpdate() {
      const k = proxy.k;
      plane.scale.y      = k;
      plane.position.z   = k * restZ;
    },
  }, 0.05);

  // Fade video in slightly behind the scale to avoid a flash of first-frame
  tl.to(plane.material, { opacity: 1, duration: 0.45 }, 0.15);

  // ── Phase 3 (0.5 – 0.8 s): glow settles to soft pulse ──────────────────
  tl.to(glow.material, { opacity: 0.3, duration: 0.35 }, 0.5);
  tl.to(glow.scale,    { x: 1.1, duration: 0.3, ease: 'power1.inOut' }, 0.5);

  // ── Phase 4: start persistent float loop once fully risen ────────────────
  tl.call(() => _startFloat(plane, glow, restZ), null, 0.75);
};

// ─────────────────────────────────────────────────────────────────────────────
// Exit — target lost
// ─────────────────────────────────────────────────────────────────────────────

/**
 * animateTargetLost — collapses the plane back down to the card surface.
 */
export const animateTargetLost = (plane, glow, restZ) => {
  const gsap = g();
  if (!gsap) return;

  gsap.killTweensOf([plane.scale, plane.position, plane.material,
                     glow.scale,  glow.material]);
  _stopFloat(plane, glow, restZ);

  const proxy = { k: 1 };
  const tl = gsap.timeline({
    onComplete: () => {
      plane.visible = false;
      glow.visible  = false;
      // Reset for next clean entrance
      plane.scale.set(1, 0, 1);
      plane.position.set(0, 0, 0);
      glow.scale.set(0, 1, 1);
    },
  });

  // Reverse the rise: scale.y collapses back toward card surface
  tl.to(proxy, {
    k: 0,
    duration: 0.3,
    ease: 'power2.in',
    onUpdate() {
      plane.scale.y    = proxy.k;
      plane.position.z = proxy.k * restZ;
    },
  }, 0);
  tl.to(plane.material, { opacity: 0, duration: 0.2 }, 0);
  tl.to(glow.material,  { opacity: 0, duration: 0.2 }, 0);
  tl.to(glow.scale,     { x: 0,      duration: 0.25, ease: 'power2.in' }, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Idle loop — runs while the target is tracked
// ─────────────────────────────────────────────────────────────────────────────
// We intentionally do NOT move the plane position here. Any position animation
// on top of live tracking adds to the inherent filter jitter and makes the
// hologram appear to zigzag. Only the base glow pulses (opacity + scale.x)
// to show the experience is "live" without introducing extra motion.
// ─────────────────────────────────────────────────────────────────────────────

const _active = { glow: null };

const _startFloat = (plane, glow, restZ) => {
  const gsap = g();
  if (!gsap) return;

  // Ensure plane is locked at its exact rest position
  plane.position.z = restZ;

  const glowProxy = { x: glow.scale.x };
  _active.glow = gsap.to(glowProxy, {
    x: 1.2,
    duration: 1.6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => { glow.scale.x = glowProxy.x; },
  });
};

const _stopFloat = (plane, glow, restZ) => {
  if (_active.glow) { _active.glow.kill(); _active.glow = null; }
  plane.position.z = restZ;
  glow.scale.x = 1;
};
