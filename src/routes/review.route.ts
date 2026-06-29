import { Router } from 'express';
import {
  createReview,
  updateReview,
  deleteReview,
  listReviews,
  listMyReviews,
  listAdminReviews,
  moderateReview,
} from '../controllers/review.controller';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation';
import {
  adminReviewListQuerySchema,
  createReviewSchema,
  reviewIdParamSchema,
  reviewListQuerySchema,
  reviewModerationSchema,
  updateReviewSchema,
} from '../validations/review.validation';
import { authenticate, authorize } from '../middlewares/auth';
import { UserRole } from '../types/index';

const router = Router();

router.get('/', validateQuery(reviewListQuerySchema), listReviews);
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
router.put('/:reviewId', authenticate, validateParams(reviewIdParamSchema), validateBody(updateReviewSchema), updateReview);
router.delete('/:reviewId', authenticate, validateParams(reviewIdParamSchema), deleteReview);

export default router;
