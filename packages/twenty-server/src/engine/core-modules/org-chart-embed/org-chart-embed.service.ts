import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

import { v4 as uuidV4 } from 'uuid';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { ImageProxyService } from 'src/engine/core-modules/org-chart/services/image-proxy.service';
import { OrgChartPublishedSlugService } from 'src/engine/core-modules/org-chart/services/org-chart-published-slug.service';
import { OrgChartService } from 'src/engine/core-modules/org-chart/services/org-chart.service';
import { OrgChartS3Service } from 'src/engine/core-modules/org-chart/services/orgchart-s3.service';
import { validatePublishSlug } from 'src/engine/core-modules/org-chart/utils/org-chart-published-slug.util';

import {
  isOrgChartEmbedConfigActive,
  orgChartEmbedKeyCacheKey,
  orgChartEmbedRateLimitCacheKey,
  orgChartEmbedUsageCacheKey,
  orgChartEmbedWorkspaceIndexCacheKey,
  type OrgChartEmbedWorkspaceIndex,
} from './org-chart-embed-cache.util';
import {
  extractRequestOrigin,
  isOriginAllowed,
  normalizeAllowedOrigins,
} from './org-chart-embed-origin.util';
import { OrgChartEmbedWebhookService } from './org-chart-embed-webhook.service';
import type {
  CreateOrgChartEmbedInput,
  OrgChartEmbedConfig,
  OrgChartEmbedResolveResult,
  UpdateOrgChartEmbedInput,
} from './org-chart-embed.types';

const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
const EMBED_KEY_PREFIX = 'emb_';
const DEFAULT_EMBED_MONTHLY_VIEW_LIMIT = 10_000;

const getEmbedMonthlyViewLimit = (): number => {
  const raw = process.env.ORG_CHART_EMBED_MONTHLY_VIEW_LIMIT?.trim();
  if (!raw) {
    return DEFAULT_EMBED_MONTHLY_VIEW_LIMIT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EMBED_MONTHLY_VIEW_LIMIT;
  }
  return parsed;
};

@Injectable()
export class OrgChartEmbedService {
  private readonly logger = new Logger(OrgChartEmbedService.name);

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly orgChartPublishedSlugService: OrgChartPublishedSlugService,
    private readonly imageProxyService: ImageProxyService,
    private readonly orgChartEmbedWebhookService: OrgChartEmbedWebhookService,
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly orgChartCacheStorageService: CacheStorageService,
  ) {}

  private generateEmbedKey(): string {
    return `${EMBED_KEY_PREFIX}${uuidV4().replace(/-/g, '')}`;
  }

  private normalizeCompanyId(companyId: string): string {
    if (!companyId?.trim()) {
      return companyId;
    }
    let decoded = companyId.trim();
    let prev = '';
    while (prev !== decoded) {
      prev = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        break;
      }
    }
    return decoded.toLowerCase();
  }

  private async getConfigByEmbedKey(
    embedKey: string,
  ): Promise<OrgChartEmbedConfig | null> {
    const trimmed = embedKey?.trim();
    if (!trimmed) {
      return null;
    }
    return (
      (await this.orgChartCacheStorageService.get<OrgChartEmbedConfig>(
        orgChartEmbedKeyCacheKey(trimmed),
      )) ?? null
    );
  }

  private async saveConfig(config: OrgChartEmbedConfig): Promise<void> {
    await this.orgChartCacheStorageService.set(
      orgChartEmbedKeyCacheKey(config.embedKey),
      config,
    );

    const indexKey = orgChartEmbedWorkspaceIndexCacheKey(config.workspaceId);
    const index =
      (await this.orgChartCacheStorageService.get<OrgChartEmbedWorkspaceIndex>(
        indexKey,
      )) ?? { embedKeys: [] };

    if (!index.embedKeys.includes(config.embedKey)) {
      index.embedKeys.push(config.embedKey);
      await this.orgChartCacheStorageService.set(indexKey, index);
    }
  }

  private validateCreateInput(input: CreateOrgChartEmbedInput): void {
    if (!input.name?.trim()) {
      throw new HttpException('name is required', HttpStatus.BAD_REQUEST);
    }

    const origins = normalizeAllowedOrigins(input.allowedOrigins ?? []);
    if (origins.length === 0) {
      throw new HttpException(
        'At least one allowed origin is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (input.mode === 'live') {
      if (!input.companyDomain?.trim()) {
        throw new HttpException(
          'companyDomain is required for live mode',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (input.mode === 'published') {
      if (!input.publishSlug?.trim()) {
        throw new HttpException(
          'publishSlug is required for published mode',
          HttpStatus.BAD_REQUEST,
        );
      }
      const slugValidation = validatePublishSlug(input.publishSlug.trim());
      if (!slugValidation.ok) {
        throw new HttpException(
          slugValidation.message ?? 'Invalid publish slug',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async createEmbed(
    workspaceId: string,
    input: CreateOrgChartEmbedInput,
    createdByMemberId?: string,
  ): Promise<OrgChartEmbedConfig> {
    this.validateCreateInput(input);

    const publishedSlugValidation =
      input.mode === 'published' && input.publishSlug?.trim()
        ? validatePublishSlug(input.publishSlug.trim())
        : null;

    const now = new Date().toISOString();
    const embedKey = this.generateEmbedKey();
    const config: OrgChartEmbedConfig = {
      id: uuidV4(),
      embedKey,
      workspaceId,
      name: input.name.trim(),
      allowedOrigins: normalizeAllowedOrigins(input.allowedOrigins),
      mode: input.mode,
      companyDomain: input.companyDomain?.trim() || undefined,
      publishSlug:
        publishedSlugValidation?.ok === true
          ? publishedSlugValidation.slug
          : undefined,
      allowedDomains: input.allowedDomains
        ?.map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
      options: input.options ?? {},
      rateLimitPerMinute:
        input.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
      createdByMemberId,
      createdAt: now,
      updatedAt: now,
    };

    await this.saveConfig(config);
    this.logger.log(
      `Created org chart embed key=${embedKey} workspaceId=${workspaceId} mode=${config.mode}`,
    );

    return config;
  }

  async listEmbeds(workspaceId: string): Promise<OrgChartEmbedConfig[]> {
    const index =
      (await this.orgChartCacheStorageService.get<OrgChartEmbedWorkspaceIndex>(
        orgChartEmbedWorkspaceIndexCacheKey(workspaceId),
      )) ?? { embedKeys: [] };

    const configs = await Promise.all(
      index.embedKeys.map((embedKey) => this.getConfigByEmbedKey(embedKey)),
    );

    return configs.filter(
      (config): config is OrgChartEmbedConfig => config !== null,
    );
  }

  async getActiveEmbedByKey(embedKey: string): Promise<OrgChartEmbedConfig> {
    const config = await this.getConfigByEmbedKey(embedKey);
    if (!config || !isOrgChartEmbedConfigActive(config)) {
      throw new HttpException('Embed not found', HttpStatus.NOT_FOUND);
    }
    return config;
  }

  async emitNodeClickedEvent(input: {
    workspaceId: string;
    embedKey: string;
    node: Record<string, unknown>;
    companyId?: string;
    companyName?: string;
  }): Promise<void> {
    void this.orgChartEmbedWebhookService.emitEmbedEvent({
      workspaceId: input.workspaceId,
      eventName: 'embed.node_clicked',
      record: {
        embedKey: input.embedKey,
        companyId: input.companyId,
        companyName: input.companyName,
        node: input.node,
      },
    });
  }

  async getEmbedForWorkspace(
    workspaceId: string,
    embedKey: string,
  ): Promise<OrgChartEmbedConfig> {
    const config = await this.getConfigByEmbedKey(embedKey);
    if (!config || config.workspaceId !== workspaceId) {
      throw new HttpException('Embed not found', HttpStatus.NOT_FOUND);
    }
    return config;
  }

  async updateEmbed(
    workspaceId: string,
    embedKey: string,
    input: UpdateOrgChartEmbedInput,
  ): Promise<OrgChartEmbedConfig> {
    const config = await this.getEmbedForWorkspace(workspaceId, embedKey);
    const now = new Date().toISOString();

    const updated: OrgChartEmbedConfig = {
      ...config,
      name: input.name?.trim() || config.name,
      allowedOrigins: input.allowedOrigins
        ? normalizeAllowedOrigins(input.allowedOrigins)
        : config.allowedOrigins,
      companyDomain:
        input.companyDomain !== undefined
          ? input.companyDomain.trim() || undefined
          : config.companyDomain,
      publishSlug:
        input.publishSlug !== undefined
          ? input.publishSlug.trim() || undefined
          : config.publishSlug,
      allowedDomains:
        input.allowedDomains !== undefined
          ? input.allowedDomains
              .map((domain) => domain.trim().toLowerCase())
              .filter(Boolean)
          : config.allowedDomains,
      options: input.options ? { ...config.options, ...input.options } : config.options,
      rateLimitPerMinute:
        input.rateLimitPerMinute ?? config.rateLimitPerMinute,
      expiresAt:
        input.expiresAt !== undefined ? input.expiresAt : config.expiresAt,
      updatedAt: now,
    };

    await this.saveConfig(updated);
    return updated;
  }

  async revokeEmbed(
    workspaceId: string,
    embedKey: string,
  ): Promise<OrgChartEmbedConfig> {
    const config = await this.getEmbedForWorkspace(workspaceId, embedKey);
    const revoked: OrgChartEmbedConfig = {
      ...config,
      revokedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.saveConfig(revoked);
    return revoked;
  }

  private async assertRateLimit(embedKey: string, limit: number): Promise<void> {
    const minuteBucket = new Date().toISOString().slice(0, 16);
    const cacheKey = orgChartEmbedRateLimitCacheKey(embedKey, minuteBucket);
    const current =
      (await this.orgChartCacheStorageService.get<number>(cacheKey)) ?? 0;

    if (current >= limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.orgChartCacheStorageService.set(cacheKey, current + 1, 120_000);
  }

  private async recordUsage(embedKey: string): Promise<void> {
    const dayKey = new Date().toISOString().slice(0, 10);
    const cacheKey = orgChartEmbedUsageCacheKey(embedKey, dayKey);
    const current =
      (await this.orgChartCacheStorageService.get<number>(cacheKey)) ?? 0;
    await this.orgChartCacheStorageService.set(
      cacheKey,
      current + 1,
      60 * 60 * 24 * 7 * 1000,
    );
  }

  async getMonthlyUsageCount(embedKey: string): Promise<number> {
    const now = new Date();
    let total = 0;
    for (let dayOffset = 0; dayOffset < 31; dayOffset += 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - dayOffset);
      const dayKey = date.toISOString().slice(0, 10);
      total += await this.getUsageCount(embedKey, dayKey);
    }
    return total;
  }

  private async assertBillingGate(config: OrgChartEmbedConfig): Promise<void> {
    if (config.options?.hidePoweredBy) {
      return;
    }

    const monthlyUsage = await this.getMonthlyUsageCount(config.embedKey);
    if (monthlyUsage > getEmbedMonthlyViewLimit()) {
      throw new HttpException(
        'Embed view limit exceeded for this billing period',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  async getUsageCount(embedKey: string, dayKey?: string): Promise<number> {
    const key = dayKey ?? new Date().toISOString().slice(0, 10);
    return (
      (await this.orgChartCacheStorageService.get<number>(
        orgChartEmbedUsageCacheKey(embedKey, key),
      )) ?? 0
    );
  }

  private async loadPublishedOrgChart(
    publishSlug: string,
  ): Promise<{ companyId: string; companyName?: string; payload: Record<string, unknown> }> {
    const slugValidation = validatePublishSlug(publishSlug);
    if (!slugValidation.ok) {
      throw new HttpException('Invalid publish slug', HttpStatus.BAD_REQUEST);
    }

    const mapping =
      await this.orgChartPublishedSlugService.getPublishedSlugMapping(
        slugValidation.slug,
      );

    const companyId = mapping?.companyId?.trim();
    if (!companyId) {
      throw new HttpException(
        'Published org chart not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    const orgChart =
      (await this.orgChartService.getOrgChartFromS3WithAliasLookup(
        normalizedCompanyId,
      )) ??
      (await this.orgChartS3Service.getOrgChart(normalizedCompanyId));

    if (!orgChart) {
      throw new HttpException('Org chart not found', HttpStatus.NOT_FOUND);
    }

    const payload: Record<string, unknown> = {
      ...(orgChart as Record<string, unknown>),
      ...(mapping?.companyName?.trim()
        ? { job_company_name: mapping.companyName.trim() }
        : {}),
    };

    return {
      companyId: normalizedCompanyId,
      companyName: mapping?.companyName?.trim() || normalizedCompanyId,
      payload,
    };
  }

  private async loadLiveOrgChart(
    domain: string,
    config: OrgChartEmbedConfig,
  ): Promise<{ companyId: string; companyName: string; payload: Record<string, unknown> }> {
    const resolved = await this.orgChartService.resolveCompanyByDomain(domain);
    if (!resolved.found || !resolved.companyId?.trim()) {
      throw new HttpException(
        'Company not found for domain',
        HttpStatus.NOT_FOUND,
      );
    }

    const companyId = this.normalizeCompanyId(resolved.companyId);
    const companyName =
      resolved.companyName?.trim() || resolved.companyId.trim();

    if (config.allowedDomains && config.allowedDomains.length > 0) {
      const normalizedDomain = domain.trim().toLowerCase();
      const isAllowed = config.allowedDomains.some(
        (allowed) =>
          normalizedDomain === allowed ||
          normalizedDomain.endsWith(`.${allowed}`),
      );
      if (!isAllowed) {
        throw new HttpException('Domain not allowed', HttpStatus.FORBIDDEN);
      }
    }

    const chartResult = await this.orgChartService.getOrgChart(companyId, {
      companyName,
      website: resolved.website,
      serveCachedOnly: false,
    });

    return {
      companyId,
      companyName,
      payload: chartResult.data as Record<string, unknown>,
    };
  }

  async resolveEmbedChart(input: {
    embedKey: string;
    domain?: string;
    origin?: string | null;
    referer?: string | null;
  }): Promise<OrgChartEmbedResolveResult> {
    const config = await this.getConfigByEmbedKey(input.embedKey);
    if (!config || !isOrgChartEmbedConfigActive(config)) {
      throw new HttpException('Embed not found', HttpStatus.NOT_FOUND);
    }

    const requestOrigin = extractRequestOrigin({
      origin: input.origin,
      referer: input.referer,
    });

    if (!isOriginAllowed(requestOrigin, config.allowedOrigins)) {
      throw new HttpException('Origin not allowed', HttpStatus.FORBIDDEN);
    }

    await this.assertRateLimit(config.embedKey, config.rateLimitPerMinute);
    await this.assertBillingGate(config);
    await this.recordUsage(config.embedKey);

    let companyId: string;
    let companyName: string;
    let payload: Record<string, unknown>;

    if (config.mode === 'published') {
      const published = await this.loadPublishedOrgChart(
        config.publishSlug ?? '',
      );
      companyId = published.companyId;
      companyName = published.companyName ?? companyId;
      payload = published.payload;
    } else {
      const domain = (input.domain ?? config.companyDomain ?? '').trim();
      if (!domain) {
        throw new HttpException('domain is required', HttpStatus.BAD_REQUEST);
      }
      const live = await this.loadLiveOrgChart(domain, config);
      companyId = live.companyId;
      companyName = live.companyName;
      payload = live.payload;
    }

    const proxiedPayload =
      await this.imageProxyService.proxyImagesInPayload(payload);

    void this.orgChartEmbedWebhookService.emitEmbedEvent({
      workspaceId: config.workspaceId,
      eventName: 'embed.viewed',
      record: {
        embedKey: config.embedKey,
        companyId,
        companyName,
        mode: config.mode,
        domain: input.domain ?? config.companyDomain,
      },
    });

    return {
      status: 'ok',
      companyId,
      companyName,
      mode: config.mode,
      options: config.options,
      result: proxiedPayload,
    };
  }

  isOriginAllowedForEmbed(
    embedKey: string,
    origin: string | null,
  ): Promise<boolean> {
    return this.getConfigByEmbedKey(embedKey).then((config) => {
      if (!config || !isOrgChartEmbedConfigActive(config)) {
        return false;
      }
      return isOriginAllowed(origin, config.allowedOrigins);
    });
  }
}
