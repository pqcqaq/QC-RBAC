import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { clientOrigins } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import { requestContextMiddleware } from './middlewares/request-context';
import { apiRouter } from './routes/index';
import { oauth2Router } from './routes/oauth2';

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: clientOrigins,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(requestContextMiddleware);
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
  app.use(oauth2Router);
  app.use('/api', apiRouter);
  app.use(errorHandler);

  return app;
};
