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
    certificationFiles: listSchema,
  })
  .strict();

export type TrainerApplicationRequest = z.infer<typeof trainerApplicationSchema>;

export const trainerApplicationIdParamSchema = z
  .object({
    applicationId: z.string().min(1, 'Application ID is required'),
  })
  .strict();

export type TrainerApplicationIdParamRequest = z.infer<typeof trainerApplicationIdParamSchema>;

export const trainerProgramSchema = z
  .object({
    title: z.string().min(2, 'Program title must be at least 2 characters').max(100),
    description: z.string().max(500, 'Program description must be at most 500 characters').optional(),
    programType: z.string().min(2, 'Program type is required').max(50).optional().default('1-on-1'),
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('beginner'),
    image: profilePictureSchema,
    durationWeeks: z.coerce.number().int().min(1, 'Duration must be at least 1 week'),
    sessions: z.coerce.number().int().min(1, 'Sessions must be at least 1'),
    price: z.coerce.number().nonnegative('Program price cannot be negative'),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export type TrainerProgramRequest = z.infer<typeof trainerProgramSchema>;

export const updateTrainerProgramSchema = trainerProgramSchema.partial().strict();

export type UpdateTrainerProgramRequest = z.infer<typeof updateTrainerProgramSchema>;

export const trainerProgramIdParamSchema = z
  .object({
    programId: z.string().min(1, 'Program ID is required'),
  })
  .strict();

export type TrainerProgramIdParamRequest = z.infer<typeof trainerProgramIdParamSchema>;

export const trainerAvailabilitySchema = z
  .object({
    dayOfWeek: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
    timeLabel: z.string().min(2, 'Time is required').max(30),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export type TrainerAvailabilityRequest = z.infer<typeof trainerAvailabilitySchema>;

export const updateTrainerAvailabilitySchema = trainerAvailabilitySchema.partial().strict();

export type UpdateTrainerAvailabilityRequest = z.infer<typeof updateTrainerAvailabilitySchema>;

export const trainerAvailabilityIdParamSchema = z
  .object({
    slotId: z.string().min(1, 'Availability slot ID is required'),
  })
  .strict();

export type TrainerAvailabilityIdParamRequest = z.infer<typeof trainerAvailabilityIdParamSchema>;
