import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import type { ContactEnrichmentProvider } from '../interfaces/contact-enrichment-provider.interface';
import type {
    ContactAvailability,
    ContactEnrichmentOptions,
    ContactResult,
} from '../types/contact-enrichment.types';

@Injectable()
export class ApolloProvider implements ContactEnrichmentProvider {
  private readonly logger = new Logger(ApolloProvider.name);
  private readonly apiKey: string | null;

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly apolloIoRestService: ApolloIoRestService,
  ) {
    this.apiKey =
      (this.environmentService.get('APOLLO_API_KEY' as never) as
        | string
        | undefined) ?? null;
  }

  getName(): string {
    return 'apollo';
  }

  isEnabled(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  async checkAvailability(
    _linkedinUrl: string,
  ): Promise<ContactAvailability> {
    return { emailAvailable: true, phoneAvailable: true };
  }

  /**
   * Enrich via `people/match` with Apollo id + domain. Prefer {@link fetchContacts} via the waterfall
   * so LinkedIn can be sent together when available.
   */
  async fetchContactsByApolloIdAndDomain(
    apolloPersonId: string,
    companyDomain: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult> {
    return this.fetchContacts('', {
      ...options,
      apolloPersonId,
      companyDomain,
    });
  }

  private async peopleMatchByIdAndDomain(
    apolloPersonId: string,
    companyDomain: string,
    options: ContactEnrichmentOptions | undefined,
    profileLinkedinUrl: string,
  ): Promise<ContactResult> {
    if (!this.isEnabled()) {
      throw new Error(
        'Apollo provider is not enabled (APOLLO_API_KEY not configured)',
      );
    }
    const id = apolloPersonId.trim();
    const domain = companyDomain.trim().toLowerCase();
    if (!id || !domain) {
      throw new Error('apolloPersonId and companyDomain are required');
    }

    const { wantEmail = true, wantPhone = true } = options ?? {};
    const revealPhone = wantPhone;
    const webhookUrl = this.environmentService.get(
      'APOLLO_WEBHOOK_URL' as never,
    ) as string | undefined;
    const revealPhoneNumber = revealPhone && Boolean(webhookUrl?.trim());

    try {
      const li = profileLinkedinUrl?.trim();
      const raw = await this.apolloIoRestService.peopleMatch({
        id,
        domain,
        ...(li ? { linkedinUrl: li } : {}),
        revealPersonalEmails: wantEmail ? true : undefined,
        revealPhoneNumber: revealPhoneNumber ? true : undefined,
      });
      const person = (raw as { person?: Record<string, unknown> }).person;
      if (!person || typeof person !== 'object') {
        return { emails: [], phones: [], source: 'apollo' };
      }
      return this.extractContactFromPersonRecord(person, {
        wantEmail,
        wantPhone: revealPhoneNumber,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return { emails: [], phones: [], source: 'apollo' };
        }
      }
      this.logger.error(
        `Apollo people/match (id+domain) failed for id=${id.slice(0, 8)}...`,
        error as Error,
      );
      throw error;
    }
  }

  async fetchContacts(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult> {
    if (!this.isEnabled()) {
      throw new Error(
        'Apollo provider is not enabled (APOLLO_API_KEY not configured)',
      );
    }

    const apolloId = options?.apolloPersonId?.trim();
    const apolloDomain = options?.companyDomain?.trim();
    if (apolloId && apolloDomain) {
      return this.peopleMatchByIdAndDomain(
        apolloId,
        apolloDomain,
        options,
        linkedinUrl,
      );
    }

    if (!linkedinUrl?.trim()) {
      return { emails: [], phones: [], source: 'apollo' };
    }

    const { wantEmail = true, wantPhone = true } = options ?? {};

    try {
      const params: Record<string, unknown> = {
        linkedin_url: linkedinUrl,
        reveal_personal_emails: wantEmail,
        reveal_phone_number: wantPhone,
        run_waterfall_email: false,
        run_waterfall_phone: false,
      };

      if (wantPhone) {
        const webhookUrl = this.environmentService.get(
          'APOLLO_WEBHOOK_URL' as never,
        ) as string | undefined;
        if (!webhookUrl) {
          params.reveal_phone_number = false;
        } else {
          params.webhook_url = webhookUrl;
        }
      }

      const response = await axios.post(
        'https://api.apollo.io/api/v1/people/match',
        null,
        {
          headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
          },
          params: {
            ...params,
            api_key: this.apiKey ?? '',
          },
        },
      );

      if (response.data?.person) {
        const person = response.data.person as Record<string, unknown>;
        return this.extractContactFromPersonRecord(person, {
          wantEmail,
          wantPhone,
        });
      }

      return { emails: [], phones: [], source: 'apollo' };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404 || error.response?.status === 200) {
          return { emails: [], phones: [], source: 'apollo' };
        }
      }
      this.logger.error(
        `Apollo fetch failed for ${linkedinUrl}`,
        error as Error,
      );
      throw error;
    }
  }

  private extractContactFromPersonRecord(
    person: Record<string, unknown>,
    opts: { wantEmail: boolean; wantPhone: boolean },
  ): ContactResult {
    const { wantEmail, wantPhone } = opts;
    const emails: string[] = [];
    const phones: string[] = [];

    if (wantEmail) {
      if (person.email && typeof person.email === 'string') {
        emails.push(person.email);
      }
      if (
        person.contact &&
        typeof person.contact === 'object' &&
        person.contact !== null
      ) {
        const c = person.contact as Record<string, unknown>;
        if (
          c.contact_emails &&
          Array.isArray(c.contact_emails)
        ) {
          for (const emailObj of c.contact_emails) {
            if (
              emailObj &&
              typeof emailObj === 'object' &&
              (emailObj as { email?: string }).email &&
              typeof (emailObj as { email: string }).email === 'string'
            ) {
              emails.push((emailObj as { email: string }).email);
            }
          }
        }
      }
    }

    if (wantPhone) {
      if (
        person.contact &&
        typeof person.contact === 'object' &&
        person.contact !== null
      ) {
        const c = person.contact as Record<string, unknown>;
        if (c.phone_numbers && Array.isArray(c.phone_numbers)) {
          for (const phoneObj of c.phone_numbers) {
            if (phoneObj && typeof phoneObj === 'object') {
              const p = phoneObj as {
                sanitized_number?: string;
                raw_number?: string;
              };
              if (typeof p.sanitized_number === 'string') {
                phones.push(p.sanitized_number);
              } else if (typeof p.raw_number === 'string') {
                phones.push(p.raw_number);
              }
            }
          }
        }
        if (
          typeof c.sanitized_phone === 'string' &&
          c.sanitized_phone.length > 0
        ) {
          phones.push(c.sanitized_phone);
        }
      }
    }

    let linkedinUrl: string | undefined;
    if (typeof person.linkedin_url === 'string' && person.linkedin_url.trim()) {
      linkedinUrl = person.linkedin_url.trim();
    }

    const rawName =
      typeof person.name === 'string' && person.name.trim()
        ? person.name.trim()
        : undefined;
    const first =
      typeof person.first_name === 'string' && person.first_name.trim()
        ? person.first_name.trim()
        : '';
    const last =
      typeof person.last_name === 'string' && person.last_name.trim()
        ? person.last_name.trim()
        : '';
    const derivedFullName =
      rawName ?? [first, last].filter((p) => p.length > 0).join(' ').trim();
    const fullName = derivedFullName.length > 0 ? derivedFullName : undefined;

    return {
      emails: [...new Set(emails)],
      phones: [...new Set(phones)],
      source: 'apollo',
      ...(linkedinUrl ? { linkedinUrl } : {}),
      ...(fullName ? { fullName } : {}),
    };
  }
}
