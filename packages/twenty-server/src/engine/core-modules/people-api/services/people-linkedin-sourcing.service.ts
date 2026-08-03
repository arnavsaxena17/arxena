import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';
import {
  OrgChartSuperImposeService,
  type SuperImposeFetchContext,
} from 'src/engine/core-modules/org-chart/services/org-chart-super-impose.service';
import type { SuperImposeInputs } from 'src/engine/core-modules/org-chart/types/super-impose.types';
import { normalizeLinkedinCompanyUrl } from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import { extractKeywordsClauseFromGeneratedSearchParameters } from 'src/engine/core-modules/org-chart/utils/super-impose-keyword-merge.util';

export type PeopleLinkedInCandidateSource = 'harvest' | 'unipile';

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
  limit?: number;
  linkedinSearchKeywords?: string;
};

export type PeopleLinkedInSourcingResult = {
  candidateSource: PeopleLinkedInCandidateSource;
  keywords: string | null;
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
  ) {}

  isUnipileConfigured(): boolean {
    return (
      !!process.env.UNIPILE_API_URL?.trim() &&
      !!process.env.UNIPILE_ACCESS_TOKEN?.trim()
    );
  }

  async search(input: PeopleLinkedInSourcingInput): Promise<PeopleLinkedInSourcingResult> {
    const candidateSource = input.candidateSource ?? 'unipile';
    const companyName = input.companyName?.trim() || '';
    const website = input.website?.trim();
    const companyId = input.companyId?.trim();

    if (!website && !companyId && !companyName) {
      throw new HttpException(
        'At least one of website, companyId, or companyName is required',
        HttpStatus.BAD_REQUEST,
      );
    }

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
        ? normalizeLinkedinCompanyUrl(companyId) ?? undefined
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

    const context: SuperImposeFetchContext = {
      apiToken: input.apiToken,
      primaryCompanyName,
      companyId: primaryCompany?.slug ?? companyId,
      country: input.country,
      functionRoot: keywordPlan.functionRoot,
      leadershipOnly: keywordPlan.leadershipOnly,
      linkedinSearchKeywords: keywordPlan.linkedinSearchKeywords,
      candidateSource,
      searchType: 'sales_navigator',
      maxProfiles: input.limit ?? 20,
    };

    const plan =
      await this.orgChartSuperImposeService.buildQueryPlanFromContext(
        context,
        resolved.resolvedCompanies,
        resolved.salesNavigatorSearchUrls,
      );

    const items = await this.orgChartSuperImposeService.fetchCandidatesForPlan(
      plan,
      context,
    );

    return {
      candidateSource,
      keywords: plan.mergedSearchClause ?? keywordPlan.linkedinSearchKeywords ?? null,
      company: {
        name: primaryCompanyName,
        slug: primaryCompany?.slug ?? null,
        linkedinUrl: primaryCompany?.linkedinUrl ?? null,
      },
      items: items.map((item) => this.normalizePersonItem(item, candidateSource)),
    };
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
    let linkedinSearchKeywords = args.linkedinSearchKeywords?.trim() || undefined;
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
