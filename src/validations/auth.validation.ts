import { z } from 'zod';
import { UserRole } from '../types/index';

const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

const nameSchema = z.string().min(2, 'Must be at least 2 characters').max(50);

export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z.string().regex(phoneRegex, 'Invalid phone number');

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(100);

export const tokenSchema = z.string().min(1, 'Token is required');

const profilePictureSchema = z.string().url('Invalid profile picture URL');

export const registerSchema = z
  .object({
    firstName: nameSchema.min(2, 'First name must be at least 2 characters'),
    lastName: nameSchema.min(2, 'Last name must be at least 2 characters'),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z
      .enum([UserRole.CUSTOMER])
      .default(UserRole.CUSTOMER),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterRequest = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type LoginRequest = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z
  .object({
    refreshToken: tokenSchema,
  })
  .strict();

export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;

export const verifyEmailSchema = z
  .object({
    email: emailSchema,
    token: tokenSchema,
  })
  .strict();

export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: tokenSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters')
      .max(100),
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    phone: phoneSchema.optional(),
    bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
    profilePicture: profilePictureSchema.optional(),
  })
  .strict();

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
