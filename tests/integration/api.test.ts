import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryUrlRepository } from '../../src/infra/persistence/in-memory-url-repository';
import { createApp } from '../../src/infra/http/app';
import { UrlShortenerService } from '../../src/services/url-shortener-service';
import { assertMatchesSchema } from './openapi-contract';

const SHORT_URL_BASE = 'http://localhost:3000';

let app: Express;
let repository: InMemoryUrlRepository;

beforeEach(() => {
  repository = new InMemoryUrlRepository();
  const service = new UrlShortenerService(repository, { shortUrlBase: SHORT_URL_BASE });
  app = createApp(service);
});

describe('AC-1 — Create with valid URL', () => {
  it('returns 201 with all fields populated and short_url containing the slug', async () => {
    const destination = 'https://example.com/foo';
    const customURL = 'my-custom-alias';
    const res = await request(app)
      .post('/v1/urls')
      .send({ destination_url: destination, customURL })
      .expect(201)
      .expect('Content-Type', /application\/json/);

    expect(res.body.id).toBeTruthy();
    expect(res.body.slug).toMatch(/^[0-9a-zA-Z]{8}$/);
    expect(res.body.destination_url).toBe(destination);
    expect(res.body.customURL).toBe(customURL);
    expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.short_url).toContain(res.body.slug);
    expect(res.body.short_url).toBe(`${SHORT_URL_BASE}/${res.body.slug}`);

    assertMatchesSchema('CreateUrlResponse', res.body);
  });
});

describe('AC-2 — Create with missing/invalid URL', () => {
  it('returns 400 VALIDATION_ERROR when destination_url is missing', async () => {
    const res = await request(app).post('/v1/urls').send({}).expect(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    assertMatchesSchema('ErrorResponse', res.body);
  });

  it('returns 400 VALIDATION_ERROR when destination_url is not a valid URL', async () => {
    const res = await request(app)
      .post('/v1/urls')
      .send({ destination_url: 'not a url' })
      .expect(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    assertMatchesSchema('ErrorResponse', res.body);
  });

  it('returns 400 VALIDATION_ERROR for a relative URL', async () => {
    const res = await request(app)
      .post('/v1/urls')
      .send({ destination_url: '/relative/path' })
      .expect(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for malformed JSON', async () => {
    const res = await request(app)
      .post('/v1/urls')
      .set('Content-Type', 'application/json')
      .send('{not json')
      .expect(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('AC-3 — Create with blocked domain', () => {
  it("returns 422 when destination points at the shortener's own host", async () => {
    const res = await request(app)
      .post('/v1/urls')
      .send({ destination_url: `${SHORT_URL_BASE}/abc123` })
      .expect(422);
    expect(res.body.error).toBe('BLOCKED_DOMAIN');
    assertMatchesSchema('ErrorResponse', res.body);
  });

  it('returns 422 for disallowed schemes like javascript:', async () => {
    const res = await request(app)
      .post('/v1/urls')
      .send({ destination_url: 'javascript:alert(1)' })
      .expect(422);
    expect(res.body.error).toBe('BLOCKED_DOMAIN');
  });
});

describe('AC-4 — Redirect success', () => {
  it('returns 302 with Location equal to the original destination', async () => {
    const destination = 'https://www.example.com/some/very/long/path?query=value';
    const created = await request(app)
      .post('/v1/urls')
      .send({ destination_url: destination })
      .expect(201);

    const res = await request(app).get(`/${created.body.slug}`).expect(302);
    expect(res.headers.location).toBe(destination);
  });
});

describe('AC-5 — Redirect unknown slug', () => {
  it('returns 404 NOT_FOUND for a slug that was never created', async () => {
    const res = await request(app).get('/xyz99').expect(404);
    expect(res.body.error).toBe('NOT_FOUND');
    assertMatchesSchema('ErrorResponse', res.body);
  });
});

describe('AC-6 — Redirect deleted slug', () => {
  it('returns 410 GONE for a slug whose record has deletedAt set', async () => {
    const created = await request(app)
      .post('/v1/urls')
      .send({ destination_url: 'https://example.com/foo' })
      .expect(201);

    await repository.softDelete(created.body.slug);

    const res = await request(app).get(`/${created.body.slug}`).expect(410);
    expect(res.body.error).toBe('GONE');
    assertMatchesSchema('ErrorResponse', res.body);
  });
});

describe('AC-7 — Slug uniqueness', () => {
  it('two successful creations produce different slugs', async () => {
    const first = await request(app)
      .post('/v1/urls')
      .send({ destination_url: 'https://example.com/one' })
      .expect(201);
    const second = await request(app)
      .post('/v1/urls')
      .send({ destination_url: 'https://example.com/two' })
      .expect(201);

    expect(first.body.slug).not.toBe(second.body.slug);
  });
});
