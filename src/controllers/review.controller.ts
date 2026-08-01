import { Response } from 'express';
import { Types } from 'mongoose';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Booking from '../models/Booking';
import Order from '../models/Order';
import Product from '../models/Product';
import Review from '../models/Review';
import ServiceBooking from '../models/ServiceBooking';
import User from '../models/User';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { OrderStatus, UserRole } from '../types/index';
import {
  AdminReviewListQueryRequest,
  CreateReviewRequest,
  ReviewFeatureRequest,
  ReviewListQueryRequest,
  ReviewModerationRequest,
  UpdateReviewRequest,
} from '../validations/review.validation';

const approvedReviewMatch = {
  isActive: true,
  $or: [{ moderationStatus: 'approved' }, { moderationStatus: { $exists: false } }],
};

const recalculateProductRating = async (productId: Types.ObjectId | string) => {
  const [stats] = await Review.aggregate([
    {
      $match: {
        productId: new Types.ObjectId(productId.toString()),
        ...approvedReviewMatch,
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
  const filter: Record<string, unknown> = { ...approvedReviewMatch };

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
      moderationStatus: 'approved',
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

  if (!review || !review.isActive || review.moderationStatus === 'removed') {
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
  review.moderationStatus = 'removed';
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

const listAdminReviews = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const {
    productId,
    userId,
    status = 'all',
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    order = 'desc',
  } = req.query as unknown as AdminReviewListQueryRequest;

  const conditions: Record<string, unknown>[] = [];

  if (productId) conditions.push({ productId });
  if (userId) conditions.push({ userId });

  if (status === 'approved') {
    conditions.push({
      isActive: true,
      $or: [{ moderationStatus: 'approved' }, { moderationStatus: { $exists: false } }],
    });
  } else if (status === 'removed') {
    conditions.push({ $or: [{ isActive: false }, { moderationStatus: 'removed' }] });
  }

  if (search?.trim()) {
    const regex = new RegExp(escapeRegExp(search.trim()), 'i');
    const [matchingUsers, matchingProducts] = await Promise.all([
      User.find({ $or: [{ firstName: regex }, { lastName: regex }, { email: regex }] }).select('_id'),
      Product.find({ $or: [{ name: regex }, { brand: regex }, { category: regex }] }).select('_id'),
    ]);

    const orParts: Record<string, unknown>[] = [{ title: regex }, { comment: regex }];
    if (matchingUsers.length) orParts.push({ userId: { $in: matchingUsers.map((u) => u._id) } });
    if (matchingProducts.length) orParts.push({ productId: { $in: matchingProducts.map((p) => p._id) } });

    conditions.push({ $or: orParts });
  }

  const filter = conditions.length > 0 ? { $and: conditions } : {};
  const skip = (page - 1) * limit;
  const sortDirection = order === 'asc' ? 1 : -1;

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('productId', 'name category brand images price averageRating ratingCount')
      .populate('userId', 'firstName lastName email')
      .populate('orderId', 'orderNumber status totalAmount createdAt')
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  return sendSuccess(
    res,
    'Admin reviews fetched successfully',
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
});

const moderateReview = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { reviewId } = req.params;
  const { status } = req.body as ReviewModerationRequest;

  const review = await Review.findById(reviewId);

  if (!review) {
    throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);
  }

  review.moderationStatus = status;
  review.isActive = status === 'approved';
  await review.save();
  await recalculateProductRating(review.productId);

  const populatedReview = await Review.findById(review._id)
    .populate('productId', 'name category brand images price averageRating ratingCount')
    .populate('userId', 'firstName lastName email')
    .populate('orderId', 'orderNumber status totalAmount createdAt');

  return sendSuccess(
    res,
    status === 'approved' ? 'Review approved successfully' : 'Review removed successfully',
    { review: populatedReview },
    HTTP_STATUS.OK
  ) as any;
});

/**
 * Homepage testimonials, drawn from all three review sources.
 *
 * Product reviews are their own collection, while trainer-session and service reviews are
 * fields on their booking documents. They are normalised into one shape here so the homepage
 * can render them uniformly.
 */
const listFeaturedReviews = asyncHandler(async (_req, res: Response): Promise<void> => {
  const [productReviews, trainerBookings, serviceBookings] = await Promise.all([
    Review.find({ isFeatured: true, isActive: true, moderationStatus: 'approved' })
      .populate('userId', 'firstName lastName profilePicture')
      .populate('productId', 'name')
      .sort({ updatedAt: -1 })
      .limit(10),
    Booking.find({ reviewIsFeatured: true, reviewModerationStatus: 'approved', clientRating: { $gte: 1 } })
      .populate('clientId', 'firstName lastName profilePicture')
      .populate({ path: 'trainerId', select: 'userId', populate: { path: 'userId', select: 'firstName lastName' } })
      .sort({ updatedAt: -1 })
      .limit(10),
    ServiceBooking.find({ reviewIsFeatured: true, reviewModerationStatus: 'approved', clientRating: { $gte: 1 } })
      .populate('clientId', 'firstName lastName profilePicture')
      .populate('serviceId', 'name')
      .sort({ updatedAt: -1 })
      .limit(10),
  ]);

  const normalisedProduct = productReviews.map((review) => {
    const author = review.userId as unknown as { firstName?: string; lastName?: string; profilePicture?: string };
    const product = review.productId as unknown as { name?: string };
    return {
      id: review._id,
      kind: 'product' as const,
      rating: review.rating,
      comment: review.comment || review.title || '',
      subject: product?.name || 'Product',
      authorName: `${author?.firstName ?? ''} ${author?.lastName ?? ''}`.trim(),
      authorPicture: author?.profilePicture || null,
      updatedAt: review.updatedAt,
    };
  });

  const normalisedTrainer = trainerBookings.map((booking) => {
    const author = booking.clientId as unknown as { firstName?: string; lastName?: string; profilePicture?: string };
    const trainer = booking.trainerId as unknown as { userId?: { firstName?: string; lastName?: string } };
    const trainerName = `${trainer?.userId?.firstName ?? ''} ${trainer?.userId?.lastName ?? ''}`.trim();
    return {
      id: booking._id,
      kind: 'trainer' as const,
      rating: booking.clientRating ?? 0,
      comment: booking.clientComment || '',
      subject: trainerName || 'Trainer session',
      authorName: `${author?.firstName ?? ''} ${author?.lastName ?? ''}`.trim(),
      authorPicture: author?.profilePicture || null,
      updatedAt: booking.updatedAt,
    };
  });

  const normalisedService = serviceBookings.map((booking) => {
    const author = booking.clientId as unknown as { firstName?: string; lastName?: string; profilePicture?: string };
    const service = booking.serviceId as unknown as { name?: string };
    return {
      id: booking._id,
      kind: 'service' as const,
      rating: booking.clientRating ?? 0,
      comment: booking.clientComment || '',
      subject: service?.name || 'Service',
      authorName: `${author?.firstName ?? ''} ${author?.lastName ?? ''}`.trim(),
      authorPicture: author?.profilePicture || null,
      updatedAt: booking.updatedAt,
    };
  });

  const reviews = [...normalisedProduct, ...normalisedTrainer, ...normalisedService]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 12);

  return sendSuccess(res, 'Featured reviews fetched successfully', { reviews }, HTTP_STATUS.OK) as any;
});

const featureReview = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { reviewId } = req.params;
  const { isFeatured } = req.body as ReviewFeatureRequest;

  const review = await Review.findByIdAndUpdate(
    reviewId,
    { isFeatured },
    { new: true }
  )
    .populate('productId', 'name category brand images price averageRating ratingCount')
    .populate('userId', 'firstName lastName email')
    .populate('orderId', 'orderNumber status totalAmount createdAt');

  if (!review) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);

  return sendSuccess(
    res,
    isFeatured ? 'Review featured on homepage' : 'Review removed from homepage',
    { review },
    HTTP_STATUS.OK
  ) as any;
});

/**
 * Trainer-session and service reviews live on their booking documents rather than in the
 * Review collection, so they need their own moderation handlers. Behaviour matches
 * featureReview/moderateReview so the admin console can treat all three review kinds alike.
 */
// Booking and ServiceBooking are separate models with the same review fields. Selecting
// between them inline keeps each branch's document type concrete for the compiler.
const findBookingReview = async (kind: 'trainer' | 'service', bookingId: string) =>
  kind === 'trainer' ? Booking.findById(bookingId) : ServiceBooking.findById(bookingId);

const featureBookingReview = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { kind, bookingId } = req.params as { kind: 'trainer' | 'service'; bookingId: string };
  const { isFeatured } = req.body as ReviewFeatureRequest;

  const booking = await findBookingReview(kind, bookingId);

  if (!booking) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);

  if (!booking.clientRating) {
    throw new AppError('This booking has no review to feature', HTTP_STATUS.BAD_REQUEST);
  }

  booking.reviewIsFeatured = isFeatured;
  await booking.save();

  return sendSuccess(
    res,
    isFeatured ? 'Review featured on homepage' : 'Review removed from homepage',
    { id: booking._id, kind, isFeatured: booking.reviewIsFeatured },
    HTTP_STATUS.OK
  ) as any;
});

const moderateBookingReview = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { kind, bookingId } = req.params as { kind: 'trainer' | 'service'; bookingId: string };
  const { status } = req.body as ReviewModerationRequest;

  const booking = await findBookingReview(kind, bookingId);

  if (!booking) throw new AppError('Review not found', HTTP_STATUS.NOT_FOUND);

  booking.reviewModerationStatus = status;
  // A removed review must not keep appearing on the homepage.
  if (status === 'removed') booking.reviewIsFeatured = false;
  await booking.save();

  return sendSuccess(
    res,
    status === 'approved' ? 'Review approved successfully' : 'Review removed successfully',
    {
      id: booking._id,
      kind,
      moderationStatus: booking.reviewModerationStatus,
      isFeatured: booking.reviewIsFeatured,
    },
    HTTP_STATUS.OK
  ) as any;
});

export {
  createReview,
  updateReview,
  deleteReview,
  listReviews,
  listMyReviews,
  listAdminReviews,
  moderateReview,
  listFeaturedReviews,
  featureReview,
  featureBookingReview,
  moderateBookingReview,
};
