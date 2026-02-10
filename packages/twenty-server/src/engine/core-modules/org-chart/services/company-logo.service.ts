import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

const NUBELA_LOGO_API = 'https://nubela.co/api/v1/company/logo';

@Injectable()
export class CompanyLogoService {
  private readonly logger = new Logger(CompanyLogoService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    const key = this.environmentService.get('NUBELA_API_KEY');
    return typeof key === 'string' && key.length > 0;
  }

  private getApiKey(): string | undefined {
    const key = this.environmentService.get('NUBELA_API_KEY');
    return typeof key === 'string' && key.length > 0 ? key : undefined;
  }

  /**
   * Fetch company logo image from Nubela API by company website.
   * Returns the response (image binary or error) to be forwarded to the client.
   */
  async fetchLogoByWebsite(website: string): Promise<{
    ok: boolean;
    contentType: string | null;
    body: ArrayBuffer;
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn('NUBELA_API_KEY not configured');
      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }

    const normalizedWebsite = this.normalizeWebsite(website);
    if (!normalizedWebsite) {
      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }

    try {
      const url = `${NUBELA_LOGO_API}?${new URLSearchParams({
        website: normalizedWebsite,
      }).toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const contentType =
        response.headers.get('content-type') ?? 'image/png';
      const body = await response.arrayBuffer();

      return {
        ok: response.ok,
        contentType,
        body,
      };
    } catch (error) {
      this.logger.warn('Nubela logo fetch failed', error);
      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }
  }

  private normalizeWebsite(website: string): string | null {
    const trimmed = website?.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }
}
