/** Machine-readable error codes matching the OpenAPI contract. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BLOCKED_DOMAIN'
  | 'NOT_FOUND'
  | 'GONE'
  | 'INTERNAL_ERROR';

/**
 * Domain error carrying the machine-readable code and the HTTP status it maps
 * to. The centralized error middleware turns these into `{ error, message }`
 * responses.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', 400, message);
    this.name = 'ValidationError';
  }
}

export class BlockedDomainError extends DomainError {
  constructor(message: string) {
    super('BLOCKED_DOMAIN', 422, message);
    this.name = 'BlockedDomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(slug: string) {
    super('NOT_FOUND', 404, `No shortened URL found for slug '${slug}'.`);
    this.name = 'NotFoundError';
  }
}

export class GoneError extends DomainError {
  constructor(slug: string) {
    super('GONE', 410, `The shortened URL for slug '${slug}' has been deleted or expired.`);
    this.name = 'GoneError';
  }
}

export class InternalError extends DomainError {
  constructor(message = 'An unexpected error occurred. Please try again later.') {
    super('INTERNAL_ERROR', 500, message);
    this.name = 'InternalError';
  }
}
