import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { CompanyApiService } from 'src/engine/core-modules/company-api/company-api.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export type SearchCompaniesInput = {
  query?: string;
  keywords?: string;
  companyName?: string;
  website?: string;
  industry?: string;
  location?: string;
  url?: string;
  useV2?: boolean;
  sortBy?: string;
  sortOrder?: string;
  dataSource?: string;
  accountId?: string;
  limit?: number;
};

@Injectable()
export class SearchCompaniesService {
  private readonly logger = new Logger(SearchCompaniesService.name);

  constructor(
    private readonly companyApiService: CompanyApiService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchCompaniesInput;
  }): Promise<object> {
    try {
      const apiToken = await this.resolveApiToken(workspaceId);
      if (!isNonEmptyString(apiToken)) {
        return {
          success: false,
          total: 0,
          dataSource: input.dataSource ?? 'auto',
          error: 'Workspace API token is required to search companies',
          companies: [],
        };
      }

      const search = await this.companyApiService.searchCompanies(
        {
          query: input.query,
          keywords: input.keywords,
          companyName: input.companyName,
          website: input.website,
          industry: input.industry,
          location: input.location,
          url: input.url,
          useV2: input.useV2,
          sortBy: input.sortBy,
          sortOrder: input.sortOrder,
          dataSource: (input.dataSource as never) ?? 'auto',
          accountId: input.accountId,
          limit: Math.min(Math.max(1, input.limit ?? 10), 25),
        },
        apiToken,
      );

      return {
        success: true,
        total: search.total,
        dataSource: search.dataSource,
        error: '',
        companies: search.items,
      };
    } catch (error) {
      this.logger.error('search-companies failed', error);

      return {
        success: false,
        total: 0,
        dataSource: input.dataSource ?? 'auto',
        error: error instanceof Error ? error.message : String(error),
        companies: [],
      };
    }
  }

  private async resolveApiToken(workspaceId: string): Promise<string | null> {
    const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId);
    const apiKeyId = apiKeys?.[0]?.id;

    if (!isNonEmptyString(apiKeyId)) {
      return null;
    }

    const token = await this.apiKeyService.generateApiKeyToken(
      workspaceId,
      apiKeyId,
    );

    return token?.token ?? null;
  }
}
