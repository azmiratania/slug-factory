import { describe, expect, it } from 'vitest';

import { BlockedDomainError, ValidationError } from '../../src/domain';
import { validateDestinationUrl } from '../../src/services/url-validator';

const noBlockedHosts = new Set<string>();

describe('validateDestinationUrl', () => {
  it('accepts a valid https URL', () => {
    const url = 'https://www.example.com/some/very/long/path?query=value';
    expect(validateDestinationUrl(url, noBlockedHosts)).toBe(url);
  });

  it('accepts a valid http URL', () => {
    expect(validateDestinationUrl('http://example.com/foo', noBlockedHosts)).toBe(
      'http://example.com/foo',
    );
  });

  it.each([undefined, null, 42, '', '   ', 'not a url', 'example.com/foo', '/relative/path'])(
    'rejects %j with a 400 ValidationError',
    (value) => {
      expect(() => validateDestinationUrl(value, noBlockedHosts)).toThrow(ValidationError);
    },
  );

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.com/file'])(
    'rejects disallowed scheme %s with a 422 BlockedDomainError',
    (value) => {
      expect(() => validateDestinationUrl(value, noBlockedHosts)).toThrow(BlockedDomainError);
    },
  );

  it('rejects blocked hosts with a 422 BlockedDomainError', () => {
    const blocked = new Set(['short.example.com']);
    expect(() =>
      validateDestinationUrl('https://short.example.com/abc', blocked),
    ).toThrow(BlockedDomainError);
    // Case-insensitive hostname match.
    expect(() =>
      validateDestinationUrl('https://SHORT.example.com/abc', blocked),
    ).toThrow(BlockedDomainError);
  });
});
