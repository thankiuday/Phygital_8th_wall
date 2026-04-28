/**
 * animations.js — GSAP animations for the AR hologram
 *
 * FOUR-PHASE ENTRANCE ("animateTargetFound")
 * ───────────────────────────────────────────
 *  Phase 1 (0 – 0.3 s)   Card activation
 *    • _scanRing expands like a sonar ping (scale 0 → 1.8, opacity flashes then fades)
 *    • _glow base ellipse grows at the card edge
 *
 *  Phase 2 (0.25 – 0.95 s)  Breaking through
 *    • proxy scalar k drives both plane.scale.y AND plane.position.z
 *      so the bottom edge stays at the card surface as the plane rises:
 *        bottom_z = position.z − k*(H/2) = k*(H/2) − k*(H/2) = 0  ✓
 *    • elastic.out(1, 0.6) easing gives the "punch through" overshoot
 *    • video opacity fades in behind the scale to avoid first-frame flash
 *
 *  Phase 3 (0.95 – 1.35 s)  Settle
 *    • _rimGlow (the edge bloom plane) fades in → purple halo around video
 *    • _glow settles to a softer opacity / slightly wider scale
 *
 *  Phase 4 (1.35 s +)  Idle loops
 *    • Soft scale breathing on the plane (0.97 ↔ 1.03, sine.inOut, no jitter)
 *    • _rimGlow opacity breathes in sync
 *    • _glow width pulses gently
 *    • NO position animation — avoids compounding tracking noise
 *
 * EXIT ("animateTargetLost")
 * ───────────────────────────
 *    • _rimGlow opacity drops immediately
 *    • _scanRing does a brief "closing portal" reverse flash
 *    • plane collapses with power3.in (fast at end — snappy, no overshoot)
 *    • _glow fades and shrinks simultaneously
 *
 * GLOBAL DEPENDENCY: window.gsap — set in main.js from the gsap npm package.
 */

const g = () => window.gsap;

// Handles for active idle tweens so they can be killed cleanly on exit
const _active = { scale: null, rim: null, glow: null };

// ─────────────────────────────────────────────────────────────────────────────
// Entrance — target found
// ─────────────────────────────────────────────────────────────────────────────

/**
 * animateTargetFound
 *
 * @param {THREE.Mesh} plane     Video plane (billboard; scale.y starts at 0)
 * @param {THREE.Mesh} glow      Flat base ellipse at card surface
 * @param {THREE.Mesh} scanRing  Sonar-ping ring at card surface
 * @param {THREE.Mesh} rimGlow   Edge-bloom plane behind video plane
 * @param {number}     restZ     plane.position.z when fully emerged (= PLANE_HEIGHT/2)
 */
export const animateTargetFound = (plane, glow, scanRing, rimGlow, restZ) => {
  const gsap = g();
  if (!gsap) return;

  // Kill any tweens that may still be in flight (e.g. rapid re-detection)
  gsap.killTweensOf([
    plane.scale, plane.position, plane.material,
    glow.scale,  glow.material,
    rimGlow.material,
    scanRing.scale, scanRing.material,
  ]);
  _stopFloat();

  // ── Reset every mesh to the "collapsed / invisible" start state ──────────
  plane.visible     = true;
  glow.visible      = true;
  scanRing.visible  = true;
  rimGlow.visible   = true;

  plane.material.opacity    = 0;
  glow.material.opacity     = 0;
  rimGlow.material.opacity  = 0;
  scanRing.material.opacity = 0;

  plane.scale.set(1, 0, 1);
  plane.position.set(0, 0, 0);
  glow.scale.set(0, 1, 1);
  scanRing.scale.set(0, 0, 1);

  const tl = gsap.timeline();

  // ── Phase 1 (0 – 0.3 s): Card surface activation ─────────────────────────

  // Scan ring expands as a sonar ping — brief flash, then fades out
  tl.to(scanRing.scale, {
    x: 1.8, y: 1.8,
    duration: 0.55,
    ease: 'power2.out',
  }, 0);
  // Quick opacity flash at ring birth
  tl.to(scanRing.material, { opacity: 0.9, duration: 0.07 }, 0);
  // Fade out as ring expands
  tl.to(scanRing.material, {
    opacity: 0,
    duration: 0.45,
    ease: 'power2.in',
  }, 0.1);

  // Base glow expands at the card edge (stays visible through idle)
  tl.to(glow.scale,    { x: 1, duration: 0.3, ease: 'power2.out' }, 0.05);
  tl.to(glow.material, { opacity: 0.7, duration: 0.25 }, 0.05);

  // ── Phase 2 (0.25 – 0.95 s): Video breaks through surface ────────────────
  // Single proxy scalar k drives BOTH scale.y and position.z so the
  // bottom edge stays glued to z = 0 (card surface) throughout:
  //   position.z = k * restZ
  //   scale.y    = k
  //   bottom_z   = position.z − k * (PLANE_HEIGHT/2) = k*restZ − k*restZ = 0
  const proxy = { k: 0 };
  tl.to(proxy, {
    k: 1,
    duration: 0.7,
    ease: 'elastic.out(1, 0.6)',
    onUpdate() {
      const k = proxy.k;
      plane.scale.y    = k;
      plane.position.z = k * restZ;
    },
  }, 0.25);

  // Fade video in slightly behind the scale to avoid seeing the first frame
  // before the plane has meaningfully risen
  tl.to(plane.material, {
    opacity: 1,
    duration: 0.5,
    ease: 'power2.out',
  }, 0.35);

  // ── Phase 3 (0.95 – 1.35 s): Settle ─────────────────────────────────────

  // Rim glow fades in to create the purple edge bloom around the video
  tl.to(rimGlow.material, {
    opacity: 0.35,
    duration: 0.45,
    ease: 'power2.out',
  }, 0.95);

  // Base glow settles to a softer / wider idle state
  tl.to(glow.material, { opacity: 0.3, duration: 0.35 }, 0.95);
  tl.to(glow.scale,    { x: 1.1,  duration: 0.3, ease: 'power1.inOut' }, 0.95);

  // ── Phase 4 (1.35 s +): Start idle loops ─────────────────────────────────
  tl.call(() => _startFloat(plane, glow, rimGlow, restZ), null, 1.35);
};

// ─────────────────────────────────────────────────────────────────────────────
// Exit — target lost
// ─────────────────────────────────────────────────────────────────────────────

/**
 * animateTargetLost
 *
 * @param {THREE.Mesh} plane
 * @param {THREE.Mesh} glow
 * @param {THREE.Mesh} scanRing
 * @param {THREE.Mesh} rimGlow
 * @param {number}     restZ
 */
export const animateTargetLost = (plane, glow, scanRing, rimGlow, restZ) => {
  const gsap = g();
  if (!gsap) return;

  gsap.killTweensOf([
    plane.scale, plane.position, plane.material,
    glow.scale,  glow.material,
    rimGlow.material,
    scanRing.scale, scanRing.material,
  ]);
  _stopFloat();

  // Rim glow drops immediately (visually "the energy is absorbed back")
  gsap.to(rimGlow.material, { opacity: 0, duration: 0.12 });

  // Scan ring: brief reverse flash → "closing portal" feel
  scanRing.visible = true;
  gsap.set(scanRing.scale, { x: 0.4, y: 0.4 });
  gsap.to(scanRing.material, { opacity: 0.5, duration: 0.07 });
  gsap.to(scanRing.material, {
    opacity: 0,
    duration: 0.22,
    delay: 0.07,
    ease: 'power2.in',
  });

  // proxy k: 1 = fully risen, 0 = collapsed at card surface
  const proxy = { k: 1 };

  const tl = gsap.timeline({
    onComplete: () => {
      // Hide all meshes and reset to initial state for a clean next entrance
      plane.visible    = false;
      glow.visible     = false;
      rimGlow.visible  = false;
      scanRing.visible = false;

      plane.scale.set(1, 0, 1);
      plane.position.set(0, 0, 0);
      glow.scale.set(0, 1, 1);
      scanRing.scale.set(0, 0, 1);
    },
  });

  // Snappy collapse — power3.in accelerates toward the end (no bounce)
  tl.to(proxy, {
    k: 0,
    duration: 0.25,
    ease: 'power3.in',
    onUpdate() {
      plane.scale.y    = proxy.k;
      plane.position.z = proxy.k * restZ;
    },
  }, 0);
  tl.to(plane.material, { opacity: 0, duration: 0.18 }, 0);
  tl.to(glow.material,  { opacity: 0, duration: 0.18 }, 0);
  tl.to(glow.scale,     { x: 0,      duration: 0.2, ease: 'power2.in' }, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Idle loops — run while target is tracked
// ─────────────────────────────────────────────────────────────────────────────
// Design rule: NEVER animate plane.position here.
// Any position tween on top of live tracking adds to inherent filter jitter.
// Only scale (which is in screen space with billboard) and opacity are safe.
// ─────────────────────────────────────────────────────────────────────────────

const _startFloat = (plane, glow, rimGlow, restZ) => {
  const gsap = g();
  if (!gsap) return;

  // Lock plane at its exact rest position before starting idle
  plane.position.z = restZ;
  plane.scale.set(1, 1, 1);

  // Scale breathing — very subtle "alive" pulse in screen space.
  // Smaller amplitude (1.012) and slower period (3.6 s) so the breathing
  // never visually competes with tracking jitter.
  const scalePx = { v: 1 };
  _active.scale = gsap.to(scalePx, {
    v: 1.012,
    duration: 3.6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      plane.scale.x = scalePx.v;
      plane.scale.y = scalePx.v;
    },
  });

  // rimGlow opacity breathes in sync with scale (0.35 ↔ 0.45) — gentler
  _active.rim = gsap.to(rimGlow.material, {
    opacity: 0.45,
    duration: 3.6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });

  // Base glow width pulses gently (1.10 ↔ 1.16, 2.4 s) — smaller, slower
  const glowPx = { x: glow.scale.x };
  _active.glow = gsap.to(glowPx, {
    x: 1.16,
    duration: 2.4,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => { glow.scale.x = glowPx.x; },
  });
};

const _stopFloat = () => {
  if (_active.scale) { _active.scale.kill(); _active.scale = null; }
  if (_active.rim)   { _active.rim.kill();   _active.rim   = null; }
  if (_active.glow)  { _active.glow.kill();  _active.glow  = null; }
};
