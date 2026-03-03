import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import cors from 'cors';
import callRouter from './routes/call';
import webhooksRouter from './routes/webhooks';
import loggerMiddleware from './middleware/logger';
import errorHandler from './middleware/errorHandler';

export function createServer() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(bodyParser.json());
  app.use(loggerMiddleware);

  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
  app.use('/api', callRouter);
  // public endpoints for frontend polling
  const apiRouter = require('./routes/api').default;
  app.use('/api', apiRouter);
  app.use('/webhooks', webhooksRouter);

  app.use(errorHandler);

  return app;
}

export default createServer;
