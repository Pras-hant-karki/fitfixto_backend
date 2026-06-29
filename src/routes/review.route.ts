import { Router } from 'express';
import { createReview, updateReview, deleteReview, listReviews, listMyReviews } from '../controllers/review.controller';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation';
import { createReviewSchema, updateReviewSchema, reviewIdParamSchema, reviewListQuerySchema } from '../validations/review.validation';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', validateQuery(reviewListQuerySchema), listReviews);
router.get('/my', authenticate, validateQuery(reviewListQuerySchema), listMyReviews);
router.post('/', authenticate, validateBody(createReviewSchema), createReview);
router.put('/:reviewId', authenticate, validateParams(reviewIdParamSchema), validateBody(updateReviewSchema), updateReview);
router.delete('/:reviewId', authenticate, validateParams(reviewIdParamSchema), deleteReview);

export default router;
