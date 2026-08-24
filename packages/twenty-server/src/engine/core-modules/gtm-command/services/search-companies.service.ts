import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { CompanyApiService } from 'src/engine/core-modules/company-api/company-api.service';
import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import type { CompanySearchHit } from 'src/engine/core-modules/company-api/company-api.types';
import {
  collectIdentityKeySet,
  hitMatchesIdentityKeys,
} from 'src/engine/core-modules/company-api/utils/company-identity.util';
import { gtmRunKeyHasProject } from 'src/engine/core-modules/gtm-command/utils/gtm-run-key.util';
import { extractSalesNavigatorAccountListId } from 'src/engine/core-modules/linkedin-search/utils/classify-linkedin-search-url.util';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CompanyRecord = ObjectLiteral & {
  name?: string | null;
  linkedinId?: string | null;
  gtmRunKey?: string | string[] | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinLinkPrimaryLinkUrl?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  domainNamePrimaryLinkUrl?: string | null;
};

export type SearchCompaniesInput = {
  query?: string;
  keywords?: string;
  companyName?: string;
  website?: string;
  industry?: string;
  location?: string;
  url?: string;
  useV2?: boolean;
  dataSource?: string;
  accountId?: string;
  projectId?: string;
  limit?: number;
};

@Injectable()
export class SearchCompaniesService {
  private readonly logger = new Logger(SearchCompaniesService.name);

  constructor(
    private readonly companyApiService: CompanyApiService,
    private readonly gtmWorkspaceAuthTokenService: GtmWorkspaceAuthTokenService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchCompaniesInput;
  }): Promise<object> {
    try {
      const apiToken =
        await this.gtmWorkspaceAuthTokenService.resolveOrMint(workspaceId);
      if (!isNonEmptyString(apiToken)) {
        return {
          success: false,
          total: 0,
          dataSource: 'unipile',
          error: 'Workspace API token is required to search companies',
          companies: [],
        };
      }

      const defaultAccount =
        await this.unipileSearchAccountResolver.resolveDefaultWorkspaceAccount(
          workspaceId,
        );
      const projectId = input.projectId?.trim() ?? '';
      const knownKeys = isNonEmptyString(projectId)
        ? await this.loadHarvestedIdentityKeys(workspaceId, projectId)
        : new Set<string>();
      const searchUrl = this.resolveSearchUrl(input);
      const isV2AccountList = Boolean(
        searchUrl && extractSalesNavigatorAccountListId(searchUrl),
      );
      const isKnownHit = (hit: CompanySearchHit) =>
        hitMatchesIdentityKeys(hit, knownKeys);

      const search = await this.companyApiService.searchCompanies(
        {
          query: input.query,
          keywords: input.keywords,
          companyName: input.companyName,
          website: input.website,
          industry: input.industry,
          location: input.location,
          url: input.url,
          useV2: true,
          dataSource: 'auto',
          accountId: defaultAccount?.accountId,
          limit: Math.min(Math.max(1, input.limit ?? 10), 100),
        },
        apiToken,
        knownKeys.size > 0
          ? {
              isKnownHit,
              stopAtKnown: isV2AccountList,
            }
          : undefined,
      );

      return {
        success: true,
        total: search.total,
        dataSource: search.dataSource,
        error: '',
        companies: search.items,
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }

      this.logger.error('search-companies failed', error);

      return {
        success: false,
        total: 0,
        dataSource: 'unipile',
        error: error instanceof Error ? error.message : String(error),
        companies: [],
      };
    }
  }

  private resolveSearchUrl(input: SearchCompaniesInput): string | undefined {
    const explicit = input.url?.trim();
    if (explicit) {
      return explicit;
    }

    const query = input.query?.trim();
    if (query && /linkedin\.com/i.test(query)) {
      return query;
    }

    return undefined;
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
            gtmRunKeyHasProject(row.gtmRunKey, projectId),
          );

          this.logger.log(
            `search-companies loaded ${harvested.length} previously harvested companies for project ${projectId}`,
          );

          return collectIdentityKeySet(harvested);
        },
        authContext,
      );
    } catch (error) {
      this.logger.warn(
        `search-companies could not load existing companies: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return new Set<string>();
    }
  }
}
