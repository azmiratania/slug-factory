import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../src/domain';
import {
  MAX_SLUG_RETRIES,
  SLUG_LENGTH,
  generateSlug,
  generateUniqueSlug,
} from '../../src/services/slug-generator';

describe('generateSlug', () => {
  it('produces 8-character base62 slugs by default', () => {
    for (let i = 0; i < 100; i++) {
      const slug = generateSlug();
      expect(slug).toMatch(/^[0-9a-zA-Z]{8}$/);
      expect(slug).toHaveLength(SLUG_LENGTH);
    }
  });

  it('respects a custom length', () => {
    expect(generateSlug(12)).toMatch(/^[0-9a-zA-Z]{12}$/);
  });
});

describe('generateUniqueSlug', () => {
  it('returns the first slug when there is no collision', async () => {
    const exists = vi.fn().mockResolvedValue(false);
    const slug = await generateUniqueSlug(exists);
    expect(slug).toMatch(/^[0-9a-zA-Z]{8}$/);
    expect(exists).toHaveBeenCalledTimes(1);
  });

  it('retries on collision and returns a free slug', async () => {
    const exists = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const slug = await generateUniqueSlug(exists);
    expect(slug).toMatch(/^[0-9a-zA-Z]{8}$/);
    expect(exists).toHaveBeenCalledTimes(3);
  });

  it('throws a 500 InternalError after exhausting bounded retries', async () => {
    const exists = vi.fn().mockResolvedValue(true);
    await expect(generateUniqueSlug(exists)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    await expect(generateUniqueSlug(exists)).rejects.toBeInstanceOf(DomainError);
    expect(exists).toHaveBeenCalledTimes(MAX_SLUG_RETRIES * 2);
  });
});
