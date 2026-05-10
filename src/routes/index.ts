import { Router } from 'express';
import healthRouter from './health.route';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);

export default apiRouter;
