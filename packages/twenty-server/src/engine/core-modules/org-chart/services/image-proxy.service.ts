import { Injectable, Logger } from '@nestjs/common';

/** Allowed hostnames for image proxy (e.g. LinkedIn CDN, default avatar). */
const ALLOWED_IMAGE_HOSTS = new Set([
  'media.licdn.com',
  'media-exp1.licdn.com',
  'static.licdn.com',
  'st2.depositphotos.com',
]);

@Injectable()
export class ImageProxyService {
  private readonly logger = new Logger(ImageProxyService.name);

  isAllowedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      return ALLOWED_IMAGE_HOSTS.has(host);
    } catch {
      return false;
    }
  }

  /**
   * Fetch image from URL and return body + content-type for proxying.
   * Only allows configured hosts to avoid open proxy abuse.
   */
  async fetchImage(url: string): Promise<{
    ok: boolean;
    contentType: string | null;
    body: ArrayBuffer;
  }> {
    if (!this.isAllowedUrl(url)) {
      this.logger.warn(`Image proxy rejected disallowed URL: ${url}`);
      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; ArxenaImageProxy/1.0)',
          Accept: 'image/*',
        },
      });

      const contentType =
        response.headers.get('content-type') ?? 'image/jpeg';
      const body = await response.arrayBuffer();

      return {
        ok: response.ok,
        contentType,
        body,
      };
    } catch (error) {
      this.logger.warn('Image proxy fetch failed', { url, error });
      return {
        ok: false,
        contentType: null,
        body: new ArrayBuffer(0),
      };
    }
  }
}
