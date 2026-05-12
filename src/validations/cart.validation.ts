import { z } from 'zod';

export const addCartItemSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional().default(1),
  })
  .strict();

export type AddCartItemRequest = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.coerce.number().int().min(0, 'Quantity must be 0 or greater'),
  })
  .strict();

export type UpdateCartItemRequest = z.infer<typeof updateCartItemSchema>;

export const removeCartItemSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
  })
  .strict();

export type RemoveCartItemRequest = z.infer<typeof removeCartItemSchema>;
