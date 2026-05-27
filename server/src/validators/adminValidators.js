'use strict';

const { z } = require('zod');

const createCouponSchema = z
  .object({
    code: z
      .string({ required_error: 'Coupon code is required' })
      .trim()
      .min(3, 'Code must be at least 3 characters')
      .max(32, 'Code cannot exceed 32 characters'),
    description: z.string().max(200).optional(),
    benefit: z.enum(['full_access', 'extra_campaigns', 'extended_storage']).optional(),
    maxUses: z.coerce.number().int().min(1).max(10000).optional(),
    expiresAt: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

const updateCouponSchema = z
  .object({
    isActive: z.boolean().optional(),
    description: z.string().max(200).optional(),
    maxUses: z.coerce.number().int().min(1).max(10000).optional(),
    expiresAt: z
      .union([
        z.string().datetime({ offset: true }),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        z.null(),
      ])
      .optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No valid fields to update' });

const redeemCouponSchema = z
  .object({
    code: z
      .string({ required_error: 'Coupon code is required' })
      .trim()
      .min(3, 'Code must be at least 3 characters')
      .max(32),
  })
  .strict();

const adminResetPasswordSchema = z
  .object({
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  })
  .strict();

module.exports = {
  createCouponSchema,
  updateCouponSchema,
  redeemCouponSchema,
  adminResetPasswordSchema,
};
