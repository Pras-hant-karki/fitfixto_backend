import { Router } from 'express';
import {
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
} from '../controllers/review.controller';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation';
import {
  adminReviewListQuerySchema,
  bookingReviewKindParamSchema,
  createReviewSchema,
  reviewFeatureSchema,
  reviewIdParamSchema,
  reviewListQuerySchema,
  reviewModerationSchema,
  updateReviewSchema,
} from '../validations/review.validation';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '../types/index';

const router = Router();

router.get('/', validateQuery(reviewListQuerySchema), listReviews);
router.get('/featured', listFeaturedReviews);
router.get('/my', authenticate, validateQuery(reviewListQuerySchema), listMyReviews);
router.get('/admin', authenticate, authorize(UserRole.ADMIN), validateQuery(adminReviewListQuerySchema), listAdminReviews);
router.post('/', authenticate, validateBody(createReviewSchema), createReview);
router.patch(
  '/admin/:reviewId/moderation',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(reviewIdParamSchema),
  validateBody(reviewModerationSchema),
  moderateReview
);
router.patch(
  '/admin/:reviewId/feature',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(reviewIdParamSchema),
  validateBody(reviewFeatureSchema),
  featureReview
);
// Trainer-session and service reviews are stored on their booking documents, so they get
// their own moderation routes. Registered before /:reviewId so the literal prefix wins.
router.patch(
  '/admin/booking/:kind/:bookingId/feature',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(bookingReviewKindParamSchema),
  validateBody(reviewFeatureSchema),
  featureBookingReview
);
router.patch(
  '/admin/booking/:kind/:bookingId/moderation',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(bookingReviewKindParamSchema),
  validateBody(reviewModerationSchema),
  moderateBookingReview
);

router.put('/:reviewId', authenticate, validateParams(reviewIdParamSchema), validateBody(updateReviewSchema), updateReview);
router.delete('/:reviewId', authenticate, validateParams(reviewIdParamSchema), deleteReview);

export default router;
