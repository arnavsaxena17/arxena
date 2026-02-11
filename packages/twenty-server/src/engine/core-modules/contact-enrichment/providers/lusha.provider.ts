import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import type {
  ContactAvailability,
  ContactEnrichmentOptions,
  ContactResult,
} from '../types/contact-enrichment.types';
import type { ContactEnrichmentProvider } from '../interfaces/contact-enrichment-provider.interface';

@Injectable()
export class LushaProvider implements ContactEnrichmentProvider {
  private readonly logger = new Logger(LushaProvider.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string | null;

  constructor(private readonly environmentService: EnvironmentService) {
    this.apiKey =
      (this.environmentService.get('LUSHA_API_KEY' as any) as string | undefined) ??
      null;

    this.client = axios.create({
      baseURL: 'https://api.lusha.com',
      headers: {
        api_key: this.apiKey ?? '',
      },
    });
  }

  getName(): string {
    return 'lusha';
  }

  isEnabled(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  async checkAvailability(
    linkedinUrl: string,
  ): Promise<ContactAvailability> {
    // Lusha doesn't have a dedicated availability checker
    // Return both true and rely on fetch to fail without charging where possible
    return { emailAvailable: true, phoneAvailable: true };
  }

  async fetchContacts(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult> {
    if (!this.isEnabled()) {
      throw new Error('Lusha provider is not enabled (LUSHA_API_KEY not configured)');
    }

    const { wantEmail = true, wantPhone = true } = options ?? {};

    try {
      const params: Record<string, unknown> = {
        linkedinUrl,
      };

      // Lusha supports revealEmails and revealPhones for Unified Credits plan
      // For now, we'll request both and filter in response
      if (wantEmail || wantPhone) {
        // Note: revealEmails/revealPhones may require Unified Credits plan
        // If not available, API will return error and we'll handle it
        if (wantEmail) {
          params.revealEmails = true;
        }
        if (wantPhone) {
          params.revealPhones = true;
        }
      }

      const response = await this.client.get('/v2/person', { params });

      if (response.data?.data) {
        const data = response.data.data;
        const emails: string[] = [];
        const phones: string[] = [];

        // Extract emails
        if (wantEmail) {
          if (data.emails && Array.isArray(data.emails)) {
            emails.push(...data.emails.filter((e: unknown) => typeof e === 'string'));
          }
          if (data.email && typeof data.email === 'string') {
            emails.push(data.email);
          }
        }

        // Extract phone numbers
        if (wantPhone) {
          if (data.phoneNumbers && Array.isArray(data.phoneNumbers)) {
            phones.push(...data.phoneNumbers.filter((p: unknown) => typeof p === 'string'));
          }
          if (data.phone && typeof data.phone === 'string') {
            phones.push(data.phone);
          }
          if (data.phones && Array.isArray(data.phones)) {
            phones.push(...data.phones.filter((p: unknown) => typeof p === 'string'));
          }
        }

        return {
          emails: [...new Set(emails)], // Remove duplicates
          phones: [...new Set(phones)], // Remove duplicates
          source: 'lusha',
        };
      }

      return { emails: [], phones: [], source: 'lusha' };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 404 means no match found
        if (error.response?.status === 404) {
          return { emails: [], phones: [], source: 'lusha' };
        }
        // 403 might mean Unified Credits plan required
        if (error.response?.status === 403) {
          this.logger.warn(
            `Lusha fetch returned 403 for ${linkedinUrl} - may require Unified Credits plan`,
          );
          return { emails: [], phones: [], source: 'lusha' };
        }
      }
      this.logger.error(
        `Lusha fetch failed for ${linkedinUrl}`,
        error as Error,
      );
      throw error;
    }
  }
}
