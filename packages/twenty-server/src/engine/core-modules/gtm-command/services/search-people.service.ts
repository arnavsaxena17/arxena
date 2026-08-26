import { Injectable, Logger } from '@nestjs/common';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';

import { GtmWorkspaceAuthTokenService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-auth-token.service';
import { mapSearchPeopleProfile } from 'src/engine/core-modules/gtm-command/utils/map-search-people-profile.util';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';
import { PeopleApiService } from 'src/engine/core-modules/people-api/people-api.service';

export type SearchPeopleInput = {
  naturalLanguage?: string;
  searchUrl?: string;
  companyName?: string;
  website?: string;
  companyId?: string;
  jobTitle?: string;
  locations?: string[];
  country?: string;
  limit?: number;
};

@Injectable()
export class SearchPeopleService {
  private readonly logger = new Logger(SearchPeopleService.name);

  constructor(
    private readonly peopleApiService: PeopleApiService,
    private readonly gtmWorkspaceAuthTokenService: GtmWorkspaceAuthTokenService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchPeopleInput;
  }): Promise<object> {
    let dataSource: 'unipile' | 'harvest' = 'harvest';

    try {
      const apiToken =
        await this.gtmWorkspaceAuthTokenService.resolveApiKeyToken(workspaceId);
      const defaultAccount =
        await this.unipileSearchAccountResolver.resolveDefaultWorkspaceAccount(
          workspaceId,
        );

      const accountId = defaultAccount?.accountId;
      dataSource = accountId ? 'unipile' : 'harvest';
      const limit = Math.min(Math.max(1, input.limit ?? 10), 25);
      const search = await this.peopleApiService.searchPeople(
        {
          naturalLanguage: input.naturalLanguage,
          searchUrl: input.searchUrl,
          companyName: input.companyName,
          website: input.website,
          companyId: input.companyId,
          jobTitle: input.jobTitle,
          locations: input.locations,
          country: input.country,
          dataSource,
          accountId,
          limit,
        },
        apiToken ?? undefined,
        { workspaceId },
      );

      const companyId = input.companyId?.trim();
      const people = (search.items ?? []).map((item) => {
        const mapped = mapSearchPeopleProfile(item, {
          source: search.dataSource,
          companyId,
          companyName: input.companyName,
        });

        return {
          ...mapped,
          ...(companyId ? { companyId } : {}),
        };
      });

      return {
        success: true,
        total: search.total ?? people.length,
        dataSource: search.dataSource,
        error: '',
        people,
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }

      this.logger.error('search-people failed', error);

      return {
        success: false,
        total: 0,
        dataSource,
        error: error instanceof Error ? error.message : String(error),
        people: [],
      };
    }
  }
}
