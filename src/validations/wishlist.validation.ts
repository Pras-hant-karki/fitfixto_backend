import { z } from 'zod';

export const wishlistProductSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
  })
  .strict();

export type WishlistProductRequest = z.infer<typeof wishlistProductSchema>;
