import { Response } from 'express';
import { Types } from 'mongoose';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Order from '../models/Order';
import Product from '../models/Product';
import Review from '../models/Review';
import { OrderStatus, UserRole } from '../types/index';
import { CreateReviewRequest, ReviewListQueryRequest, UpdateReviewRequest } from '../validations/review.validation';

const recalculateProductRating = async (productId: Types.ObjectId | string) => {
  const [stats] = await Review.aggregate([
    {
      $match: {
        productId: new Types.ObjectId(productId.toString()),
        isActive: true,
      },
    },
    {
      $group: {
        _id: '$productId',
        averageRating: { $avg: '$rating' },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  await Product.findByIdAndUpdate(productId, {
    averageRating: stats ? Math.round(stats.averageRating * 10) / 10 : 0,
    ratingCount: stats?.ratingCount ?? 0,
  });
};

const sendReviewList = async (
  res: Response,
  query: ReviewListQueryRequest,
  forcedUserId?: string
) => {
  const { productId, userId, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = query;
  const filter: Record<string, unknown> = { isActive: true };

  if (productId) {
    filter.productId = productId;
  }

  if (forcedUserId || userId) {
    filter.userId = forcedUserId || userId;
  }

  const skip = (page - 1) * limit;
  const sortDirection = order === 'asc' ? 1 : -1;

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('productId', 'name category brand images price averageRating ratingCount')
      .populate('userId', 'firstName lastName email')
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  return sendSuccess(
    res,
    'Reviews fetched successfully',
    {
      reviews,
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
};

const createReview = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  if (req.user.role !== UserRole.CUSTOMER) {
    throw new AppError('Only customers can submit product reviews', HTTP_STATUS.FORBIDDEN);
  }

  const { productId, orderId, rating, title, comment } = req.body as CreateReviewRequest;

  const order = await Order.findOne({
    _id: orderId,
    userId: req.user._id,
    status: OrderStatus.DELIVERED,
    'items.productId': productId,
  });

  if (!order) {
    throw new AppError('Only delivered purchased products can be reviewed', HTTP_STATUS.BAD_REQUEST);
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);
  }

  const existingReview = await Review.findOne({ userId: req.user._id, productId, orderId });
  if (existingReview) {
    throw new AppError('You have already reviewed this product from this order', HTTP_STATUS.CONFLICT);
  }

  const review = await Review.create({
    userId: req.user._id,
    productId,
    orderId,
    rating,
    title,
    comment,
  });

  await recalculateProductRating(productId);

  const populatedReview = await Review.findById(review._id)
    .populate('productId', 'name category brand images price averageRating ratingCount')
    .populate('userId', 'firstName lastName email');

  return sendSuccess(res, 'Review submitted successfully', { review: populatedReview }, HTTP_STATUS.CREATED) as any;
});

const updateReview = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { reviewId } = req.params;
  const updates = req.body as UpdateReviewRequest;
  const review = await Review.findById(reviewId);

  if (!review || !review.isActive) {
    throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
  }

  const isOwner = review.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === UserRole.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError('Forbidden', HTTP_STATUS.FORBIDDEN);
  }

  if (updates.rating !== undefined) review.rating = updates.rating;
  if (updates.title !== undefined) review.title = updates.title;
  if (updates.comment !== undefined) review.comment = updates.comment;
  await review.save();
  await recalculateProductRating(review.productId);

  const populatedReview = await Review.findById(review._id)
    .populate('productId', 'name category brand images price averageRating ratingCount')
    .populate('userId', 'firstName lastName email');

  return sendSuccess(res, 'Review updated successfully', { review: populatedReview }, HTTP_STATUS.OK) as any;
});

const deleteReview = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { reviewId } = req.params;
  const review = await Review.findById(reviewId);

  if (!review || !review.isActive) {
    throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
  }

  const isOwner = review.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === UserRole.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError('Forbidden', HTTP_STATUS.FORBIDDEN);
  }

  review.isActive = false;
  await review.save();
  await recalculateProductRating(review.productId);

  return sendSuccess(res, 'Review deleted successfully', { reviewId }, HTTP_STATUS.OK) as any;
});

const listReviews = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  return sendReviewList(res, req.query as unknown as ReviewListQueryRequest);
});

const listMyReviews = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  return sendReviewList(res, req.query as unknown as ReviewListQueryRequest, req.user._id.toString());
});

export { createReview, updateReview, deleteReview, listReviews, listMyReviews };
