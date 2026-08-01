import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validation';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlist.controller';
import { wishlistProductSchema } from '../validations/wishlist.validation';

const router = Router();

router.use(authenticate);

router.get('/', getWishlist);
router.post('/', validateBody(wishlistProductSchema), addToWishlist);
router.delete('/', validateBody(wishlistProductSchema), removeFromWishlist);

export default router;
