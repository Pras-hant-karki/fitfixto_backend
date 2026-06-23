import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { HTTP_STATUS } from '../constants/app.constants';
import Product from '../models/Product';
import { RequestWithUser } from '../middlewares/auth';
import { AppError } from '../utils/appError';
import { ProductCategory, UserRole } from '../types/index';

type ProductQuery = {
  search?: string;
  category?: ProductCategory[];
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  maxRating?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'price' | 'name' | 'stock' | 'updatedAt';
  order?: 'asc' | 'desc';
  sort?: `${'price' | 'name' | 'stock' | 'createdAt' | 'updatedAt'}_${'asc' | 'desc'}`;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createProduct = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const product = await Product.create({
    ...req.body,
    images: Array.isArray(req.body.images) ? req.body.images : [],
    verifiedBadge: req.body.verifiedBadge ?? false,
  });

  return sendSuccess(
    res,
    'Product created successfully',
    { product },
    HTTP_STATUS.CREATED
  ) as any;
});

const listProducts = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const {
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    minRating,
    maxRating,
    isFeatured,
    isActive,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    order = 'desc',
    sort,
  } = req.query as unknown as ProductQuery;

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
  }

  if (category?.length) {
    filter.category = { $in: category };
  }

  if (brand) {
    const brands = brand
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (brands.length === 1) {
      filter.brand = { $regex: `^${escapeRegExp(brands[0])}$`, $options: 'i' };
    } else if (brands.length > 1) {
      filter.brand = { $in: brands.map((value) => new RegExp(`^${escapeRegExp(value)}$`, 'i')) };
    }
  }

  if (typeof minPrice === 'number') {
    filter.price = { ...(filter.price as Record<string, unknown>), $gte: minPrice };
  }

  if (typeof maxPrice === 'number') {
    filter.price = { ...(filter.price as Record<string, unknown>), $lte: maxPrice };
  }

  if (typeof minRating === 'number') {
    filter.averageRating = {
      ...(filter.averageRating as Record<string, unknown>),
      $gte: minRating,
    };
  }

  if (typeof maxRating === 'number') {
    filter.averageRating = {
      ...(filter.averageRating as Record<string, unknown>),
      $lte: maxRating,
    };
  }

  if (typeof isFeatured === 'boolean') {
    filter.isFeatured = isFeatured;
  }

  const isAdmin = req.user?.role === UserRole.ADMIN;

  if (typeof isActive === 'boolean' && isAdmin) {
    filter.isActive = isActive;
  } else if (!isAdmin) {
    filter.isActive = true;
  }

  const skip = (page - 1) * limit;
  const [sortFieldFromParam, sortOrderFromParam] = sort ? sort.split('_') : [];
  const finalSortBy = (sortFieldFromParam || sortBy) as NonNullable<ProductQuery['sortBy']>;
  const finalOrder = (sortOrderFromParam || order) as NonNullable<ProductQuery['order']>;
  const sortDirection = finalOrder === 'asc' ? 1 : -1;

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ [finalSortBy]: sortDirection }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  return sendSuccess(
    res,
    'Products fetched successfully',
    {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    },
    HTTP_STATUS.OK
  ) as any;
});

const getProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { productId } = req.params;

  const product = await Product.findById(productId);

  if (!product) {
    throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(
    res,
    'Product fetched successfully',
    { product },
    HTTP_STATUS.OK
  ) as any;
});

const updateProduct = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { productId } = req.params;
  const product = await Product.findByIdAndUpdate(productId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(
    res,
    'Product updated successfully',
    { product },
    HTTP_STATUS.OK
  ) as any;
});

const deleteProduct = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { productId } = req.params;
  const product = await Product.findByIdAndDelete(productId);

  if (!product) {
    throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(
    res,
    'Product deleted successfully',
    { productId },
    HTTP_STATUS.OK
  ) as any;
});

const uploadProductImages = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    return sendError(res, 'No product images uploaded', HTTP_STATUS.BAD_REQUEST) as any;
  }

  const images = req.files.map((file) => ({
    filename: file.filename,
    path: `/uploads/${file.filename}`,
    mimetype: file.mimetype,
  }));

  return sendSuccess(
    res,
    'Product images uploaded successfully',
    { images },
    HTTP_STATUS.OK
  ) as any;
});

const compareProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const idsInput = req.query.ids;
  const ids = Array.isArray(idsInput) ? idsInput : idsInput;

  const parsedIds = Array.isArray(ids)
    ? ids
    : String(ids)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

  const products = await Product.find({ _id: { $in: parsedIds } }).select(
    'name description specifications price category brand stock tags averageRating ratingCount verifiedBadge discountPercentage weight dimensions images'
  );

  if (products.length < 2) {
    throw new AppError('At least 2 valid products are required for comparison', HTTP_STATUS.BAD_REQUEST);
  }

  return sendSuccess(
    res,
    'Products compared successfully',
    {
      comparedCount: products.length,
      products,
    },
    HTTP_STATUS.OK
  ) as any;
});

export { createProduct, listProducts, getProduct, updateProduct, deleteProduct, uploadProductImages, compareProducts };
