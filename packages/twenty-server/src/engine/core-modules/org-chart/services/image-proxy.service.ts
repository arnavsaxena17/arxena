import { Injectable, Logger } from '@nestjs/common';

import { CandidateAvatarStorageService } from 'src/engine/core-modules/candidate-avatar/services/candidate-avatar-storage.service';

/** Allowed hostnames for image proxy (e.g. LinkedIn CDN, default avatar). */
const ALLOWED_IMAGE_HOSTS = new Set([
  'media.licdn.com',
  'media-exp1.licdn.com',
  'static.licdn.com',
  'st2.depositphotos.com',
]);
const ALLOWED_IMAGE_HOST_SUFFIXES = ['.theorg.com'];
const PROXY_PATH = '/org-chart/image-proxy';
const PROXY_BUCKET_THEORG = 'images-1';
const PROXY_BUCKET_EXTERNAL = 'images-2';
const IMAGE_FIELD_NAMES = new Set([
  'profile_picture_url',
  'profile_picture_url_large',
  'profileImageUrl',
  'displayPicture',
  'display_picture',
  'image',
  'avatar',
]);

@Injectable()
export class ImageProxyService {
  private readonly logger = new Logger(ImageProxyService.name);

  constructor(
    private readonly candidateAvatarStorageService: CandidateAvatarStorageService,
  ) {}

  private isAllowedHost(hostname: string): boolean {
    const normalizedHostname = hostname.toLowerCase();

    return (
      ALLOWED_IMAGE_HOSTS.has(normalizedHostname) ||
      ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) =>
        normalizedHostname.endsWith(suffix),
      )
    );
  }

  isAllowedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      return this.isAllowedHost(parsed.hostname);
    } catch {
      return false;
    }
  }

  isProxyUrl(url: string): boolean {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return false;
    }

    if (this.candidateAvatarStorageService.isPersistedAvatarUrl(trimmedUrl)) {
      return true;
    }

    if (trimmedUrl.startsWith(`${PROXY_PATH}/`)) {
      return true;
    }

    try {
      const parsed = new URL(trimmedUrl);

      return parsed.pathname.startsWith(`${PROXY_PATH}/`);
    } catch {
      return false;
    }
  }

  private toBase64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private fromBase64Url(value: string): string | null {
    try {
      return Buffer.from(value, 'base64url').toString('utf8');
    } catch {
      return null;
    }
  }

  private buildDeterministicProxyPath(url: string): string | null {
    const parsed = new URL(url);
    const normalizedHost = parsed.hostname.toLowerCase();

    if (ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix))) {
      const match = parsed.pathname.match(
        /^\/([a-z0-9-]+?)(?:_([a-z0-9-]+))?\.([a-z0-9]+)$/iu,
      );

      if (match) {
        const [, imageId, variant, ext] = match;

        return `${PROXY_PATH}/${PROXY_BUCKET_THEORG}/${imageId}/${variant || 'original'}/${ext.toLowerCase()}`;
      }
    }

    if (ALLOWED_IMAGE_HOSTS.has(normalizedHost)) {
      const encodedPath = this.toBase64Url(`${parsed.pathname}${parsed.search}`);

      const encodedHost = this.toBase64Url(normalizedHost);

      return `${PROXY_PATH}/${PROXY_BUCKET_EXTERNAL}/${encodedHost}/${encodedPath}`;
    }

    return null;
  }

  async buildProxyUrl(url: string | null | undefined): Promise<string | null> {
    const trimmedUrl = url?.trim();

    if (!trimmedUrl) {
      return null;
    }

    if (this.candidateAvatarStorageService.isPersistedAvatarUrl(trimmedUrl)) {
      return trimmedUrl;
    }

    if (this.isProxyUrl(trimmedUrl)) {
      return trimmedUrl;
    }

    if (!this.isAllowedUrl(trimmedUrl)) {
      return trimmedUrl;
    }

    return this.buildDeterministicProxyPath(trimmedUrl) ?? trimmedUrl;
  }

  async proxyImagesInPayload<T>(value: T): Promise<T> {
    return (await this.rewriteValue(value)) as T;
  }

  private async rewriteValue(value: unknown): Promise<unknown> {
    if (Array.isArray(value)) {
      return Promise.all(value.map((entry) => this.rewriteValue(entry)));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const record = value as Record<string, unknown>;
    const rewritten: Record<string, unknown> = {};

    for (const [key, currentValue] of Object.entries(record)) {
      if (key === 'orgchart' && Array.isArray(currentValue)) {
        rewritten[key] = await this.rewriteValue(currentValue);
        continue;
      }

      if (key === 'orgchart' && typeof currentValue === 'string') {
        rewritten[key] = await this.rewriteOrgChartString(currentValue);
        continue;
      }

      if (typeof currentValue === 'string' && IMAGE_FIELD_NAMES.has(key)) {
        if (
          this.candidateAvatarStorageService.isPersistedAvatarUrl(currentValue)
        ) {
          rewritten[key] = currentValue;
        } else {
          rewritten[key] = await this.buildProxyUrl(currentValue);
        }
        continue;
      }

      rewritten[key] = await this.rewriteValue(currentValue);
    }

    return rewritten;
  }

  private async rewriteOrgChartString(orgChart: string): Promise<string> {
    try {
      const parsed = JSON.parse(orgChart) as unknown;
      const rewritten = await this.rewriteValue(parsed);

      return JSON.stringify(rewritten);
    } catch {
      this.logger.warn('Failed to parse orgchart JSON for image proxy rewrite');
      return orgChart;
    }
  }

  resolveUrlFromDeterministicPath(
    bucket: string,
    identifierA: string,
    identifierB?: string,
    identifierC?: string,
  ): string | null {
    const normalizedBucket = bucket.trim().toLowerCase();

    if (normalizedBucket === PROXY_BUCKET_THEORG) {
      const imageId = identifierA.trim();
      const variant = (identifierB?.trim() || 'original').toLowerCase();
      const ext = (identifierC?.trim() || 'jpg').toLowerCase();

      if (!imageId || !/^[a-z0-9-]+$/iu.test(imageId)) {
        return null;
      }

      if (!/^[a-z0-9-]+$/iu.test(variant) || !/^[a-z0-9]+$/iu.test(ext)) {
        return null;
      }

      const suffix = variant === 'original' ? '' : `_${variant}`;

      return `https://cdn.theorg.com/${imageId}${suffix}.${ext}`;
    }

    if (normalizedBucket === PROXY_BUCKET_EXTERNAL) {
      const host = this.fromBase64Url(identifierA.trim())?.trim().toLowerCase();
      const pathAndQuery = this.fromBase64Url(identifierB?.trim() || '');

      if (!host || !pathAndQuery || !ALLOWED_IMAGE_HOSTS.has(host)) {
        return null;
      }

      if (!pathAndQuery.startsWith('/')) {
        return null;
      }

      return `https://${host}${pathAndQuery}`;
    }

    return null;
  }

  private async tryServeFromPersistedCache(url: string): Promise<{
    ok: boolean;
    contentType: string | null;
    body: ArrayBuffer;
  } | null> {
    const stableKey = this.candidateAvatarStorageService.resolveStableKey({
      imageUrl: url,
    });
    if (!stableKey) {
      return null;
    }

    const exists =
      await this.candidateAvatarStorageService.avatarExists(stableKey);
    if (!exists) {
      return null;
    }

    const buffer =
      await this.candidateAvatarStorageService.readAvatarBuffer(stableKey);
    if (!buffer || buffer.byteLength === 0) {
      return null;
    }

    return {
      ok: true,
      contentType: 'image/webp',
      body: buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer,
    };
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
    const cached = await this.tryServeFromPersistedCache(url);
    if (cached) {
      return cached;
    }

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
          Referer: 'https://www.linkedin.com/',
        },
      });

      const contentType =
        response.headers.get('content-type') ?? 'image/jpeg';
      const body = await response.arrayBuffer();

      if (!response.ok) {
        const stableKey = this.candidateAvatarStorageService.resolveStableKey({
          imageUrl: url,
        });
        if (stableKey) {
          const meta =
            await this.candidateAvatarStorageService.readMeta(stableKey);
          if (meta?.linkedinUrl) {
            this.logger.warn(
              `Image proxy upstream ${response.status}; avatar meta has linkedinUrl for key=${stableKey}`,
            );
          }
        }
      }

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
