/**
 * ARExperience.js — Main WebAR orchestrator (production polish build)
 *
 * STABILITY PIPELINE
 * ──────────────────
 * Two layers cooperate so the hologram is steady at rest AND glides on motion:
 *
 *  1. MindAR One-Euro filter — algorithm-level smoothing of raw tracking
 *     (filterMinCF / filterBeta on MindARThree).  Tight cutoff at rest kills
 *     shimmer; high beta opens it on real motion → no swimming / lag.
 *
 *  2. Camera-facing billboard with EMA — the plane's facing direction is
 *     slerped each frame, so it glides toward the viewer rather than snapping.
 *
 * NOTE on a tempting third layer:
 * A post-MindAR anchor-matrix EMA (decompose → lerp/slerp → recompose) was
 * tried but kept breaking visibility on MindAR 1.1.5: any subsequent call to
 * anchor.group.getWorldPosition() / getWorldQuaternion() triggers Three.js
 * updateMatrix(), which recomposes anchor.group.matrix from its identity
 * position/quaternion/scale — wiping both our write AND MindAR's pose.  The
 * plane then renders at scene origin (= camera) and is invisible.  We rely on
 * One-Euro and the billboard EMA instead; the One-Euro pair below is tuned
 * conservatively for that reason.
 *
 * SCENE HIERARCHY (minimalist)
 * ────────────────────────────
 * anchor.group  (MindAR — smoothed in-place each frame)
 *   └─ _plane   (video; billboard quaternion)
 *
 * No rim glow, no base glow, no scan ring — pure video on the card.
 *
 * UX OVERLAY (DOM, sibling of #ar-root)
 * ──────────────────────────────────────
 *   #ar-controls  — bottom-center pill: play/pause, mute, fullscreen
 *   #ar-buffer    — centered ring spinner shown while video stalls
 *   #ar-watermark — bottom-right "Powered by Phygital" (auto-fades)
 *
 * AUTO-QUALITY
 * ────────────
 * Render loop tracks a 60-frame FPS average.  If sustained < 30 fps we drop
 * pixelRatio to 1; if it recovers above 50 fps we restore it to
 * min(devicePixelRatio, 2).  Keeps the video smooth on low-end phones.
 *
 * GLOBAL DEPENDENCIES (loaded via CDN in index.html):
 *   window.MINDAR.IMAGE  — MindARThree + Compiler  (mind-ar@1.1.5 UMD)
 *   window.THREE         — Three.js r149
 * GSAP is bundled via Vite and exposed as window.gsap in main.js.
 */

import { startImageTargetSession } from './imageTargetSession.js';
import { SurfaceTrackingSession, createPlacementReticle } from './surfaceTrackingSession.js';
import { EighthWallSurfaceSession } from './eighthWallSurfaceSession.js';
import { takeGestureEighthWallSession } from './eighthWallGestureBoot.js';
import { animateTargetFound, animateTargetLost, forceHidePlane } from './animations.js';
import { createArEffect } from './effects/index.js';
import { updateLoadingProgress, showError, hideLoading } from '../utils/loadingScreen.js';
import { updateSession } from '../services/campaignLoader.js';
import { isApplePlaybackEngine } from '../utils/platform.js';
import { initGravityTracker, getUpVector } from '../utils/gravity.js';
import { buildLinkOverlay } from './buildLinkOverlay.js';
import { buildHubToggle } from './buildHubToggle.js';
import {
  getScanHintPrefix,
  getScanImageAlt,
  getScanTitle,
  usesImageTarget,
} from '../utils/arTargetCopy.js';
import {
  checkWebXrArSupported,
  requestSurfaceSession,
} from '../utils/webxr.js';
import { resolveSurfaceArBackend } from '../utils/surfaceCapability.js';
import { createSurfaceCoachingOverlay } from './surfaceCoachingOverlay.js';
import {
  markReturnReload,
  hasPendingReturnReload,
  consumeReturnReload,
} from '../utils/arReturnReload.js';

// ─────────────────────────────────────────────────────────────────────────────
// Scene constants
// ─────────────────────────────────────────────────────────────────────────────

// Portrait 9:16 plane — 65 % of card width.
const PLANE_WIDTH  = 0.65;
const PLANE_HEIGHT = PLANE_WIDTH * (16 / 9);   // ≈ 1.156

// ─────────────────────────────────────────────────────────────────────────────
// Smoothing levers — tune to dial responsiveness vs stability.
// Higher α = snappier; lower α = smoother but laggier.
// ─────────────────────────────────────────────────────────────────────────────

// Billboard facing-direction quaternion EMA.  0.18 → 5-frame half-life.
const BILLBOARD_ALPHA = 0.18;

// FPS-aware auto-quality
const FPS_DROP_THRESHOLD    = 30;
const FPS_RESTORE_THRESHOLD = 50;
const FPS_SAMPLE_FRAMES     = 60;
const IOS_FPS_DROP_THRESHOLD = 22;
const IOS_FPS_RESTORE_THRESHOLD = 42;

// ─────────────────────────────────────────────────────────────────────────────
// Surface gating for the hologram base effect
// ─────────────────────────────────────────────────────────────────────────────
// The base effect only makes sense when the card lies on a horizontal surface
// (rings/pillar rising "up" off a table). We dot the card's normal with the
// device-gravity up vector; hysteresis prevents show/hide flicker near the
// threshold. When sensor data is unavailable (iOS permission denied), we
// default to showing the effect.
const SURFACE_ON_DOT   = 0.6;    // card facing up within ~53° → surface mode
const SURFACE_OFF_DOT  = 0.45;   // tilted beyond ~63° → wall/handheld mode
const SURFACE_CHECK_INTERVAL = 10;   // frames between checks

// ─────────────────────────────────────────────────────────────────────────────
const SCAN_OVERLAY_ID = 'ar-scanning-overlay';

export class ARExperience {
  constructor({ container, campaign, sessionId, embedMode = false }) {
    this._container = container;
    this._campaign  = campaign;
    this._sessionId = sessionId;
    this._embedMode = embedMode;
    this._preSessionPromise = null;
    this._coaching = null;
    this._setupScanningOverlay();

    // Three.js / MindAR objects
    this._mindarThree  = null;
    this._anchor       = null;
    this._videoEl      = null;
    this._videoTexture = null;

    // Scene meshes
    this._plane        = null;   // video quad (billboard quaternion each frame)
    this._effect       = null;   // optional hologram base effect (campaign.arEffect)

    // Surface gating state (effect only shows on horizontal surfaces)
    this._targetVisible      = false;
    this._surfaceMode        = true;   // permissive default (no sensor → show)
    this._effectShown        = false;
    this._surfaceCheckFrame  = 0;

    // Pre-allocated render-loop scratch objects
    this._scratch      = null;

    // FPS-aware quality state
    this._fpsLastTs        = 0;
    this._fpsAccum         = 0;
    this._fpsFrames        = 0;
    this._fpsLowStreak     = 0;
    this._fpsHighStreak    = 0;
    this._lowQualityActive = false;
    this._defaultPixelRatio = 1;

    // UX DOM overlays (created in _buildUx)
    this._ui = {
      controls:    null,
      btnPlay:     null,
      btnMute:     null,
      btnFs:       null,
      buffer:      null,
      watermark:   null,
      linkOverlay: null,
      hubToggle:   null,
      _videoListeners: null,
    };

    this._started      = false;
    this._sessionStart = null;
    this._renderLoop   = null;

    // Session pause/resume when tab is hidden or user leaves via links
    this._destroyed       = false;
    this._sessionPaused   = false;
    this._lifecycleBound  = false;
    this._resumeTimer     = null;
    this._resumeInFlight  = null;
    this._pauseTask       = Promise.resolve();
    this._cameraWatchdog  = null;
    this._trackingMode    = 'image';
    this._surfaceSession  = null;
    this._surfaceReticle  = null;
    this._surfaceScene     = null;
    this._surfaceStarting  = false;
    this._surfaceBackend   = null;
    this._preferHighQuality = false;
  }

  _usesImageTarget() {
    return usesImageTarget(this._campaign);
  }

  _getUxRoot() {
    if (this._trackingMode === 'surface') {
      return document.getElementById('ar-dom-overlay') || document.body;
    }
    return document.body;
  }

  _getActiveCamera() {
    if (this._trackingMode === 'surface') {
      if (this._surfaceBackend === 'eighthwall-slam') {
        return window.XR8?.Threejs?.xrScene?.()?.camera || this._surfaceCamera;
      }
      const renderer = this._mindarThree?.renderer;
      if (renderer?.xr?.isPresenting) {
        return renderer.xr.getCamera();
      }
      return this._surfaceCamera;
    }
    return this._mindarThree?.camera;
  }

  _initSurfaceCoaching() {
    const domRoot = document.getElementById('ar-dom-overlay');
    if (!domRoot || this._coaching) return;

    this._coaching = createSurfaceCoachingOverlay({
      domRoot,
      onStartTap: () => this._onCoachingStartTap(),
    });
  }

  _onCoachingStartTap() {
    if (this._surfaceSession || this._surfaceStarting) return;

    if (this._surfaceBackend === 'eighthwall-slam') {
      this._showSurfaceCoaching('scanning');
      this._startEighthWallSession();
      return;
    }

    const domOverlay = document.getElementById('ar-dom-overlay');
    const sessionPromise = requestSurfaceSession(domOverlay);
    this._showSurfaceCoaching('scanning');
    this._startSurfaceSession({ sessionPromise });
  }

  _showSurfaceCoaching(state) {
    this._initSurfaceCoaching();
    this._coaching?.setState(state);
  }

  _syncSurfaceSessionUi(placed) {
    if (this._trackingMode !== 'surface') return;

    this._ui.watermark?.classList.toggle('visible', placed);
    this._ui.hubToggle?.el?.classList.toggle('visible', placed);

    if (!placed) {
      this._ui.linkOverlay?.hide();
    }
  }

  async _startSurfaceSession({ sessionPromise } = {}) {
    if (this._surfaceStarting) return;
    if (this._surfaceSession) return;

    const renderer = this._mindarThree?.renderer;
    const scene = this._surfaceScene;
    const camera = this._surfaceCamera;
    if (!renderer || !scene || !camera) return;

    const promise = sessionPromise || this._preSessionPromise;
    this._preSessionPromise = null;

    this._surfaceStarting = true;

    try {
      this._surfaceSession = new SurfaceTrackingSession({
        renderer,
        scene,
        camera,
        anchorGroup: this._anchor.group,
        reticle: this._surfaceReticle,
        domOverlayRoot: document.getElementById('ar-dom-overlay'),
        THREE: this._THREE,
        onPlaced: () => this._onSurfacePlaced(),
        onRescan: () => this._onSurfaceRescan(),
        onAnimate: (now) => this._animateSurfaceFrame(now, renderer),
        onHitVisibilityChange: (visible) => this._onSurfaceHitVisibilityChange(visible),
      });
      await this._surfaceSession.start({ sessionPromise: promise });
      this._started = true;
      if (!this._sessionStart) {
        this._sessionStart = Date.now();
      }
      this._showSurfaceCoaching('scanning');
    } catch {
      this._surfaceSession = null;
      this._showSurfaceCoaching('starting');
      showError(
        'Could not start surface AR',
        'Allow camera permissions and try again, or switch to Image target mode in your dashboard.'
      );
    } finally {
      this._surfaceStarting = false;
    }
  }

  _onSurfaceHitVisibilityChange(visible) {
    if (this._surfaceSession?.placed) return;
    this._setSurfacePlaceHintVisible(false);
    this._showSurfaceCoaching(visible ? 'ready' : 'scanning');
  }

  _setupScanningOverlay() {
    const imageMode = this._usesImageTarget();
    const scanEl = document.getElementById(SCAN_OVERLAY_ID);
    if (scanEl) scanEl.classList.toggle('mode-hidden', !imageMode);

    const campaignType = this._campaign.campaignType;
    const titleEl = document.getElementById('ar-scan-title');
    if (titleEl) titleEl.textContent = getScanTitle(imageMode);

    const img = document.getElementById('ar-scan-target-img');
    const nameEl = document.getElementById('ar-scan-campaign-name');
    const hintPrefixEl = document.getElementById('ar-scan-hint-prefix');
    const url = this._campaign.targetImageUrl || this._campaign.targetImageOriginalUrl;

    if (imageMode && img && url) {
      img.src = url;
      img.alt = getScanImageAlt(campaignType, this._campaign.campaignName, true);
    }

    if (hintPrefixEl && nameEl) {
      if (imageMode && this._campaign.campaignName) {
        hintPrefixEl.textContent = 'Point your camera at ';
        nameEl.textContent = this._campaign.campaignName;
      } else if (imageMode) {
        hintPrefixEl.textContent = getScanHintPrefix(campaignType, true);
        nameEl.textContent = '';
      }
    }
  }

  _setScanningOverlayVisible(visible) {
    const el = document.getElementById(SCAN_OVERLAY_ID);
    if (!el) return;
    el.classList.toggle('hidden', !visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // boot
  // ───────────────────────────────────────────────────────────────────────────
  async boot({ THREE, preSessionPromise, surfaceBackend } = {}) {
    const three = THREE || window.THREE;
    if (!three && surfaceBackend !== 'eighthwall-slam') {
      throw new Error('Three.js not found');
    }

    if (preSessionPromise) {
      this._preSessionPromise = preSessionPromise;
    }
    if (surfaceBackend) {
      this._surfaceBackend = surfaceBackend;
    }

    this._bindLifecycle();

    if (this._usesImageTarget()) {
      if (!window.MINDAR?.IMAGE?.MindARThree) {
        throw new Error('MindARThree not found. Check CDN scripts in index.html.');
      }
      await this._bootImageTarget(three);
    } else {
      await this._bootSurfaceMode(three);
    }
  }

  async _bootImageTarget(THREE) {
    updateLoadingProgress(5, 'Preparing AR experience…');
    initGravityTracker();

    let session;
    try {
      session = await startImageTargetSession({
        container: this._container,
        campaign: this._campaign,
        THREE,
        onTargetFound: () => this._onTargetFound(),
        onTargetLost: () => this._onTargetLost(),
      });
    } catch (err) {
      showError('Could not calibrate image target.', err.message);
      return;
    }

    this._trackingMode = 'image';
    this._mindarThree = session.mindarThree;
    const { renderer, scene, camera } = session;
    this._anchor = session.anchor;
    this._defaultPixelRatio = session.defaultPixelRatio;
    this._started = true;

    this._buildScene(THREE, renderer);
    this._buildUx();

    this._anchor.group.add(this._plane);
    if (this._effect) this._anchor.group.add(this._effect.group);
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    this._sessionStart = Date.now();
    updateLoadingProgress(100, 'Ready!');
    hideLoading();
    this._setScanningOverlayVisible(true);

    const sc = this._scratch;
    this._renderLoop = (now) => {
      if (this._plane.visible) {
        camera.getWorldPosition(sc.camPos);
        this._anchor.group.getWorldPosition(sc.anchorWorldPos);

        sc.towardCam.subVectors(sc.camPos, sc.anchorWorldPos);
        if (sc.towardCam.lengthSq() > 0.0001) {
          sc.towardCam.normalize();
          sc.billboardWorldQuat.setFromUnitVectors(sc.FWD, sc.towardCam);
          sc.smoothBillboardQuat.slerp(sc.billboardWorldQuat, BILLBOARD_ALPHA);

          this._anchor.group.getWorldQuaternion(sc.parentQuatInv);
          sc.parentQuatInv.invert();
          sc.parentQuatInv.multiply(sc.smoothBillboardQuat);
          this._plane.quaternion.copy(sc.parentQuatInv);
        }
      }

      if (this._effect && this._targetVisible) {
        this._surfaceCheckFrame += 1;
        if (this._surfaceCheckFrame >= SURFACE_CHECK_INTERVAL) {
          this._surfaceCheckFrame = 0;
          this._evaluateSurfaceMode();
          this._syncEffectVisibility();
        }
      }

      this._effect?.update(now ?? performance.now());

      if (
        this._videoTexture &&
        this._videoEl?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        this._videoTexture.needsUpdate = true;
      }

      renderer.render(scene, camera);
      this._sampleFps(now ?? performance.now(), renderer);
    };

    renderer.setAnimationLoop(this._renderLoop);
  }

  async _bootSurfaceMode(THREE) {
    this._THREE = THREE;
    updateLoadingProgress(10, 'Preparing surface AR…');
    initGravityTracker();

    if (!this._surfaceBackend) {
      this._surfaceBackend = await resolveSurfaceArBackend();
    }

    if (this._surfaceBackend === 'unsupported') {
      showError(
        'Surface mode unavailable',
        'Surface AR needs a phone with a camera. Turn Image target back on in your dashboard, or open this experience on a supported mobile device.',
      );
      return;
    }

    this._trackingMode = 'surface';
    document.body.classList.add('ar-surface-active');

    if (this._surfaceBackend === 'eighthwall-slam') {
      await this._bootEighthWallSurfaceMode();
      return;
    }

    await this._bootWebXrSurfaceMode(THREE);
  }

  async _bootWebXrSurfaceMode(THREE) {
    const supported = await checkWebXrArSupported();
    if (!supported) {
      showError(
        'Surface mode unavailable',
        'WebXR is not available on this device. Try Chrome on Android or use an iPhone with surface mode.'
      );
      return;
    }

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.xr.enabled = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    this._container.appendChild(renderer.domElement);
    this._mindarThree = { renderer };
    this._defaultPixelRatio = renderer.getPixelRatio();

    const scene = new THREE.Scene();
    this._surfaceScene = scene;
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      50
    );
    this._surfaceCamera = camera;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2.5));
    this._buildScene(THREE, renderer);
    this._buildUx();

    this._anchor = { group: new THREE.Group() };
    scene.add(this._anchor.group);
    this._anchor.group.add(this._plane);
    if (this._effect) this._anchor.group.add(this._effect.group);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    this._surfaceReticle = createPlacementReticle(THREE);
    scene.add(this._surfaceReticle);

    this._initSurfaceCoaching();

    updateLoadingProgress(100, 'Ready!');
    hideLoading();

    if (this._preSessionPromise) {
      await this._startSurfaceSession({ sessionPromise: this._preSessionPromise });
    } else {
      this._showSurfaceCoaching('starting');
    }
  }

  async _bootEighthWallSurfaceMode() {
    this._initSurfaceCoaching();
    this._showSurfaceCoaching('scanning');
    updateLoadingProgress(40, 'Starting camera…');

    try {
      await this._startEighthWallSession();
      updateLoadingProgress(100, 'Ready!');
      hideLoading();
      this._started = true;
      if (!this._sessionStart) {
        this._sessionStart = Date.now();
      }
    } catch {
      showError(
        'Could not start surface AR',
        'Allow camera access and try again, or switch to Image target mode in your dashboard.'
      );
    }
  }

  async _startEighthWallSession() {
    if (this._surfaceStarting) return;
    if (this._surfaceSession) return;

    this._surfaceStarting = true;

    const sceneCallbacks = {
      onPlaced: () => this._onSurfacePlaced(),
      onRescan: () => this._onSurfaceRescan(),
      onAnimate: (now) => this._animateEighthWallFrame(now),
      onHitVisibilityChange: (visible) => this._onSurfaceHitVisibilityChange(visible),
      onSceneReady: async ({ scene, camera, renderer, THREE }) => {
        this._THREE = THREE;
        this._surfaceScene = scene;
        this._surfaceCamera = camera;
        this._mindarThree = { renderer };
        this._preferHighQuality = isApplePlaybackEngine();
        if (renderer?.setPixelRatio) {
          const targetRatio = Math.min(window.devicePixelRatio || 1, this._preferHighQuality ? 2.25 : 2);
          renderer.setPixelRatio(targetRatio);
        }
        this._defaultPixelRatio = renderer.getPixelRatio?.()
          ?? Math.min(window.devicePixelRatio, 2);

        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2.5));
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        this._anchor = { group: new THREE.Group() };
        this._buildScene(THREE, renderer);
        this._anchor.group.add(this._plane);
        if (this._effect) this._anchor.group.add(this._effect.group);

        const reticle = createPlacementReticle(THREE);
        this._surfaceReticle = reticle;

        this._buildUx();
        this._showSurfaceCoaching('scanning');

        return {
          anchorGroup: this._anchor.group,
          reticle,
        };
      },
    };

    try {
      const gestureSession = takeGestureEighthWallSession();
      if (gestureSession) {
        gestureSession.bindCallbacks(sceneCallbacks);
        this._surfaceSession = gestureSession;
        await gestureSession.waitForSceneReady();
      } else {
        this._surfaceSession = new EighthWallSurfaceSession({
          container: this._container,
          ...sceneCallbacks,
        });
        await this._surfaceSession.start();
      }
    } catch (err) {
      this._surfaceSession = null;
      throw err;
    } finally {
      this._surfaceStarting = false;
    }
  }

  _animateSurfaceFrame(now, renderer) {
    if (this._plane.visible && this._surfaceSession?.placed) {
      const sc = this._scratch;
      const cam = renderer.xr.getCamera();
      this._billboardPlaneTowardCamera(cam, sc);
    }

    if (this._effect && this._targetVisible) {
      this._effect.update(now ?? performance.now());
    }

    if (
      this._videoTexture &&
      this._videoEl?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      this._videoTexture.needsUpdate = true;
    }
  }

  _animateEighthWallFrame(now) {
    if (this._plane.visible && this._surfaceSession?.placed) {
      const sc = this._scratch;
      const cam = this._getActiveCamera();
      if (cam) {
        this._billboardPlaneTowardCamera(cam, sc);
      }
    }

    if (this._effect && this._targetVisible) {
      this._effect.update(now ?? performance.now());
    }

    if (
      this._videoTexture &&
      this._videoEl?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      this._videoTexture.needsUpdate = true;
    }
  }

  _billboardPlaneTowardCamera(cam, sc) {
    cam.getWorldPosition(sc.camPos);
    this._anchor.group.getWorldPosition(sc.anchorWorldPos);
    sc.towardCam.subVectors(sc.camPos, sc.anchorWorldPos);
    if (sc.towardCam.lengthSq() > 0.0001) {
      sc.towardCam.normalize();
      sc.billboardWorldQuat.setFromUnitVectors(sc.FWD, sc.towardCam);
      sc.smoothBillboardQuat.slerp(sc.billboardWorldQuat, BILLBOARD_ALPHA);
      this._anchor.group.getWorldQuaternion(sc.parentQuatInv);
      sc.parentQuatInv.invert();
      sc.parentQuatInv.multiply(sc.smoothBillboardQuat);
      this._plane.quaternion.copy(sc.parentQuatInv);
    }
  }

  _setSurfacePlaceHintVisible(visible) {
    const el = document.getElementById('ar-surface-place-hint');
    if (!el) return;
    el.classList.toggle('visible', visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  _onSurfacePlaced() {
    this._setSurfacePlaceHintVisible(false);
    this._showSurfaceCoaching('placed');
    this._onTargetFound();
  }

  _onSurfaceRescan() {
    if (this._surfaceBackend === 'eighthwall-slam' && this._surfaceSession) {
      this._surfaceSession.resetPlacement();
      this._prepareForRescan();
      this._showSurfaceCoaching('scanning');
      return;
    }

    this._surfaceSession = null;
    this._started = false;
    this._prepareForRescan();
    this._showSurfaceCoaching('starting');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // _buildScene — creates the video plane only; boot() adds it to anchor.group
  // ───────────────────────────────────────────────────────────────────────────
  _buildScene(THREE, renderer) {
    this._scratch = {
      // Billboard
      camPos:              new THREE.Vector3(),
      anchorWorldPos:      new THREE.Vector3(),
      towardCam:           new THREE.Vector3(),
      billboardWorldQuat:  new THREE.Quaternion(),
      smoothBillboardQuat: new THREE.Quaternion(),
      parentQuatInv:       new THREE.Quaternion(),
      FWD:                 new THREE.Vector3(0, 0, 1),
      // Surface gating
      cardNormal:          new THREE.Vector3(),
      anchorQuat:          new THREE.Quaternion(),
    };

    // ── Pick the right source per platform ──────────────────────────────────
    //
    // iOS Safari black-bg workaround:
    //   Apple WebKit ignores the alpha channel on transparent .webm / .mov
    //   when <video> is composited over the AR camera feed. The campaign
    //   ships a second upload (`videoUrlIos`) — a regular H.264 .mov with
    //   RGB on the LEFT half of every frame and the alpha mask (as a
    //   grayscale image) on the RIGHT half. We feed that side-by-side
    //   texture into a ShaderMaterial that recombines the two halves into
    //   a real RGBA fragment. Everywhere else (Android Chrome, desktop)
    //   the native WebM alpha path is already working, so we keep it.
    //
    // If a campaign was created before this feature shipped (no iOS upload
    // available), iOS falls back to the WebM and accepts the platform's
    // black-bg limitation rather than failing the experience entirely.
    const wantsIosShader =
      isApplePlaybackEngine() && !!this._campaign.videoUrlIos;
    this._iosShaderActive = wantsIosShader;
    const sourceUrl = wantsIosShader
      ? this._campaign.videoUrlIos
      : this._campaign.videoUrl;

    // ── Off-screen video element ─────────────────────────────────────────────
    this._videoEl = document.createElement('video');
    Object.assign(this._videoEl, {
      src:         sourceUrl,
      loop:        true,
      muted:       true,      // unmuted later in _onTargetFound
      playsInline: true,
      crossOrigin: 'anonymous',   // required so the texture upload isn't tainted on iOS
      preload:     'auto',
    });
    this._videoEl.setAttribute('webkit-playsinline', 'true');
    this._videoEl.disableRemotePlayback = true;
    this._videoEl.style.display = 'none';
    document.body.appendChild(this._videoEl);
    this._videoEl.load();

    // ── Video texture ────────────────────────────────────────────────────────
    this._videoTexture = new THREE.VideoTexture(this._videoEl);
    this._videoTexture.minFilter = THREE.LinearFilter;
    this._videoTexture.magFilter = THREE.LinearFilter;
    this._videoTexture.generateMipmaps = false;
    // MeshBasicMaterial relies on Three's built-in sRGB → linear shader
    // chunk; the iOS ShaderMaterial does the same conversion manually in
    // its fragment shader. Either way we want the texture flagged as
    // LinearEncoding in the iOS path so the engine doesn't try to apply
    // its own encoding step on top of ours.
    this._videoTexture.encoding = wantsIosShader
      ? THREE.LinearEncoding
      : THREE.sRGBEncoding;
    const maxAniso = renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
    this._videoTexture.anisotropy = Math.min(8, maxAniso);

    // ── Video plane (billboard — render loop sets quaternion each frame) ─────
    // Geometry is translated so the mesh origin is the BOTTOM EDGE of the
    // plane, not its centre. Two wins:
    //   • the billboard quaternion pivots around the base, so the video's
    //     bottom edge stays glued to the anchor origin (where the hologram
    //     base effect sits) in every orientation — no more drift;
    //   • the entrance animation is a pure scale.y 0→1 (no position.z
    //     driving needed to keep the bottom edge on the card surface).
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT);
    planeGeo.translate(0, PLANE_HEIGHT / 2, 0);
    const planeMat = wantsIosShader
      ? this._buildSideBySideAlphaMaterial(THREE, this._videoTexture)
      : new THREE.MeshBasicMaterial({
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

    // ── Hologram base effect (campaign-selected, default none) ───────────────
    // Built once at boot — show()/hide() on detection only toggles visibility
    // and tweens opacity, so re-detection has zero allocation/decode delay.
    this._effect = createArEffect(this._campaign.arEffect, THREE);
  }

  /**
   * _buildSideBySideAlphaMaterial — iOS-only ShaderMaterial.
   *
   * The source texture is laid out as `[ RGB | ALPHA_MASK ]` horizontally:
   *   • The LEFT half (uv.x ∈ [0, 0.5]) holds the colour image.
   *   • The RIGHT half (uv.x ∈ [0.5, 1]) holds a grayscale alpha mask;
   *     darker pixels = more transparent, white pixels = fully opaque.
   *
   * We sample the texture twice per fragment, remap the UV.x range so the
   * plane shows only the left (visible) half, then write the mask's red
   * channel as the alpha output.  `opacity` is exposed as a uniform so
   * the GSAP entrance/exit tweens (which mutate `material.opacity`) keep
   * working unchanged.
   *
   * @param {object} THREE
   * @param {THREE.Texture} videoTexture
   * @returns {THREE.ShaderMaterial}
   */
  _buildSideBySideAlphaMaterial(THREE, videoTexture) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        map:     { value: videoTexture },
        opacity: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D map;
        uniform float opacity;
        varying vec2 vUv;

        // sRGB → linear. Matches the conversion MeshBasicMaterial gets for
        // free via Three.js' built-in encoding shader chunks; without it
        // the colour half of the texture looks washed out once the
        // renderer's outputEncoding re-encodes the fragment to sRGB.
        vec3 srgbToLinear(vec3 c) {
          return pow(c, vec3(2.2));
        }

        void main() {
          // Plane UV.x ∈ [0,1] maps to the visible left half of the source;
          // the same y is sampled from the right half for the alpha mask.
          vec2 colorUv = vec2(vUv.x * 0.5, vUv.y);
          vec2 alphaUv = vec2(vUv.x * 0.5 + 0.5, vUv.y);

          vec3 color = srgbToLinear(texture2D(map, colorUv).rgb);
          float alpha = texture2D(map, alphaUv).r;

          // Straight alpha (not premultiplied) — Three.js' default blending
          // expects straight alpha for transparent: true. Multiply by the
          // GSAP-driven opacity uniform so the entrance / exit tweens that
          // mutate material.opacity keep fading the hologram in and out.
          gl_FragColor = vec4(color, alpha * opacity);
        }
      `,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });

    // Mirror MeshBasicMaterial's `material.opacity` API so the existing
    // GSAP tweens in animations.js (which write `material.opacity`) keep
    // working without any per-platform branching there.
    Object.defineProperty(material, 'opacity', {
      configurable: true,
      get() { return this.uniforms.opacity.value; },
      set(v)       { this.uniforms.opacity.value = v; },
    });
    material.opacity = 0;

    return material;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // _buildUx — DOM overlays (controls, buffer spinner, watermark)
  // ───────────────────────────────────────────────────────────────────────────
  _buildUx() {
    const uxRoot = this._getUxRoot();

    // Controls pill (hidden until target is found for the first time)
    const controls = document.createElement('div');
    controls.id = 'ar-controls';
    controls.innerHTML = `
      <button class="ar-ctrl" data-action="play"  aria-label="Play / pause">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path class="icon-pause" fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/>
          <path class="icon-play"  fill="currentColor" d="M8 5v14l11-7z" style="display:none"/>
        </svg>
      </button>
      <button class="ar-ctrl" data-action="mute" aria-label="Mute / unmute">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path class="icon-vol"  fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06A7 7 0 0 1 14 18.7v2.06A9 9 0 0 0 14 3.23z"/>
          <path class="icon-mute" fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm15.59 2L21 9.59 19.59 8.17 17.17 10.59 14.76 8.17 13.34 9.59 15.76 12l-2.42 2.41 1.42 1.42 2.41-2.42 2.42 2.42L21 14.41z" style="display:none"/>
        </svg>
      </button>
      <button class="ar-ctrl" data-action="fullscreen" aria-label="Fullscreen">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path class="icon-expand" fill="currentColor" d="M5 5h5V3H3v7h2zm9-2v2h5v5h2V3zM5 19v-5H3v7h7v-2zm14 0h-5v2h7v-7h-2z"/>
          <path class="icon-compress" fill="currentColor" d="M8 3v3H5V3zm8 0h3v3h-3zM8 21v-3H5v3zm8 0h3v-3h-3z" style="display:none"/>
        </svg>
      </button>
    `;
    uxRoot.appendChild(controls);

    const btnPlay = controls.querySelector('[data-action="play"]');
    const btnMute = controls.querySelector('[data-action="mute"]');
    const btnFs   = controls.querySelector('[data-action="fullscreen"]');

    btnPlay.addEventListener('click', () => this._togglePlayPause());
    btnMute.addEventListener('click', () => this._toggleMute());
    btnFs.addEventListener('click',   () => this._toggleFullscreen());

    // Buffer spinner (hidden by default)
    const buffer = document.createElement('div');
    buffer.id = 'ar-buffer';
    buffer.innerHTML = '<div class="ar-buffer-ring"></div>';
    uxRoot.appendChild(buffer);

    // Watermark with brand mark
    const watermark = document.createElement('div');
    watermark.id = 'ar-watermark';
    watermark.innerHTML = `
      <img src="/phygital-mark.png" alt="" class="ar-watermark-mark" width="16" height="16" />
      <span>Powered by Phygital</span>
    `;
    uxRoot.appendChild(watermark);
    if (this._trackingMode === 'surface') {
      watermark.classList.remove('visible');
    } else {
      watermark.classList.add('visible');
    }

    this._ui.controls  = controls;
    this._ui.btnPlay   = btnPlay;
    this._ui.btnMute   = btnMute;
    this._ui.btnFs     = btnFs;
    this._ui.buffer    = buffer;
    this._ui.watermark = watermark;

    // Buffer state listeners on the video element
    const onWaiting = () => this._ui.buffer.classList.add('visible');
    const onPlaying = () => this._ui.buffer.classList.remove('visible');
    const onCanPlay = () => this._ui.buffer.classList.remove('visible');
    const onStalled = () => this._ui.buffer.classList.add('visible');
    this._videoEl.addEventListener('waiting', onWaiting);
    this._videoEl.addEventListener('playing', onPlaying);
    this._videoEl.addEventListener('canplay', onCanPlay);
    this._videoEl.addEventListener('stalled', onStalled);
    this._videoEl.addEventListener('play',    () => this._refreshPlayIcon());
    this._videoEl.addEventListener('pause',   () => this._refreshPlayIcon());
    this._videoEl.addEventListener('volumechange', () => this._refreshMuteIcon());

    this._ui._videoListeners = { onWaiting, onPlaying, onCanPlay, onStalled };

    const onFullscreenChange = () => this._refreshFsIcon();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    this._ui._fsListeners = { onFullscreenChange };

    this._refreshFsIcon();

    const markForReturnReload = () => {
      markReturnReload(this._campaign._id, this._sessionId);
    };

    const uxOverlay = this._trackingMode === 'surface'
      ? document.getElementById('ar-dom-overlay')
      : null;

    this._ui.hubToggle = buildHubToggle(
      this._campaign.hubPageUrl,
      markForReturnReload,
      uxOverlay
    );
    this._ui.linkOverlay = buildLinkOverlay({
      links: this._campaign.links,
      redirectSlug: this._campaign.redirectSlug,
      videoEl: this._videoEl,
      onBeforeLeave: markForReturnReload,
      parent: uxOverlay,
    });

    if (this._trackingMode === 'surface') {
      this._syncSurfaceSessionUi(false);
    } else {
      this._ui.hubToggle?.el?.classList.add('visible');
    }

  }

  // ───────────────────────────────────────────────────────────────────────────
  // FPS sampling for auto-quality
  // ───────────────────────────────────────────────────────────────────────────
  _sampleFps(nowMs, renderer) {
    if (!this._fpsLastTs) {
      this._fpsLastTs = nowMs;
      return;
    }
    const dt = nowMs - this._fpsLastTs;
    this._fpsLastTs = nowMs;
    if (dt <= 0 || dt > 1000) return;   // ignore tab-switch spikes

    this._fpsAccum  += dt;
    this._fpsFrames += 1;

    if (this._fpsFrames < FPS_SAMPLE_FRAMES) return;

    const avgDt = this._fpsAccum / this._fpsFrames;
    const fps   = 1000 / avgDt;
    this._fpsAccum = 0;
    this._fpsFrames = 0;

    const dropThreshold = this._preferHighQuality
      ? IOS_FPS_DROP_THRESHOLD
      : FPS_DROP_THRESHOLD;
    const restoreThreshold = this._preferHighQuality
      ? IOS_FPS_RESTORE_THRESHOLD
      : FPS_RESTORE_THRESHOLD;

    if (fps < dropThreshold) {
      this._fpsLowStreak  += 1;
      this._fpsHighStreak  = 0;
    } else if (fps > restoreThreshold) {
      this._fpsHighStreak += 1;
      this._fpsLowStreak   = 0;
    } else {
      this._fpsLowStreak   = 0;
      this._fpsHighStreak  = 0;
    }

    if (!this._lowQualityActive && this._fpsLowStreak >= 1) {
      renderer.setPixelRatio(1);
      this._lowQualityActive = true;
    } else if (this._lowQualityActive && this._fpsHighStreak >= 1) {
      renderer.setPixelRatio(this._defaultPixelRatio);
      this._lowQualityActive = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Surface gating — base effect only on horizontal surfaces
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Updates `this._surfaceMode` from the card-normal · gravity-up dot product
   * with hysteresis. Without sensor data (`getUpVector()` null) we stay
   * permissive and treat the card as on a surface.
   */
  _evaluateSurfaceMode() {
    const up = getUpVector();
    if (!up) {
      this._surfaceMode = true;
      return;
    }

    const sc = this._scratch;
    this._anchor.group.getWorldQuaternion(sc.anchorQuat);
    sc.cardNormal.set(0, 0, 1).applyQuaternion(sc.anchorQuat);
    const dot = sc.cardNormal.x * up.x + sc.cardNormal.y * up.y + sc.cardNormal.z * up.z;

    if (this._surfaceMode) {
      if (dot < SURFACE_OFF_DOT) this._surfaceMode = false;
    } else if (dot > SURFACE_ON_DOT) {
      this._surfaceMode = true;
    }
  }

  /** Shows/hides the base effect to match tracking + surface state. */
  _syncEffectVisibility() {
    if (!this._effect) return;
    const shouldShow = this._targetVisible && this._surfaceMode;
    if (shouldShow && !this._effectShown) {
      this._effect.show();
      this._effectShown = true;
    } else if (!shouldShow && this._effectShown) {
      this._effect.hide();
      this._effectShown = false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ───────────────────────────────────────────────────────────────────────────
  _onTargetFound() {
    this._setScanningOverlayVisible(false);

    const sc = this._scratch;
    const camera = this._getActiveCamera();
    if (camera) {
      this._anchor.group.getWorldPosition(sc.anchorWorldPos);
      camera.getWorldPosition(sc.camPos);
      sc.towardCam.subVectors(sc.camPos, sc.anchorWorldPos);
      if (sc.towardCam.lengthSq() > 0.0001) {
        sc.towardCam.normalize();
        sc.smoothBillboardQuat.setFromUnitVectors(sc.FWD, sc.towardCam);
      }
    }

    this._playWithAudio();
    animateTargetFound(this._plane);

    // Base effect rises alongside the video entrance — same tick, same anchor
    // pose, so they always appear together and stay aligned. Only shown when
    // the card lies on a horizontal surface (gravity check, permissive when
    // sensor data is unavailable).
    this._targetVisible = true;
    this._surfaceCheckFrame = 0;
    if (this._effect) {
      this._evaluateSurfaceMode();
      this._syncEffectVisibility();
    }

    // Reveal the controls overlay (after the entrance has started)
    this._ui.controls?.classList.add('visible');
    this._syncSurfaceSessionUi(true);
    if (this._trackingMode !== 'surface') {
      this._ui.hubToggle?.el?.classList.add('visible');
    }
  }

  _onTargetLost() {
    this._prepareForRescan();
    // Keep controls visible — user may want to keep using them; spinner hides
    this._ui.buffer?.classList.remove('visible');
  }

  /**
   * Reset UI/video to scanning state so MindAR can re-acquire the target.
   */
  _prepareForRescan() {
    if (this._trackingMode === 'surface') {
      this._setScanningOverlayVisible(false);
      this._syncSurfaceSessionUi(false);
      if (!this._surfaceSession?.placed) {
        this._showSurfaceCoaching('starting');
      }
    } else {
      this._setScanningOverlayVisible(true);
    }

    if (this._plane?.visible) {
      animateTargetLost(this._plane);
    }
    this._targetVisible = false;
    this._syncEffectVisibility();
    this._videoEl?.pause();
    this._ui.buffer?.classList.remove('visible');
    this._ui.linkOverlay?.hide();
    this._refreshPlayIcon();
  }

  /**
   * Hard-reset the 3D scene when pausing — prevents a floating effect on a
   * black screen while the camera stream is dead.
   */
  _forceHideScene() {
    forceHidePlane(this._plane);
    this._targetVisible = false;
    if (this._effect) {
      this._effect.forceHide();
      this._effectShown = false;
    }
    this._ui.controls?.classList.remove('visible');
    this._ui.linkOverlay?.hide();
    this._ui.buffer?.classList.remove('visible');
  }

  _markForReturnReload() {
    markReturnReload(this._campaign._id, this._sessionId);
  }

  _hasPendingReturnReload() {
    return hasPendingReturnReload(this._campaign._id, this._sessionId);
  }

  /** Full page reload when the user returns from a social/hub link. */
  _tryReturnReload() {
    if (this._destroyed || !this._hasPendingReturnReload()) return false;
    this._forceHideScene();
    return consumeReturnReload(this._campaign._id, this._sessionId);
  }

  _isCameraFeedActive() {
    const video = this._container?.querySelector('video');
    return !!(video && video.readyState >= 2 && video.videoWidth > 0);
  }

  _clearCameraWatchdog() {
    if (this._cameraWatchdog) {
      clearTimeout(this._cameraWatchdog);
      this._cameraWatchdog = null;
    }
  }

  _watchCameraRecovery() {
    this._clearCameraWatchdog();
    this._cameraWatchdog = setTimeout(() => {
      this._cameraWatchdog = null;
      if (!this._destroyed && !this._isCameraFeedActive()) {
        window.location.reload();
      }
    }, 2500);
  }

  _reloadIfPendingReturn() {
    return this._tryReturnReload();
  }

  /**
   * Stop MindAR and release the camera when the page is hidden or the user
   * navigates away (link tap, hub, home button).
   */
  _pauseSession() {
    if (this._destroyed || !this._mindarThree || this._sessionPaused) return;
    // If the user opened an external link, never resume into a dead camera —
    // a full reload will run when they come back.
    if (this._hasPendingReturnReload()) return;

    this._sessionPaused = true;
    this._clearCameraWatchdog();
    if (this._resumeTimer) {
      clearTimeout(this._resumeTimer);
      this._resumeTimer = null;
    }

    if (this._trackingMode === 'image') {
      this._setScanningOverlayVisible(true);
    }
    this._forceHideScene();
    this._videoEl?.pause();
    this._refreshPlayIcon();

    this._pauseTask = (async () => {
      if (this._trackingMode === 'surface' && this._surfaceSession) {
        try {
          await this._surfaceSession.destroy();
        } catch {
          // ignore
        }
        this._surfaceSession = null;
        this._started = false;
        this._showSurfaceCoaching('starting');
        return;
      }
      if (!this._started || !this._mindarThree?.stop) return;
      try {
        await this._mindarThree.stop();
      } catch {
        // ignore — camera may already be stopped by the OS
      }
      this._started = false;
    })();
  }

  _scheduleResume() {
    if (this._destroyed || !this._sessionPaused) return;
    if (this._tryReturnReload()) return;
    if (this._hasPendingReturnReload()) return;
    if (this._resumeTimer) clearTimeout(this._resumeTimer);
    // Brief delay lets mobile browsers restore the camera after tab focus.
    this._resumeTimer = setTimeout(() => {
      this._resumeTimer = null;
      this._resumeSession();
    }, 300);
  }

  /**
   * Restart MindAR tracking after the tab becomes visible again.
   */
  async _resumeSession() {
    if (this._destroyed || !this._sessionPaused || !this._mindarThree) return;
    if (document.visibilityState === 'hidden') return;
    if (this._tryReturnReload()) return;
    if (this._hasPendingReturnReload()) return;
    if (this._resumeInFlight) return this._resumeInFlight;

    this._resumeInFlight = (async () => {
      try {
        await this._pauseTask;
        if (this._destroyed || !this._sessionPaused) return;
        if (document.visibilityState === 'hidden') return;
        if (this._tryReturnReload()) return;
        if (this._hasPendingReturnReload()) return;

        this._prepareForRescan();

        if (this._trackingMode === 'surface') {
          if (this._surfaceBackend === 'eighthwall-slam') {
            this._sessionPaused = false;
            this._showSurfaceCoaching('scanning');
            await this._startEighthWallSession();
            return;
          }
          this._showSurfaceCoaching('starting');
          this._sessionPaused = false;
          this._started = false;
          return;
        }

        await this._mindarThree.start();
        this._started = true;
        this._sessionPaused = false;

        if (this._renderLoop && this._mindarThree.renderer) {
          this._mindarThree.renderer.setAnimationLoop(this._renderLoop);
        }

        this._watchCameraRecovery();
      } catch {
        // Camera failed to restart — full reload is the reliable fallback.
        window.location.reload();
      } finally {
        this._resumeInFlight = null;
      }
    })();

    return this._resumeInFlight;
  }

  _bindLifecycle() {
    if (this._lifecycleBound) return;
    this._lifecycleBound = true;

    this._onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this._pauseSession();
      } else if (!this._tryReturnReload()) {
        this._scheduleResume();
      }
    };

    this._onPageShow = (event) => {
      if (event.persisted) {
        window.location.reload();
        return;
      }
      if (this._tryReturnReload()) return;
      if (this._sessionPaused) {
        this._scheduleResume();
      }
    };

    this._onPageHide = () => {
      this._pauseSession();
    };

    this._onWindowFocus = () => {
      if (this._tryReturnReload()) return;
      if (this._sessionPaused) {
        this._scheduleResume();
      }
    };

    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('pageshow', this._onPageShow);
    window.addEventListener('pagehide', this._onPageHide);
    window.addEventListener('focus', this._onWindowFocus);
  }

  _unbindLifecycle() {
    if (!this._lifecycleBound) return;
    this._lifecycleBound = false;

    this._clearCameraWatchdog();
    if (this._resumeTimer) {
      clearTimeout(this._resumeTimer);
      this._resumeTimer = null;
    }

    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('pageshow', this._onPageShow);
    window.removeEventListener('pagehide', this._onPageHide);
    window.removeEventListener('focus', this._onWindowFocus);
  }

  /**
   * Attempts to play the video unmuted.  Falls back to muted on iOS Safari;
   * the user can tap the mute button in the controls pill to enable audio.
   */
  _playWithAudio() {
    const v = this._videoEl;
    if (!v) return;

    v.muted = false;
    v.play().then(() => {
      this._refreshMuteIcon();
    }).catch(() => {
      v.muted = true;
      v.play().catch(() => {});
      this._refreshMuteIcon();
    });
  }

  _togglePlayPause() {
    const v = this._videoEl;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }

  _toggleMute() {
    const v = this._videoEl;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.paused) v.play().catch(() => {});
  }

  _toggleFullscreen() {
    const root = document.documentElement;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
    this._refreshFsIcon();
  }

  _isFullscreenActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  _refreshFsIcon() {
    const btn = this._ui.btnFs;
    if (!btn) return;
    const active = this._isFullscreenActive();
    btn.querySelector('.icon-expand').style.display = active ? 'none' : '';
    btn.querySelector('.icon-compress').style.display = active ? '' : 'none';
    btn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Fullscreen');
  }

  _refreshPlayIcon() {
    const v = this._videoEl;
    const btn = this._ui.btnPlay;
    if (!v || !btn) return;
    const playing = !v.paused && !v.ended;
    btn.querySelector('.icon-pause').style.display = playing ? '' : 'none';
    btn.querySelector('.icon-play').style.display  = playing ? 'none' : '';
  }

  _refreshMuteIcon() {
    const v = this._videoEl;
    const btn = this._ui.btnMute;
    if (!v || !btn) return;
    btn.querySelector('.icon-vol').style.display  = v.muted ? 'none' : '';
    btn.querySelector('.icon-mute').style.display = v.muted ? '' : 'none';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // destroy
  // ───────────────────────────────────────────────────────────────────────────
  async destroy() {
    this._destroyed = true;
    document.body.classList.remove('ar-surface-active');
    this._unbindLifecycle();

    if (this._sessionStart) {
      updateSession(
        this._campaign._id,
        Date.now() - this._sessionStart,
        this._getVideoWatchPercent(),
        this._campaign.redirectSlug
      );
    }
    if (this._mindarThree?.renderer) {
      this._mindarThree.renderer.setAnimationLoop(null);
    }
    if (this._surfaceSession) {
      await this._surfaceSession.destroy();
      this._surfaceSession = null;
    }
    if (this._started && this._mindarThree?.stop) {
      await this._mindarThree.stop();
    }

    // Detach video listeners
    const v = this._videoEl;
    const ls = this._ui._videoListeners;
    if (v && ls) {
      v.removeEventListener('waiting', ls.onWaiting);
      v.removeEventListener('playing', ls.onPlaying);
      v.removeEventListener('canplay', ls.onCanPlay);
      v.removeEventListener('stalled', ls.onStalled);
    }
    if (v) {
      v.pause();
      v.remove();
    }

    const fs = this._ui._fsListeners;
    if (fs) {
      document.removeEventListener('fullscreenchange', fs.onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', fs.onFullscreenChange);
    }

    this._videoTexture?.dispose();
    this._effect?.dispose();

    this._coaching?.destroy();
    this._coaching = null;

    // Remove DOM overlays
    this._ui.linkOverlay?.destroy();
    this._ui.hubToggle?.destroy();
    this._ui.controls?.remove();
    this._ui.buffer?.remove();
    this._ui.watermark?.remove();
  }

  _getVideoWatchPercent() {
    const v = this._videoEl;
    if (!v || !v.duration) return 0;
    return Math.round((v.currentTime / v.duration) * 100);
  }
}
