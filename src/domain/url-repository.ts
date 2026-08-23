import type { ShortUrl } from './short-url';

/**
 * Persistence abstraction. Services depend only on this interface, never on a
 * concrete implementation — swapping storage (e.g. to Postgres/Redis) means
 * adding a new class under `src/infra/persistence/` and changing one line in
 * `src/config/`.
 */
export interface UrlRepository {
  create(entry: Omit<ShortUrl, 'id'>): Promise<ShortUrl>;
  findBySlug(slug: string): Promise<ShortUrl | null>;
  existsBySlug(slug: string): Promise<boolean>;
}
