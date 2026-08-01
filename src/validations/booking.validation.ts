import { z } from 'zod';

export const createBookingSchema = z
  .object({
    trainerId: z.string().min(1, 'Trainer ID is required'),
    slotDate: z.string().min(1, 'Slot date is required'),
    timeLabel: z.string().min(2, 'Time slot is required').max(30),
    sessionType: z.enum(['single', 'five_pack', 'ten_pack']),
    contactName: z.string().min(2, 'Contact name is required').max(120),
    contactEmail: z.string().email('Valid contact email is required'),
    contactPhone: z.string().min(7, 'Valid contact phone is required').max(20),
    paymentMethod: z.enum(['esewa', 'khalti', 'card', 'cash']),
    notes: z.string().max(500, 'Notes must be at most 500 characters').optional(),
  })
  .strict();

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;

export const updateBookingStatusSchema = z
  .object({
    status: z.enum(['confirmed', 'cancelled', 'completed']),
    trainerNotes: z.string().max(500).optional(),
  })
  .strict();

export type UpdateBookingStatusRequest = z.infer<typeof updateBookingStatusSchema>;

export const bookingIdParamSchema = z
  .object({
    bookingId: z.string().min(1, 'Booking ID is required'),
  })
  .strict();

export type BookingIdParamRequest = z.infer<typeof bookingIdParamSchema>;
