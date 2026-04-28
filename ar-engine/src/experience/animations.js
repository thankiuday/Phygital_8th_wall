/**
 * animations.js — GSAP animations for the AR hologram
 *
 * CINEMATIC ENTRANCE ("animateTargetFound")
 * ──────────────────────────────────────────
 *  Phase 1 (0 – 0.6 s)  Plane rises out of the card surface
 *    • proxy scalar k drives both plane.scale.y AND plane.position.z so the
 *      bottom edge stays at the card surface as the plane rises:
 *        bottom_z = position.z − k*(H/2) = k*(H/2) − k*(H/2) = 0  ✓
 *    • power3.out easing — snappy at start, soft at end, no overshoot
 *      (replaces the old elastic.out bounce; reads as cinematic, not toy-like)
 *
 *  Phase 1' (0.05 – 0.55 s)  Opacity trails the rise
 *    • Avoids seeing a flat first frame before the plane has meaningfully grown.
 *
 *  Phase 2 (0.6 s +)  Idle loops
 *    • Very subtle screen-space scale breathing (1.000 ↔ 1.010 over 4 s).
 *    • NO position animation on top of live tracking — preserves the smoothing
 *      we apply at the anchor-matrix level.
 *
 * EXIT ("animateTargetLost")
 * ───────────────────────────
 *    • Plane collapses with power2.in (fast at end, no overshoot) over 0.25 s.
 *    • Opacity fades simultaneously.
 *
 * GLOBAL DEPENDENCY: window.gsap — set in main.js from the gsap npm package.
 */

const g = () => window.gsap;

// Handles for active idle tweens so they can be killed cleanly on exit
const _active = { scale: null };

// ─────────────────────────────────────────────────────────────────────────────
// Entrance — target found
// ─────────────────────────────────────────────────────────────────────────────

/**
 * animateTargetFound
 *
 * @param {THREE.Mesh} plane  Video plane (billboard; scale.y starts at 0)
 * @param {number}     restZ  plane.position.z when fully emerged (= PLANE_HEIGHT/2)
 */
export const animateTargetFound = (plane, restZ) => {
  const gsap = g();
  if (!gsap) return;

  // Kill any tweens that may still be in flight (e.g. rapid re-detection)
  gsap.killTweensOf([plane.scale, plane.position, plane.material]);
  _stopFloat();

  // ── Reset to the "collapsed / invisible" start state ─────────────────────
  plane.visible          = true;
  plane.material.opacity = 0;
  plane.scale.set(1, 0, 1);
  plane.position.set(0, 0, 0);

  const tl = gsap.timeline();

  // Phase 1: plane rises out of the card surface (cinematic ease-out, no bounce)
  const proxy = { k: 0 };
  tl.to(proxy, {
    k: 1,
    duration: 0.6,
    ease: 'power3.out',
    onUpdate() {
      const k = proxy.k;
      plane.scale.y    = k;
      plane.position.z = k * restZ;
    },
  }, 0);

  // Phase 1': opacity trails the rise
  tl.to(plane.material, {
    opacity: 1,
    duration: 0.5,
    ease: 'power2.out',
  }, 0.05);

  // Phase 2: idle loops start once the plane has settled
  tl.call(() => _startFloat(plane), null, 0.6);
};

// ─────────────────────────────────────────────────────────────────────────────
// Exit — target lost
// ─────────────────────────────────────────────────────────────────────────────

/**
 * animateTargetLost
 *
 * @param {THREE.Mesh} plane
 * @param {number}     restZ
 */
export const animateTargetLost = (plane, restZ) => {
  const gsap = g();
  if (!gsap) return;

  gsap.killTweensOf([plane.scale, plane.position, plane.material]);
  _stopFloat();

  // proxy k: 1 = fully risen, 0 = collapsed at card surface
  const proxy = { k: 1 };

  const tl = gsap.timeline({
    onComplete: () => {
      // Hide and reset to initial state for a clean next entrance
      plane.visible = false;
      plane.scale.set(1, 0, 1);
      plane.position.set(0, 0, 0);
    },
  });

  // Smooth collapse — power2.in accelerates toward the end (no bounce)
  tl.to(proxy, {
    k: 0,
    duration: 0.25,
    ease: 'power2.in',
    onUpdate() {
      plane.scale.y    = proxy.k;
      plane.position.z = proxy.k * restZ;
    },
  }, 0);
  tl.to(plane.material, { opacity: 0, duration: 0.22 }, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Idle loop — runs while target is tracked
// ─────────────────────────────────────────────────────────────────────────────
// Design rule: NEVER animate plane.position here.
// Any position tween on top of live tracking adds to inherent filter jitter.
// Only screen-space scale (with billboard) is safe.
// ─────────────────────────────────────────────────────────────────────────────

const _startFloat = (plane) => {
  const gsap = g();
  if (!gsap) return;

  // Lock plane at exactly its rest pose before starting idle
  plane.scale.set(1, 1, 1);

  // Very subtle "alive" breathing pulse — small amplitude, slow period.
  const scalePx = { v: 1 };
  _active.scale = gsap.to(scalePx, {
    v: 1.010,
    duration: 4.0,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      plane.scale.x = scalePx.v;
      plane.scale.y = scalePx.v;
    },
  });
};

const _stopFloat = () => {
  if (_active.scale) { _active.scale.kill(); _active.scale = null; }
};
