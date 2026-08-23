import { Router } from 'express';

import type { UrlShortenerService } from '../../services/url-shortener-service';

/** POST /v1/urls — create a shortened URL. */
export function createUrlsRouter(service: UrlShortenerService): Router {
  const router = Router();

  router.post('/urls', async (req, res, next) => {
    try {
      const destinationUrl = (req.body ?? {}).destination_url;
      const customUrl = (req.body ?? {}).custom_url;
      const { record, shortUrl } = await service.create(destinationUrl, customUrl);
      res.status(201).json({
        id: record.id,
        slug: record.slug,
        short_url: shortUrl,
        destination_url: record.destinationUrl,
        custom_url: customUrl,
        created_at: record.createdAt,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** GET /:slug — 302 redirect to the destination URL. */
export function createRedirectRouter(service: UrlShortenerService): Router {
  const router = Router();

  router.get('/:slug', async (req, res, next) => {
    try {
      const destination = await service.resolve(req.params.slug);
      res.redirect(302, destination);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
