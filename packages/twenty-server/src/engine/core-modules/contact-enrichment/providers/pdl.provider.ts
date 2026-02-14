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
export class PdlProvider implements ContactEnrichmentProvider {
  private readonly logger = new Logger(PdlProvider.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string | null;

  constructor(private readonly environmentService: EnvironmentService) {
    this.apiKey =
      (this.environmentService.get('PDL_API_KEY') as string | undefined) ??
      null;

    this.client = axios.create({
      baseURL: 'https://api.peopledatalabs.com',
      headers: {
        'X-Api-Key': this.apiKey ?? '',
      },
    });
  }

  getName(): string {
    return 'pdl';
  }

  isEnabled(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  async checkAvailability(
    linkedinUrl: string,
  ): Promise<ContactAvailability> {
    if (!this.isEnabled()) {
      return { emailAvailable: false, phoneAvailable: false };
    }

    try {
      // Use preview API to check availability without consuming credits
      const response = await this.client.get('/v5/person/enrich/preview', {
        params: {
          profile: linkedinUrl,
        },
      });

      if (response.data?.status === 200 && response.data?.data) {
        const data = response.data.data;
        return {
          emailAvailable:
            data.emails === true || data.personal_emails === true || data.work_email === true,
          phoneAvailable:
            data.phone_numbers === true || data.mobile_phone === true || data.phones === true,
          provider: 'pdl',
        };
      }

      return { emailAvailable: false, phoneAvailable: false };
    } catch (error) {
      this.logger.error(
        `PDL availability check failed for ${linkedinUrl}`,
        error as Error,
      );
      return { emailAvailable: false, phoneAvailable: false };
    }
  }

  async fetchContacts(
    linkedinUrl: string,
    options?: ContactEnrichmentOptions,
  ): Promise<ContactResult> {
    if (!this.isEnabled()) {
      throw new Error('PDL provider is not enabled (PDL_API_KEY not configured)');
    }

    const { wantEmail = true, wantPhone = true } = options ?? {};

    try {
      const params: Record<string, unknown> = {
        profile: linkedinUrl,
      };

      // Build required parameter based on what we want
      if (wantEmail && wantPhone) {
        params.required = 'emails OR phone_numbers';
      } else if (wantEmail) {
        params.required = 'emails';
      } else if (wantPhone) {
        params.required = 'phone_numbers';
      }

      const response = await this.client.get('/v5/person/enrich', { params });

      if (response.data?.status === 200 && response.data?.data) {
        const data = response.data.data;
        const emails: string[] = [];
        const phones: string[] = [];

        // Extract emails
        if (wantEmail) {
          if (data.emails && Array.isArray(data.emails)) {
            for (const emailObj of data.emails) {
              if (typeof emailObj === 'object' && emailObj !== null) {
                if (emailObj.address && typeof emailObj.address === 'string') {
                  emails.push(emailObj.address);
                }
              } else if (typeof emailObj === 'string') {
                emails.push(emailObj);
              }
            }
          }
          if (data.personal_emails && Array.isArray(data.personal_emails)) {
            for (const email of data.personal_emails) {
              if (typeof email === 'string') {
                emails.push(email);
              }
            }
          }
          if (data.work_email && typeof data.work_email === 'string') {
            emails.push(data.work_email);
          }
        }

        // Extract phone numbers
        if (wantPhone) {
          if (data.phone_numbers && Array.isArray(data.phone_numbers)) {
            for (const phone of data.phone_numbers) {
              if (typeof phone === 'string') {
                phones.push(phone);
              }
            }
          }
          if (data.mobile_phone && typeof data.mobile_phone === 'string') {
            phones.push(data.mobile_phone);
          }
          if (data.phones && Array.isArray(data.phones)) {
            for (const phone of data.phones) {
              if (typeof phone === 'string') {
                phones.push(phone);
              }
            }
          }
        }

        return {
          emails: [...new Set(emails)], // Remove duplicates
          phones: [...new Set(phones)], // Remove duplicates
          source: 'pdl',
        };
      }

      // 404 means no match found
      if (response.data?.status === 404) {
        return { emails: [], phones: [], source: 'pdl' };
      }

      throw new Error(
        `PDL enrichment failed: ${response.data?.status ?? 'unknown status'}`,
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { emails: [], phones: [], source: 'pdl' };
      }
      this.logger.error(
        `PDL fetch failed for ${linkedinUrl}`,
        error as Error,
      );
      throw error;
    }
  }
}
