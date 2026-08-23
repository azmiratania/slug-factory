import { randomInt } from 'node:crypto';

import { InternalError } from '../domain';

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const SLUG_LENGTH = 8;
export const MAX_SLUG_RETRIES = 5;

/** Generate a random slug of `length` base62 characters. */
export function generateSlug(length = SLUG_LENGTH): string {
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += BASE62[randomInt(BASE62.length)];
  }
  return slug;
}

/**
 * Generate a slug not already present per `exists`. Retries up to
 * `maxRetries` times on collision, then throws a 500 InternalError.
 */
export async function generateUniqueSlug(
  exists: (slug: string) => Promise<boolean>,
  options: { length?: number; maxRetries?: number; generate?: (length: number) => string } = {},
): Promise<string> {
  const { length = SLUG_LENGTH, maxRetries = MAX_SLUG_RETRIES, generate = generateSlug } = options;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const slug = generate(length);
    if (!(await exists(slug))) {
      return slug;
    }
  }
  throw new InternalError('Failed to generate a unique slug. Please try again later.');
}
