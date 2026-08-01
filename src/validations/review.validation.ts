import { z } from 'zod';

export const ratingSchema = z
  .number()
  .int()
  .min(1, 'Rating must be at least 1')
  .max(5, 'Rating cannot exceed 5');

export const createReviewSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required').optional(),
    trainerId: z.string().min(1, 'Trainer ID is required').optional(),
    rating: ratingSchema,
    title: z.string().min(1).max(150).optional(),
    comment: z.string().min(1).max(2000).optional(),
  })
  .strict()
  .refine((data) => !!data.productId || !!data.trainerId, {
    message: 'Either productId or trainerId is required',
    path: ['productId'],
  });

export type CreateReviewRequest = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z
  .object({
    rating: ratingSchema.optional(),
    title: z.string().min(1).max(150).optional(),
    comment: z.string().min(1).max(2000).optional(),
  })
  .strict();

export type UpdateReviewRequest = z.infer<typeof updateReviewSchema>;

export const reviewIdParamSchema = z
  .object({
    reviewId: z.string().min(1, 'Review ID is required'),
  })
  .strict();

export type ReviewIdParamRequest = z.infer<typeof reviewIdParamSchema>;

export const reviewListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .strict();

export type ReviewListQueryRequest = z.infer<typeof reviewListQuerySchema>;
