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
export class ContactOutProvider implements ContactEnrichmentProvider {
  private readonly logger = new Logger(ContactOutProvider.name);
  private readonly client: AxiosInstance;
  private readonly apiToken: string | null;

  constructor(private readonly environmentService: EnvironmentService) {
    this.apiToken =
      (this.environmentService.get('CONTACTOUT_API_TOKEN' as any) as string | undefined) ??
      null;

    this.client = axios.create({
      baseURL: 'https://api.contactout.com',
      headers: {
        token: this.apiToken ?? '',
      },
    });
  }

  getName(): string {
    return 'contactout';
  }

  isEnabled(): boolean {
    return this.apiToken !== null && this.apiToken.length > 0;
  }

  async checkAvailability(
    linkedinUrl: string,
  ): Promise<ContactAvailability> {
    if (!this.isEnabled()) {
      return { emailAvailable: false, phoneAvailable: false };
    }

    try {
      // Check personal email availability (no credits)
      const personalEmailResponse = await this.client.get(
        '/v1/people/linkedin/personal_email_status',
        {
          params: {
            profile: linkedinUrl,
          },
        },
      );

      // Check work email availability (no credits)
      const workEmailResponse = await this.client.get(
        '/v1/people/linkedin/work_email_status',
        {
          params: {
            profile: linkedinUrl,
          },
        },
      );

      // Check phone availability (no credits)
      const phoneResponse = await this.client.get(
        '/v1/people/linkedin/phone_status',
        {
          params: {
            profile: linkedinUrl,
          },
        },
      );

      const emailAvailable =
        (personalEmailResponse.data?.profile?.email === true) ||
        (workEmailResponse.data?.profile?.email === true);

      const phoneAvailable = phoneResponse.data?.profile?.phone === true;

      return {
        emailAvailable,
        phoneAvailable,
        provider: 'contactout',
      };
    } catch (error) {
      this.logger.error(
        `ContactOut availability check failed for ${linkedinUrl}`,
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
      throw new Error(
        'ContactOut provider is not enabled (CONTACTOUT_API_TOKEN not configured)',
      );
    }

    const { wantEmail = true, wantPhone = true } = options ?? {};

    try {
      const params: Record<string, unknown> = {
        profile: linkedinUrl,
      };

      if (wantPhone) {
        params.include_phone = true;
      }

      const response = await this.client.get('/v1/people/linkedin', {
        params,
      });

      if (response.data?.status_code === 200 && response.data?.profile) {
        const profile = response.data.profile;
        const emails: string[] = [];
        const phones: string[] = [];

        // Extract emails
        if (wantEmail) {
          if (profile.email && Array.isArray(profile.email)) {
            emails.push(...profile.email.filter((e: unknown) => typeof e === 'string'));
          }
          if (profile.work_email && Array.isArray(profile.work_email)) {
            emails.push(...profile.work_email.filter((e: unknown) => typeof e === 'string'));
          }
          if (profile.personal_email && Array.isArray(profile.personal_email)) {
            emails.push(...profile.personal_email.filter((e: unknown) => typeof e === 'string'));
          }
        }

        // Extract phone numbers
        if (wantPhone && profile.phone && Array.isArray(profile.phone)) {
          phones.push(...profile.phone.filter((p: unknown) => typeof p === 'string'));
        }

        return {
          emails: [...new Set(emails)], // Remove duplicates
          phones: [...new Set(phones)], // Remove duplicates
          source: 'contactout',
        };
      }

      // 404 means no match found
      if (response.data?.status_code === 404) {
        return { emails: [], phones: [], source: 'contactout' };
      }

      throw new Error(
        `ContactOut enrichment failed: ${response.data?.status_code ?? 'unknown status'}`,
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { emails: [], phones: [], source: 'contactout' };
      }
      this.logger.error(
        `ContactOut fetch failed for ${linkedinUrl}`,
        error as Error,
      );
      throw error;
    }
  }
}
