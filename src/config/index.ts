import type { UrlRepository } from '../domain';
import { InMemoryUrlRepository } from '../infra/persistence/in-memory-url-repository';
import { UrlShortenerService } from '../services/url-shortener-service';

export interface AppConfig {
  port: number;
  /** Base URL used to build short_url values (env: SHORT_URL_BASE). */
  shortUrlBase: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    shortUrlBase: env.SHORT_URL_BASE ?? 'http://localhost:3000',
  };
}

/**
 * DI wiring. The repository implementation is chosen here — to swap storage,
 * replace `InMemoryUrlRepository` with another UrlRepository implementation.
 */
export function createRepository(): UrlRepository {
  return new InMemoryUrlRepository();
}

export function createService(repository: UrlRepository, config: AppConfig): UrlShortenerService {
  return new UrlShortenerService(repository, { shortUrlBase: config.shortUrlBase });
}
