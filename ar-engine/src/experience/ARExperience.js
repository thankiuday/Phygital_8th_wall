/**
 * ARExperience.js — Main WebAR orchestrator
 *
 * STABILITY & 360° VIEWING APPROACH
 * ───────────────────────────────────
 * Four layers cooperate to give a hologram that is rock-steady at rest AND
 * smooth on motion, without re-introducing the "invisible plane on detection"
 * bug that an earlier scene-space EMA had:
 *
 *  1. MindAR One-Euro filter — smooths raw tracking output at the algorithm
 *     level (filterMinCF / filterBeta on MindARThree).  Tuned so the cutoff
 *     stays low when the card is still (kills shimmer) but opens up
 *     aggressively when it actually moves (no swimming / lag).
 *
 *  2. Scene-space EMA wrapper (_smoothGroup) — a Group whose pose lerps and
 *     slerps toward the anchor's world pose every frame while tracking.
 *     Absorbs residual filter noise without introducing visible lag.
 *
 *  3. Camera-facing billboard with EMA — the plane's facing direction is
 *     also slerped, so the billboard glides toward the viewer rather than
 *     snapping every frame.
 *
 *  4. Positional dead-zone — sub-millimetre EMA targets are skipped so a
 *     completely still card produces zero pixel motion.
 *
 * SCENE HIERARCHY
 * ───────────────
 * scene
 *   └─ _smoothGroup          ← EMA of anchor world pose (visible only after snap)
 *        ├─ _rimGlow         ← edge bloom; renderOrder 0
 *        └─ _plane           ← video; billboard quaternion; renderOrder 1
 *
 * anchor.group  (MindAR — XY = card surface, +Z toward camera)
 *   ├─ _glow                 ← flat base ellipse on card
 *   └─ _scanRing             ← sonar-ping ring on card
 *
 * INVISIBLE-PLANE RACE — and the fix
 * ──────────────────────────────────
 * Previously _smoothGroup started at scene origin (0,0,0) which is the
 * camera's own origin, so on first detection the plane was clipped/invisible
 * until the EMA had converged onto the card.  We now keep _smoothGroup
 * .visible = false at construction, and on _onTargetFound:
 *   a. force this._anchor.group.updateWorldMatrix(true, false)
 *   b. copy the latest world position/quaternion into _smoothGroup
 *   c. set _smoothGroup.visible = true
 *   d. start the entrance animation
 * The very first rendered frame after detection therefore has _smoothGroup
 * already at the card pose — no origin flash.
 *
 * GLOBAL DEPENDENCIES (loaded via CDN in index.html):
 *   window.MINDAR.IMAGE  — MindARThree + Compiler  (mind-ar@1.1.5 UMD)
 *   window.THREE         — Three.js r149
 * GSAP is bundled via Vite and exposed as window.gsap in main.js.
 */

import { compileMindTarget } from './targetCompiler.js';
import { animateTargetFound, animateTargetLost } from './animations.js';
import { updateLoadingProgress, showError, hideLoading } from '../utils/loadingScreen.js';
import { updateSession } from '../services/campaignLoader.js';

// ─────────────────────────────────────────────────────────────────────────────
// Scene constants
// ─────────────────────────────────────────────────────────────────────────────

// Portrait 9:16 plane — 65 % of card width.
const PLANE_WIDTH  = 0.65;
const PLANE_HEIGHT = PLANE_WIDTH * (16 / 9);   // ≈ 1.156

// PLANE_REST_Z: plane centre offset from card surface when fully emerged.
// In _smoothGroup local space (which mirrors anchor.group), +Z = toward camera.
export const PLANE_REST_Z = PLANE_HEIGHT / 2;  // ≈ 0.578

// Base glow ellipse dimensions (flat on card)
const GLOW_W = PLANE_WIDTH * 1.5;
const GLOW_H = 0.06;

// ─────────────────────────────────────────────────────────────────────────────
// Smoothing levers — tune these four constants to dial responsiveness vs
// stability.  Higher α = snappier, lower α = smoother.
// ─────────────────────────────────────────────────────────────────────────────

// EMA factor for _smoothGroup position (per-frame lerp toward anchor).
// 0.18 ≈ 5-frame half-life at 60 fps: smooth but tracks real motion within
// ~80 ms.  Lower values feel laggy; higher values let through more shimmer.
const SMOOTH_POS_ALPHA = 0.18;

// EMA factor for _smoothGroup rotation (per-frame slerp toward anchor).
const SMOOTH_ROT_ALPHA = 0.18;

// EMA factor for billboard facing-direction quaternion.
// 0.18 vs the old 0.30 → calmer face-to-camera updates, no shimmer when
// the viewer holds the phone still.
const BILLBOARD_ALPHA = 0.18;

// Positional dead-zone in MindAR units (≈ metres).  Sub-millimetre targets
// are skipped so a perfectly still card produces zero pixel motion.
const POS_DEADZONE = 0.0004;

// ─────────────────────────────────────────────────────────────────────────────
export class ARExperience {
  constructor({ container, campaign }) {
    this._container = container;
    this._campaign  = campaign;

    // Three.js / MindAR objects
    this._mindarThree  = null;
    this._anchor       = null;
    this._videoEl      = null;
    this._videoTexture = null;

    // Scene meshes
    this._smoothGroup  = null;   // EMA wrapper (scene space) — hosts _plane + _rimGlow
    this._plane        = null;   // video quad (billboard quaternion each frame)
    this._rimGlow      = null;   // edge bloom behind plane
    this._glow         = null;   // flat base ellipse on card surface (anchor.group)
    this._scanRing     = null;   // sonar-ping ring on card surface (anchor.group)

    // Pre-allocated render-loop scratch objects (avoids per-frame GC pressure)
    this._scratch      = null;

    // State flags
    this._tracking     = false;  // true only while MindAR actively tracks
    this._started      = false;
    this._sessionStart = null;
    this._renderLoop   = null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // boot
  // ───────────────────────────────────────────────────────────────────────────
  async boot() {
    const THREE = window.THREE;
    if (!THREE) throw new Error('Three.js not found on window.THREE');
    if (!window.MINDAR?.IMAGE?.MindARThree) {
      throw new Error('MindARThree not found. Check CDN scripts in index.html.');
    }

    updateLoadingProgress(5, 'Preparing AR experience…');

    // 1 — Compile target image → .mind blob
    let mindBlobUrl;
    try {
      mindBlobUrl = await compileMindTarget(
        this._campaign.targetImageUrl,
        (pct) => updateLoadingProgress(5 + Math.round(pct * 0.8), `Calibrating target… ${pct}%`)
      );
    } catch (err) {
      showError('Could not calibrate image target.', err.message);
      return;
    }

    updateLoadingProgress(88, 'Starting camera…');

    // 2 — Bootstrap MindARThree
    const { MindARThree } = window.MINDAR.IMAGE;
    this._mindarThree = new MindARThree({
      container:      this._container,
      imageTargetSrc: mindBlobUrl,
      maxTrack:       1,
      uiLoading:      'no',
      uiScanning:     'yes',
      uiError:        'no',

      // One-Euro filter — tuned for "stable when still, responsive on motion".
      // filterMinCF very low → cutoff stays tight at rest (kills shimmer).
      // filterBeta higher    → cutoff opens fast on real motion (no lag).
      // Combined with the scene-space EMA below, this gives the best of both.
      filterMinCF:    0.0001,
      filterBeta:     0.01,

      warmupTolerance: 5,
      missTolerance:   20,
    });

    const { renderer, scene, camera } = this._mindarThree;

    // Transparent WebGL canvas — camera feed shows through
    renderer.setClearColor(0x000000, 0);
    scene.background = null;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.physicallyCorrectLights = true;

    // 3 — Build scene objects (also initialises this._scratch and _smoothGroup)
    this._buildScene(THREE, scene, renderer);

    // 4 — Wire anchor events
    const anchor = this._mindarThree.addAnchor(0);
    this._anchor = anchor;
    anchor.onTargetFound = () => this._onTargetFound();
    anchor.onTargetLost  = () => this._onTargetLost();

    // _plane and _rimGlow live in _smoothGroup (scene space; EMA-smoothed pose).
    // _glow and _scanRing live on the card itself in anchor.group (raw pose).
    anchor.group.add(this._glow);
    anchor.group.add(this._scanRing);

    scene.add(new THREE.AmbientLight(0xffffff, 1));

    // 5 — Start MindAR (opens camera + begins tracking)
    try {
      await this._mindarThree.start();
      this._started = true;
    } catch {
      showError('Camera access required.', 'Please allow camera permissions and reload.');
      return;
    }

    this._sessionStart = Date.now();
    updateLoadingProgress(100, 'Ready!');
    hideLoading();

    // ── Render loop ──────────────────────────────────────────────────────────
    const sc = this._scratch;

    this._renderLoop = () => {
      // 1. EMA smoothing: _smoothGroup tracks anchor world transform
      //    (only while tracking → no drift on target lost).
      if (this._tracking) {
        this._anchor.group.getWorldPosition(sc.anchorPos);
        this._anchor.group.getWorldQuaternion(sc.anchorQuat);

        // Positional dead-zone: skip the lerp if movement is below the
        // shimmer threshold.  Compared on the full vector length so a
        // legitimate slow drift still gets through eventually.
        sc.posDelta.subVectors(sc.anchorPos, this._smoothGroup.position);
        if (sc.posDelta.lengthSq() > POS_DEADZONE * POS_DEADZONE) {
          this._smoothGroup.position.lerp(sc.anchorPos, SMOOTH_POS_ALPHA);
        }

        this._smoothGroup.quaternion.slerp(sc.anchorQuat, SMOOTH_ROT_ALPHA);
      }

      // 2. Billboard: make plane (and _rimGlow) always face the camera,
      //    computed in _smoothGroup local space so it composes cleanly with
      //    the EMA-smoothed pose above.
      if (this._plane.visible) {
        camera.getWorldPosition(sc.camPos);
        this._smoothGroup.getWorldPosition(sc.smoothPos);

        sc.towardCam.subVectors(sc.camPos, sc.smoothPos);
        if (sc.towardCam.lengthSq() > 0.0001) {
          sc.towardCam.normalize();

          // Desired world quaternion: rotate plane's +Z toward the camera
          sc.billboardWorldQuat.setFromUnitVectors(sc.FWD, sc.towardCam);

          // EMA-smooth the billboard world quaternion (kills facing shimmer).
          sc.smoothBillboardQuat.slerp(sc.billboardWorldQuat, BILLBOARD_ALPHA);

          // Convert to _smoothGroup local space:
          //   q_local = q_parent^-1 * q_world
          this._smoothGroup.getWorldQuaternion(sc.parentQuatInv);
          sc.parentQuatInv.invert();
          sc.parentQuatInv.multiply(sc.smoothBillboardQuat);

          this._plane.quaternion.copy(sc.parentQuatInv);

          // rimGlow mirrors plane orientation + position (sibling in _smoothGroup)
          this._rimGlow.quaternion.copy(sc.parentQuatInv);
          this._rimGlow.position.copy(this._plane.position);
        }
      }

      // 3. Upload latest decoded video frame to GPU texture
      if (
        this._videoTexture &&
        this._videoEl?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        this._videoTexture.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(this._renderLoop);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // _buildScene
  // ───────────────────────────────────────────────────────────────────────────
  _buildScene(THREE, scene, renderer) {
    // Pre-allocate scratch objects used every render frame (avoids GC at 60fps)
    this._scratch = {
      anchorPos:           new THREE.Vector3(),
      anchorQuat:          new THREE.Quaternion(),
      posDelta:            new THREE.Vector3(),
      camPos:              new THREE.Vector3(),
      smoothPos:           new THREE.Vector3(),
      towardCam:           new THREE.Vector3(),
      billboardWorldQuat:  new THREE.Quaternion(),
      // Smoothed billboard quaternion — EMA toward billboardWorldQuat each frame.
      smoothBillboardQuat: new THREE.Quaternion(),
      parentQuatInv:       new THREE.Quaternion(),
      FWD:                 new THREE.Vector3(0, 0, 1),
    };

    // ── EMA wrapper (scene space) ────────────────────────────────────────────
    // Hidden until _onTargetFound snaps it onto the card pose; this prevents
    // a one-frame flash at the world origin on first detection.
    this._smoothGroup = new THREE.Group();
    this._smoothGroup.visible = false;
    scene.add(this._smoothGroup);

    // ── Off-screen video element ─────────────────────────────────────────────
    this._videoEl = document.createElement('video');
    Object.assign(this._videoEl, {
      src:         this._campaign.videoUrl,
      loop:        true,
      muted:       true,      // unmuted later in _onTargetFound
      playsInline: true,
      crossOrigin: 'anonymous',
      preload:     'auto',
    });
    this._videoEl.setAttribute('width',  '1080');
    this._videoEl.setAttribute('height', '1920');
    this._videoEl.style.display = 'none';
    document.body.appendChild(this._videoEl);
    this._videoEl.load();

    // ── Video texture ────────────────────────────────────────────────────────
    this._videoTexture = new THREE.VideoTexture(this._videoEl);
    this._videoTexture.minFilter = THREE.LinearFilter;
    this._videoTexture.magFilter = THREE.LinearFilter;
    this._videoTexture.generateMipmaps = false;
    this._videoTexture.encoding = THREE.sRGBEncoding;
    const maxAniso = renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
    this._videoTexture.anisotropy = maxAniso;

    // ── Video plane (billboard — render loop sets quaternion each frame) ─────
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
    const planeMat = new THREE.MeshBasicMaterial({
      map:         this._videoTexture,
      transparent: true,
      opacity:     0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    this._plane = new THREE.Mesh(planeGeo, planeMat);
    // Start collapsed (zero height); entrance animation grows scale.y 0 → 1
    // and slides position.z 0 → PLANE_REST_Z (toward camera).
    this._plane.scale.set(1, 0, 1);
    this._plane.position.set(0, 0, 0);
    this._plane.renderOrder = 1;
    this._plane.visible = false;
    this._smoothGroup.add(this._plane);

    // ── Rim glow (edge bloom around the video plane) ─────────────────────────
    // 10 % larger than the video plane; additive purple blend; renderOrder 0
    // (draws before the video plane so the edges protrude as a glow ring).
    const rimGeo = new THREE.PlaneGeometry(PLANE_WIDTH * 1.1, PLANE_HEIGHT * 1.1);
    const rimMat = new THREE.MeshBasicMaterial({
      color:       0x7c3aed,
      transparent: true,
      opacity:     0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    this._rimGlow = new THREE.Mesh(rimGeo, rimMat);
    this._rimGlow.renderOrder = 0;
    this._rimGlow.visible = false;
    this._smoothGroup.add(this._rimGlow);

    // ── Base glow ellipse (flat on card — added to anchor.group in boot) ─────
    const glowGeo = new THREE.PlaneGeometry(GLOW_W, GLOW_H);
    const glowMat = new THREE.MeshBasicMaterial({
      color:       0x7c3aed,
      transparent: true,
      opacity:     0,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    this._glow = new THREE.Mesh(glowGeo, glowMat);
    this._glow.position.set(0, 0, 0.003);
    this._glow.scale.set(0, 1, 1);
    this._glow.visible = false;

    // ── Scan ring (sonar-ping on card surface — added to anchor.group in boot) ─
    // RingGeometry lies in the XY plane by default → faces +Z in anchor space
    // (+Z = toward camera), so the viewer sees the full ring face on detection.
    const ringGeo = new THREE.RingGeometry(0.28, 0.34, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color:       0xa855f7,
      transparent: true,
      opacity:     0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    this._scanRing = new THREE.Mesh(ringGeo, ringMat);
    this._scanRing.position.set(0, 0, 0.004);
    this._scanRing.scale.set(0, 0, 1);
    this._scanRing.visible = false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ───────────────────────────────────────────────────────────────────────────
  _onTargetFound() {
    // Snap _smoothGroup to the anchor's current world pose BEFORE the entrance
    // animation, so frame 1 is already at the card location (no origin flash).
    const sc = this._scratch;

    // Force MindAR's latest matrix to propagate through the scene graph
    // before we read it — defeats the original "first frame at origin" race.
    this._anchor.group.updateWorldMatrix(true, false);
    this._anchor.group.getWorldPosition(sc.anchorPos);
    this._anchor.group.getWorldQuaternion(sc.anchorQuat);

    this._smoothGroup.position.copy(sc.anchorPos);
    this._smoothGroup.quaternion.copy(sc.anchorQuat);

    // Reset the smoothed billboard quaternion to the desired world facing
    // direction so the very first frame already faces the camera.
    this._smoothGroup.getWorldPosition(sc.smoothPos);
    this._mindarThree.camera.getWorldPosition(sc.camPos);
    sc.towardCam.subVectors(sc.camPos, sc.smoothPos);
    if (sc.towardCam.lengthSq() > 0.0001) {
      sc.towardCam.normalize();
      sc.smoothBillboardQuat.setFromUnitVectors(sc.FWD, sc.towardCam);
    }

    this._smoothGroup.visible = true;
    this._tracking = true;

    this._playWithAudio();
    animateTargetFound(
      this._plane, this._glow, this._scanRing, this._rimGlow, PLANE_REST_Z
    );
  }

  _onTargetLost() {
    this._tracking = false;
    animateTargetLost(
      this._plane, this._glow, this._scanRing, this._rimGlow, PLANE_REST_Z
    );
    this._videoEl?.pause();
  }

  /**
   * Attempts to play the video unmuted.  Falls back to muted on iOS Safari
   * and shows a persistent tap-to-unmute button.
   */
  _playWithAudio() {
    const v = this._videoEl;
    if (!v) return;

    v.muted = false;
    v.play().then(() => {
      document.getElementById('ar-audio-btn')?.remove();
    }).catch(() => {
      v.muted = true;
      v.play().catch(() => {});
      this._showAudioButton();
    });
  }

  _showAudioButton() {
    if (document.getElementById('ar-audio-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'ar-audio-btn';
    btn.textContent = '🔊 Tap for audio';
    Object.assign(btn.style, {
      position:       'fixed',
      bottom:         '28px',
      left:           '50%',
      transform:      'translateX(-50%)',
      zIndex:         '9998',
      padding:        '10px 22px',
      borderRadius:   '99px',
      border:         'none',
      background:     'rgba(124,58,237,0.85)',
      color:          '#fff',
      fontSize:       '14px',
      fontWeight:     '600',
      cursor:         'pointer',
      backdropFilter: 'blur(8px)',
    });
    btn.addEventListener('click', () => {
      if (this._videoEl) {
        this._videoEl.muted = false;
        this._videoEl.play().catch(() => {});
      }
      btn.remove();
    }, { once: true });

    document.body.appendChild(btn);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // destroy
  // ───────────────────────────────────────────────────────────────────────────
  async destroy() {
    if (this._sessionStart) {
      updateSession(
        this._campaign._id,
        Date.now() - this._sessionStart,
        this._getVideoWatchPercent()
      );
    }
    if (this._mindarThree?.renderer) {
      this._mindarThree.renderer.setAnimationLoop(null);
    }
    if (this._started && this._mindarThree) {
      await this._mindarThree.stop();
    }
    if (this._videoEl) {
      this._videoEl.pause();
      this._videoEl.remove();
    }
    this._videoTexture?.dispose();
    document.getElementById('ar-audio-btn')?.remove();
  }

  _getVideoWatchPercent() {
    const v = this._videoEl;
    if (!v || !v.duration) return 0;
    return Math.round((v.currentTime / v.duration) * 100);
  }
}
