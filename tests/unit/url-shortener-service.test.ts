import { describe, expect, it, vi } from 'vitest';

import type { ShortUrl, UrlRepository } from '../../src/domain';
import { GoneError, NotFoundError } from '../../src/domain';
import { UrlShortenerService } from '../../src/services/url-shortener-service';

function mockRepository(overrides: Partial<UrlRepository> = {}): UrlRepository {
  return {
    create: vi.fn(async (entry: Omit<ShortUrl, 'id'>) => ({ id: entry.slug, ...entry })),
    findBySlug: vi.fn(async () => null),
    existsBySlug: vi.fn(async () => false),
    ...overrides,
  };
}

const options = { shortUrlBase: 'http://localhost:3000' };

describe('UrlShortenerService.create', () => {
  it('creates a record with a generated slug and builds short_url from the base', async () => {
    const repo = mockRepository();
    const service = new UrlShortenerService(repo, options);

    const { record, shortUrl } = await service.create('https://example.com/foo');

    expect(record.slug).toMatch(/^[0-9a-zA-Z]{8}$/);
    expect(record.destinationUrl).toBe('https://example.com/foo');
    expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(shortUrl).toBe(`http://localhost:3000/${record.slug}`);
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('rejects invalid URLs with VALIDATION_ERROR and does not touch the repository', async () => {
    const repo = mockRepository();
    const service = new UrlShortenerService(repo, options);

    await expect(service.create('not a url')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("rejects the shortener's own host with BLOCKED_DOMAIN", async () => {
    const repo = mockRepository();
    const service = new UrlShortenerService(repo, options);

    await expect(service.create('http://localhost:3000/abc123')).rejects.toMatchObject({
      code: 'BLOCKED_DOMAIN',
      status: 422,
    });
  });

  it('rejects additional configured blocked hosts with BLOCKED_DOMAIN', async () => {
    const repo = mockRepository();
    const service = new UrlShortenerService(repo, {
      ...options,
      blockedHosts: ['evil.example.com'],
    });

    await expect(service.create('https://evil.example.com/x')).rejects.toMatchObject({
      code: 'BLOCKED_DOMAIN',
      status: 422,
    });
  });

  it('retries slug generation on collision', async () => {
    const existsBySlug = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const repo = mockRepository({ existsBySlug });
    const service = new UrlShortenerService(repo, options);

    const { record } = await service.create('https://example.com/foo');

    expect(record.slug).toMatch(/^[0-9a-zA-Z]{8}$/);
    expect(existsBySlug).toHaveBeenCalledTimes(2);
  });

  it('fails with INTERNAL_ERROR when collisions exhaust retries', async () => {
    const repo = mockRepository({ existsBySlug: vi.fn().mockResolvedValue(true) });
    const service = new UrlShortenerService(repo, options);

    await expect(service.create('https://example.com/foo')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('UrlShortenerService.resolve', () => {
  it('returns the destination for an existing slug', async () => {
    const record: ShortUrl = {
      id: 'abc12345',
      slug: 'abc12345',
      destinationUrl: 'https://example.com/foo',
      createdAt: '2026-07-01T02:30:00Z',
    };
    const repo = mockRepository({ findBySlug: vi.fn(async () => record) });
    const service = new UrlShortenerService(repo, options);

    await expect(service.resolve('abc12345')).resolves.toBe('https://example.com/foo');
  });

  it('throws NotFoundError (404) for a slug that never existed', async () => {
    const repo = mockRepository();
    const service = new UrlShortenerService(repo, options);

    await expect(service.resolve('xyz99')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws GoneError (410) for a soft-deleted slug', async () => {
    const record: ShortUrl = {
      id: 'abc12345',
      slug: 'abc12345',
      destinationUrl: 'https://example.com/foo',
      createdAt: '2026-07-01T02:30:00Z',
      deletedAt: '2026-07-02T00:00:00Z',
    };
    const repo = mockRepository({ findBySlug: vi.fn(async () => record) });
    const service = new UrlShortenerService(repo, options);

    await expect(service.resolve('abc12345')).rejects.toBeInstanceOf(GoneError);
  });
});
