/**
 * Boot embedded surface AR from the React landing page (preserves Launch tap gesture).
 */

import gsap from 'gsap';
import { createSurfaceArShell, removeSurfaceArShell } from './surfaceArShell.js';
import { registerReturnReloadHandlers } from '@ar-engine/utils/arReturnReload.js';

let activeExperience = null;

export const bootEmbeddedSurfaceAr = async ({
  campaign,
  sessionId,
  sessionPromise,
  surfaceBackend,
  onError,
}) => {
  window.gsap = gsap;

  const shell = createSurfaceArShell();
  const container = shell.arRoot;
  if (!container) {
    onError?.('Could not create AR view.');
    return null;
  }

  try {
    registerReturnReloadHandlers(campaign._id, sessionId);

    const [{ ARExperience }, threeModule] = await Promise.all([
      import('@ar-engine/experience/ARExperience.js'),
      surfaceBackend === 'eighthwall-slam'
        ? Promise.resolve(null)
        : import('three-ar'),
    ]);

    const experience = new ARExperience({
      container,
      campaign,
      sessionId,
      embedMode: true,
    });

    activeExperience = experience;
    await experience.boot({
      THREE: threeModule?.default || threeModule || undefined,
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
