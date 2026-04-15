/**
 * main.js — AR Engine entry point
 *
 * Flow:
 *  1. Parse campaignId from the URL path  (/ar/:campaignId)
 *  2. Fetch campaign data from the public API
 *  3. Record the scan event (non-blocking)
 *  4. Boot the full AR experience
 */

import { loadCampaign, recordScan } from './services/campaignLoader.js';
import { ARExperience } from './experience/ARExperience.js';
import { updateLoadingProgress, showError } from './utils/loadingScreen.js';

const init = async () => {
  // Parse campaign ID from the last path segment: /ar/CAMPAIGN_ID
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const campaignId = pathParts[pathParts.length - 1];

  if (!campaignId || campaignId === 'ar') {
    showError('Invalid AR link.', 'No campaign ID found in the URL.');
    return;
  }

  updateLoadingProgress(2, 'Loading campaign…');

  // Fetch campaign data
  let campaign;
  try {
    campaign = await loadCampaign(campaignId);
  } catch (err) {
    showError(
      err.message.includes('404') ? 'Campaign not found.' : 'Could not load campaign.',
      err.message
    );
    return;
  }

  if (!campaign.targetImageUrl || !campaign.videoUrl) {
    showError('Campaign is incomplete.', 'Target image or video is missing.');
    return;
  }

  // Fire-and-forget scan recording
  recordScan(campaignId);

  // Update page title
  document.title = `${campaign.campaignName} — Phygital8ThWall AR`;

  // Boot the AR experience
  const container = document.getElementById('ar-root');
  const experience = new ARExperience({ container, campaign });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => experience.destroy());

  await experience.boot();
};

// Ensure CDN scripts are ready before running
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
