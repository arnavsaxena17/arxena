import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

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
  private readonly client: AxiosInstance;
  private readonly apiKey: string | null;

  constructor(private readonly environmentService: EnvironmentService) {
    this.apiKey =
      (this.environmentService.get('APOLLO_API_KEY' as any) as string | undefined) ??
      null;

    this.client = axios.create({
      baseURL: 'https://api.apollo.io',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
      params: {
        api_key: this.apiKey ?? '',
      },
    });
  }

  getName(): string {
    return 'apollo';
  }

  isEnabled(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  async checkAvailability(
    linkedinUrl: string,
  ): Promise<ContactAvailability> {
    // Apollo doesn't have a dedicated availability checker
    // Return both true and rely on fetch to fail without charging where possible
    return { emailAvailable: true, phoneAvailable: true };
  }

  async fetchContacts(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult> {
    if (!this.isEnabled()) {
      throw new Error('Apollo provider is not enabled (APOLLO_API_KEY not configured)');
    }

    const { wantEmail = true, wantPhone = true } = options ?? {};

    try {
      const params: Record<string, unknown> = {
        linkedin_url: linkedinUrl,
        reveal_personal_emails: wantEmail,
        reveal_phone_number: wantPhone,
        run_waterfall_email: false, // Don't use waterfall for now
        run_waterfall_phone: false,
      };

      // Note: If reveal_phone_number is true, Apollo requires webhook_url
      // For now, we'll set it to false if webhook is not configured
      // In production, you may want to configure a webhook URL
      if (wantPhone) {
        const webhookUrl = this.environmentService.get('APOLLO_WEBHOOK_URL' as any) as
          | string
          | undefined;
        if (!webhookUrl) {
          // Without webhook, phone numbers won't be returned
          // Set reveal_phone_number to false to avoid error
          params.reveal_phone_number = false;
        } else {
          params.webhook_url = webhookUrl;
        }
      }

      const response = await this.client.post('/api/v1/people/match', null, {
        params,
      });

      if (response.data?.person) {
        const person = response.data.person;
        const emails: string[] = [];
        const phones: string[] = [];

        // Extract emails
        if (wantEmail) {
          if (person.email && typeof person.email === 'string') {
            emails.push(person.email);
          }
          // Apollo may return contact_emails array
          if (
            person.contact &&
            typeof person.contact === 'object' &&
            person.contact.contact_emails &&
            Array.isArray(person.contact.contact_emails)
          ) {
            for (const emailObj of person.contact.contact_emails) {
              if (
                emailObj &&
                typeof emailObj === 'object' &&
                emailObj.email &&
                typeof emailObj.email === 'string'
              ) {
                emails.push(emailObj.email);
              }
            }
          }
        }

        // Extract phone numbers
        // Note: Phone numbers may come via webhook if reveal_phone_number was true
        if (
          wantPhone &&
          person.contact &&
          typeof person.contact === 'object' &&
          person.contact.phone_numbers &&
          Array.isArray(person.contact.phone_numbers)
        ) {
          for (const phoneObj of person.contact.phone_numbers) {
            if (
              phoneObj &&
              typeof phoneObj === 'object' &&
              phoneObj.sanitized_number &&
              typeof phoneObj.sanitized_number === 'string'
            ) {
              phones.push(phoneObj.sanitized_number);
            } else if (
              phoneObj &&
              typeof phoneObj === 'object' &&
              phoneObj.raw_number &&
              typeof phoneObj.raw_number === 'string'
            ) {
              phones.push(phoneObj.raw_number);
            }
          }
        }
        if (
          wantPhone &&
          person.contact &&
          typeof person.contact === 'object' &&
          person.contact.sanitized_phone &&
          typeof person.contact.sanitized_phone === 'string'
        ) {
          phones.push(person.contact.sanitized_phone);
        }

        return {
          emails: [...new Set(emails)], // Remove duplicates
          phones: [...new Set(phones)], // Remove duplicates
          source: 'apollo',
        };
      }

      return { emails: [], phones: [], source: 'apollo' };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 404 or empty response means no match found
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
}
