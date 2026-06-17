/**
 * imageTargetSession — MindAR image-target bootstrap.
 */

import { compileMindTarget } from './targetCompiler.js';
import { updateLoadingProgress } from '../utils/loadingScreen.js';

const SCAN_OVERLAY_ID = 'ar-scanning-overlay';

/**
 * @param {{
 *   container: HTMLElement,
 *   campaign: object,
 *   THREE: object,
 *   onTargetFound: () => void,
 *   onTargetLost: () => void,
 * }} opts
 */
export const startImageTargetSession = async ({
  container,
  campaign,
  THREE,
  onTargetFound,
  onTargetLost,
}) => {
  let mindBlobUrl;
  try {
    mindBlobUrl = await compileMindTarget(
      campaign.targetImageUrl,
      (pct) => {
        const clamped = Math.min(100, Math.max(0, pct));
        const barPct = 5 + Math.round((clamped / 100) * 80);
        updateLoadingProgress(barPct, `Calibrating target… ${clamped}%`);
      }
    );
  } catch (err) {
    throw new Error(err.message || 'Could not calibrate image target.');
  }

  updateLoadingProgress(88, 'Starting camera…');

  const { MindARThree } = window.MINDAR.IMAGE;
  const mindarThree = new MindARThree({
    container,
    imageTargetSrc: mindBlobUrl,
    maxTrack: 1,
    uiLoading: 'no',
    uiScanning: `#${SCAN_OVERLAY_ID}`,
    uiError: 'no',
    filterMinCF: 0.0001,
    filterBeta: 0.01,
    warmupTolerance: 5,
    missTolerance: 20,
  });

  const { renderer, scene, camera } = mindarThree;

  renderer.setClearColor(0x000000, 0);
  scene.background = null;
  renderer.outputEncoding = THREE.sRGBEncoding;
  const defaultPixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(defaultPixelRatio);
  renderer.physicallyCorrectLights = true;

  const anchor = mindarThree.addAnchor(0);
  anchor.onTargetFound = onTargetFound;
  anchor.onTargetLost = onTargetLost;

  await mindarThree.start();

  return { mindarThree, renderer, scene, camera, anchor, defaultPixelRatio };
};
