/**
 * ARExperience.js — Main WebAR orchestrator
 *
 * STABILITY & 360° VIEWING APPROACH
 * ───────────────────────────────────
 * Three layers work together to eliminate jitter and make the video plane
 * stable from any viewing angle:
 *
 *  1. MindAR One-Euro filter  — smooths the raw tracking output at the
 *     algorithm level (filterMinCF / filterBeta params on MindARThree).
 *
 *  2. EMA wrapper (_smoothGroup) — a scene-space Group that lerps/slerps
 *     toward the anchor's world transform every frame.  This second
 *     smoothing pass absorbs residual micro-jitter without adding visible
 *     lag on normal card movement.
 *
 *  3. Camera-facing billboard — the video plane's quaternion is recomputed
 *     every frame so its +Z axis points toward the camera.  The content
 *     always faces the viewer regardless of which angle they approach the
 *     card from; it will never go edge-on.
 *
 * SCENE HIERARCHY
 * ───────────────
 * scene
 *   └─ _smoothGroup          ← EMA of anchor world pos/quat (scene space)
 *        ├─ _rimGlow          ← 10 % larger additive plane; renderOrder 0
 *        └─ _plane            ← video mesh; billboard quaternion; renderOrder 1
 *
 * anchor.group  (MindAR — XY = card surface, +Z toward camera)
 *   ├─ _glow                 ← flat base ellipse on card
 *   └─ _scanRing             ← sonar-ping ring on card
 *
 * COORDINATE NOTE
 * ───────────────
 * With the billboard, the plane no longer needs rotation.x = Math.PI/2.
 * The render loop sets the plane's local quaternion (relative to _smoothGroup)
 * so that its world +Z always points at the camera.  scale.y still controls
 * the apparent height in screen space, and position.z (in _smoothGroup /
 * anchor space) pushes the centre toward the camera — giving the "emerge
 * from card surface" feel without being edge-on from any direction.
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

// The plane centre is offset PLANE_REST_Z units toward the camera from the
// card when fully emerged.  With billboard, this makes the hologram "hover"
// in front of the card rather than sitting flat on it.
export const PLANE_REST_Z = PLANE_HEIGHT / 2;  // ≈ 0.578

// Base glow ellipse dimensions (flat on card)
const GLOW_W = PLANE_WIDTH * 1.5;
const GLOW_H = 0.06;

// EMA smoothing factor applied each frame.
// 0.12 ≈ 7-frame half-life at 60 fps — snappy on fast moves, smooth at rest.
const SMOOTH_ALPHA = 0.12;

// ─────────────────────────────────────────────────────────────────────────────
export class ARExperience {
  constructor({ container, campaign }) {
    this._container = container;
    this._campaign  = campaign;

    // Three.js / MindAR objects
    this._mindarThree  = null;
    this._anchor       = null;   // stored so the render loop can read world pos
    this._videoEl      = null;
    this._videoTexture = null;

    // Scene meshes
    this._smoothGroup  = null;   // EMA wrapper (scene space)
    this._plane        = null;   // video quad (billboard)
    this._rimGlow      = null;   // edge bloom behind plane (billboard sibling)
    this._glow         = null;   // base ellipse on card surface
    this._scanRing     = null;   // sonar-ping ring on card surface

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

      // One-Euro filter — slightly relaxed vs. the old (0.001 / 0.001) values.
      // Our EMA layer in the render loop handles residual micro-jitter, so
      // these params can afford a touch more responsiveness on fast moves.
      filterMinCF:    0.002,
      filterBeta:     0.005,

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

    // 3 — Build scene objects (also initialises this._scratch)
    this._buildScene(THREE, scene, renderer);

    // 4 — Wire anchor events
    const anchor = this._mindarThree.addAnchor(0);
    this._anchor = anchor;
    anchor.onTargetFound = () => this._onTargetFound();
    anchor.onTargetLost  = () => this._onTargetLost();

    // _plane and _rimGlow are children of _smoothGroup (scene space).
    // _glow and _scanRing sit flat ON the card in anchor space.
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
      //    Only update while actively tracking (prevents drift on target lost).
      if (this._tracking) {
        this._anchor.group.getWorldPosition(sc.anchorPos);
        this._anchor.group.getWorldQuaternion(sc.anchorQuat);
        this._smoothGroup.position.lerp(sc.anchorPos, SMOOTH_ALPHA);
        this._smoothGroup.quaternion.slerp(sc.anchorQuat, SMOOTH_ALPHA);
      }

      // 2. Billboard: make plane (and rimGlow) always face the camera.
      //    Computed in _smoothGroup local space to play nicely with the EMA.
      if (this._plane.visible) {
        camera.getWorldPosition(sc.camPos);
        this._smoothGroup.getWorldPosition(sc.smoothPos);

        sc.towardCam.subVectors(sc.camPos, sc.smoothPos);
        if (sc.towardCam.lengthSq() > 0.0001) {
          sc.towardCam.normalize();

          // World quaternion: rotate +Z onto the toward-camera direction
          sc.worldBillboardQuat.setFromUnitVectors(sc.FWD, sc.towardCam);

          // Convert to _smoothGroup local space:
          //   q_local = q_parent^-1 * q_world
          this._smoothGroup.getWorldQuaternion(sc.parentQuatInv);
          sc.parentQuatInv.invert();
          // After .multiply(): sc.parentQuatInv holds q_parent^-1 * q_world
          sc.parentQuatInv.multiply(sc.worldBillboardQuat);

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
      anchorPos:          new THREE.Vector3(),
      anchorQuat:         new THREE.Quaternion(),
      camPos:             new THREE.Vector3(),
      smoothPos:          new THREE.Vector3(),
      towardCam:          new THREE.Vector3(),
      worldBillboardQuat: new THREE.Quaternion(),
      parentQuatInv:      new THREE.Quaternion(),
      FWD:                new THREE.Vector3(0, 0, 1),
    };

    // ── EMA wrapper (scene space) ────────────────────────────────────────────
    this._smoothGroup = new THREE.Group();
    scene.add(this._smoothGroup);

    // ── Off-screen video element ─────────────────────────────────────────────
    this._videoEl = document.createElement('video');
    Object.assign(this._videoEl, {
      src:         this._campaign.videoUrl,
      loop:        true,
      muted:       true,
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
    // No static rotation.x = Math.PI/2 here; the billboard computation in the
    // render loop rotates this plane so its +Z faces the camera every frame.
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
    this._plane.renderOrder = 1;   // renders after rimGlow so video is on top
    this._plane.visible = false;
    this._smoothGroup.add(this._plane);

    // ── Rim glow (edge bloom around video plane) ─────────────────────────────
    // 10 % larger than the video plane; additive purple blend; renderOrder 0
    // so it renders before the video plane.  The protruding 10 % edge
    // (not covered by the opaque video) is visible as a glowing ring.
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
    this._glow.position.set(0, 0, 0.003);  // sits just above card surface
    this._glow.scale.set(0, 1, 1);
    this._glow.visible = false;

    // ── Scan ring (sonar ping on card surface — added to anchor.group in boot) ─
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
    // Snap _smoothGroup to the anchor's current world transform immediately
    // so there is no visible "slide-in" lag on first detection.
    const sc = this._scratch;
    this._anchor.group.getWorldPosition(sc.anchorPos);
    this._anchor.group.getWorldQuaternion(sc.anchorQuat);
    this._smoothGroup.position.copy(sc.anchorPos);
    this._smoothGroup.quaternion.copy(sc.anchorQuat);

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
