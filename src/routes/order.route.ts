import { Router } from 'express';
import { placeOrder, getOrder, getMyOrders, cancelOrder, trackOrder, updateOrderStatus, updatePaymentStatus, downloadInvoice } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth';
import { validateBody, validateParams } from '../middlewares/validation';
import {
	placeOrderSchema,
	cancelOrderSchema,
	updateOrderStatusSchema,
	updatePaymentStatusSchema,
	orderIdParamSchema,
} from '../validations/order.validation';

const router = Router();

router.use(authenticate);

router.get('/my-orders', getMyOrders);
router.post('/', validateBody(placeOrderSchema), placeOrder);
router.post('/place', validateBody(placeOrderSchema), placeOrder);
router.get('/:orderId', validateParams(orderIdParamSchema), getOrder);
router.patch('/:orderId/cancel', validateParams(orderIdParamSchema), validateBody(cancelOrderSchema), cancelOrder);
router.get('/:orderId/track', validateParams(orderIdParamSchema), trackOrder);
router.get('/:orderId/invoice', validateParams(orderIdParamSchema), downloadInvoice);
router.patch('/:orderId/status', validateParams(orderIdParamSchema), validateBody(updateOrderStatusSchema), updateOrderStatus);
router.patch('/:orderId/payment', validateParams(orderIdParamSchema), validateBody(updatePaymentStatusSchema), updatePaymentStatus);

export default router;
