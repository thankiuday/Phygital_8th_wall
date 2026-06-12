'use strict';

const { z } = require('zod');

const qrPlacementSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    scale: z.number().min(0.08).max(0.55).optional(),
    preset: z
      .enum([
        'top-left',
        'top-right',
        'top-center',
        'bottom-left',
        'bottom-right',
        'center',
      ])
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

const linkItemObjectSchema = z
  .object({
    kind: linkKindEnum,
    label: z.string().trim().min(1).max(80),
    value: z.string().trim().min(1).max(500),
  })
  .strict();

const linkItemInputSchema = linkItemObjectSchema.refine(
  (d) => {
    if (d.kind !== 'email') return true;
    return z.string().email().safeParse(d.value).success;
  },
  { message: 'Invalid email address', path: ['value'] }
);

const linkItemsOptionalField = z.array(linkItemInputSchema).max(20, 'Too many links (max 20)');

const mp4UrlField = z
  .string()
  .url('greenscreenVideoUrl must be a valid URL')
  .refine(
    (url) => /\.mp4(\?|$)/i.test(url) || url.includes('/video/upload/'),
    { message: 'Green-screen video must be an MP4 upload' }
  );

const requestKindField = z.enum(['ar-card', 'ar-poster']).default('ar-card');

const createArServiceRequestSchema = z
  .object({
    requestKind: requestKindField,
    targetImageUrl: z.string().url('targetImageUrl must be a valid URL'),
    targetImagePublicId: z.string().min(1).max(512).optional(),
    qrPlacement: qrPlacementSchema,
    greenscreenVideoUrl: mp4UrlField,
    greenscreenVideoPublicId: z.string().min(1).max(512).optional(),
    linkItems: linkItemsOptionalField.optional(),
    userNotes: z.string().trim().max(500).optional(),
    /** Cancel the user's in-progress request of the same kind and submit this one. */
    replaceOpen: z.boolean().optional(),
  })
  .strict();

const updateArServiceRequestAdminSchema = z
  .object({
    status: z.enum(['in_progress', 'cancelled']).optional(),
    adminNotes: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No valid fields to update' });

const patchArCampaignAssetsSchema = z
  .object({
    targetImageUrl: z.string().url(),
    targetImagePublicId: z.string().min(1).max(512).nullable().optional(),
  })
  .strict();

module.exports = {
  createArServiceRequestSchema,
  updateArServiceRequestAdminSchema,
  patchArCampaignAssetsSchema,
  qrPlacementSchema,
  requestKindField,
};
