import type { NextFunction, Request, Response } from 'express';

import { DomainError } from '../../domain';

interface ErrorBody {
  error: string;
  message: string;
}

/**
 * Centralized error-to-HTTP mapping. Domain errors carry their own status and
 * machine-readable code; anything else becomes a 500 INTERNAL_ERROR without
 * leaking internals.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof DomainError) {
    const body: ErrorBody = { error: err.code, message: err.message };
    res.status(err.status).json(body);
    return;
  }

  // Malformed JSON bodies surface as SyntaxError from express.json().
  if (err instanceof SyntaxError && 'body' in err) {
    const body: ErrorBody = {
      error: 'VALIDATION_ERROR',
      message: 'Request body must be valid JSON.',
    };
    res.status(400).json(body);
    return;
  }

  console.error(JSON.stringify({ level: 'error', message: (err as Error)?.message, stack: (err as Error)?.stack }));
  const body: ErrorBody = {
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
  };
  res.status(500).json(body);
}
