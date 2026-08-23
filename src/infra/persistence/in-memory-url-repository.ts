import type { ShortUrl, UrlRepository } from '../../domain';

/**
 * Default repository backed by a Map. Suitable for development and tests;
 * swap for a database-backed implementation via `src/config/`.
 */
export class InMemoryUrlRepository implements UrlRepository {
  private readonly bySlug = new Map<string, ShortUrl>();

  async create(entry: Omit<ShortUrl, 'id'>): Promise<ShortUrl> {
    const record: ShortUrl = { id: entry.slug, ...entry };
    this.bySlug.set(record.slug, record);
    return record;
  }

  async findBySlug(slug: string): Promise<ShortUrl | null> {
    return this.bySlug.get(slug) ?? null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return this.bySlug.has(slug);
  }

  /** Test helper: soft-delete a record (sets `deletedAt`). */
  async softDelete(slug: string, deletedAt = new Date().toISOString()): Promise<void> {
    const record = this.bySlug.get(slug);
    if (record) {
      this.bySlug.set(slug, { ...record, deletedAt });
    }
  }
}
