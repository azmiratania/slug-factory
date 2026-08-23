import express from 'express';

import type { UrlShortenerService } from '../../services/url-shortener-service';
import { errorHandler } from './error-handler';
import { requestLogger } from './request-logger';
import { createRedirectRouter, createUrlsRouter } from './routes';

/** Build the Express app with all middleware and routes wired. */
export function createApp(service: UrlShortenerService): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);
  app.use(express.json());

  app.use('/v1', createUrlsRouter(service));
  app.use('/', createRedirectRouter(service));

  app.use(errorHandler);
  return app;
}
