import { z } from 'zod';

export const createDeliveryAddressSchema = z.object({
  recipientName: z.string().min(2, 'Recipient name must be at least 2 characters').max(100),
  phone: z
    .string()
    .regex(
      /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
      'Invalid phone number'
    ),
  street: z.string().min(5, 'Street address must be at least 5 characters').max(255),
  city: z.string().min(2, 'City must be at least 2 characters').max(100),
  state: z.string().min(2, 'State must be at least 2 characters').max(100),
  postalCode: z.string().min(2, 'Postal code must be at least 2 characters').max(20),
  country: z.string().min(2, 'Country must be at least 2 characters').max(100),
  isDefault: z.boolean().optional().default(false),
});

export type CreateDeliveryAddressRequest = z.infer<typeof createDeliveryAddressSchema>;

export const updateDeliveryAddressSchema = z.object({
  recipientName: z.string().min(2, 'Recipient name must be at least 2 characters').max(100).optional(),
  phone: z
    .string()
    .regex(
      /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
      'Invalid phone number'
    )
    .optional(),
  street: z.string().min(5, 'Street address must be at least 5 characters').max(255).optional(),
  city: z.string().min(2, 'City must be at least 2 characters').max(100).optional(),
  state: z.string().min(2, 'State must be at least 2 characters').max(100).optional(),
  postalCode: z.string().min(2, 'Postal code must be at least 2 characters').max(20).optional(),
  country: z.string().min(2, 'Country must be at least 2 characters').max(100).optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateDeliveryAddressRequest = z.infer<typeof updateDeliveryAddressSchema>;
