import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validation';
import { addCartItemSchema, updateCartItemSchema, removeCartItemSchema } from '../validations/cart.validation';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../controllers/cart.controller';

const router = Router();

router.use(authenticate);

router.get('/', getCart);
router.post('/', validateBody(addCartItemSchema), addToCart);
router.post('/add', validateBody(addCartItemSchema), addToCart);
router.patch('/update', validateBody(updateCartItemSchema), updateCartItem);
router.delete('/remove', validateBody(removeCartItemSchema), removeFromCart);
router.delete('/clear', clearCart);

export default router;
