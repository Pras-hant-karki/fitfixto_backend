import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import errorHandler from './middlewares/errorHandler';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'FitFIXto backend is healthy',
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    statusCode: 404,
  });
});

export default app;
