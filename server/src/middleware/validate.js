'use strict';

const { z } = require('zod');

/**
 * validate — Zod request body validation middleware factory.
 *
 * Usage: router.post('/register', validate(registerSchema), controller)
 * Returns 422 with detailed field errors on failure.
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    const primaryMessage = errors[0]?.message || 'Validation failed';

    // Debug visibility for complex wizard payloads (guest draft restore, etc).
    console.warn('[validate] request body validation failed', {
      method: req.method,
      path: req.originalUrl || req.url,
      errors,
    });

    return res.status(422).json({
      success: false,
      message: primaryMessage,
      errors,
    });
  }

  // Replace req.body with the parsed (sanitised) data
  req.body = result.data;
  next();
};

/* ─────────────────────────────────────────
   Auth Schemas
   ───────────────────────────────────────── */

const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please provide a valid email')
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  agreedToCertification: z.literal(true, {
    errorMap: () => ({
      message: 'You must accept the certification and agreement to create an account',
    }),
  }),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please provide a valid email')
    .toLowerCase()
    .trim(),

  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please provide a valid email')
    .toLowerCase()
    .trim(),
});

const resetPasswordSchema = z.object({
  password: z
    .string({ required_error: 'New password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  confirmPassword: z.string({ required_error: 'Please confirm your password' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(60, 'Name cannot exceed 60 characters')
      .optional(),
  })
  .strict()
  .refine((d) => d.name !== undefined, {
    message: 'No fields to update',
  });

const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
};
