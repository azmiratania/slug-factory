import type { ShortUrl, UrlRepository } from '../domain';
import { GoneError, NotFoundError } from '../domain';
import { generateUniqueSlug } from './slug-generator';
import { validateDestinationUrl } from './url-validator';

export interface UrlShortenerServiceOptions {
  /** Base URL used to build `short_url`, e.g. "http://localhost:3000". */
  shortUrlBase: string;
  /** Hostnames that may not be used as destinations (e.g. the shortener's own host). */
  blockedHosts?: Iterable<string>;
}

export interface CreatedShortUrl {
  record: ShortUrl;
  shortUrl: string;
}

/**
 * Orchestrates URL validation, slug generation, and persistence. Depends only
 * on the UrlRepository interface, never on a concrete persistence class.
 */
export class UrlShortenerService {
  private readonly shortUrlBase: string;
  private readonly blockedHosts: ReadonlySet<string>;

  constructor(
    private readonly repository: UrlRepository,
    options: UrlShortenerServiceOptions,
  ) {
    this.shortUrlBase = options.shortUrlBase.replace(/\/+$/, '');
    const hosts = new Set<string>(
      [...(options.blockedHosts ?? [])].map((h) => h.toLowerCase()),
    );
    // The shortener's own host is always blocked to prevent redirect loops.
    hosts.add(new URL(this.shortUrlBase).hostname.toLowerCase());
    this.blockedHosts = hosts;
  }

  /** Create a shortened URL for a validated destination. */
  async create(destinationUrl: unknown, customUrl?: string): Promise<CreatedShortUrl> {
    console.log("customUrl", customUrl);
    const validated = validateDestinationUrl(destinationUrl, this.blockedHosts);
    let slug: string;
    if(customUrl && customUrl.length > 0) {
      slug =  customUrl;
    }else{
     slug =  await generateUniqueSlug((s) => this.repository.existsBySlug(s));
    }
  
    const record = await this.repository.create({
      slug,
      destinationUrl: validated,
      createdAt: new Date().toISOString(),
    });
    return { record, shortUrl: `${this.shortUrlBase}/${record.slug}` };
  }

  /**
   * Resolve a slug to its destination URL.
   * Throws NotFoundError (404) if the slug never existed, GoneError (410) if
   * the record was soft-deleted.
   */
  async resolve(slug: string): Promise<string> {
    const record = await this.repository.findBySlug(slug);
    if (!record) {
      throw new NotFoundError(slug);
    }
    if (record.deletedAt) {
      throw new GoneError(slug);
    }
    return record.destinationUrl;
  }
}
