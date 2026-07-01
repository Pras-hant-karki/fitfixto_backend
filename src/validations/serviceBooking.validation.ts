import { z } from 'zod';

export const createServiceBookingSchema = z
  .object({
    serviceId: z.string().min(1, 'Service ID is required'),
    scheduledDate: z.string().min(1, 'Scheduled date is required'),
    contactName: z.string().trim().min(1).max(120),
    contactEmail: z.string().trim().email(),
    contactPhone: z.string().trim().min(1).max(30),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .strict();

export const updateServiceBookingStatusSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']),
    adminNotes: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .strict();

export const serviceBookingIdParamSchema = z
  .object({ bookingId: z.string().min(1) })
  .strict();

export type CreateServiceBookingRequest = z.infer<typeof createServiceBookingSchema>;
export type UpdateServiceBookingStatusRequest = z.infer<typeof updateServiceBookingStatusSchema>;
