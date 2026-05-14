'use strict';

const { z } = require('zod');
const { safeUrl } = require('./safeUrl');
const { isAllowedVideoHost } = require('../utils/videoEmbed');

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
    // Optional client-seeded immutable slug so wizard-downloaded QRs can
    // match the eventually persisted campaign redirect URL.
    redirectSlug: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{8}$/, 'redirectSlug must be 8 alphanumeric characters')
      .optional(),
  })
  .strict();

const linkKindEnum = z.enum([
  'contact',
  'whatsapp',
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'website',
  'tiktok',
  'email',
  'custom',
]);

/** Plain object shape — must stay a ZodObject so `.extend()` works for PATCH rows. */
const linkItemObjectSchema = z
  .object({
    kind: linkKindEnum,
    label: z.string().trim().min(1, 'label is required').max(80),
    value: z.string().trim().min(1, 'value is required').max(500),
  })
  .strict();

const linkItemEmailValueRefine = (d) => {
  if (d.kind !== 'email') return true;
  return z.string().email().safeParse(d.value).success;
};

const linkItemEmailRefineConfig = {
  message: 'Invalid email address',
  path: ['value'],
};

const linkItemInputSchema = linkItemObjectSchema.refine(
  linkItemEmailValueRefine,
  linkItemEmailRefineConfig
);

/** PATCH body — optional linkId when updating existing hub rows (preserves analytics). */
const linkItemPatchSchema = linkItemObjectSchema
  .extend({
    linkId: z.string().trim().min(8).max(24).optional(),
  })
  .refine(linkItemEmailValueRefine, linkItemEmailRefineConfig);

const linkItemsField = z
  .array(linkItemInputSchema)
  .min(1, 'At least one link is required')
  .max(20, 'Too many links (max 20)');

const linkItemsPatchField = z
  .array(linkItemPatchSchema)
  .min(1, 'At least one link is required')
  .max(20, 'Too many links (max 20)');

/**
 * POST /api/campaigns/multiple-links — dedicated route (mirrors single-link).
 */
const createMultipleLinksOnlySchema = z
  .object({
    campaignName: campaignNameField,
    linkItems: linkItemsField,
    qrDesign: qrDesignSchema.nullable().optional(),
    preciseGeoAnalytics: z.boolean().optional(),
    redirectSlug: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{8}$/, 'redirectSlug must be 8 alphanumeric characters')
      .optional(),
  })
  .strict();

/**
 * externalVideoUrl — allowlisted public video provider URL (YouTube / Vimeo /
 * Facebook). Reuses `safeUrl` for SSRF / scheme defense, then enforces the
 * curated host allowlist defined in `utils/videoEmbed`.
 */
const externalVideoUrlField = z
  .string({ required_error: 'externalVideoUrl is required' })
  .min(1, 'externalVideoUrl is required')
  .max(2048, 'externalVideoUrl cannot exceed 2048 characters')
  .transform((val, ctx) => {
    let normalized;
    try {
      normalized = safeUrl(val);
    } catch (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: err.message });
      return z.NEVER;
    }
    if (!isAllowedVideoHost(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only YouTube, Vimeo, or Facebook video URLs are supported',
      });
      return z.NEVER;
    }
    return normalized;
  });

const cloudinaryUrlField = z
  .string()
  .min(1, 'videoUrl is required')
  .max(2048, 'videoUrl cannot exceed 2048 characters')
  .url('videoUrl must be a valid URL');

/**
 * POST /api/campaigns/links-video — dedicated route mirroring multiple-links.
 *
 * Conditional `superRefine`:
 *   videoSource === 'upload' → requires `videoUrl` (Cloudinary).
 *   videoSource === 'link'   → requires `externalVideoUrl` (allowlisted host).
 */
const createLinksVideoOnlySchema = z
  .object({
    campaignName: campaignNameField,
    videoSource: z.enum(['upload', 'link'], {
      required_error: 'videoSource is required',
      invalid_type_error: 'videoSource must be "upload" or "link"',
    }),
    videoUrl: cloudinaryUrlField.optional(),
    videoPublicId: z.string().min(1).max(512).optional(),
    externalVideoUrl: externalVideoUrlField.optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
    linkItems: linkItemsField,
    qrDesign: qrDesignSchema.nullable().optional(),
    preciseGeoAnalytics: z.boolean().optional(),
    redirectSlug: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{8}$/, 'redirectSlug must be 8 alphanumeric characters')
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.videoSource === 'upload') {
      if (!data.videoUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'videoUrl is required when videoSource is "upload"',
          path: ['videoUrl'],
        });
      }
      if (data.externalVideoUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'externalVideoUrl must not be set when videoSource is "upload"',
          path: ['externalVideoUrl'],
        });
      }
    } else if (data.videoSource === 'link') {
      if (!data.externalVideoUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'externalVideoUrl is required when videoSource is "link"',
          path: ['externalVideoUrl'],
        });
      }
      if (data.videoUrl || data.videoPublicId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'videoUrl/videoPublicId must not be set when videoSource is "link"',
          path: ['videoUrl'],
        });
      }
    }
  });

/* ─────────────────────────────────────────────────────────────────────────────
   links-doc-video-qr — multi-asset hub
   - up to 5 video items (campaign-wide source mode)
   - up to 5 doc items (Cloudinary raw / image)
   - reuses linkItems contract
   ─────────────────────────────────────────────────────────────────────────── */

/** Allow PDFs, common Office formats, and inline images. */
const ALLOWED_DOC_MIME_TYPES = Object.freeze([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]);

const MAX_DOC_BYTES = 25 * 1024 * 1024;

const docItemInputSchema = z
  .object({
    label: z.string().trim().min(1, 'Document label is required').max(80),
    url: cloudinaryUrlField,
    publicId: z.string().min(1).max(512).optional(),
    mimeType: z
      .string()
      .max(128)
      .refine(
        (v) => ALLOWED_DOC_MIME_TYPES.includes(v),
        'Document type is not supported'
      )
      .optional(),
    bytes: z.number().int().min(0).max(MAX_DOC_BYTES, 'Document exceeds 25 MB').optional(),
    resourceType: z.enum(['raw', 'image']).optional(),
  })
  .strict();

const docItemPatchSchema = docItemInputSchema.extend({
  docId: z.string().trim().min(8).max(24).optional(),
});

const docItemsField = z.array(docItemInputSchema).max(5, 'Too many documents (max 5)');
const docItemsPatchField = z.array(docItemPatchSchema).max(5, 'Too many documents (max 5)');

const videoItemInputBase = z
  .object({
    label: z.string().trim().min(1, 'Video label is required').max(80),
    source: z.enum(['upload', 'link']),
    url: cloudinaryUrlField.optional(),
    publicId: z.string().min(1).max(512).optional(),
    externalVideoUrl: externalVideoUrlField.optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.source === 'upload') {
      if (!data.url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'url is required for an uploaded video',
          path: ['url'],
        });
      }
      if (data.externalVideoUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'externalVideoUrl must be empty for an uploaded video',
          path: ['externalVideoUrl'],
        });
      }
    } else if (data.source === 'link') {
      if (!data.externalVideoUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'externalVideoUrl is required when video source is "link"',
          path: ['externalVideoUrl'],
        });
      }
      if (data.url || data.publicId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'url/publicId must be empty for a linked video',
          path: ['url'],
        });
      }
    }
  });

const videoItemInputSchema = videoItemInputBase;
const videoItemPatchSchema = z
  .object({
    videoId: z.string().trim().min(8).max(24).optional(),
    label: z.string().trim().min(1).max(80),
    source: z.enum(['upload', 'link']),
    url: cloudinaryUrlField.optional(),
    publicId: z.string().min(1).max(512).optional(),
    externalVideoUrl: externalVideoUrlField.optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
  })
  .strict();

const videoItemsField = z.array(videoItemInputSchema).max(5, 'Too many videos (max 5)');
const videoItemsPatchField = z.array(videoItemPatchSchema).max(5, 'Too many videos (max 5)');

/**
 * POST /api/campaigns/links-doc-video — dedicated route mirroring links-video.
 *
 * `videoSource` is the campaign-wide mode; every entry in `videoItems[]`
 * must agree with it. We enforce "≥1 link AND ≥1 of {video, doc}" here so
 * the controller only sees validated rows.
 */
const createLinksDocVideoOnlySchema = z
  .object({
    campaignName: campaignNameField,
    videoSource: z.enum(['upload', 'link']),
    videoItems: videoItemsField.optional(),
    docItems: docItemsField.optional(),
    linkItems: linkItemsField,
    qrDesign: qrDesignSchema.nullable().optional(),
    preciseGeoAnalytics: z.boolean().optional(),
    redirectSlug: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{8}$/, 'redirectSlug must be 8 alphanumeric characters')
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const videoCount = data.videoItems?.length || 0;
    const docCount = data.docItems?.length || 0;
    if (videoCount + docCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one video or document',
        path: ['videoItems'],
      });
    }
    if (videoCount > 0) {
      data.videoItems.forEach((vi, idx) => {
        if (vi.source !== data.videoSource) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `videoItems[${idx}].source must match the campaign-wide videoSource`,
            path: ['videoItems', idx, 'source'],
          });
        }
      });
    }
  });

/* ─────────────────────────────────────────────────────────────────────────────
   digital-business-card — personalized identity card hub
   - rich profile (image, banner, name, contact, social, sections)
   - 12 design templates + color/font/layout/corners/spacing
   - print preset (size, theme, qrPosition, displayFields, profileAdjust)
   ─────────────────────────────────────────────────────────────────────────── */

/** Friendly URL slug for /card/:cardSlug — kebab-case, 3-60 chars. */
const cardSlugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Custom URL must be at least 3 characters')
  .max(60, 'Custom URL is too long (max 60 characters)')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/,
    'Custom URL must be lowercase letters, numbers, and hyphens'
  );

const cardSocialField = z
  .object({
    instagram: z.string().trim().max(500).optional().nullable(),
    linkedin: z.string().trim().max(500).optional().nullable(),
    twitter: z.string().trim().max(500).optional().nullable(),
    github: z.string().trim().max(500).optional().nullable(),
    youtube: z.string().trim().max(500).optional().nullable(),
    facebook: z.string().trim().max(500).optional().nullable(),
    telegram: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .partial();

const cardContactField = z
  .object({
    phone: z.string().trim().max(40).optional().nullable(),
    email: z.string().trim().max(254).optional().nullable(),
    whatsapp: z.string().trim().max(40).optional().nullable(),
    website: z.string().trim().max(2048).optional().nullable(),
    address: z.string().trim().max(300).optional().nullable(),
  })
  .strict()
  .partial();

/** Discriminated section payloads — keep each shape strict so unknown fields
 *  can't pollute the rendered card. */
const cardSectionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    id: z.string().trim().max(24).optional(),
    title: z.string().trim().min(1).max(120),
  }).strict(),
  z.object({
    type: z.literal('text'),
    id: z.string().trim().max(24).optional(),
    title: z.string().trim().max(120).optional().nullable(),
    body: z.string().trim().max(1500),
  }).strict(),
  z.object({
    type: z.literal('about'),
    id: z.string().trim().max(24).optional(),
    title: z.string().trim().max(120).optional().nullable(),
    body: z.string().trim().max(1500),
  }).strict(),
  z.object({
    type: z.literal('imageGallery'),
    id: z.string().trim().max(24).optional(),
    title: z.string().trim().max(120).optional().nullable(),
    images: z
      .array(
        z.object({
          url: z.string().url().max(2048),
          publicId: z.string().max(256).optional().nullable(),
          alt: z.string().trim().max(120).optional().nullable(),
        }).strict()
      )
      .max(12, 'Gallery is limited to 12 images'),
  }).strict(),
  z.object({
    type: z.literal('video'),
    id: z.string().trim().max(24).optional(),
    title: z.string().trim().max(120).optional().nullable(),
    source: z.enum(['upload', 'link']),
    url: cloudinaryUrlField.optional().nullable(),
    publicId: z.string().min(1).max(256).optional().nullable(),
    externalVideoUrl: externalVideoUrlField.optional().nullable(),
    thumbnailUrl: z.string().url().max(2048).optional().nullable(),
  }).strict(),
  z.object({
    type: z.literal('customLinks'),
    id: z.string().trim().max(24).optional(),
    title: z.string().trim().max(120).optional().nullable(),
    items: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(80),
          url: z.string().trim().min(1).max(2048),
        }).strict()
      )
      .max(12, 'Custom links section is limited to 12 entries'),
  }).strict(),
  z.object({
    type: z.literal('testimonials'),
    id: z.string().trim().max(24).optional(),
    title: z.string().trim().max(120).optional().nullable(),
    items: z
      .array(
        z.object({
          quote: z.string().trim().min(1).max(600),
          author: z.string().trim().max(120).optional().nullable(),
          role: z.string().trim().max(120).optional().nullable(),
          avatarUrl: z.string().url().max(2048).optional().nullable(),
        }).strict()
      )
      .max(8, 'Testimonials section is limited to 8 entries'),
  }).strict(),
]);

const cardContentSchema = z
  .object({
    profileImageUrl: z.string().url().max(2048).optional().nullable(),
    profileImagePublicId: z.string().max(256).optional().nullable(),
    bannerImageUrl: z.string().url().max(2048).optional().nullable(),
    bannerImagePublicId: z.string().max(256).optional().nullable(),
    fullName: z.string().trim().min(1, 'Full name is required').max(120),
    jobTitle: z.string().trim().max(120).optional().nullable(),
    company: z.string().trim().max(120).optional().nullable(),
    bio: z.string().trim().max(500).optional().nullable(),
    tagline: z.string().trim().max(160).optional().nullable(),
    contact: cardContactField.optional(),
    social: cardSocialField.optional(),
    sections: z.array(cardSectionSchema).max(10).optional(),
  })
  .strict();

const CARD_TEMPLATE_IDS = z.enum([
  'professional', 'creative', 'minimal', 'bold', 'elegant', 'dark',
  'sunset', 'ocean', 'forest', 'neon', 'rose', 'slate',
]);

const cardDesignSchema = z
  .object({
    template: CARD_TEMPLATE_IDS.optional(),
    colors: z
      .object({
        primary: colorHex.optional(),
        secondary: colorHex.optional(),
        background: colorHex.optional(),
      })
      .strict()
      .optional(),
    font: z.enum(['Inter', 'Georgia', 'Trebuchet MS', 'Arial', 'Verdana']).optional(),
    layout: z.enum(['centered', 'left-aligned', 'cover']).optional(),
    corners: z.enum(['rounded', 'sharp']).optional(),
    spacing: z.enum(['compact', 'normal', 'relaxed']).optional(),
  })
  .strict();

const CARD_SIZE_IDS = z.enum(['us', 'intl', 'slim-h', 'slim-v', 'square-s', 'square-m']);
const CARD_DISPLAY_FIELDS = z.enum([
  'name', 'jobTitle', 'company', 'phone', 'email', 'website', 'address', 'tagline',
]);

const cardPrintSettingsSchema = z
  .object({
    cardSize: CARD_SIZE_IDS.optional(),
    theme: z.enum(['white', 'black', 'neon']).optional(),
    qrPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']).optional(),
    qrPlacement: z.enum(['front', 'back', 'both']).optional(),
    includeQr: z.boolean().optional(),
    displayFields: z.array(CARD_DISPLAY_FIELDS).max(8).optional(),
    profileZoom: z.number().min(0.5).max(2.0).optional(),
    profileCropX: z.number().min(0).max(100).optional(),
    profileCropY: z.number().min(0).max(100).optional(),
  })
  .strict();

/**
 * POST /api/campaigns/digital-business-card — dedicated route. Mirrors the
 * pattern used by other hub types: name + content required; design / print
 * settings / qr / slug all optional and filled with sensible defaults
 * server-side when missing.
 */
const createDigitalBusinessCardSchema = z
  .object({
    campaignName: campaignNameField,
    cardSlug: cardSlugField.optional(),
    visibility: z.enum(['public', 'private']).optional(),
    cardContent: cardContentSchema,
    cardDesign: cardDesignSchema.optional(),
    cardPrintSettings: cardPrintSettingsSchema.optional(),
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
    linkItems: linkItemsPatchField.optional(),
    /* ── links-video-qr fields (controller gates by campaignType) ── */
    videoSource: z.enum(['upload', 'link']).optional(),
    videoUrl: cloudinaryUrlField.nullable().optional(),
    videoPublicId: z.string().min(1).max(512).nullable().optional(),
    externalVideoUrl: externalVideoUrlField.nullable().optional(),
    thumbnailUrl: z.string().url().nullable().optional(),
    /* ── links-doc-video-qr (controller gates by campaignType) ── */
    docItems: docItemsPatchField.optional(),
    videoItems: videoItemsPatchField.optional(),
    /* ── digital-business-card (controller gates by campaignType) ── */
    cardSlug: cardSlugField.optional(),
    visibility: z.enum(['public', 'private']).optional(),
    cardContent: cardContentSchema.optional(),
    cardDesign: cardDesignSchema.optional(),
    cardPrintSettings: cardPrintSettingsSchema.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No valid fields to update' });

module.exports = {
  qrDesignSchema,
  linkItemInputSchema,
  linkItemPatchSchema,
  linkItemsField,
  linkItemsPatchField,
  docItemInputSchema,
  docItemPatchSchema,
  videoItemInputSchema,
  videoItemPatchSchema,
  ALLOWED_DOC_MIME_TYPES,
  MAX_DOC_BYTES,
  createCampaignSchema,
  createSingleLinkOnlySchema,
  createMultipleLinksOnlySchema,
  createLinksVideoOnlySchema,
  createLinksDocVideoOnlySchema,
  createDigitalBusinessCardSchema,
  cardSlugField,
  cardContentSchema,
  cardDesignSchema,
  cardPrintSettingsSchema,
  updateCampaignSchema,
};
