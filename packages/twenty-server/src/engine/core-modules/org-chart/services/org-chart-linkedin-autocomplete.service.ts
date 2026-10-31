import { Injectable } from '@nestjs/common';

import {
    isLikelyLinkedInSearchTypeMismatchError,
    linkedInSearchTypeToCompanySearchApi,
} from 'twenty-shared';

import { WorkspaceMemberLinkedinSearchTypeService } from 'src/engine/core-modules/arx-chat/services/workspace-member-linkedin-search-type.service';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type { LinkedInCompanySearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import {
    resolveOrgChartLinkedInCompanySearchApi,
    type OrgChartLinkedInCompanySearchApi,
} from 'src/engine/core-modules/org-chart/constants/org-chart-company-autocomplete-source.const';
import type { CompanyAutocompleteItem } from 'src/engine/core-modules/org-chart/services/pdl-autocomplete.service';
import { extractLinkedinCompanySlugFromUrl } from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';

export type LinkedInLocationAutocompleteItem = {
  id: string;
  title: string;
};

type LinkedInParameterItem = {
  id: string;
  title: string;
  picture_url?: string;
  additional_data?: Record<string, unknown>;
};

type LinkedInCompanySearchItem = LinkedInCompanySearchResult & {
  logo?: string | null;
  profile_url?: string | null;
};

@Injectable()
export class OrgChartLinkedInAutocompleteService {
  constructor(
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly workspaceMemberLinkedinSearchTypeService: WorkspaceMemberLinkedinSearchTypeService,
  ) {}

  async searchCompaniesViaParameters(
    inputText: string,
    apiToken: string,
    options?: {
      limit?: number;
      linkedinUnipileAccountId?: string;
      workspaceMemberId?: string;
    },
  ): Promise<CompanyAutocompleteItem[]> {
    const keywords = inputText.trim();
    if (!keywords) {
      return [];
    }

    const limit = options?.limit ?? 10;
    const accountId = await this.candidateSearchBaseService.getLinkedInAccountId(
      apiToken,
      options?.linkedinUnipileAccountId,
    );

    const runSearch = async () => {
      const result = await this.candidateSearchBaseService.fetchLinkedInParameters(
        'company',
        keywords,
        limit,
        apiToken,
      );
      return (result?.items ?? []) as LinkedInParameterItem[];
    };

    try {
      const items = await runSearch();
      return this.mapParameterItemsToAutocomplete(items);
    } catch (error) {
      if (
        !isLikelyLinkedInSearchTypeMismatchError(error) ||
        !options?.workspaceMemberId
      ) {
        throw error;
      }
      const refreshed = await this.workspaceMemberLinkedinSearchTypeService.refreshFromAccountId(
        options.workspaceMemberId,
        apiToken,
        accountId,
      );
      if (!refreshed) {
        throw error;
      }
      const items = await runSearch();
      return this.mapParameterItemsToAutocomplete(items);
    }
  }

  async searchCompaniesViaLinkedInSearch(
    inputText: string,
    apiToken: string,
    options?: {
      limit?: number;
      linkedinUnipileAccountId?: string;
      workspaceMemberId?: string;
      api?: OrgChartLinkedInCompanySearchApi;
    },
  ): Promise<CompanyAutocompleteItem[]> {
    const keywords = inputText.trim();
    if (!keywords) {
      return [];
    }

    const limit = options?.limit ?? 10;
    const accountId = await this.candidateSearchBaseService.getLinkedInAccountId(
      apiToken,
      options?.linkedinUnipileAccountId,
    );

    const resolveApi = async (): Promise<OrgChartLinkedInCompanySearchApi> => {
      if (options?.api) {
        return options.api;
      }
      if (options?.workspaceMemberId) {
        const searchType =
          await this.workspaceMemberLinkedinSearchTypeService.resolveSearchTypeForMember(
            options.workspaceMemberId,
            apiToken,
          );
        return linkedInSearchTypeToCompanySearchApi(searchType);
      }
      return resolveOrgChartLinkedInCompanySearchApi();
    };

    const runSearch = async (api: OrgChartLinkedInCompanySearchApi) => {
      const response =
        api === 'classic'
          ? await this.linkedInSearchService.searchCompanies(
              { keywords },
              accountId,
              { limit },
            )
          : await this.linkedInSearchService.searchCompaniesSalesNavigator(
              { keywords },
              accountId,
              { limit },
            );
      return (response.items ?? []) as LinkedInCompanySearchItem[];
    };

    let api = await resolveApi();
    try {
      const items = await runSearch(api);
      return this.mapCompanySearchItemsToAutocomplete(items);
    } catch (error) {
      if (
        !isLikelyLinkedInSearchTypeMismatchError(error) ||
        !options?.workspaceMemberId
      ) {
        throw error;
      }
      const refreshed =
        await this.workspaceMemberLinkedinSearchTypeService.refreshFromAccountId(
          options.workspaceMemberId,
          apiToken,
          accountId,
        );
      if (!refreshed) {
        throw error;
      }
      const nextApi = linkedInSearchTypeToCompanySearchApi(refreshed);
      if (nextApi === api) {
        throw error;
      }
      api = nextApi;
      const items = await runSearch(api);
      return this.mapCompanySearchItemsToAutocomplete(items);
    }
  }

  async searchLocations(
    inputText: string,
    apiToken: string,
    options?: {
      limit?: number;
      linkedinUnipileAccountId?: string;
      workspaceMemberId?: string;
    },
  ): Promise<LinkedInLocationAutocompleteItem[]> {
    const keywords = inputText.trim();
    if (!keywords) {
      return [];
    }

    const limit = options?.limit ?? 10;
    const accountId = await this.candidateSearchBaseService.getLinkedInAccountId(
      apiToken,
      options?.linkedinUnipileAccountId,
    );

    const runSearch = async () => {
      const result = await this.candidateSearchBaseService.fetchLinkedInParameters(
        'location',
        keywords,
        limit,
        apiToken,
      );
      return (result?.items ?? []) as LinkedInParameterItem[];
    };

    try {
      const items = await runSearch();
      return items.map((item) => ({
        id: item.id,
        title: item.title,
      }));
    } catch (error) {
      if (
        !isLikelyLinkedInSearchTypeMismatchError(error) ||
        !options?.workspaceMemberId
      ) {
        throw error;
      }
      const refreshed =
        await this.workspaceMemberLinkedinSearchTypeService.refreshFromAccountId(
          options.workspaceMemberId,
          apiToken,
          accountId,
        );
      if (!refreshed) {
        throw error;
      }
      const items = await runSearch();
      return items.map((item) => ({
        id: item.id,
        title: item.title,
      }));
    }
  }

  private mapParameterItemsToAutocomplete(
    items: LinkedInParameterItem[],
  ): CompanyAutocompleteItem[] {
    return items.map((item) => {
      const pictureUrl =
        item.picture_url ??
        (typeof item.additional_data?.picture_url === 'string'
          ? item.additional_data.picture_url
          : undefined);

      return {
        name: item.title,
        meta: {
          id: item.id,
          display_name: item.title,
          picture_url: pictureUrl,
          linkedin_url: `https://www.linkedin.com/company/${item.id}/`,
        },
        count: 0,
      };
    });
  }

  private mapCompanySearchItemsToAutocomplete(
    items: LinkedInCompanySearchItem[],
  ): CompanyAutocompleteItem[] {
    return items.map((item) => {
      const profileUrl = item.profile_url?.trim() || undefined;
      const slug = profileUrl
        ? extractLinkedinCompanySlugFromUrl(profileUrl)
        : null;
      const linkedinUrl =
        profileUrl ??
        (slug
          ? `https://www.linkedin.com/company/${slug}/`
          : item.id
            ? `https://www.linkedin.com/company/${item.id}/`
            : undefined);
      const headcount = Number.parseInt(item.headcount ?? '', 10);
      const employeeCount = Number.isFinite(headcount) ? headcount : undefined;

      return {
        name: item.name,
        meta: {
          id: slug ?? item.id,
          linkedin_slug: slug ?? undefined,
          linkedin_url: linkedinUrl,
          picture_url: item.logo ?? undefined,
          industry: item.industry || undefined,
          location_name: item.location ?? undefined,
          employee_count: employeeCount,
          display_name: item.name,
        },
        count: item.followers_count ?? 0,
      };
    });
  }
}
