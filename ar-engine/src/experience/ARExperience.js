/**
 * ARExperience.js — Main WebAR orchestrator
 *
 * STABILITY & 360° VIEWING APPROACH
 * ───────────────────────────────────
 * Three layers cooperate to give a hologram that is steady at rest AND
 * smooth on motion, while staying robust against the "invisible plane on
 * detection" bug an earlier scene-space EMA wrapper kept hitting:
 *
 *  1. MindAR One-Euro filter — smooths raw tracking output at the algorithm
 *     level (filterMinCF / filterBeta on MindARThree).  Tuned so the cutoff
 *     stays low when the card is still (kills shimmer) but opens aggressively
 *     when it actually moves (no swimming / lag).
 *
 *  2. Camera-facing billboard with EMA — the plane's facing direction is
 *     slerped each frame, so the billboard glides toward the viewer rather
 *     than snapping every frame.  This absorbs residual quaternion noise
 *     without adding visible positional lag.
 *
 *  3. Soft idle animations — small-amplitude scale/opacity breathing that
 *     never visually competes with tracking jitter.
 *
 * SCENE HIERARCHY
 * ───────────────
 * anchor.group  (MindAR — XY = card surface, +Z toward camera)
 *   ├─ _rimGlow   ← edge bloom; renderOrder 0; billboard
 *   ├─ _plane     ← video; billboard quaternion; renderOrder 1
 *   ├─ _glow      ← flat base ellipse on card
 *   └─ _scanRing  ← sonar-ping ring on card
 *
 * WHY EVERYTHING LIVES IN anchor.group
 * ─────────────────────────────────────
 * MindAR keeps anchor.group at the exact tracked card pose every frame.
 * Earlier designs put the floating meshes in a scene-space EMA group, but
 * that group started at world (0,0,0) and the snap-on-detect kept missing
 * MindAR's first-frame matrix update — leaving the plane invisible while
 * the video element kept playing audio.  Parenting all meshes to anchor.group
 * removes that race entirely: position is correct on frame 1.  Stability is
 * achieved through the One-Euro tuning and billboard EMA below.
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
// In anchor space, +Z = toward camera.
export const PLANE_REST_Z = PLANE_HEIGHT / 2;  // ≈ 0.578

// Base glow ellipse dimensions (flat on card)
const GLOW_W = PLANE_WIDTH * 1.5;
const GLOW_H = 0.06;

// ─────────────────────────────────────────────────────────────────────────────
// Smoothing levers — tune these to dial responsiveness vs stability.
// Higher α = snappier; lower α = smoother but laggier.
// ─────────────────────────────────────────────────────────────────────────────

// EMA factor for billboard facing-direction quaternion (slerp per frame).
// 0.18 ≈ 5-frame half-life at 60 fps: smooth face-to-camera with no shimmer.
const BILLBOARD_ALPHA = 0.18;

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

    // Scene meshes (all children of anchor.group)
    this._plane        = null;   // video quad (billboard quaternion each frame)
    this._rimGlow      = null;   // edge bloom behind plane
    this._glow         = null;   // flat base ellipse on card surface
    this._scanRing     = null;   // sonar-ping ring on card surface

    // Pre-allocated render-loop scratch objects (avoids per-frame GC pressure)
    this._scratch      = null;

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

    // 3 — Build scene objects
    this._buildScene(THREE, renderer);

    // 4 — Wire anchor events and add ALL meshes to anchor.group
    //     anchor.group is positioned by MindAR every frame at the exact
    //     tracked card pose — keeping meshes here guarantees they are always
    //     at the correct world position (no startup drift from (0,0,0)).
    const anchor = this._mindarThree.addAnchor(0);
    this._anchor = anchor;
    anchor.onTargetFound = () => this._onTargetFound();
    anchor.onTargetLost  = () => this._onTargetLost();

    anchor.group.add(this._rimGlow);   // rimGlow behind plane (renderOrder 0)
    anchor.group.add(this._plane);     // video plane on top (renderOrder 1)
    anchor.group.add(this._glow);      // flat base glow
    anchor.group.add(this._scanRing);  // sonar-ping ring

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
      // Billboard: make _plane (and _rimGlow) always face the camera, with
      // an EMA on the facing-direction quaternion so the rotation glides
      // (no per-frame shimmer).  Only active while the plane is visible.
      if (this._plane.visible) {
        camera.getWorldPosition(sc.camPos);
        this._anchor.group.getWorldPosition(sc.anchorPos);

        sc.towardCam.subVectors(sc.camPos, sc.anchorPos);

        if (sc.towardCam.lengthSq() > 0.0001) {
          sc.towardCam.normalize();

          // Desired world quaternion: rotate plane's +Z toward the camera
          sc.billboardWorldQuat.setFromUnitVectors(sc.FWD, sc.towardCam);

          // EMA-smooth the world billboard quaternion → calmer face-to-camera.
          sc.smoothBillboardQuat.slerp(sc.billboardWorldQuat, BILLBOARD_ALPHA);

          // Convert the smoothed world quaternion to anchor.group local space:
          //   q_local = q_parent^-1 * q_world
          this._anchor.group.getWorldQuaternion(sc.parentQuatInv);
          sc.parentQuatInv.invert();
          sc.parentQuatInv.multiply(sc.smoothBillboardQuat);

          this._plane.quaternion.copy(sc.parentQuatInv);

          // rimGlow mirrors the plane's orientation and position
          this._rimGlow.quaternion.copy(sc.parentQuatInv);
          this._rimGlow.position.copy(this._plane.position);
        }
      }

      // Upload latest decoded video frame to GPU texture
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
  // _buildScene — creates all meshes; boot() adds them to anchor.group
  // ───────────────────────────────────────────────────────────────────────────
  _buildScene(THREE, renderer) {
    // Pre-allocate scratch objects used every render frame (avoids GC at 60fps)
    this._scratch = {
      camPos:              new THREE.Vector3(),
      anchorPos:           new THREE.Vector3(),
      towardCam:           new THREE.Vector3(),
      billboardWorldQuat:  new THREE.Quaternion(),
      // Smoothed billboard quaternion — slerps toward billboardWorldQuat each
      // frame.  Initialised to identity; converges to correct facing within
      // ~10 frames after detection.
      smoothBillboardQuat: new THREE.Quaternion(),
      parentQuatInv:       new THREE.Quaternion(),
      FWD:                 new THREE.Vector3(0, 0, 1),
    };

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
    // No static rotation.x = Math.PI/2.  The billboard computation in the
    // render loop sets the plane's local quaternion so its +Z faces the camera.
    // Starts collapsed (scale.y = 0); entrance animation grows it.
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
    const planeMat = new THREE.MeshBasicMaterial({
      map:         this._videoTexture,
      transparent: true,
      opacity:     0,
      side:        THREE.DoubleSide,
      depthWrite:  false,
    });
    this._plane = new THREE.Mesh(planeGeo, planeMat);
    this._plane.scale.set(1, 0, 1);
    this._plane.position.set(0, 0, 0);
    this._plane.renderOrder = 1;
    this._plane.visible = false;

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

    // ── Base glow ellipse (flat on card) ─────────────────────────────────────
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

    // ── Scan ring (sonar-ping on card surface) ───────────────────────────────
    // RingGeometry lies in the XY plane by default — in anchor.group space
    // that means it sits flat on the card facing the camera (+Z = toward camera).
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
    // Reset the smoothed billboard quaternion so it doesn't carry stale
    // rotation from a previous detection (would cause a sweep on re-detect).
    const sc = this._scratch;
    const camera = this._mindarThree.camera;

    this._anchor.group.getWorldPosition(sc.anchorPos);
    camera.getWorldPosition(sc.camPos);
    sc.towardCam.subVectors(sc.camPos, sc.anchorPos);
    if (sc.towardCam.lengthSq() > 0.0001) {
      sc.towardCam.normalize();
      sc.smoothBillboardQuat.setFromUnitVectors(sc.FWD, sc.towardCam);
    }

    this._playWithAudio();
    animateTargetFound(
      this._plane, this._glow, this._scanRing, this._rimGlow, PLANE_REST_Z
    );
  }

  _onTargetLost() {
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
