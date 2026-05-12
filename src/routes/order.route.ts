import { Router } from 'express';
import { placeOrder, getOrder, cancelOrder, trackOrder, updateOrderStatus, updatePaymentStatus } from '../controllers/order.controller';
import { validateBody, validateParams } from '../middlewares/validation';
import {
	placeOrderSchema,
	cancelOrderSchema,
	updateOrderStatusSchema,
	updatePaymentStatusSchema,
	orderIdParamSchema,
} from '../validations/order.validation';

const router = Router();

router.post('/', validateBody(placeOrderSchema), placeOrder);
router.post('/place', validateBody(placeOrderSchema), placeOrder);
router.get('/:orderId', validateParams(orderIdParamSchema), getOrder);
router.patch('/:orderId/cancel', validateParams(orderIdParamSchema), validateBody(cancelOrderSchema), cancelOrder);
router.get('/:orderId/track', validateParams(orderIdParamSchema), trackOrder);
router.patch('/:orderId/status', validateParams(orderIdParamSchema), validateBody(updateOrderStatusSchema), updateOrderStatus);
router.patch('/:orderId/payment', validateParams(orderIdParamSchema), validateBody(updatePaymentStatusSchema), updatePaymentStatus);

export default router;
