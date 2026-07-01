import { z } from 'zod';

const servicePayloadSchema = z
  .object({
    name: z.string().trim().min(2, 'Service name must be at least 2 characters').max(150),
    description: z.string().trim().min(5, 'Description must be at least 5 characters').max(500),
    priceLabel: z.string().trim().max(100).optional().or(z.literal('')),
    charge: z.number().min(0, 'Charge cannot be negative').optional().default(0),
    features: z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
    image: z.string().trim().max(1000).optional().or(z.literal('')),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const createServiceSchema = servicePayloadSchema;

export const updateServiceSchema = servicePayloadSchema.partial();

export const serviceIdParamSchema = z
  .object({
    serviceId: z.string().min(1, 'Service ID is required'),
  })
  .strict();
