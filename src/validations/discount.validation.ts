import { z } from 'zod';

export const updateFlashSaleSchema = z
  .object({
    title: z.string().trim().max(150).optional().or(z.literal('')),
    discountPercentage: z.number().min(0).max(100).optional(),
    endsAt: z.string().datetime({ offset: true }).optional().nullable().or(z.literal('')),
    productIds: z.array(z.string().min(1)).optional().default([]),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateBestPriceSchema = z
  .object({
    productIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const updateRefundGuaranteeSchema = z
  .object({
    refundGuarantee: z.string().trim().max(1000),
  })
  .strict();

export const createBundleSchema = z
  .object({
    title: z.string().trim().min(2).max(150),
    description: z.string().trim().max(300).optional().or(z.literal('')),
    image: z.string().trim().optional().or(z.literal('')),
    productIds: z.array(z.string().min(1)).min(2, 'Bundle must have at least 2 products'),
    discountPercentage: z.number().min(1).max(99),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateBundleSchema = createBundleSchema.partial();

export const bundleIdParamSchema = z
  .object({ bundleId: z.string().min(1) })
  .strict();
