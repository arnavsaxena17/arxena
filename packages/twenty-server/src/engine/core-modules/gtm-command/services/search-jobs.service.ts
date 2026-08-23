import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { JobApiService } from 'src/engine/core-modules/jobs-api/jobs-api.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export type SearchJobsInput = {
  keywords?: string;
  location?: string;
  company?: string;
  datePosted?: number;
  dataSource?: string;
  accountId?: string;
  limit?: number;
};

@Injectable()
export class SearchJobsService {
  private readonly logger = new Logger(SearchJobsService.name);

  constructor(
    private readonly jobApiService: JobApiService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchJobsInput;
  }): Promise<object> {
    try {
      const apiToken = await this.resolveApiToken(workspaceId);
      if (!isNonEmptyString(apiToken)) {
        return {
          success: false,
          total: 0,
          dataSource: input.dataSource ?? 'auto',
          error: 'Workspace API token is required to search jobs',
          jobs: [],
        };
      }

      const search = await this.jobApiService.searchJobs(
        {
          keywords: input.keywords,
          location: input.location,
          company: input.company,
          datePosted: input.datePosted,
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
        jobs: search.items,
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }

      this.logger.error('search-jobs failed', error);

      return {
        success: false,
        total: 0,
        dataSource: input.dataSource ?? 'auto',
        error: error instanceof Error ? error.message : String(error),
        jobs: [],
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
