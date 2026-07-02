import express from 'express';
import { API_PREFIX } from './constants/app.constants';
import env from './config/env';
import errorHandler from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { apiRateLimiter } from './middlewares/rateLimiter';
import { requestLogger } from './middlewares/requestLogger';
import { corsMiddleware, securityHeaders } from './middlewares/security';
import apiRouter from './routes';
import { resolveUploadDir } from './utils/uploadPath';

const app = express();

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded assets at /assets (cross-origin so frontend on port 3000 can load images)
app.use('/assets', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(resolveUploadDir(env.UPLOAD_DIR)));

app.use(API_PREFIX, apiRateLimiter, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
