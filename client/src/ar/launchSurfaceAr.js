/**
 * Boot embedded surface AR from the React landing page (preserves Launch tap gesture).
 */

import gsap from 'gsap';
import './surfaceArUi.css';
import {
  createSurfaceArShell,
  getSurfaceArShell,
  removeSurfaceArShell,
} from './surfaceArShell.js';
import { registerReturnReloadHandlers } from '@ar-engine/utils/arReturnReload.js';

let activeExperience = null;

export const bootEmbeddedSurfaceAr = async ({
  campaign,
  sessionId,
  sessionPromise,
  surfaceBackend,
  skipShellCreation = false,
  onError,
}) => {
  window.gsap = gsap;

  const shell = skipShellCreation && getSurfaceArShell()
    ? {
        shell: getSurfaceArShell(),
        arRoot: getSurfaceArShell().querySelector('#ar-root'),
        domOverlay: getSurfaceArShell().querySelector('#ar-dom-overlay'),
      }
    : createSurfaceArShell();

  const container = shell.arRoot;
  if (!container) {
    onError?.('Could not create AR view.');
    return null;
  }

  try {
    registerReturnReloadHandlers(campaign._id, sessionId);

    const isEighthWall = surfaceBackend === 'eighthwall-slam';
    const { ARExperience } = await import('@ar-engine/experience/ARExperience.js');

    let THREE = window.THREE;
    if (!isEighthWall) {
      const threeModule = await import('three-ar');
      THREE = threeModule?.default || threeModule;
      if (THREE && !window.THREE) {
        window.THREE = THREE;
      }
    } else if (!THREE) {
      throw new Error('Three.js is still loading. Wait a moment and try again.');
    }

    const experience = new ARExperience({
      container,
      campaign,
      sessionId,
      embedMode: true,
    });

    activeExperience = experience;
    await experience.boot({
      THREE: isEighthWall ? window.THREE : (THREE || window.THREE),
      preSessionPromise: sessionPromise,
      surfaceBackend,
    });
    return experience;
  } catch (err) {
    onError?.(err?.message || 'Could not start surface AR.');
    removeSurfaceArShell();
    activeExperience = null;
    return null;
  }
};

export const teardownEmbeddedSurfaceAr = async () => {
  if (activeExperience) {
    await activeExperience.destroy();
    activeExperience = null;
  }
  removeSurfaceArShell();
};

export const getActiveSurfaceExperience = () => activeExperience;
