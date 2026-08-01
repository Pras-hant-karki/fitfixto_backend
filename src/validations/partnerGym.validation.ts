import { z } from 'zod';

const gymPayloadSchema = z
  .object({
    name: z.string().trim().min(2, 'Gym name must be at least 2 characters').max(150),
    address: z.string().trim().min(2, 'Gym address must be at least 2 characters').max(300),
    phone: z.string().trim().max(50).optional().or(z.literal('')),
    hours: z.string().trim().max(80).optional().or(z.literal('')),
    rating: z.number().min(0).max(5).optional(),
    pin: z.string().trim().max(80).optional().or(z.literal('')),
    locationUrl: z.string().trim().max(1000).optional().or(z.literal('')),
    images: z.array(z.string().trim().min(1).max(1000)).max(5).optional().default([]),
    isVisible: z.boolean().optional().default(true),
  })
  .strict();

export const createPartnerGymSchema = gymPayloadSchema;

export const updatePartnerGymSchema = gymPayloadSchema.partial();

export const partnerGymIdParamSchema = z
  .object({
    gymId: z.string().min(1, 'Gym ID is required'),
  })
  .strict();
