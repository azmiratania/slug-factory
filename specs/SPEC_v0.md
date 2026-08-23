# Spec: URL Shortener Service

| Field | Value |
|---|---|
| Status | Draft |
| Owner | Azmira Tania |
| Version | 1.0.0 |
| Last updated | 2026-07-22 |
| Related | `specs/openapi.yaml` (v1.0.0) |

## 1. Summary

A backend service that shortens long URLs into unique, short slugs and redirects clients to the original URL when the slug is visited. Exposed as a REST API, implemented in TypeScript, with pluggable persistence (in-memory by default, swappable for a real database without touching business logic).

## 2. Goals

- Create a shortened URL for any valid destination URL via `POST /v1/urls`.
- Redirect (`302`) from a shortened slug to its destination via `GET /{slug}`.
- Slugs are auto-generated, unique, and URL-safe.
- Persistence layer is abstracted behind an interface so in-memory storage can be swapped for Postgres/Redis/etc. without changing route or service code.
- Correct HTTP status codes and error shapes per the OpenAPI contract (`400`, `404`, `410`, `422`, `500`).

## 3. Non-Goals (out of scope for v1)

- Custom/user-chosen slugs.
- Authentication/authorization on the create endpoint.
- Click analytics, rate limiting, expiry scheduling.
- Multi-tenant namespacing of slugs.

> Non-goals are explicit so scope creep during implementation is easy to catch and reject or defer to v2.

## 4. User Stories

1. **As a client application**, I can POST a long URL and receive back a short URL I can share.
2. **As an end user**, when I open a short URL, I'm redirected to the original destination without seeing the shortener.
3. **As a client application**, if I submit an invalid or missing URL, I get a clear `400` error I can show to my user.
4. **As an end user**, if I visit a slug that never existed, I get a `404`; if it existed but was removed, I get a `410`.

## 5. API Contract

Source of truth: the provided OpenAPI 3.0.3 document (`specs/openapi.yaml`). Do not hand-write route logic that diverges from it — regenerate types from it (e.g. via `openapi-typescript`) so request/response shapes stay in sync.

| Method | Path | Purpose | Success | Failure |
|---|---|---|---|---|
| POST | `/v1/urls` | Create shortened URL | `201` `CreateUrlResponse` | `400`, `422`, `500` |
| GET | `/{slug}` | Redirect to destination | `302` + `Location` header | `404`, `410`, `500` |

Error body shape (all error responses): `{ error: string, message: string }` — `error` is a machine-readable code (`VALIDATION_ERROR`, `NOT_FOUND`, `GONE`, `INTERNAL_ERROR`), `message` is human-readable.

## 6. Data Model

```ts
interface ShortUrl {
  id: string;            // internal id, may equal slug
  slug: string;           // url-safe unique key, e.g. 8 chars base62
  destinationUrl: string; // validated absolute URL
  createdAt: string;      // ISO 8601
  deletedAt?: string;     // ISO 8601, set on soft-delete → drives 410
}
```

### Persistence abstraction

```ts
interface UrlRepository {
  create(entry: Omit<ShortUrl, 'id'>): Promise<ShortUrl>;
  findBySlug(slug: string): Promise<ShortUrl | null>;
  existsBySlug(slug: string): Promise<boolean>;
}
```

- `InMemoryUrlRepository` — default, backed by a `Map<string, ShortUrl>`.
- `UrlRepository` interface lives in `src/domain/`; concrete implementations live in `src/infra/persistence/`. Swapping to Postgres/Redis means adding a new class that implements the same interface and changing one line in the DI wiring — no service/controller changes.

## 7. Business Rules

- **Slug generation**: 8-char base62 (`[0-9a-zA-Z]`), generated server-side; on collision, retry generation (bounded retries, e.g. 5, then `500`).
- **URL validation**: `destination_url` must be a syntactically valid absolute URL (`http`/`https` scheme). Reject otherwise with `400 VALIDATION_ERROR`.
- **Blocked destinations** (e.g. shortener's own domain, disallowed schemes like `javascript:`, `file:`) → `422`.
- **Soft delete**: deleting a record marks `deletedAt`; `findBySlug` still returns it so the redirect handler can distinguish "never existed" (`404`) from "existed, now gone" (`410`). (Delete endpoint itself is out of scope for v1 but the model supports it — see Non-Goals.)
- **Idempotency**: not required — the same destination URL submitted twice may produce two different slugs.

## 8. Acceptance Criteria (Given/When/Then)

**AC-1 — Create with valid URL**
Given a valid `https://example.com/foo` destination, when `POST /v1/urls` is called, then response is `201` with `slug`, `short_url`, `destination_url`, `id`, `created_at` populated, and `short_url` contains `slug`.

**AC-2 — Create with missing/invalid URL**
Given `destination_url` is missing or not a valid URL, when `POST /v1/urls` is called, then response is `400` with `error: "VALIDATION_ERROR"`.

**AC-3 — Create with blocked domain**
Given `destination_url` points to a blocked domain, when `POST /v1/urls` is called, then response is `422`.

**AC-4 — Redirect success**
Given a slug created in AC-1, when `GET /{slug}` is called, then response is `302` with `Location` header equal to the original `destination_url`.

**AC-5 — Redirect unknown slug**
Given a slug that was never created, when `GET /{slug}` is called, then response is `404` with `error: "NOT_FOUND"`.

**AC-6 — Redirect deleted slug**
Given a slug whose record has `deletedAt` set, when `GET /{slug}` is called, then response is `410`.

**AC-7 — Slug uniqueness**
Given two `POST /v1/urls` calls with different destinations, when both succeed, then their slugs are different.

## 9. Test Plan

| Layer | Tool | Coverage |
|---|---|---|
| Unit | Jest/Vitest | Slug generator (format, collision retry), URL validator, service layer logic (repository mocked) |
| Integration | Jest + Supertest | Each endpoint against `InMemoryUrlRepository`, mapped 1:1 to AC-1..AC-7 |
| Contract | `specs/openapi.yaml` as source | Response shapes validated against schema (e.g. via `express-openapi-validator` or a schema-diff test) |

Every acceptance criterion above must map to at least one automated test; a criterion without a corresponding test is treated as unimplemented.

## 10. Architecture

```
specs/             # source of truth — this file, openapi.yaml, traceability matrix
  SPEC.md
  openapi.yaml
  README.md        # SDD workflow + AC-to-test traceability
src/
  domain/          # ShortUrl entity, UrlRepository interface, business rules
  services/        # UrlShortenerService — orchestrates repo + slug generation
  infra/
    persistence/   # InMemoryUrlRepository (default), future PostgresUrlRepository
    http/           # Express/Fastify routes, request validation, error mapping
  config/          # DI wiring — repository implementation is chosen here
tests/
  unit/
  integration/
```

Layering rule: `services/` depends only on the `UrlRepository` interface, never on a concrete persistence class — this is what makes the storage swap non-invasive.

## 11. Non-Functional Requirements

- **Language**: TypeScript, strict mode.
- **Modularity**: persistence swap requires touching only `config/` wiring + adding a new class under `infra/persistence/`.
- **Error handling**: centralized error-to-HTTP-status mapping middleware, not scattered per-route try/catch.
- **Observability**: structured request logs (method, path, status, latency) — not specified in OpenAPI but useful for debugging; doesn't affect contract.

## 12. Open Questions / Assumptions

- Assumption: `short.example.com` base is configurable via env var (`SHORT_URL_BASE`), defaulting to `http://localhost:3000`.
- Assumption: no auth on v1 endpoints (matches OpenAPI, which defines no security scheme).
- Open: should slug collisions be logged/monitored in production for capacity planning? (Deferred — not blocking v1.)

## 13. Implementation Plan (task breakdown)

1. Scaffold TS project (tsconfig strict, Jest/Vitest, eslint).
2. Define `ShortUrl` entity + `UrlRepository` interface (`domain/`).
3. Implement `InMemoryUrlRepository`.
4. Implement slug generator with collision-retry + unit tests.
5. Implement `UrlShortenerService` (create + resolve) + unit tests.
6. Wire HTTP layer (routes, validation, error-mapping middleware) matching OpenAPI shapes exactly.
7. Integration tests for AC-1 through AC-7.
8. Validate responses against `specs/openapi.yaml` schemas.
9. README: run instructions, how to swap persistence implementation.

---
*This document is the source of truth. Code, tests, and the OpenAPI file must stay consistent with it — if implementation reveals the spec is wrong or incomplete, update this file first, then the code.*
