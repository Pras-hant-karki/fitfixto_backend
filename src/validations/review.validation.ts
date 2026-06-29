import { z } from 'zod';

export const ratingSchema = z
  .number()
  .int()
  .min(1, 'Rating must be at least 1')
  .max(5, 'Rating cannot exceed 5');

export const createReviewSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
    orderId: z.string().min(1, 'Order ID is required'),
    rating: ratingSchema,
    title: z.string().min(1).max(150).optional(),
    comment: z.string().min(1).max(2000).optional(),
  })
  .strict();

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
    productId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z.enum(['createdAt', 'rating']).optional().default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .strict();

export type ReviewListQueryRequest = z.infer<typeof reviewListQuerySchema>;

export const adminReviewListQuerySchema = reviewListQuerySchema.extend({
  status: z.enum(['all', 'approved', 'removed']).optional().default('all'),
  search: z.string().trim().optional(),
});

export type AdminReviewListQueryRequest = z.infer<typeof adminReviewListQuerySchema>;

export const reviewModerationSchema = z
  .object({
    status: z.enum(['approved', 'removed']),
  })
  .strict();

export type ReviewModerationRequest = z.infer<typeof reviewModerationSchema>;
