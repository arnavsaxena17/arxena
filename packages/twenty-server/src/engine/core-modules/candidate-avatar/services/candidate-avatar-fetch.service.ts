import { Injectable, Logger } from '@nestjs/common';

import {
    AVATAR_ALLOWED_IMAGE_HOSTS,
    AVATAR_ALLOWED_IMAGE_HOST_SUFFIXES,
} from '../candidate-avatar.constants';

@Injectable()
export class CandidateAvatarFetchService {
  private readonly logger = new Logger(CandidateAvatarFetchService.name);

  isAllowedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return false;
      }
      const hostname = parsed.hostname.toLowerCase();

      return (
        AVATAR_ALLOWED_IMAGE_HOSTS.has(hostname) ||
        AVATAR_ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) =>
          hostname.endsWith(suffix),
        )
      );
    } catch {
      return false;
    }
  }

  async fetchImageBuffer(
    url: string,
    timeoutMs: number,
  ): Promise<{ ok: boolean; buffer: Buffer; contentType: string | null }> {
    if (!this.isAllowedUrl(url)) {
      this.logger.warn(`Avatar fetch rejected disallowed URL: ${url}`);
      return { ok: false, buffer: Buffer.alloc(0), contentType: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; ArxenaCandidateAvatar/1.0)',
          Accept: 'image/*',
          Referer: 'https://www.linkedin.com/',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `Avatar fetch upstream status ${response.status} for ${url}`,
        );
        return {
          ok: false,
          buffer: Buffer.alloc(0),
          contentType: response.headers.get('content-type'),
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return {
        ok: true,
        buffer,
        contentType: response.headers.get('content-type'),
      };
    } catch (error) {
      this.logger.warn(`Avatar fetch failed for ${url}`, error);
      return { ok: false, buffer: Buffer.alloc(0), contentType: null };
    } finally {
      clearTimeout(timeout);
    }
  }
}
