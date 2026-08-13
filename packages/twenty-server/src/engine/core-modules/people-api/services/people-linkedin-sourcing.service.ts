import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { LinkedinUnipileSessionService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
import {
  extractLinkedinCompanyIdFromUnipileProfile,
  UnipileCompanyService,
} from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type { LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';
import {
  OrgChartSuperImposeService,
  type SuperImposeFetchContext,
} from 'src/engine/core-modules/org-chart/services/org-chart-super-impose.service';
import type { SuperImposeInputs } from 'src/engine/core-modules/org-chart/types/super-impose.types';
import { normalizeLinkedinCompanyUrl } from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import { extractKeywordsClauseFromGeneratedSearchParameters } from 'src/engine/core-modules/org-chart/utils/super-impose-keyword-merge.util';

import { resolveSalesNavFilters } from 'src/engine/core-modules/candidate-search/constants/taxonomy-platform-maps';
import {
  PeopleSalesNavAccountResolver,
  type PeopleSalesNavAccountSource,
} from './people-sales-nav-account.resolver';

export type PeopleLinkedInCandidateSource = PeopleSalesNavAccountSource;

export type PeopleLinkedInSourcingInput = {
  apiToken: string;
  website?: string;
  companyId?: string;
  companyName?: string;
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
  country?: string;
  candidateSource?: PeopleLinkedInCandidateSource;
  accountId?: string;
  linkedInAccountId?: string;
  limit?: number;
  linkedinSearchKeywords?: string;
};

export type PeopleLinkedInSourcingResult = {
  candidateSource: PeopleLinkedInCandidateSource;
  keywords: string | null;
  appliedFilters: {
    functionIds: string[];
    seniorities: LinkedInSeniorityType[];
  };
  company: {
    name: string | null;
    slug: string | null;
    linkedinUrl: string | null;
  };
  items: Array<Record<string, unknown>>;
};

@Injectable()
export class PeopleLinkedInSourcingService {
  private readonly logger = new Logger(PeopleLinkedInSourcingService.name);

  constructor(
    private readonly orgChartSuperImposeService: OrgChartSuperImposeService,
    private readonly pythonQueryGenerationService: PythonQueryGenerationService,
    private readonly peopleSalesNavAccountResolver: PeopleSalesNavAccountResolver,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly linkedinUnipileSessionService: LinkedinUnipileSessionService,
    private readonly unipileCompanyService: UnipileCompanyService,
  ) {}

  isUnipileConfigured(): boolean {
    return this.peopleSalesNavAccountResolver.isUnipileConfigured();
  }

  async search(
    input: PeopleLinkedInSourcingInput,
  ): Promise<PeopleLinkedInSourcingResult> {
    const companyName = input.companyName?.trim() || '';
    const website = input.website?.trim();
    const companyId = input.companyId?.trim();

    if (!website && !companyId && !companyName) {
      throw new HttpException(
        'At least one of website, companyId, or companyName is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const account = await this.peopleSalesNavAccountResolver.resolve({
      candidateSource: input.candidateSource,
      accountId: input.accountId,
      linkedInAccountId: input.linkedInAccountId,
    });

    const salesNavFilters = resolveSalesNavFilters({
      functionRoot: input.stdFunctionRoot,
      stdFunction: input.stdFunction,
      stdGrade: input.stdGrade,
    });

    const inputs = this.buildSuperImposeInputs({
      website,
      companyId,
      companyName,
    });

    const resolved = await this.orgChartSuperImposeService.resolveInputs({
      inputs,
      primaryCompanyId: companyId,
      primaryCompanyName: companyName || undefined,
      primaryLinkedinCompanyUrl: companyId
        ? (normalizeLinkedinCompanyUrl(companyId) ?? undefined)
        : undefined,
      apiToken: input.apiToken,
    });

    if (resolved.errors.length > 0 && resolved.resolvedCompanies.length === 0) {
      throw new HttpException(
        `Could not resolve company: ${resolved.errors.join('; ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const primaryCompany = resolved.resolvedCompanies[0];
    const primaryCompanyName =
      primaryCompany?.companyName?.trim() ||
      companyName ||
      primaryCompany?.slug ||
      'company';

    const keywordPlan = await this.buildKeywordPlan({
      stdFunction: input.stdFunction,
      stdFunctionRoot: input.stdFunctionRoot,
      stdGrade: input.stdGrade,
      primaryCompanyName,
      linkedinSearchKeywords: input.linkedinSearchKeywords,
    });

    const functionRoot =
      keywordPlan.functionRoot ||
      input.stdFunctionRoot?.trim() ||
      input.stdFunction?.trim();

    // Harvest + keyword Unipile path via super-impose (Sales Nav)
    if (account.candidateSource === 'harvest') {
      const context: SuperImposeFetchContext = {
        apiToken: input.apiToken,
        primaryCompanyName,
        companyId: primaryCompany?.slug ?? companyId,
        country: input.country,
        functionRoot,
        leadershipOnly: keywordPlan.leadershipOnly,
        linkedinSearchKeywords: keywordPlan.linkedinSearchKeywords,
        candidateSource: 'harvest',
        searchType: 'sales_navigator',
        maxProfiles: input.limit ?? 20,
        salesNavFunctionIds: salesNavFilters.functionIds,
        salesNavSeniorities: salesNavFilters.seniorities,
      };

      const plan =
        await this.orgChartSuperImposeService.buildQueryPlanFromContext(
          context,
          resolved.resolvedCompanies,
          resolved.salesNavigatorSearchUrls,
        );

      // Prefer mapped functionIds on harvest batches when present
      if (salesNavFilters.functionIds.length > 0) {
        const functionIdsJoined = salesNavFilters.functionIds.join(',');
        for (const batch of plan.harvestBatches) {
          if (!batch.salesNavUrl) {
            batch.functionIds = functionIdsJoined;
          }
        }
      }

      const items =
        await this.orgChartSuperImposeService.fetchCandidatesForPlan(
          plan,
          context,
        );

      return {
        candidateSource: 'harvest',
        keywords:
          plan.mergedSearchClause ??
          keywordPlan.linkedinSearchKeywords ??
          null,
        appliedFilters: salesNavFilters,
        company: {
          name: primaryCompanyName,
          slug: primaryCompany?.slug ?? null,
          linkedinUrl: primaryCompany?.linkedinUrl ?? null,
        },
        items: items.map((item) =>
          this.normalizePersonItem(item, 'harvest'),
        ),
      };
    }

    // Unipile / pool: facet-mapped Sales Nav people search
    const accountId = account.linkedinUnipileAccountId;
    if (!accountId) {
      throw new HttpException(
        'Resolved Unipile Sales Navigator account id is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const items = await this.searchUnipileSalesNavWithFacets({
      apiToken: input.apiToken,
      accountId,
      primaryCompanyName,
      primaryCompanyLinkedinUrl: primaryCompany?.linkedinUrl,
      country: input.country,
      keywords: keywordPlan.linkedinSearchKeywords,
      functionIds: salesNavFilters.functionIds,
      seniorities: salesNavFilters.seniorities,
      limit: input.limit ?? 20,
    });

    return {
      candidateSource: account.candidateSource,
      keywords: keywordPlan.linkedinSearchKeywords ?? null,
      appliedFilters: salesNavFilters,
      company: {
        name: primaryCompanyName,
        slug: primaryCompany?.slug ?? null,
        linkedinUrl: primaryCompany?.linkedinUrl ?? null,
      },
      items: items.map((item) =>
        this.normalizePersonItem(item, account.candidateSource),
      ),
    };
  }

  private async searchUnipileSalesNavWithFacets(input: {
    apiToken: string;
    accountId: string;
    primaryCompanyName: string;
    primaryCompanyLinkedinUrl?: string;
    country?: string;
    keywords?: string;
    functionIds: string[];
    seniorities: LinkedInSeniorityType[];
    limit: number;
  }): Promise<Array<Record<string, unknown>>> {
    return this.linkedinUnipileSessionService.withLinkedinSession(
      input.apiToken,
      input.accountId,
      async (session) => {
        let companyParameterId: string | undefined;

        if (input.primaryCompanyLinkedinUrl?.trim()) {
          const slug =
            this.unipileCompanyService.extractPublicIdentifier(
              input.primaryCompanyLinkedinUrl,
            ) ?? undefined;
          if (slug) {
            try {
              const profile =
                await this.unipileCompanyService.getCompanyProfile(
                  slug,
                  session.accountId,
                );
              companyParameterId =
                extractLinkedinCompanyIdFromUnipileProfile(profile) ??
                undefined;
            } catch (error) {
              this.logger.warn(
                `People API Unipile company profile lookup failed: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          }
        }

        const keywordParts: string[] = [];
        if (input.keywords?.trim()) {
          keywordParts.push(input.keywords.trim());
        }
        if (!companyParameterId && input.primaryCompanyName.trim()) {
          keywordParts.push(`"${input.primaryCompanyName.trim()}"`);
        }
        if (
          input.country?.trim() &&
          input.country.trim().toLowerCase() !== 'global'
        ) {
          keywordParts.push(input.country.trim());
        }

        const request = {
          ...(keywordParts.length > 0
            ? { keywords: keywordParts.join(' AND ') }
            : {}),
          ...(companyParameterId
            ? { company: { include: [companyParameterId] } }
            : {}),
          ...(input.functionIds.length > 0
            ? { function: { include: input.functionIds } }
            : {}),
          ...(input.seniorities.length > 0
            ? { seniority: { include: input.seniorities } }
            : {}),
        };

        this.logger.log(
          `People API Sales Nav search account=${session.accountId} functionIds=${input.functionIds.join(',')} seniorities=${input.seniorities.join(',')}`,
        );

        const response =
          await this.linkedInSearchService.searchPeopleSalesNavigator(
            request,
            session.accountId,
            { limit: input.limit },
          );

        return (response.items ?? []) as Array<Record<string, unknown>>;
      },
    );
  }

  private buildSuperImposeInputs(args: {
    website?: string;
    companyId?: string;
    companyName?: string;
  }): SuperImposeInputs {
    const inputs: SuperImposeInputs = {};

    if (args.website?.trim()) {
      inputs.websiteUrls = [args.website.trim()];
    }

    if (args.companyId?.trim()) {
      const linkedinUrl =
        normalizeLinkedinCompanyUrl(args.companyId) ??
        `https://www.linkedin.com/company/${args.companyId.trim()}/`;
      inputs.linkedinCompanyUrls = [linkedinUrl];
    }

    return inputs;
  }

  private async buildKeywordPlan(args: {
    stdFunction?: string;
    stdFunctionRoot?: string;
    stdGrade?: string;
    primaryCompanyName: string;
    linkedinSearchKeywords?: string;
  }): Promise<{
    functionRoot?: string;
    leadershipOnly?: boolean;
    linkedinSearchKeywords?: string;
  }> {
    const stdFunction = args.stdFunction?.trim();
    const stdFunctionRoot = args.stdFunctionRoot?.trim();
    const stdGrade = args.stdGrade?.trim();
    const companyNames = args.primaryCompanyName
      ? [args.primaryCompanyName]
      : [];

    let functionRoot: string | undefined;
    let linkedinSearchKeywords =
      args.linkedinSearchKeywords?.trim() || undefined;
    let leadershipOnly = false;

    if (stdFunctionRoot) {
      functionRoot = stdFunctionRoot;
    }

    if (stdFunction) {
      try {
        const generated =
          await this.pythonQueryGenerationService.generateSearchParameters(
            {
              functions: [{ name: stdFunction, exclude: false }],
              ...(stdGrade
                ? { grades: [{ name: stdGrade, exclude: false }] }
                : {}),
              company_names: companyNames,
            },
            'sales_navigator',
            `People API std_function search for ${args.primaryCompanyName}`,
          );
        linkedinSearchKeywords =
          extractKeywordsClauseFromGeneratedSearchParameters(generated) ??
          linkedinSearchKeywords;
      } catch (error) {
        this.logger.warn(
          `People API std_function keyword generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if (stdGrade && stdGrade.toLowerCase() !== 'leadership') {
      try {
        const generated =
          await this.pythonQueryGenerationService.generateSearchParameters(
            {
              grades: [{ name: stdGrade, exclude: false }],
              company_names: companyNames,
            },
            'sales_navigator',
            `People API std_grade search for ${args.primaryCompanyName}`,
          );
        const gradeClause =
          extractKeywordsClauseFromGeneratedSearchParameters(generated);
        if (gradeClause) {
          linkedinSearchKeywords = linkedinSearchKeywords
            ? `(${linkedinSearchKeywords}) AND (${gradeClause})`
            : gradeClause;
        }
      } catch (error) {
        this.logger.warn(
          `People API std_grade keyword generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (stdGrade?.toLowerCase() === 'leadership') {
      leadershipOnly = true;
    }

    return {
      functionRoot,
      leadershipOnly,
      linkedinSearchKeywords,
    };
  }

  private normalizePersonItem(
    item: Record<string, unknown>,
    source: PeopleLinkedInCandidateSource,
  ): Record<string, unknown> {
    return {
      ...item,
      source,
      data_source: source,
    };
  }
}
