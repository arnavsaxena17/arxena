import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { PostsApiService } from 'src/engine/core-modules/posts-api/posts-api.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export type SearchPostsInput = {
  keywords?: string;
  sortBy?: string;
  datePosted?: string;
  contentType?: string;
  dataSource?: string;
  accountId?: string;
  limit?: number;
};

@Injectable()
export class SearchPostsService {
  private readonly logger = new Logger(SearchPostsService.name);

  constructor(
    private readonly postsApiService: PostsApiService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchPostsInput;
  }): Promise<object> {
    try {
      const apiToken = await this.resolveApiToken(workspaceId);
      if (!isNonEmptyString(apiToken)) {
        return {
          success: false,
          total: 0,
          dataSource: input.dataSource ?? 'auto',
          error: 'Workspace API token is required to search posts',
          posts: [],
        };
      }

      const search = await this.postsApiService.searchPosts(
        {
          keywords: input.keywords,
          sortBy: input.sortBy as never,
          datePosted: input.datePosted as never,
          contentType: input.contentType as never,
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
        posts: search.items,
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }

      this.logger.error('search-posts failed', error);

      return {
        success: false,
        total: 0,
        dataSource: input.dataSource ?? 'auto',
        error: error instanceof Error ? error.message : String(error),
        posts: [],
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
