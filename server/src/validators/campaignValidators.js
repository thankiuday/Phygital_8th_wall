'use strict';

const { z } = require('zod');
const { safeUrl } = require('./safeUrl');

/* ─────────────────────────────────────────────────────────────────────────────
   Strict qrDesign schema — every property is whitelisted by name and shape.
   We deliberately avoid z.any() / z.record(z.any()) so a malicious client can't
   smuggle prototype-pollution payloads or oversized blobs into Mongo.
   ─────────────────────────────────────────────────────────────────────────── */

const colorHex = z
  .string()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i, 'Color must be hex (#rgb / #rrggbb / #rrggbbaa)');

const dotType = z.enum([
  'square',
  'rounded',
  'dots',
  'classy',
  'classy-rounded',
  'extra-rounded',
]);

const cornerSquareType = z.enum(['dot', 'square', 'extra-rounded']);
const cornerDotType = z.enum(['dot', 'square']);

const gradient = z
  .object({
    type: z.enum(['linear', 'radial']),
    rotation: z.number().min(0).max(Math.PI * 2).optional(),
    colorStops: z
      .array(
        z.object({
          offset: z.number().min(0).max(1),
          color: colorHex,
        })
      )
      .min(2)
      .max(4),
  })
  .strict();

const dotsOptions = z
  .object({
    type: dotType,
    color: colorHex.optional(),
    gradient: gradient.optional(),
  })
  .strict();

const cornersSquareOptions = z
  .object({
    type: cornerSquareType,
    color: colorHex.optional(),
    gradient: gradient.optional(),
  })
  .strict();

const cornersDotOptions = z
  .object({
    type: cornerDotType,
    color: colorHex.optional(),
    gradient: gradient.optional(),
  })
  .strict();

const backgroundOptions = z
  .object({
    color: colorHex.optional(),
    gradient: gradient.optional(),
  })
  .strict();

const imageOptions = z
  .object({
    hideBackgroundDots: z.boolean().optional(),
    imageSize: z.number().min(0.1).max(0.5).optional(),
    margin: z.number().int().min(0).max(20).optional(),
  })
  .strict();

/**
 * Logo data URL — capped at 180 KB pre-base64 to keep the whole stringified
 * qrDesign comfortably under the 32 KB Mongo cap once the small structural
 * keys are added.  Wait — base64 is ~33 % larger than binary, so 180 KB of
 * base64 is ~135 KB of binary; combined with the rest of the design JSON
 * we still fit comfortably in 16 MB BSON; we apply a separate stringified
 * cap in the controller for defense-in-depth.
 */
const imageDataUrl = z
  .string()
  .regex(
    /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/,
    'image must be a base64 data URL (png|jpeg|webp|svg+xml)'
  )
  .max(180_000, 'Logo image is too large (max 180 KB)');

const qrDesignSchema = z
  .object({
    width: z.number().int().min(128).max(1024).optional(),
    height: z.number().int().min(128).max(1024).optional(),
    margin: z.number().int().min(0).max(40).optional(),
    dotsOptions: dotsOptions.optional(),
    cornersSquareOptions: cornersSquareOptions.optional(),
    cornersDotOptions: cornersDotOptions.optional(),
    backgroundOptions: backgroundOptions.optional(),
    image: imageDataUrl.optional(),
    imageOptions: imageOptions.optional(),
    frame: z.enum(['none', 'bottom-arrow', 'bottom-bar', 'right-arrow']).optional(),
    frameCaption: z.string().max(40).optional(),
  })
  .strict();

/* ─────────────────────────────────────────────────────────────────────────────
   Per-type create schemas — combined into a discriminated union below.
   ─────────────────────────────────────────────────────────────────────────── */

const campaignNameField = z
  .string({ required_error: 'campaignName is required' })
  .trim()
  .min(1, 'campaignName is required')
  .max(100, 'campaignName cannot exceed 100 characters');

const destinationUrlField = z
  .string({ required_error: 'destinationUrl is required' })
  .min(1, 'destinationUrl is required')
  .max(2048, 'destinationUrl cannot exceed 2048 characters')
  .transform((val, ctx) => {
    try {
      return safeUrl(val);
    } catch (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: err.message });
      return z.NEVER;
    }
  });

const arCardCreateSchema = z
  .object({
    campaignType: z.literal('ar-card'),
    campaignName: campaignNameField,
    targetImageUrl: z.string().url('targetImageUrl must be a valid URL'),
    targetImagePublicId: z.string().min(1).optional(),
    videoUrl: z.string().url('videoUrl must be a valid URL'),
    videoPublicId: z.string().min(1).optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
  })
  .strict();

const singleLinkCreateSchema = z
  .object({
    campaignType: z.literal('single-link-qr'),
    campaignName: campaignNameField,
    destinationUrl: destinationUrlField,
    qrDesign: qrDesignSchema.nullable().optional(),
    preciseGeoAnalytics: z.boolean().optional(),
  })
  .strict();

/**
 * Dedicated POST /api/campaigns/single-link — no `campaignType`, no union preprocess.
 * Avoids any proxy/client dropping the discriminator and falling through to AR validation.
 */
const createSingleLinkOnlySchema = z
  .object({
    campaignName: campaignNameField,
    destinationUrl: destinationUrlField,
    qrDesign: qrDesignSchema.nullable().optional(),
    preciseGeoAnalytics: z.boolean().optional(),
  })
  .strict();

/**
 * Strip Cloudinary fields so single-link `.strict()` payloads never carry stray keys.
 */
const stripArMediaFields = (obj) => {
  const {
    targetImageUrl,
    targetImagePublicId,
    videoUrl,
    videoPublicId,
    thumbnailUrl,
    ...rest
  } = obj;
  return rest;
};

/**
 * Strip dynamic-QR fields so AR `.strict()` payloads never carry stray keys.
 */
const stripSingleLinkFields = (obj) => {
  const { destinationUrl, qrDesign, ...rest } = obj;
  return rest;
};

/**
 * createCampaignSchema — discriminated union.
 *
 * Discriminator resolution:
 *   • Honour explicit `campaignType` when it is `ar-card` or `single-link-qr`.
 *   • Otherwise infer: destinationUrl present **and** AR media incomplete → single-link.
 *     Everything else → AR card (legacy clients omit `campaignType` entirely).
 *
 * We then strip foreign-branch keys before parsing so `.strict()` never rejects
 * legitimate cross-feature noise from proxies or buggy clients.
 */
const createCampaignSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;

  const hasDest =
    raw.destinationUrl != null && String(raw.destinationUrl).trim() !== '';

  const hasFullArMedia =
    raw.targetImageUrl != null &&
    String(raw.targetImageUrl).trim() !== '' &&
    raw.videoUrl != null &&
    String(raw.videoUrl).trim() !== '';

  let ct =
    typeof raw.campaignType === 'string' ? raw.campaignType.trim() : '';

  if (!ct || (ct !== 'ar-card' && ct !== 'single-link-qr')) {
    ct = hasDest && !hasFullArMedia ? 'single-link-qr' : 'ar-card';
  }

  const base =
    ct === 'single-link-qr'
      ? stripArMediaFields(raw)
      : stripSingleLinkFields(raw);

  return { ...base, campaignType: ct };
}, z.discriminatedUnion('campaignType', [arCardCreateSchema, singleLinkCreateSchema]));

/* ─────────────────────────────────────────────────────────────────────────────
   Update schema — campaignType is immutable; redirectSlug is immutable;
   targetImageUrl / videoUrl are immutable post-create (they live on Cloudinary).
   ─────────────────────────────────────────────────────────────────────────── */

const updateCampaignSchema = z
  .object({
    campaignName: campaignNameField.optional(),
    status: z.enum(['draft', 'active', 'paused']).optional(),
    preciseGeoAnalytics: z.boolean().optional(),
    destinationUrl: z
      .string()
      .min(1)
      .max(2048)
      .transform((val, ctx) => {
        try {
          return safeUrl(val);
        } catch (err) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: err.message });
          return z.NEVER;
        }
      })
      .optional(),
    qrDesign: qrDesignSchema.nullable().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No valid fields to update' });

module.exports = {
  qrDesignSchema,
  createCampaignSchema,
  createSingleLinkOnlySchema,
  updateCampaignSchema,
};
