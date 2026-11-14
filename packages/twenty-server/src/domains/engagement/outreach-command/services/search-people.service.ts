import { Injectable, Logger } from '@nestjs/common';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';

import { OutreachWorkspaceAuthTokenService } from 'src/domains/engagement/outreach-command/services/outreach-workspace-auth-token.service';
import { mapSearchPeopleProfile } from 'src/domains/engagement/outreach-command/utils/map-search-people-profile.util';
import { UnipileSearchAccountResolver } from 'src/domains/discovery/transport/linkedin-search/services/unipile-search-account.resolver';
import { PEOPLE_SEARCH_MAX_LIMIT } from 'src/domains/discovery/search/people-api/constants/people-search-limits';
import { PeopleApiService } from 'src/domains/discovery/search/people-api/people-api.service';

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
  dataSource?: 'linkedin' | 'harvest' | 'bright_data';
  mode?: 'ludicrous' | 'smart' | 'instant';
};

@Injectable()
export class SearchPeopleService {
  private readonly logger = new Logger(SearchPeopleService.name);

  constructor(
    private readonly peopleApiService: PeopleApiService,
    private readonly gtmWorkspaceAuthTokenService: OutreachWorkspaceAuthTokenService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SearchPeopleInput;
  }): Promise<object> {
    let dataSource: 'linkedin' | 'harvest' | 'bright_data' =
      input.dataSource === 'bright_data' ? 'bright_data' : 'harvest';

    try {
      const apiToken =
        await this.gtmWorkspaceAuthTokenService.resolveApiKeyToken(workspaceId);
      const defaultAccount =
        input.dataSource === 'bright_data'
          ? undefined
          : await this.unipileSearchAccountResolver.resolveDefaultWorkspaceAccount(
              workspaceId,
            );

      const accountId = defaultAccount?.accountId;
      if (input.dataSource !== 'bright_data') {
        dataSource = accountId ? 'linkedin' : 'harvest';
      }
      const limit = Math.min(
        Math.max(1, input.limit ?? 10),
        PEOPLE_SEARCH_MAX_LIMIT,
      );
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
          mode: input.mode,
          limit,
        },
        apiToken ?? undefined,
        { workspaceId },
      );

      const companyId = input.companyId?.trim();
      const linkedinCompanyId = search.query?.company?.id?.trim();
      const people = (search.items ?? []).map((item) => {
        const mapped = mapSearchPeopleProfile(item, {
          source: search.dataSource,
          companyId: linkedinCompanyId,
          companyIds: search.query?.company?.ids,
          companyName: search.query?.company?.name ?? input.companyName,
          companySlug: search.query?.company?.slug,
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
