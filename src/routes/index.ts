import { Router } from 'express';
import healthRouter from './health.route';
import authRouter from './auth.route';
import deliveryAddressRouter from './deliveryAddress.route';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/delivery-addresses', deliveryAddressRouter);

export default apiRouter;
