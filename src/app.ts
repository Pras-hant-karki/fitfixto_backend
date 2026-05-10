import express from 'express';
import { API_PREFIX } from './constants/app.constants';
import errorHandler from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { apiRateLimiter } from './middlewares/rateLimiter';
import { requestLogger } from './middlewares/requestLogger';
import { corsMiddleware, securityHeaders } from './middlewares/security';
import apiRouter from './routes';

const app = express();

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(API_PREFIX, apiRateLimiter, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
