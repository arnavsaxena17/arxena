import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import {
  parseBrowserExtensionCookieArray,
  type BrowserExtensionCookie,
} from 'twenty-shared';
import { type ObjectLiteral } from 'typeorm';

import { WorkspaceMemberUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-unipile.service';
import { ApifyService } from 'src/engine/core-modules/apify/services/apify.service';
import { CompanySearchHitTransformer } from 'src/engine/core-modules/company-api/services/company-search-hit.transformer';
import {
  collectIdentityKeySet,
  hitMatchesIdentityKeys,
} from 'src/engine/core-modules/company-api/utils/company-identity.util';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { OutreachWorkspaceAuthTokenService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-auth-token.service';
import { projectIdsHasProject } from 'src/engine/core-modules/outreach-command/utils/project-ids.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CompanyRecord = ObjectLiteral & {
  name?: string | null;
  linkedinId?: string | null;
  projectIds?: string | string[] | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinLinkPrimaryLinkUrl?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  domainNamePrimaryLinkUrl?: string | null;
};

export type SearchCrunchbaseCompaniesInput = {
  searchUrl?: string;
  'search.url'?: string;
  url?: string;
  cookie?: unknown;
  workspaceMemberId?: string;
  cursor?: string;
  minDelay?: number;
  maxDelay?: number;
  projectId?: string;
  limit?: number;
};

const DEFAULT_MIN_DELAY = 1;
const DEFAULT_MAX_DELAY = 5;
const DEFAULT_CRUNCHBASE_ACTOR_ID = 'BBfgvSNWcySEk1jQO';

const parsePastedCookies = (
  raw: unknown,
): BrowserExtensionCookie[] | null => {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  if (typeof raw === 'string') {
    try {
      return parseBrowserExtensionCookieArray(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  return parseBrowserExtensionCookieArray(raw);
};

@Injectable()
export class SearchCrunchbaseCompaniesService {
  private readonly logger = new Logger(SearchCrunchbaseCompaniesService.name);

  constructor(
    private readonly apifyService: ApifyService,
    private readonly companySearchHitTransformer: CompanySearchHitTransformer,
    private readonly environmentService: EnvironmentService,
    private readonly gtmWorkspaceAuthTokenService: OutreachWorkspaceAuthTokenService,
    private readonly workspaceMemberUnipileService: WorkspaceMemberUnipileService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchCrunchbaseCompaniesInput;
  }): Promise<object> {
    try {
      if (!this.apifyService.isConfigured()) {
        return {
          success: false,
          total: 0,
          dataSource: 'crunchbase',
          error: 'Apify is not configured (set APIFY_API_TOKEN)',
          companies: [],
        };
      }

      const searchUrl = this.resolveSearchUrl(input);

      if (!isNonEmptyString(searchUrl)) {
        return {
          success: false,
          total: 0,
          dataSource: 'crunchbase',
          error: 'searchUrl is required (Crunchbase discover URL)',
          companies: [],
        };
      }

      const cookies = await this.resolveCookies(workspaceId, input);

      if (!cookies || cookies.length === 0) {
        return {
          success: false,
          total: 0,
          dataSource: 'crunchbase',
          error:
            'Crunchbase cookies required (paste cookie JSON or sync via extension to workspace member)',
          companies: [],
        };
      }

      const actorId =
        this.environmentService
          .get('APIFY_CRUNCHBASE_COMPANIES_ACTOR_ID')
          ?.trim() || DEFAULT_CRUNCHBASE_ACTOR_ID;
      const minDelay = this.resolveDelay(
        input.minDelay,
        DEFAULT_MIN_DELAY,
      );
      const maxDelay = Math.max(
        minDelay,
        this.resolveDelay(input.maxDelay, DEFAULT_MAX_DELAY),
      );
      const actorInput: Record<string, unknown> = {
        'search.url': searchUrl,
        cookie: cookies,
        cursor: input.cursor?.trim() ?? '',
        minDelay,
        maxDelay,
      };

      this.logger.log(
        `Crunchbase Apify scrape: actor=${actorId} url=${searchUrl} cookies=${cookies.length}`,
      );

      const apifyResult =
        await this.apifyService.runActorAndListDatasetItemsDetailed(
          actorId,
          actorInput,
        );

      if (!apifyResult?.items) {
        return {
          success: false,
          total: 0,
          dataSource: 'crunchbase',
          error:
            apifyResult?.run?.status && apifyResult.run.status !== 'SUCCEEDED'
              ? `Apify run ${apifyResult.run.runId} finished with status ${apifyResult.run.status}`
              : 'Apify Crunchbase scrape returned no dataset',
          companies: [],
        };
      }

      let companies = this.companySearchHitTransformer.fromCrunchbaseItems(
        apifyResult.items,
      );

      const projectId = input.projectId?.trim() ?? '';
      if (isNonEmptyString(projectId)) {
        const knownKeys = await this.loadHarvestedIdentityKeys(
          workspaceId,
          projectId,
        );
        if (knownKeys.size > 0) {
          companies = companies.filter(
            (hit) => !hitMatchesIdentityKeys(hit, knownKeys),
          );
        }
      }

      const limit = Math.min(Math.max(1, input.limit ?? 100), 500);
      companies = companies.slice(0, limit);

      return {
        success: true,
        total: companies.length,
        dataSource: 'crunchbase',
        error: '',
        companies,
      };
    } catch (error) {
      this.logger.error('search-crunchbase-companies failed', error);

      return {
        success: false,
        total: 0,
        dataSource: 'crunchbase',
        error: error instanceof Error ? error.message : String(error),
        companies: [],
      };
    }
  }

  private resolveSearchUrl(input: SearchCrunchbaseCompaniesInput): string {
    return (
      input.searchUrl?.trim() ||
      input['search.url']?.trim() ||
      input.url?.trim() ||
      ''
    );
  }

  private resolveDelay(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return fallback;
    }

    return Math.floor(value);
  }

  private async resolveCookies(
    workspaceId: string,
    input: SearchCrunchbaseCompaniesInput,
  ): Promise<BrowserExtensionCookie[] | null> {
    const pasted = parsePastedCookies(input.cookie);

    if (pasted && pasted.length > 0) {
      return pasted;
    }

    const workspaceMemberId = input.workspaceMemberId?.trim() ?? '';

    if (!isNonEmptyString(workspaceMemberId)) {
      return null;
    }

    const apiToken =
      await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);

    if (!isNonEmptyString(apiToken)) {
      return null;
    }

    const stored =
      await this.workspaceMemberUnipileService.getWorkspaceMemberCrunchbaseCookies(
        apiToken,
        workspaceMemberId,
      );

    return stored.crunchbaseCookies;
  }

  private async loadHarvestedIdentityKeys(
    workspaceId: string,
    projectId: string,
  ): Promise<Set<string>> {
    const authContext = buildSystemAuthContext(workspaceId);

    try {
      return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const companyRepository =
            await this.globalWorkspaceOrmManager.getRepository<CompanyRecord>(
              workspaceId,
              'company',
              { shouldBypassPermissionChecks: true },
            );
          const existing = await companyRepository.find({
            take: 5000,
          });
          const harvested = existing.filter((row) =>
            projectIdsHasProject(row.projectIds, projectId),
          );

          this.logger.log(
            `search-crunchbase-companies loaded ${harvested.length} previously harvested companies for project ${projectId}`,
          );

          return collectIdentityKeySet(harvested);
        },
        authContext,
      );
    } catch (error) {
      this.logger.warn(
        `search-crunchbase-companies could not load existing companies: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return new Set<string>();
    }
  }
}
