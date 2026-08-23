# Specs — source of truth

This folder holds the artifacts that drive development. **Code follows spec, never the other way around.** If implementation reveals the spec is wrong or incomplete, update the spec here first, then change the code.

| Artifact | Role |
|---|---|
| [`SPEC.md`](SPEC.md) | Product/engineering spec: goals, non-goals, data model, business rules, acceptance criteria (AC-1..AC-7), test plan, architecture |
| [`openapi.yaml`](openapi.yaml) | API contract: paths, request/response schemas, status codes, error shapes. Response bodies are validated against these schemas in tests |

## Spec-driven workflow

Every change follows this order:

1. **Spec** — update `SPEC.md` (and `openapi.yaml` if the API contract changes). Bump the version and `Last updated` fields.
2. **Acceptance criteria** — add or amend Given/When/Then criteria in `SPEC.md` section 8. A behavior without an AC does not get built.
3. **Tests** — write or update the tests that encode those criteria (see traceability below). A criterion without a corresponding test is treated as unimplemented.
4. **Implementation** — change the code until the tests pass, without diverging from `openapi.yaml` shapes.

Scope control: anything listed in `SPEC.md` section 3 (Non-Goals) is rejected or deferred to v2 — it does not sneak in during implementation.

## Traceability matrix

Every acceptance criterion maps to at least one automated test:

| Criterion | Behavior | Test |
|---|---|---|
| AC-1 | Create with valid URL → 201, all fields populated | `tests/integration/api.test.ts` — "AC-1 — Create with valid URL" |
| AC-2 | Missing/invalid URL → 400 `VALIDATION_ERROR` | `tests/integration/api.test.ts` — "AC-2 — Create with missing/invalid URL" |
| AC-3 | Blocked domain/scheme → 422 `BLOCKED_DOMAIN` | `tests/integration/api.test.ts` — "AC-3 — Create with blocked domain" |
| AC-4 | Redirect success → 302 + `Location` | `tests/integration/api.test.ts` — "AC-4 — Redirect success" |
| AC-5 | Unknown slug → 404 `NOT_FOUND` | `tests/integration/api.test.ts` — "AC-5 — Redirect unknown slug" |
| AC-6 | Soft-deleted slug → 410 `GONE` | `tests/integration/api.test.ts` — "AC-6 — Redirect deleted slug" |
| AC-7 | Slug uniqueness | `tests/integration/api.test.ts` — "AC-7 — Slug uniqueness" |

Business rules from `SPEC.md` section 7 are additionally covered at the unit level:

| Rule | Test |
|---|---|
| Slug generation: 8-char base62, bounded collision retry, then 500 | `tests/unit/slug-generator.test.ts` |
| URL validation: absolute http/https only → 400 otherwise | `tests/unit/url-validator.test.ts` |
| Blocked destinations: own domain, `javascript:`/`file:` schemes → 422 | `tests/unit/url-validator.test.ts` |
| Service orchestration, 404 vs 410 distinction | `tests/unit/url-shortener-service.test.ts` |

## Contract enforcement

`tests/integration/openapi-contract.ts` loads `openapi.yaml` and validates response bodies against its component schemas (ajv) inside the integration tests, so drift between code and contract fails CI rather than going unnoticed.
