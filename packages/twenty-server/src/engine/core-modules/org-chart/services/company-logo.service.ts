import { Injectable, Logger } from '@nestjs/common';

import { TWENTY_ICONS_BASE_URL } from 'twenty-shared';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

const NUBELA_LOGO_API = 'https://nubela.co/api/v1/company/logo';

/** Supported by https://github.com/twentyhq/favicon — good for ~40px UI at DPR 2–3 */
const TWENTY_ICONS_LOGO_SIZE = 128;

/** Google s2 favicon size hint (undocumented API; sz is not guaranteed) */
const GOOGLE_S2_FAVICON_SZ = 128;

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
   * Fetch company logo: Twenty Icons → Google s2/favicons → Nubela (if configured).
   */
  async fetchLogoByWebsite(website: string): Promise<{
    ok: boolean;
    contentType: string | null;
    body: ArrayBuffer;
  }> {
    const normalizedWebsite = this.normalizeWebsite(website);

    if (!normalizedWebsite) {
      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }

    const domain = this.extractDomainFromWebsite(normalizedWebsite);

    if (domain) {
      const twentyResult = await this.fetchLogoFromTwentyIcons(domain);

      if (this.isUsableLogo(twentyResult)) {
        return twentyResult;
      }

      const googleResult = await this.fetchLogoFromGoogleS2(domain);

      if (this.isUsableLogo(googleResult)) {
        return googleResult;
      }
    }

    return this.fetchLogoFromNubelaIfConfigured(normalizedWebsite);
  }

  private isUsableLogo(result: { ok: boolean; body: ArrayBuffer }): boolean {
    return result.ok && result.body.byteLength > 0;
  }

  private async fetchLogoFromNubelaIfConfigured(
    normalizedWebsite: string,
  ): Promise<{
    ok: boolean;
    contentType: string | null;
    body: ArrayBuffer;
  }> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      this.logger.warn(
        'CompanyLogo: nubela_skip reason=no_api_key chain=twenty_icons→google_s2→nubela',
      );

      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }

    const nubelaResult = await this.fetchLogoFromNubela(
      normalizedWebsite,
      apiKey,
    );

    if (this.isUsableLogo(nubelaResult)) {
      return nubelaResult;
    }

    if (!nubelaResult.ok) {
      this.logger.warn(
        `CompanyLogo: nubela_miss website=${normalizedWebsite}`,
      );
    } else {
      this.logger.warn(
        `CompanyLogo: nubela_empty_body website=${normalizedWebsite}`,
      );
    }

    return nubelaResult;
  }

  private async fetchLogoFromNubela(
    normalizedWebsite: string,
    apiKey: string,
  ): Promise<{
    ok: boolean;
    contentType: string | null;
    body: ArrayBuffer;
  }> {
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

      const contentType = response.headers.get('content-type') ?? 'image/png';
      const body = await response.arrayBuffer();

      return {
        ok: response.ok,
        contentType,
        body,
      };
    } catch (error) {
      this.logger.warn(
        `CompanyLogo: nubela_error website=${normalizedWebsite} err=${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }
  }

  private async fetchLogoFromTwentyIcons(domain: string): Promise<{
    ok: boolean;
    contentType: string | null;
    body: ArrayBuffer;
  }> {
    try {
      const url = `${TWENTY_ICONS_BASE_URL}/${domain}/${TWENTY_ICONS_LOGO_SIZE}`;
      const response = await fetch(url, { method: 'GET' });
      const contentType = response.headers.get('content-type') ?? 'image/png';
      const body = await response.arrayBuffer();
      const ok = response.ok && body.byteLength > 0;

      if (!ok) {
        this.logger.warn(
          `CompanyLogo: twenty_icons_miss domain=${domain} httpStatus=${response.status} bytes=${body.byteLength}`,
        );
      }

      return { ok, contentType, body };
    } catch (error) {
      this.logger.warn(
        `CompanyLogo: twenty_icons_error domain=${domain} err=${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }
  }

  private async fetchLogoFromGoogleS2(domain: string): Promise<{
    ok: boolean;
    contentType: string | null;
    body: ArrayBuffer;
  }> {
    try {
      const url = `https://www.google.com/s2/favicons?${new URLSearchParams({
        domain,
        sz: String(GOOGLE_S2_FAVICON_SZ),
      })}`;
      const response = await fetch(url, { method: 'GET' });
      const contentType = response.headers.get('content-type') ?? 'image/png';
      const body = await response.arrayBuffer();
      const ok = response.ok && body.byteLength > 0;

      if (ok) {
        this.logger.debug(`CompanyLogo: google_s2_hit domain=${domain}`);
      } else {
        this.logger.warn(
          `CompanyLogo: google_s2_miss domain=${domain} httpStatus=${response.status} bytes=${body.byteLength}`,
        );
      }

      return { ok, contentType, body };
    } catch (error) {
      this.logger.warn(
        `CompanyLogo: google_s2_error domain=${domain} err=${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }
  }

  private extractDomainFromWebsite(normalizedWebsite: string): string | null {
    try {
      const host = new URL(normalizedWebsite).hostname.trim().toLowerCase();

      if (!host) {
        return null;
      }
      if (host.startsWith('www.')) {
        return host.slice(4) || null;
      }

      return host;
    } catch {
      return null;
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
