import { z } from 'zod';
const imageUrlSchema = z.string().refine(
  (value) => {
    if (!value.trim()) {
      return false;
    }

    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return /^\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/.test(value);
    }
  },
  { message: 'Invalid image URL' }
);

const productDimensionsSchema = z
  .object({
    length: z.number().positive('Length must be greater than 0').optional(),
    width: z.number().positive('Width must be greater than 0').optional(),
    height: z.number().positive('Height must be greater than 0').optional(),
  })
  .strict()
  .partial();

const productCategoryListSchema = z
  .string()
  .min(1)
  .transform((value) => value.split(',').map((category) => category.trim()).filter(Boolean));

export const createProductSchema = z
  .object({
    name: z.string().min(2, 'Product name must be at least 2 characters').max(150),
    description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
    specifications: z.string().max(2000, 'Specifications must be at most 2000 characters').optional(),
    importedFrom: z.string().max(2000, 'Imported from must be at most 2000 characters').optional(),
    price: z.number().positive('Price must be greater than 0'),
    stock: z.number().int().nonnegative('Stock cannot be negative'),
    category: z.string().min(2, 'Category must be at least 2 characters').max(100),
    subcategory: z.string().min(2, 'Subcategory must be at least 2 characters').max(100).optional(),
    brand: z.string().min(2, 'Brand must be at least 2 characters').max(100).optional(),
    images: z.array(imageUrlSchema).optional().default([]),
    tags: z.array(z.string().min(1)).optional(),
    sku: z.string().min(2, 'SKU must be at least 2 characters').max(100).optional(),
    discountPercentage: z
      .number()
      .min(0, 'Discount cannot be negative')
      .max(100, 'Discount cannot exceed 100')
      .optional(),
    warrantyMonths: z.number().int().nonnegative('Warranty cannot be negative').optional(),
    weight: z.number().positive('Weight must be greater than 0').optional(),
    weightUnit: z.enum(['gm', 'kg']).optional().default('kg'),
    dimensions: productDimensionsSchema.optional(),
    isFeatured: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    verifiedBadge: z.boolean().optional().default(false),
  })
  .strict();

export type CreateProductRequest = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: z.string().min(2, 'Product name must be at least 2 characters').max(150).optional(),
    description: z.string().min(10, 'Description must be at least 10 characters').max(2000).optional(),
    specifications: z.string().max(2000, 'Specifications must be at most 2000 characters').optional(),
    importedFrom: z.string().max(2000, 'Imported from must be at most 2000 characters').optional(),
    price: z.number().positive('Price must be greater than 0').optional(),
    stock: z.number().int().nonnegative('Stock cannot be negative').optional(),
    category: z.string().min(2, 'Category must be at least 2 characters').max(100).optional(),
    subcategory: z.string().min(2, 'Subcategory must be at least 2 characters').max(100).optional(),
    brand: z.string().min(2, 'Brand must be at least 2 characters').max(100).optional(),
    images: z.array(imageUrlSchema).optional(),
    tags: z.array(z.string().min(1)).optional(),
    sku: z.string().min(2, 'SKU must be at least 2 characters').max(100).optional(),
    discountPercentage: z
      .number()
      .min(0, 'Discount cannot be negative')
      .max(100, 'Discount cannot exceed 100')
      .optional(),
    warrantyMonths: z.number().int().nonnegative('Warranty cannot be negative').optional(),
    weight: z.number().positive('Weight must be greater than 0').optional(),
    weightUnit: z.enum(['gm', 'kg']).optional(),
    dimensions: productDimensionsSchema.optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    verifiedBadge: z.boolean().optional(),
  })
  .strict();

export type UpdateProductRequest = z.infer<typeof updateProductSchema>;

export const productIdParamSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
  })
  .strict();

export type ProductIdParamRequest = z.infer<typeof productIdParamSchema>;

export const productListQuerySchema = z
  .object({
    search: z.string().optional(),
    category: productCategoryListSchema.optional(),
    subcategory: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),
    isFeatured: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    sortBy: z
      .enum(['createdAt', 'price', 'name', 'stock', 'updatedAt'])
      .optional()
      .default('createdAt'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    sort: z
      .enum([
        'price_asc',
        'price_desc',
        'name_asc',
        'name_desc',
        'stock_asc',
        'stock_desc',
        'createdAt_asc',
        'createdAt_desc',
        'updatedAt_asc',
        'updatedAt_desc',
      ])
      .optional(),
  })
  .strict();

export type ProductListQueryRequest = z.infer<typeof productListQuerySchema>;

export const compareProductsQuerySchema = z
  .object({
    ids: z
      .string()
      .min(1, 'ids is required')
      .transform((value) => value.split(',').map((id) => id.trim()).filter(Boolean))
      .refine((ids) => ids.length >= 2, {
        message: 'At least 2 product IDs are required for comparison',
      })
      .refine((ids) => ids.length <= 5, {
        message: 'You can compare up to 5 products at a time',
      }),
  })
  .strict();

export type CompareProductsQueryRequest = z.infer<typeof compareProductsQuerySchema>;
