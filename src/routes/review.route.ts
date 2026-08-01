import { Router } from 'express';
import { createReview, updateReview, deleteReview, listReviews } from '../controllers/review.controller';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation';
import { createReviewSchema, updateReviewSchema, reviewIdParamSchema, reviewListQuerySchema } from '../validations/review.validation';

const router = Router();

router.post('/', validateBody(createReviewSchema), createReview);
router.get('/', validateQuery(reviewListQuerySchema), listReviews);
router.get('/:reviewId', validateParams(reviewIdParamSchema), listReviews);
router.put('/:reviewId', validateParams(reviewIdParamSchema), validateBody(updateReviewSchema), updateReview);
router.delete('/:reviewId', validateParams(reviewIdParamSchema), deleteReview);

export default router;
