import { BlockedDomainError, ValidationError } from '../domain';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validate a destination URL per the business rules:
 * - must be a syntactically valid absolute URL with an http/https scheme
 *   (otherwise 400 VALIDATION_ERROR);
 * - must not point at a blocked destination, e.g. the shortener's own host
 *   (otherwise 422 BLOCKED_DOMAIN).
 *
 * Returns the normalized URL string.
 */
export function validateDestinationUrl(
  destinationUrl: unknown,
  blockedHosts: ReadonlySet<string>,
): string {
  if (typeof destinationUrl !== 'string' || destinationUrl.trim() === '') {
    throw new ValidationError('destination_url is required and must be a valid URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(destinationUrl);
  } catch {
    throw new ValidationError('destination_url is required and must be a valid URL.');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    // Non-http(s) schemes (javascript:, file:, ftp:, ...) are syntactically
    // valid URLs but cannot be accepted as redirect destinations.
    throw new BlockedDomainError(
      `destination_url uses a scheme that is not allowed: '${parsed.protocol.replace(/:$/, '')}'.`,
    );
  }

  if (blockedHosts.has(parsed.hostname.toLowerCase())) {
    throw new BlockedDomainError('destination_url points to a domain that is not allowed.');
  }

  return destinationUrl;
}
