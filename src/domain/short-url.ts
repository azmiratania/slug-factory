/**
 * A shortened URL record.
 *
 * `deletedAt` is set on soft-delete: the record still exists so the redirect
 * handler can distinguish "never existed" (404) from "existed, now gone" (410).
 */
export interface ShortUrl {
  /** Internal id; may equal the slug. */
  id: string;
  /** URL-safe unique key, e.g. 8 chars base62. */
  slug: string;
  /** Validated absolute URL. */
  destinationUrl: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 soft-delete timestamp; drives 410 Gone. */
  deletedAt?: string;
}
