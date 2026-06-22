import { z } from 'zod';

const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
const nameSchema = z.string().min(2, 'Must be at least 2 characters').max(50);
const emailSchema = z.string().email('Invalid email address');
const listSchema = z.array(z.string().min(1)).optional().default([]);
const profilePictureSchema = z
  .string()
  .refine(
    (value) => {
      if (!value.trim()) {
        return true;
      }

      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return /^\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/.test(value);
      }
    },
    { message: 'Invalid profile picture URL' }
  )
  .optional();

export const createTrainerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: z.string().regex(phoneRegex, 'Invalid phone number'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
    profilePicture: profilePictureSchema,
    location: z.string().max(120).optional(),
    sessionRate: z.number().nonnegative('Session rate cannot be negative').default(0),
    experienceYears: z.number().int().nonnegative('Experience must be non-negative').default(0),
    specialties: listSchema,
    certifications: listSchema,
    isFeatured: z.boolean().optional().default(false),
    isSuspended: z.boolean().optional().default(false),
    applicationId: z.string().min(1, 'Application ID is required').optional(),
  })
  .strict();

export type CreateTrainerRequest = z.infer<typeof createTrainerSchema>;

export const updateTrainerSchema = createTrainerSchema
  .omit({ password: true })
  .partial()
  .extend({
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  })
  .strict();

export type UpdateTrainerRequest = z.infer<typeof updateTrainerSchema>;

export const trainerIdParamSchema = z
  .object({
    trainerId: z.string().min(1, 'Trainer ID is required'),
  })
  .strict();

export type TrainerIdParamRequest = z.infer<typeof trainerIdParamSchema>;

export const trainerApplicationSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    phone: z.string().regex(phoneRegex, 'Invalid phone number').optional().or(z.literal('')),
    bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
    profilePicture: profilePictureSchema,
    location: z.string().max(120).optional(),
    sessionRate: z.coerce.number().nonnegative('Session rate cannot be negative').default(0),
    experienceYears: z.coerce.number().int().nonnegative('Experience must be non-negative').default(0),
    specialties: listSchema,
    certifications: listSchema,
  })
  .strict();

export type TrainerApplicationRequest = z.infer<typeof trainerApplicationSchema>;

export const trainerApplicationIdParamSchema = z
  .object({
    applicationId: z.string().min(1, 'Application ID is required'),
  })
  .strict();

export type TrainerApplicationIdParamRequest = z.infer<typeof trainerApplicationIdParamSchema>;
