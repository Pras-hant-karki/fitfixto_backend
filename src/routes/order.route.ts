import { Router } from 'express';
import { createOrder, getOrder, updateOrderStatus, updatePaymentStatus } from '../controllers/order.controller';
import { validateBody, validateParams } from '../middlewares/validation';
import { createOrderSchema, updateOrderStatusSchema, updatePaymentStatusSchema, orderIdParamSchema } from '../validations/order.validation';

const router = Router();

router.post('/', validateBody(createOrderSchema), createOrder);
router.get('/:orderId', validateParams(orderIdParamSchema), getOrder);
router.patch('/:orderId/status', validateParams(orderIdParamSchema), validateBody(updateOrderStatusSchema), updateOrderStatus);
router.patch('/:orderId/payment', validateParams(orderIdParamSchema), validateBody(updatePaymentStatusSchema), updatePaymentStatus);

export default router;
