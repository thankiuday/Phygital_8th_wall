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

module.exports = { publicSingleLinkScanSchema };
