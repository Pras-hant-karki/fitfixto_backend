import { Router } from 'express';
import healthRouter from './health.route';
import authRouter from './auth.route';
import deliveryAddressRouter from './deliveryAddress.route';
import productRouter from './product.route';
import orderRouter from './order.route';
import reviewRouter from './review.route';
import cartRouter from './cart.route';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/delivery-addresses', deliveryAddressRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/reviews', reviewRouter);
apiRouter.use('/cart', cartRouter);

export default apiRouter;
