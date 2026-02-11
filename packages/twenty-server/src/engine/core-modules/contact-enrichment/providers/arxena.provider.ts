import { Client } from '@elastic/elasticsearch';
import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import type { ContactEnrichmentProvider } from '../interfaces/contact-enrichment-provider.interface';
import type {
  ContactAvailability,
  ContactEnrichmentOptions,
  ContactResult,
} from '../types/contact-enrichment.types';

type ElasticsearchQuery = {
  bool?: {
    must?: unknown[];
    should?: unknown[];
    must_not?: unknown[];
  };
  match?: Record<string, unknown>;
  exists?: { field: string };
};

@Injectable()
export class ArxenaProvider implements ContactEnrichmentProvider {
  private readonly logger = new Logger(ArxenaProvider.name);
  private readonly client: Client | null;
  private readonly peopleIndex: string;

  constructor(private readonly environmentService: EnvironmentService) {
    const endpoint = this.environmentService.get('ES_ENDPOINT');
    const index =
      (this.environmentService.get('PEOPLE_ES_INDEX') as string | undefined) ??
      'people_all';

    this.peopleIndex = index;

    if (typeof endpoint === 'string' && endpoint.length > 0) {
      this.client = new Client({
        node: endpoint,
      });
      this.logger.log(
        `Arxena provider Elasticsearch client configured for index "${this.peopleIndex}"`,
      );
    } else {
      this.client = null;
      this.logger.warn(
        'ES_ENDPOINT not configured, Arxena provider is disabled',
      );
    }
  }

  getName(): string {
    return 'arxena';
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Normalize LinkedIn URL by stripping protocol and www.
   */
  private normalizeLinkedInUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .trim();
  }

  /**
   * Create ES query for person LinkedIn URL (mirrors create_es_query_person_linkedin_url).
   */
  private createPersonLinkedInUrlQuery(
    linkedinUrl: string,
  ): ElasticsearchQuery {
    const normalizedUrl = this.normalizeLinkedInUrl(linkedinUrl);

    const shouldClause: ElasticsearchQuery[] = [];
    const matchQuery: ElasticsearchQuery = {
      match: {
        linkedin_url: normalizedUrl,
      },
    };
    shouldClause.push(matchQuery);

    const mustNotClause: ElasticsearchQuery = {
      bool: {
        must_not: [],
      },
    };

    const mustQueryObj: ElasticsearchQuery = {
      bool: {
        must: [
          mustNotClause,
          {
            bool: {
              should: shouldClause,
            },
          },
        ],
      },
    };

    return mustQueryObj;
  }

  /**
   * Create contact info query (mirrors create_contact_info_query).
   */
  private createContactInfoQuery(
    linkedinUrl: string,
    wantEmail?: boolean,
    wantPhone?: boolean,
  ): ElasticsearchQuery {
    const personLinkedInQueryObj = this.createPersonLinkedInUrlQuery(
      linkedinUrl,
    );

    const mustClauses: ElasticsearchQuery[] = [personLinkedInQueryObj];

    // Add exists filters based on what we want
    if (wantPhone && !wantEmail) {
      mustClauses.push({
        exists: { field: 'phone_numbers' },
      });
    }
    if (wantEmail && !wantPhone) {
      mustClauses.push({
        exists: { field: 'emails.address' },
      });
    }
    // If both or neither, don't add exists filter (return any hit with contact data)

    const allQueryObjs: ElasticsearchQuery = {
      bool: {
        must: mustClauses,
      },
    };

    return allQueryObjs;
  }

  /**
   * Extract emails and phones from ES document _source.
   */
  private extractContacts(source: Record<string, unknown>): {
    emails: string[];
    phones: string[];
  } {
    const emails: string[] = [];
    const phones: string[] = [];

    // Extract emails from emails.address array
    if (source.emails && Array.isArray(source.emails)) {
      for (const emailObj of source.emails) {
        if (
          typeof emailObj === 'object' &&
          emailObj !== null &&
          'address' in emailObj &&
          typeof emailObj.address === 'string'
        ) {
          emails.push(emailObj.address);
        }
      }
    }

    // Extract phone numbers
    if (source.phone_numbers && Array.isArray(source.phone_numbers)) {
      for (const phone of source.phone_numbers) {
        if (typeof phone === 'string') {
          phones.push(phone);
        } else if (
          typeof phone === 'object' &&
          phone !== null &&
          'number' in phone &&
          typeof phone.number === 'string'
        ) {
          phones.push(phone.number);
        }
      }
    }

    return { emails, phones };
  }

  async checkAvailability(
    linkedinUrl: string,
  ): Promise<ContactAvailability> {
    if (!this.client) {
      return { emailAvailable: false, phoneAvailable: false };
    }

    try {
      // Check for email availability
      const emailQuery = this.createContactInfoQuery(linkedinUrl, true, false);
      const emailResponse = await this.client.search({
        index: this.peopleIndex,
        size: 0, // We only need count
        track_total_hits: true,
        query: emailQuery as any, // Cast to any to satisfy Elasticsearch client types
      });
      const emailAvailable =
        (emailResponse.hits.total as { value: number })?.value > 0;

      // Check for phone availability
      const phoneQuery = this.createContactInfoQuery(linkedinUrl, false, true);
      const phoneResponse = await this.client.search({
        index: this.peopleIndex,
        size: 0, // We only need count
        track_total_hits: true,
        query: phoneQuery as any, // Cast to any to satisfy Elasticsearch client types
      });
      const phoneAvailable =
        (phoneResponse.hits.total as { value: number })?.value > 0;

      return {
        emailAvailable,
        phoneAvailable,
        provider: 'arxena',
      };
    } catch (error) {
      this.logger.error(
        `Arxena availability check failed for ${linkedinUrl}`,
        error as Error,
      );
      return { emailAvailable: false, phoneAvailable: false };
    }
  }

  async fetchContacts(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult> {
    if (!this.client) {
      throw new Error('Arxena provider is not enabled (ES_ENDPOINT not configured)');
    }

    const { wantEmail = true, wantPhone = true } = options ?? {};

    try {
      const queryObj = this.createContactInfoQuery(
        linkedinUrl,
        wantEmail,
        wantPhone,
      );

      const response = await this.client.search<Record<string, unknown>>({
        index: this.peopleIndex,
        size: 1, // We only need the first hit
        track_total_hits: true,
        query: queryObj as any, // Cast to any to satisfy Elasticsearch client types
      });

      const hits = response.hits.hits ?? [];
      if (hits.length === 0) {
        return { emails: [], phones: [], source: 'arxena' };
      }

      const source = hits[0]._source;
      if (!source) {
        return { emails: [], phones: [], source: 'arxena' };
      }

      const { emails, phones } = this.extractContacts(source);

      return {
        emails: wantEmail ? emails : [],
        phones: wantPhone ? phones : [],
        source: 'arxena',
      };
    } catch (error) {
      this.logger.error(
        `Arxena fetch failed for ${linkedinUrl}`,
        error as Error,
      );
      throw error;
    }
  }
}
