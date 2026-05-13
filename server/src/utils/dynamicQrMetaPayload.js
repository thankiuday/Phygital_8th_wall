'use strict';

const { toPublicLinkList } = require('./linkItemResolver');
const { toEmbedSrc, detectVideoHost } = require('./videoEmbed');

/**
 * Build the JSON payload returned by GET /api/public/dynamic-qr/:slug/meta
 * and GET /api/public/hub/:handle/:hubSlug/meta (same shape for the SPA bridge).
 *
 * @param {object} campaign — lean Campaign doc with fields needed per type
 * @returns {object|null} null if campaign cannot be exposed (wrong status/type)
 */
const buildDynamicQrMetaPayload = (campaign) => {
  if (!campaign) return null;

  if (campaign.campaignType === 'single-link-qr') {
    if (campaign.status !== 'active') return null;
    return {
      campaignType: 'single-link-qr',
      campaignName: campaign.campaignName,
      destinationUrl: campaign.destinationUrl,
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      slug: campaign.redirectSlug,
    };
  }

  const hubTypes = ['multiple-links-qr', 'links-video-qr', 'links-doc-video-qr'];
  if (!hubTypes.includes(campaign.campaignType)) return null;

  if (campaign.status === 'paused') {
    return {
      campaignType: campaign.campaignType,
      campaignName: campaign.campaignName,
      status: 'paused',
      paused: true,
      links: [],
      videoItems: [],
      docItems: [],
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      slug: campaign.redirectSlug,
    };
  }

  if (campaign.status !== 'active') return null;

  if (campaign.campaignType === 'links-video-qr') {
    const embedSrc =
      campaign.videoSource === 'link' && campaign.externalVideoUrl
        ? toEmbedSrc(campaign.externalVideoUrl)
        : null;
    const embedHost =
      campaign.videoSource === 'link' && campaign.externalVideoUrl
        ? detectVideoHost(campaign.externalVideoUrl)
        : null;

    return {
      campaignType: 'links-video-qr',
      campaignName: campaign.campaignName,
      videoSource: campaign.videoSource,
      videoUrl: campaign.videoSource === 'upload' ? campaign.videoUrl : null,
      externalVideoUrl:
        campaign.videoSource === 'link' ? campaign.externalVideoUrl : null,
      embedSrc,
      embedHost,
      thumbnailUrl: campaign.thumbnailUrl || null,
      links: toPublicLinkList(campaign.linkItems || []),
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      slug: campaign.redirectSlug,
    };
  }

  if (campaign.campaignType === 'links-doc-video-qr') {
    const videoItems = (campaign.videoItems || []).map((vi) => {
      const isLink = vi.source === 'link' && vi.externalVideoUrl;
      return {
        videoId: vi.videoId,
        label: vi.label,
        source: vi.source,
        videoUrl: vi.source === 'upload' ? vi.url : null,
        externalVideoUrl: isLink ? vi.externalVideoUrl : null,
        embedSrc: isLink ? toEmbedSrc(vi.externalVideoUrl) : null,
        embedHost: isLink ? detectVideoHost(vi.externalVideoUrl) : null,
        thumbnailUrl: vi.thumbnailUrl || null,
      };
    });

    const docItems = (campaign.docItems || []).map((di) => ({
      docId: di.docId,
      label: di.label,
      url: di.url,
      mimeType: di.mimeType || null,
      bytes: di.bytes || 0,
    }));

    return {
      campaignType: 'links-doc-video-qr',
      campaignName: campaign.campaignName,
      videoSource: campaign.videoSource,
      videoItems,
      docItems,
      links: toPublicLinkList(campaign.linkItems || []),
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      slug: campaign.redirectSlug,
    };
  }

  return {
    campaignType: 'multiple-links-qr',
    campaignName: campaign.campaignName,
    links: toPublicLinkList(campaign.linkItems || []),
    preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
    slug: campaign.redirectSlug,
  };
};

module.exports = { buildDynamicQrMetaPayload };
