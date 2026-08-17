import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import type {
  GtmCompanyEnrichmentPartial,
  GtmCompanyEnrichmentSource,
  GtmCompanyEnrichmentSourceInput,
} from 'src/engine/core-modules/gtm-command/utils/gtm-company-enrichment-source.types';
import type {
  GtmLinkedInCompanyProfile,
  GtmLinkedInCompanySearchHit,
} from 'src/engine/core-modules/gtm-command/utils/gtm-workspace-profile-draft.util';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type {
  LinkedInCompanySearchResult,
  LinkedInSearchResult,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

const isCompanySearchResult = (
  item: LinkedInSearchResult,
): item is LinkedInCompanySearchResult => item.type === 'COMPANY';

// LinkedIn / Sales Nav company search + full Unipile company profile via shared pool accounts.
@Injectable()
export class GtmLinkedInPoolCompanyEnrichmentSource
  implements GtmCompanyEnrichmentSource
{
  readonly sourceId = 'linkedin_unipile_pool' as const;
  private readonly logger = new Logger(
    GtmLinkedInPoolCompanyEnrichmentSource.name,
  );

  constructor(
    @Optional()
    private readonly linkedInSearchService?: LinkedInSearchService,
    @Optional()
    private readonly unipileCompanyService?: UnipileCompanyService,
    @Optional()
    private readonly linkedinUnipileEstimateAccountService?: LinkedinUnipileEstimateAccountService,
  ) {}

  async enrich(
    input: GtmCompanyEnrichmentSourceInput,
  ): Promise<GtmCompanyEnrichmentPartial | null> {
    if (
      !isDefined(this.linkedInSearchService) ||
      !isDefined(this.unipileCompanyService) ||
      !isDefined(this.linkedinUnipileEstimateAccountService)
    ) {
      return null;
    }

    let accountId: string;

    try {
      accountId =
        await this.linkedinUnipileEstimateAccountService.resolveSharedSalesNavigatorPoolAccountId(
          'GTM workspace profile LinkedIn enrich',
        );
    } catch (error) {
      this.logger.warn(
        `Unipile shared Sales Navigator pool unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }

    if (!isNonEmptyString(accountId)) {
      return null;
    }

    const wikiLinkedInUrl = input.hints?.linkedInUrl ?? null;
    const profileFromIndex = isNonEmptyString(wikiLinkedInUrl)
      ? await this.fetchCompanyProfile(
          this.extractCompanyIdentifier({
            linkedInSearchHit: null,
            wikiLinkedInUrl,
          }) ?? wikiLinkedInUrl,
          accountId,
        )
      : null;

    const linkedInSearchHit = profileFromIndex
      ? null
      : await this.fetchCompanySearchHit({
          domain: input.domain,
          companyNameHint:
            input.hints?.companyName ?? input.workspaceDisplayName ?? null,
          wikiLinkedInUrl,
          accountId,
        });

    const profileIdentifier = this.extractCompanyIdentifier({
      linkedInSearchHit,
      wikiLinkedInUrl,
    });

    let linkedInCompanyProfile: GtmLinkedInCompanyProfile | null =
      profileFromIndex;

    if (!linkedInCompanyProfile && isNonEmptyString(profileIdentifier)) {
      linkedInCompanyProfile = await this.fetchCompanyProfile(
        profileIdentifier,
        accountId,
      );
    }

    if (!linkedInSearchHit && !linkedInCompanyProfile) {
      return {
        sourceId: this.sourceId,
        linkedInAccountId: accountId,
      };
    }

    return {
      sourceId: this.sourceId,
      linkedInSearchHit,
      linkedInCompanyProfile,
      linkedInAccountId: accountId,
    };
  }

  private async fetchCompanySearchHit(input: {
    domain: string;
    companyNameHint?: string | null;
    wikiLinkedInUrl?: string | null;
    accountId: string;
  }): Promise<GtmLinkedInCompanySearchHit | null> {
    if (!isDefined(this.linkedInSearchService)) {
      return null;
    }

    const keywords = isNonEmptyString(input.companyNameHint)
      ? input.companyNameHint
      : input.domain;

    try {
      const salesNavResponse =
        await this.linkedInSearchService.searchCompaniesSalesNavigator(
          { keywords },
          input.accountId,
          { limit: 5 },
        );

      const salesNavHit = this.pickBestCompanySearchHit(
        salesNavResponse.items.filter(isCompanySearchResult),
        input,
      );
      if (salesNavHit) {
        return salesNavHit;
      }

      const classicResponse = await this.linkedInSearchService.searchCompanies(
        { keywords },
        input.accountId,
        { limit: 5 },
      );

      return this.pickBestCompanySearchHit(
        classicResponse.items.filter(isCompanySearchResult),
        input,
      );
    } catch (error) {
      this.logger.warn(
        `LinkedIn company search failed for domain ${input.domain}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private pickBestCompanySearchHit(
    items: LinkedInCompanySearchResult[],
    input: {
      companyNameHint?: string | null;
      wikiLinkedInUrl?: string | null;
    },
  ): GtmLinkedInCompanySearchHit | null {
    if (items.length === 0) {
      return null;
    }

    const wikiSlug = isNonEmptyString(input.wikiLinkedInUrl)
      ? this.unipileCompanyService?.extractPublicIdentifier(
          input.wikiLinkedInUrl,
        )
      : null;
    const hintName = input.companyNameHint?.trim().toLowerCase();

    const preferred =
      items.find((item) => {
        if (!isNonEmptyString(wikiSlug)) {
          return false;
        }

        return (
          item.profile_url?.toLowerCase().includes(wikiSlug.toLowerCase()) ===
            true || item.id === wikiSlug
        );
      }) ??
      items.find((item) => {
        if (!isNonEmptyString(hintName)) {
          return false;
        }

        return item.name?.toLowerCase().includes(hintName) === true;
      }) ??
      items[0];

    if (!preferred) {
      return null;
    }

    return {
      id: preferred.id,
      name: preferred.name,
      profile_url: preferred.profile_url,
      industry: preferred.industry,
      headcount: preferred.headcount,
      location: preferred.location,
      summary: preferred.summary,
    };
  }

  private extractCompanyIdentifier(input: {
    linkedInSearchHit: GtmLinkedInCompanySearchHit | null;
    wikiLinkedInUrl?: string | null;
  }): string | null {
    if (isNonEmptyString(input.linkedInSearchHit?.id)) {
      return input.linkedInSearchHit.id.trim();
    }

    if (isNonEmptyString(input.linkedInSearchHit?.profile_url)) {
      return (
        this.unipileCompanyService?.extractPublicIdentifier(
          input.linkedInSearchHit.profile_url,
        ) ?? input.linkedInSearchHit.profile_url
      );
    }

    if (isNonEmptyString(input.wikiLinkedInUrl)) {
      return (
        this.unipileCompanyService?.extractPublicIdentifier(
          input.wikiLinkedInUrl,
        ) ?? input.wikiLinkedInUrl
      );
    }

    return null;
  }

  private async fetchCompanyProfile(
    publicIdentifier: string,
    accountId: string,
  ): Promise<GtmLinkedInCompanyProfile | null> {
    if (!isDefined(this.unipileCompanyService)) {
      return null;
    }

    try {
      return await this.unipileCompanyService.getCompanyProfile(
        publicIdentifier,
        accountId,
      );
    } catch (error) {
      this.logger.warn(
        `LinkedIn company profile fetch failed for ${publicIdentifier}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
