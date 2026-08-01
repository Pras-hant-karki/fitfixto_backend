import { z } from 'zod';
import { ServiceType } from '../types/index';

const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

const nameSchema = z.string().min(2, 'Must be at least 2 characters').max(50);
const emailSchema = z.string().email('Invalid email address');
const phoneSchema = z.string().regex(phoneRegex, 'Invalid phone number');

export const createTrainerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    bio: z.string().max(2000, 'Bio must be at most 2000 characters').optional(),
    services: z
      .array(z.enum([ServiceType.TRAINER_BOOKING, ServiceType.GYM_SETUP, ServiceType.MAINTENANCE]))
      .optional(),
    hourlyRate: z.number().positive('Hourly rate must be greater than 0').optional(),
    experienceYears: z.number().int().nonnegative('Experience must be non-negative').optional(),
    certifications: z.array(z.string().min(1)).optional(),
    profilePicture: z.string().url('Invalid profile picture URL').optional(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export type CreateTrainerRequest = z.infer<typeof createTrainerSchema>;

export const updateTrainerSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    bio: z.string().max(2000, 'Bio must be at most 2000 characters').optional(),
    services: z
      .array(z.enum([ServiceType.TRAINER_BOOKING, ServiceType.GYM_SETUP, ServiceType.MAINTENANCE]))
      .optional(),
    hourlyRate: z.number().positive('Hourly rate must be greater than 0').optional(),
    experienceYears: z.number().int().nonnegative('Experience must be non-negative').optional(),
    certifications: z.array(z.string().min(1)).optional(),
    profilePicture: z.string().url('Invalid profile picture URL').optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateTrainerRequest = z.infer<typeof updateTrainerSchema>;

export const trainerIdParamSchema = z
  .object({
    trainerId: z.string().min(1, 'Trainer ID is required'),
  })
  .strict();

export type TrainerIdParamRequest = z.infer<typeof trainerIdParamSchema>;
