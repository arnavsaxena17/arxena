import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';
import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral, type Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import { ClickHouseService } from 'src/database/clickHouse/clickHouse.service';
import { IpCompanyResolutionService } from 'src/engine/core-modules/geo/ip-company-resolution.service';
import { IpInfoGeoService } from 'src/engine/core-modules/geo/ip-info-geo.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import {
  WEBSITE_DOMAIN_LIMIT,
  WEBSITE_TRACKING_APP_ID_PREFIX,
  buildWebsiteTrackerSnippet,
  hostnameFromOriginOrUrl,
  mapConfidenceToSelect,
  normalizeWebsiteHostname,
  type WebsiteCollectInput,
  type WebsiteCollectResult,
  type WebsiteDomainStatus,
  type WebsiteSnippetResult,
} from 'src/engine/core-modules/website-tracker/website-tracker.types';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WebsiteDomainRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  domain?: string | null;
  status?: WebsiteDomainStatus | null;
  trackingLevel?: string | null;
  lastSeenAt?: string | null;
  lastError?: string | null;
  verifiedAt?: string | null;
};

type WebsiteVisitorRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  companyId?: string | null;
  websiteDomainId?: string | null;
  ip?: string | null;
  country?: string | null;
  city?: string | null;
  asn?: string | null;
  asnOwner?: string | null;
  confidence?: string | null;
  source?: string | null;
  pagePath?: string | null;
  pageUrl?: string | null;
  referrer?: string | null;
  visitCount?: number | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
};

const PAGEVIEW_TABLE = 'website_pageview';

@Injectable()
export class WebsiteTrackerService {
  private readonly logger = new Logger(WebsiteTrackerService.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly ipCompanyResolutionService: IpCompanyResolutionService,
    private readonly ipInfoGeoService: IpInfoGeoService,
    private readonly clickHouseService: ClickHouseService,
  ) {}

  async ensureTrackingAppId(workspaceId: string): Promise<WebsiteSnippetResult> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!isDefined(workspace)) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    let appId = workspace.websiteTrackingAppId;
    let enabled = workspace.websiteTrackingEnabled ?? false;

    if (!isNonEmptyString(appId)) {
      appId = `${WEBSITE_TRACKING_APP_ID_PREFIX}${uuidv4().replace(/-/g, '')}`;
      enabled = true;
      await this.workspaceRepository.update(
        { id: workspaceId },
        {
          websiteTrackingAppId: appId,
          websiteTrackingEnabled: true,
        },
      );
    }

    const siteBaseUrl =
      process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://arxena.com';
    const apiBaseUrl =
      process.env.SERVER_URL?.replace(/\/$/, '') || 'https://api.arxena.com';

    return {
      appId,
      enabled,
      siteBaseUrl,
      apiBaseUrl,
      snippet: buildWebsiteTrackerSnippet({
        appId,
        siteBaseUrl,
        apiBaseUrl,
      }),
    };
  }

  async setTrackingEnabled(
    workspaceId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.ensureTrackingAppId(workspaceId);
    await this.workspaceRepository.update(
      { id: workspaceId },
      { websiteTrackingEnabled: enabled },
    );
  }

  async createDomain(
    workspaceId: string,
    rawDomain: string,
  ): Promise<WebsiteDomainRecord> {
    await this.ensureTrackingAppId(workspaceId);

    const domain = normalizeWebsiteHostname(rawDomain);
    if (!isNonEmptyString(domain)) {
      throw new Error('Invalid domain');
    }

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = await this.getDomainRepository(workspaceId);
        if (!repository) {
          throw new Error('websiteDomain object unavailable');
        }

        const existing = await repository.find({
          take: WEBSITE_DOMAIN_LIMIT + 5,
        });
        const duplicate = existing.find(
          (record) =>
            normalizeWebsiteHostname(record.domain ?? '') === domain,
        );
        if (isDefined(duplicate)) {
          throw new Error('Domain already registered');
        }
        if (existing.length >= WEBSITE_DOMAIN_LIMIT) {
          throw new Error(
            `Domain limit reached (${WEBSITE_DOMAIN_LIMIT}). Remove a domain to add another.`,
          );
        }

        // Direct ORM insert skips GraphQL actor side-effects; set required
        // createdBy/updatedBy so NOT NULL composite columns are populated.
        const systemActor = buildCreatedByFromSystem();
        const insertResult = await repository.insert({
          name: domain,
          domain,
          status: 'PENDING',
          trackingLevel: 'COMPANY',
          createdBy: systemActor,
          updatedBy: systemActor,
        });

        const createdId = insertResult.identifiers[0]?.id as string | undefined;
        if (!isNonEmptyString(createdId)) {
          throw new Error('Failed to create website domain');
        }

        const created = await repository.findOne({
          where: { id: createdId },
        });
        if (!isDefined(created)) {
          throw new Error('Failed to load created website domain');
        }

        return created;
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  async deleteDomain(workspaceId: string, domainId: string): Promise<void> {
    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = await this.getDomainRepository(workspaceId);
        if (!repository) {
          throw new Error('websiteDomain object unavailable');
        }

        await repository.delete({ id: domainId });
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  async listDomains(workspaceId: string): Promise<WebsiteDomainRecord[]> {
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = await this.getDomainRepository(workspaceId);
        if (!repository) {
          return [];
        }

        return repository.find({
          order: { createdAt: 'DESC' },
          take: 50,
        });
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  async listVisitors(workspaceId: string): Promise<WebsiteVisitorRecord[]> {
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = await this.getVisitorRepository(workspaceId);
        if (!repository) {
          return [];
        }

        return repository.find({
          order: { lastSeenAt: 'DESC' },
          take: 50,
        });
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  async testConnection(
    workspaceId: string,
    domainId: string,
  ): Promise<{ status: WebsiteDomainStatus; lastError: string | null }> {
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = await this.getDomainRepository(workspaceId);
        if (!repository) {
          throw new Error('websiteDomain object unavailable');
        }

        const domainRecord = await repository.findOne({
          where: { id: domainId },
        });
        if (!isDefined(domainRecord)) {
          throw new Error('Domain not found');
        }

        const lastSeenAt = domainRecord.lastSeenAt
          ? new Date(domainRecord.lastSeenAt).getTime()
          : null;
        const recentlySeen =
          isDefined(lastSeenAt) && Date.now() - lastSeenAt < 7 * 24 * 60 * 60 * 1000;

        if (recentlySeen || domainRecord.status === 'ACTIVE') {
          await repository.update(
            { id: domainId },
            {
              status: 'ACTIVE',
              lastError: null,
              verifiedAt: new Date().toISOString(),
            },
          );

          return { status: 'ACTIVE' as const, lastError: null };
        }

        const lastError =
          'Failed to connect: check your script. Open a page on this domain after installing the snippet, then test again.';
        await repository.update(
          { id: domainId },
          {
            status: 'FAILED',
            lastError,
          },
        );

        return { status: 'FAILED' as const, lastError };
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  async collect(
    ip: string,
    input: WebsiteCollectInput,
  ): Promise<WebsiteCollectResult> {
    const appId = input.appId?.trim();
    if (!isNonEmptyString(appId)) {
      return {
        ok: false,
        persisted: false,
        visitorUpserted: false,
        companyName: null,
        companyDomain: null,
        confidence: 'none',
        error: 'appId is required',
      };
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { websiteTrackingAppId: appId },
    });

    if (!isDefined(workspace) || workspace.websiteTrackingEnabled !== true) {
      return {
        ok: false,
        persisted: false,
        visitorUpserted: false,
        companyName: null,
        companyDomain: null,
        confidence: 'none',
        error: 'unknown or disabled appId',
      };
    }

    const hostDomain =
      normalizeWebsiteHostname(input.hostDomain ?? '') ??
      hostnameFromOriginOrUrl(input.origin) ??
      hostnameFromOriginOrUrl(input.pageUrl) ??
      hostnameFromOriginOrUrl(input.referrer);

    if (!isNonEmptyString(hostDomain)) {
      return {
        ok: false,
        persisted: false,
        visitorUpserted: false,
        companyName: null,
        companyDomain: null,
        confidence: 'none',
        error: 'could not determine request domain',
      };
    }

    const matchedDomain = await this.findRegisteredDomain(
      workspace.id,
      hostDomain,
    );

    if (!isDefined(matchedDomain)) {
      return {
        ok: false,
        persisted: false,
        visitorUpserted: false,
        companyName: null,
        companyDomain: null,
        confidence: 'none',
        error: 'domain not registered for this workspace',
      };
    }

    const resolution =
      await this.ipCompanyResolutionService.resolveCompanyByIp(ip);
    const country =
      (await this.ipInfoGeoService.lookupCountryByIp(ip)) ?? null;

    const persisted = await this.persistPageview({
      workspaceId: workspace.id,
      trackingAppId: appId,
      websiteDomain: hostDomain,
      path: input.path,
      pageUrl: input.pageUrl,
      referrer: input.referrer,
      ip,
      companyName: resolution.companyName,
      domain: resolution.domain,
      asn: resolution.asn,
      asnOwner: resolution.asnOwner,
      rdnsHostname: resolution.rdnsHostname,
      confidence: resolution.confidence,
      source: resolution.source,
    });

    const visitorUpserted = await this.upsertVisitor({
      workspaceId: workspace.id,
      websiteDomainId: matchedDomain.id,
      ip,
      companyName: resolution.companyName,
      companyDomain: resolution.domain,
      country,
      asn: resolution.asn,
      asnOwner: resolution.asnOwner,
      confidence: mapConfidenceToSelect(resolution.confidence),
      source: resolution.source,
      pagePath: input.path ?? null,
      pageUrl: input.pageUrl ?? null,
      referrer: input.referrer ?? null,
    });

    await this.markDomainActive(workspace.id, matchedDomain.id);

    return {
      ok: true,
      persisted,
      visitorUpserted,
      companyName: resolution.companyName,
      companyDomain: resolution.domain,
      confidence: resolution.confidence,
    };
  }

  private async findRegisteredDomain(
    workspaceId: string,
    hostDomain: string,
  ): Promise<WebsiteDomainRecord | null> {
    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = await this.getDomainRepository(workspaceId);
        if (!repository) {
          return null;
        }

        const domains = await repository.find({ take: 50 });
        return (
          domains.find(
            (record) =>
              normalizeWebsiteHostname(record.domain ?? '') === hostDomain,
          ) ?? null
        );
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  private async markDomainActive(
    workspaceId: string,
    domainId: string,
  ): Promise<void> {
    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = await this.getDomainRepository(workspaceId);
        if (!repository) {
          return;
        }

        await repository.update(
          { id: domainId },
          {
            status: 'ACTIVE',
            lastError: null,
            lastSeenAt: new Date().toISOString(),
          },
        );
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  private async upsertVisitor(input: {
    workspaceId: string;
    websiteDomainId: string;
    ip: string;
    companyName: string | null;
    companyDomain: string | null;
    country: string | null;
    asn: string | null;
    asnOwner: string | null;
    confidence: string;
    source: string | null;
    pagePath: string | null;
    pageUrl: string | null;
    referrer: string | null;
  }): Promise<boolean> {
    try {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const repository = await this.getVisitorRepository(input.workspaceId);
          if (!repository) {
            return;
          }

          const identityKey = isNonEmptyString(input.companyDomain)
            ? { companyDomain: input.companyDomain }
            : { ip: input.ip };

          const existingList = await repository.find({
            where: {
              websiteDomainId: input.websiteDomainId,
              ...identityKey,
            },
            take: 1,
          });
          const existing = existingList[0];
          const nowIso = new Date().toISOString();
          const displayName =
            input.companyName ??
            input.companyDomain ??
            `Visitor ${input.ip}`;

          if (isDefined(existing)) {
            await repository.update(
              { id: existing.id },
              {
                name: displayName,
                companyName: input.companyName,
                companyDomain: input.companyDomain,
                ip: input.ip,
                country: input.country,
                asn: input.asn,
                asnOwner: input.asnOwner,
                confidence: input.confidence,
                source: input.source,
                pagePath: input.pagePath,
                pageUrl: input.pageUrl,
                referrer: input.referrer,
                visitCount: (existing.visitCount ?? 0) + 1,
                lastSeenAt: nowIso,
              },
            );
            return;
          }

          const systemActor = buildCreatedByFromSystem();
          await repository.insert({
            name: displayName,
            companyName: input.companyName,
            companyDomain: input.companyDomain,
            websiteDomainId: input.websiteDomainId,
            ip: input.ip,
            country: input.country,
            asn: input.asn,
            asnOwner: input.asnOwner,
            confidence: input.confidence,
            source: input.source,
            pagePath: input.pagePath,
            pageUrl: input.pageUrl,
            referrer: input.referrer,
            visitCount: 1,
            firstSeenAt: nowIso,
            lastSeenAt: nowIso,
            createdBy: systemActor,
            updatedBy: systemActor,
          });
        },
        buildSystemAuthContext(input.workspaceId),
      );

      return true;
    } catch (error) {
      this.logger.warn('[WebsiteTrackerService] visitor upsert failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async persistPageview(record: {
    workspaceId: string;
    trackingAppId: string;
    websiteDomain: string;
    path?: string;
    pageUrl?: string;
    referrer?: string;
    ip: string;
    companyName: string | null;
    domain: string | null;
    asn: string | null;
    asnOwner: string | null;
    rdnsHostname: string | null;
    confidence: string;
    source: string | null;
  }): Promise<boolean> {
    try {
      const client = this.clickHouseService.getClient();
      if (!client) {
        return false;
      }

      await client.command({
        query: `
          CREATE TABLE IF NOT EXISTS ${PAGEVIEW_TABLE}
          (
            workspace_id String,
            tracking_app_id String,
            website_domain String,
            path Nullable(String),
            page_url Nullable(String),
            referrer Nullable(String),
            ip String,
            company_name Nullable(String),
            domain Nullable(String),
            asn Nullable(String),
            asn_owner Nullable(String),
            rdns_hostname Nullable(String),
            confidence LowCardinality(String),
            source Nullable(String),
            resolved_at DateTime DEFAULT now()
          )
          ENGINE = MergeTree()
          ORDER BY (workspace_id, resolved_at, ip)
        `,
      });

      await client.insert({
        table: PAGEVIEW_TABLE,
        values: [
          {
            workspace_id: record.workspaceId,
            tracking_app_id: record.trackingAppId,
            website_domain: record.websiteDomain,
            path: record.path ?? null,
            page_url: record.pageUrl ?? null,
            referrer: record.referrer ?? null,
            ip: record.ip,
            company_name: record.companyName,
            domain: record.domain,
            asn: record.asn,
            asn_owner: record.asnOwner,
            rdns_hostname: record.rdnsHostname,
            confidence: record.confidence,
            source: record.source,
          },
        ],
        format: 'JSONEachRow',
        clickhouse_settings: {
          async_insert: 1,
          wait_for_async_insert: 1,
        },
      });

      return true;
    } catch (error) {
      this.logger.warn('[WebsiteTrackerService] pageview persist failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async getDomainRepository(workspaceId: string) {
    try {
      return await this.globalWorkspaceOrmManager.getRepository<WebsiteDomainRecord>(
        workspaceId,
        'websiteDomain',
        { shouldBypassPermissionChecks: true },
      );
    } catch (error) {
      this.logger.warn(
        `websiteDomain unavailable for workspace ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async getVisitorRepository(workspaceId: string) {
    try {
      return await this.globalWorkspaceOrmManager.getRepository<WebsiteVisitorRecord>(
        workspaceId,
        'websiteVisitor',
        { shouldBypassPermissionChecks: true },
      );
    } catch (error) {
      this.logger.warn(
        `websiteVisitor unavailable for workspace ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
