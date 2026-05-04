'use strict';

const { z } = require('zod');

/**
 * POST /api/public/single-link/:slug/scan — optional browser coordinates.
 */
const publicSingleLinkScanSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracyM: z.number().min(0).max(10_000_000).optional(),
    consentVersion: z.string().max(64).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasLat = data.latitude !== undefined;
    const hasLng = data.longitude !== undefined;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'latitude and longitude must be sent together',
        path: ['latitude'],
      });
    }
  });

/**
 * POST /api/public/multi-link/:slug/scan — hub landing; client visitorHash for session updates.
 */
const publicMultiLinkScanSchema = z
  .object({
    visitorHash: z.string().trim().min(8).max(128),
    deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).optional(),
    browser: z.string().max(64).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracyM: z.number().min(0).max(10_000_000).optional(),
    consentVersion: z.string().max(64).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasLat = data.latitude !== undefined;
    const hasLng = data.longitude !== undefined;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'latitude and longitude must be sent together',
        path: ['latitude'],
      });
    }
  });

const publicMultiLinkClickSchema = z
  .object({
    linkId: z.string().trim().min(1).max(64),
    visitorHash: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

/** PATCH or POST /api/public/multi-link/:slug/session (POST for sendBeacon). */
const publicMultiLinkSessionSchema = z
  .object({
    visitorHash: z.string().trim().min(8).max(128),
    sessionDurationMs: z.number().min(0).max(86_400_000).optional(),
  })
  .strict();

module.exports = {
  publicSingleLinkScanSchema,
  publicMultiLinkScanSchema,
  publicMultiLinkClickSchema,
  publicMultiLinkSessionSchema,
};
