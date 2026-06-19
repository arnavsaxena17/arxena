import { Injectable, Logger } from '@nestjs/common';

import { resolveOrgChartCanonicalCompanyId } from 'twenty-shared';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import type { LinkedinSessionHandle } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
import { resolveEffectiveLinkedinSearchType } from 'src/engine/core-modules/arx-chat/utils/resolve-effective-linkedin-search-type.util';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type { LinkedInSearchParameterType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';
import type { SuperImposeAutocompleteItem } from 'src/engine/core-modules/org-chart/types/super-impose.types';
import {
    extractLinkedinCompanySlugFromUrl,
    normalizeLinkedinCompanyUrl,
} from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';

type LinkedInParameterItem = {
  id?: string;
  title?: string;
  picture_url?: string;
};

type LinkedInCompanySearchItem = {
  type?: string;
  id?: string;
  name?: string;
  profile_url?: string;
  logo?: string;
  industry?: string;
  location?: string | null;
  headcount?: string;
  followers_count?: number;
};

export type SuperImposeCompanyAutocompleteSource =
  | 'linkedin_parameters'
  | 'linkedin_company_search';

@Injectable()
export class OrgChartSuperImposeAutocompleteService {
  private readonly logger = new Logger(
    OrgChartSuperImposeAutocompleteService.name,
  );

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
  ) {}

  getConfiguredCompanyAutocompleteSource(): SuperImposeCompanyAutocompleteSource {
    const raw = this.environmentService.get(
      'SUPER_IMPOSE_COMPANY_AUTOCOMPLETE_SOURCE',
    );
    return raw === 'linkedin_company_search'
      ? 'linkedin_company_search'
      : 'linkedin_parameters';
  }

  async resolveOrgChartLinkedInSearchType(
    apiToken: string,
  ): Promise<'classic' | 'sales_navigator' | 'recruiter'> {
    try {
      return await this.linkedinUnipileEstimateAccountService.withEstimateLinkedinSession(
        apiToken,
        undefined,
        async (session) =>
          resolveEffectiveLinkedinSearchType(
            undefined,
            session,
            this.environmentService.get('LINKEDIN_UNIPILE_INFER_SEARCH_TYPE'),
          ),
      );
    } catch {
      return 'classic';
    }
  }

  async searchLocations(args: {
    apiToken: string;
    keywords: string;
    limit?: number;
  }): Promise<SuperImposeAutocompleteItem[]> {
    return this.linkedinUnipileEstimateAccountService.withEstimateLinkedinSession(
      args.apiToken,
      undefined,
      async (session) => {
        const result = await this.fetchLinkedInParametersForSession(
          session,
          'LOCATION',
          args.keywords,
          args.limit ?? 10,
        );

        return (result.items ?? [])
          .map((item: LinkedInParameterItem) => this.mapParameterItem(item))
          .filter((item): item is SuperImposeAutocompleteItem => !!item);
      },
    );
  }

  async searchCompanies(args: {
    apiToken: string;
    keywords: string;
    limit?: number;
    searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  }): Promise<SuperImposeAutocompleteItem[]> {
    const configuredSource = this.getConfiguredCompanyAutocompleteSource();
    const searchType =
      args.searchType ??
      (await this.resolveOrgChartLinkedInSearchType(args.apiToken));

    const useCompanySearch =
      configuredSource === 'linkedin_company_search' &&
      searchType !== 'recruiter';

    if (useCompanySearch) {
      try {
        return await this.searchCompaniesViaCompanySearch({
          apiToken: args.apiToken,
          keywords: args.keywords,
          limit: args.limit ?? 10,
          searchType,
        });
      } catch (error) {
        this.logger.warn(
          `Super impose company search failed, falling back to parameters: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.searchCompaniesViaParameters({
      apiToken: args.apiToken,
      keywords: args.keywords,
      limit: args.limit ?? 10,
    });
  }

  private async searchCompaniesViaParameters(args: {
    apiToken: string;
    keywords: string;
    limit: number;
  }): Promise<SuperImposeAutocompleteItem[]> {
    return this.linkedinUnipileEstimateAccountService.withEstimateLinkedinSession(
      args.apiToken,
      undefined,
      async (session) => {
        const result = await this.fetchLinkedInParametersForSession(
          session,
          'COMPANY',
          args.keywords,
          args.limit,
        );

        return (result.items ?? [])
          .map((item: LinkedInParameterItem) => {
            const mapped = this.mapParameterItem(item);
            if (!mapped) {
              return null;
            }
            const slug = resolveOrgChartCanonicalCompanyId(mapped.id);
            const profileUrl =
              normalizeLinkedinCompanyUrl(slug) ??
              `https://www.linkedin.com/company/${slug}/`;
            return {
              ...mapped,
              slug,
              profileUrl,
            };
          })
          .filter((item): item is SuperImposeAutocompleteItem => !!item);
      },
    );
  }

  private async searchCompaniesViaCompanySearch(args: {
    apiToken: string;
    keywords: string;
    limit: number;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
  }): Promise<SuperImposeAutocompleteItem[]> {
    return this.linkedinUnipileEstimateAccountService.withEstimateLinkedinSession(
      args.apiToken,
      undefined,
      async (session) => {
        const request = { keywords: args.keywords };
        const options = { limit: args.limit };

        const result =
          args.searchType === 'sales_navigator'
            ? await this.linkedInSearchService.searchCompaniesSalesNavigator(
                request,
                session.accountId,
                options,
              )
            : await this.linkedInSearchService.searchCompanies(
                request,
                session.accountId,
                options,
              );

        return (result.items ?? [])
          .filter((item) => item.type === 'COMPANY')
          .map((item) => this.mapCompanySearchItem(item as LinkedInCompanySearchItem))
          .filter((item): item is SuperImposeAutocompleteItem => !!item);
      },
    );
  }

  private async fetchLinkedInParametersForSession(
    session: LinkedinSessionHandle,
    parameterType: 'LOCATION' | 'COMPANY',
    keywords: string,
    limit: number,
  ) {
    return this.linkedInSearchService.getSearchParameters(
      parameterType as LinkedInSearchParameterType,
      session.accountId,
      { keywords, limit },
    );
  }

  private mapParameterItem(
    item: LinkedInParameterItem,
  ): SuperImposeAutocompleteItem | null {
    const id = item.id?.trim();
    const title = item.title?.trim();
    if (!id || !title) {
      return null;
    }

    return {
      id,
      title,
      pictureUrl: item.picture_url?.trim() || undefined,
    };
  }

  private mapCompanySearchItem(
    item: LinkedInCompanySearchItem,
  ): SuperImposeAutocompleteItem | null {
    const id = item.id?.trim();
    const title = item.name?.trim();
    if (!id || !title) {
      return null;
    }

    const profileUrl = item.profile_url?.trim() || undefined;
    const slugFromUrl = profileUrl
      ? extractLinkedinCompanySlugFromUrl(profileUrl)
      : null;
    const slug = slugFromUrl
      ? resolveOrgChartCanonicalCompanyId(slugFromUrl)
      : resolveOrgChartCanonicalCompanyId(id);
    const linkedinCompanyUrl =
      (profileUrl && normalizeLinkedinCompanyUrl(profileUrl)) ||
      normalizeLinkedinCompanyUrl(slug) ||
      `https://www.linkedin.com/company/${slug}/`;

    return {
      id,
      title,
      pictureUrl: item.logo?.trim() || undefined,
      profileUrl,
      slug,
      industry: item.industry?.trim() || undefined,
      locationLabel:
        typeof item.location === 'string' && item.location.trim()
          ? item.location.trim()
          : undefined,
      headcount:
        item.headcount?.trim() ||
        (typeof item.followers_count === 'number'
          ? String(item.followers_count)
          : undefined),
    };
  }
}
