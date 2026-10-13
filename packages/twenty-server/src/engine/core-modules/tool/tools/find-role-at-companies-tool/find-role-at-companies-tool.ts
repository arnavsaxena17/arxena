import { Injectable, Logger } from '@nestjs/common';

import { createHash } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-search.service';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { mapBrightDataPersonToSearchItem } from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import {
  buildGoogleSerpSearchUrl,
  mapGoogleSerpOrganicResults,
} from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';
import {
  buildCompanyVariants,
  matchesAnyCompanyVariant,
  textMentionsAnyCompanyVariant,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/company-name-variants.util';
import {
  FindRoleAtCompaniesInputZodSchema,
  type FindRoleAtCompaniesInput,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/find-role-at-companies-tool.schema';
import {
  normalizeLinkedinProfileUrl,
  parseLinkedinSerpResult,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/parse-linkedin-serp-result.util';
import {
  getRequestedRoleOrder,
  scoreRoleMatch,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/role-title-matching.util';
import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';
import {
  TitleExpansionService,
  type ResolvedRoles,
} from 'src/engine/core-modules/title-taxonomy/title-expansion.service';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const COMPANY_CONCURRENCY = 5;
const MAX_VARIANTS_PER_BRIGHT_DATA_SEARCH = 2;
const BRIGHT_DATA_CANDIDATES_PER_SEARCH = 5;
const SERP_RESULT_LIMIT = 10;
const MAX_PEOPLE_PER_COMPANY = 3;
const MAX_REJECTED_PER_COMPANY = 3;
const MAX_TITLES_IN_QUERY = 8;

type Source = 'bright_data' | 'google';

type Candidate = {
  id: string;
  name: string;
  title: string;
  companyName: string;
  linkedinUrl: string;
  // Free text the company can be checked against when there is no company field
  evidenceText: string;
  source: Source;
};

type VerifiedCandidate = Candidate & {
  sources: Source[];
  roleScore: 1 | 2;
};

type RejectedCandidate = {
  name: string;
  title: string;
  companyOnProfile: string;
  reason: 'company_mismatch' | 'role_mismatch';
};

type CompanyOutcome = {
  company: string;
  status: 'matched' | 'related_role_only' | 'no_match';
  people: Array<{
    name: string;
    title: string;
    companyOnProfile: string;
    linkedinUrl: string;
    sources: Source[];
    roleMatch: 'exact' | 'related';
  }>;
  rejected: RejectedCandidate[];
  sourceErrors: string[];
  spentUsd: number;
};

const toId = (value: string): string =>
  createHash('sha1').update(value).digest('hex');

const runWithConcurrency = async <TItem, TResult>(
  items: TItem[],
  limit: number,
  worker: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> => {
  const results: TResult[] = new Array(items.length);
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;

        results[index] = await worker(items[index]);
      }
    }),
  );

  return results;
};

@Injectable()
export class FindRoleAtCompaniesTool implements Tool {
  private readonly logger = new Logger(FindRoleAtCompaniesTool.name);

  description = `Find the people who hold given roles (CEO, MD, founder, owner, ...) at named companies, in one call. Pass the companies and the roles in the user's words. The tool looks each role up in the job-title taxonomy service (function, grade and the curated titles for it), searches Bright Data people and Google (LinkedIn profiles) in parallel, checks that every person works at that company and holds the role, merges duplicates by LinkedIn URL, and returns a short table per company with a status: matched, related_role_only (deputy / vice / acting) or no_match, plus rejected rows with the reason. With projectId the verified people are written to the People tab. Use for requests like "get the CEO of each company"; do not use it to build a large people list.`;

  inputSchema = FindRoleAtCompaniesInputZodSchema;

  constructor(
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
    private readonly brightDataSerpService: BrightDataSerpService,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
    private readonly titleExpansionService: TitleExpansionService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = FindRoleAtCompaniesInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Failed to find roles at companies',
        error: parsed.error.message,
      };
    }

    if (!context.workspaceId) {
      return {
        success: false,
        message: 'Failed to find roles at companies',
        error: 'Workspace context is required',
      };
    }

    const input = parsed.data;
    const resolvedRoles = await this.titleExpansionService.resolveRoles(
      input.roles,
    );
    const outcomes = await runWithConcurrency(
      input.companies,
      COMPANY_CONCURRENCY,
      (company) =>
        this.lookupCompany(
          company,
          input,
          resolvedRoles,
          context.workspaceId,
        ).catch(
          (error): CompanyOutcome => ({
            company: company.name,
            status: 'no_match',
            people: [],
            rejected: [],
            sourceErrors: [
              error instanceof Error ? error.message : String(error),
            ],
            spentUsd: 0,
          }),
        ),
    );

    const written = await this.persist(input, outcomes, context);
    const spentUsd = outcomes.reduce(
      (total, outcome) => total + outcome.spentUsd,
      0,
    );
    const count = (status: CompanyOutcome['status']) =>
      outcomes.filter((outcome) => outcome.status === status).length;

    return {
      success: true,
      message: `Matched ${count('matched')} of ${outcomes.length} companies (${count('related_role_only')} related role only, ${count('no_match')} no match), Bright Data spend $${spentUsd.toFixed(3)}`,
      result: {
        roles: input.roles,
        companies: outcomes.map(({ spentUsd: _spent, ...outcome }) => outcome),
        summary: {
          matched: count('matched'),
          relatedRoleOnly: count('related_role_only'),
          noMatch: count('no_match'),
        },
        spentUsd: Number(spentUsd.toFixed(4)),
        written: written.count,
        ...(isDefined(written.error) && { writeError: written.error }),
      },
    };
  }

  private async lookupCompany(
    company: FindRoleAtCompaniesInput['companies'][number],
    input: FindRoleAtCompaniesInput,
    resolvedRoles: ResolvedRoles,
    workspaceId: string,
  ): Promise<CompanyOutcome> {
    const variants = buildCompanyVariants(
      company.name,
      company.alternateNames ?? [],
    );
    const titles = resolvedRoles.searchTitles.slice(0, MAX_TITLES_IN_QUERY);
    const sourceErrors: string[] = [];
    let spentUsd = 0;

    const [brightDataCandidates, googleCandidates] = await Promise.all([
      input.sources.includes('bright_data')
        ? this.searchBrightData({
            variants,
            titles,
            country: input.country,
            maxBudgetUsd: input.maxBudgetUsd,
            workspaceId,
            roles: input.roles,
            requestedClasses: resolvedRoles.requestedClasses,
          }).catch((error) => {
            sourceErrors.push(`bright_data: ${this.describe(error)}`);

            return { candidates: [] as Candidate[], spentUsd: 0 };
          })
        : { candidates: [] as Candidate[], spentUsd: 0 },
      input.sources.includes('google')
        ? this.searchGoogle({
            variants,
            titles,
            country: input.country,
          }).catch((error) => {
            sourceErrors.push(`google: ${this.describe(error)}`);

            return [] as Candidate[];
          })
        : ([] as Candidate[]),
    ]);

    spentUsd += brightDataCandidates.spentUsd;

    const { verified, rejected } = await this.verify({
      candidates: [...brightDataCandidates.candidates, ...googleCandidates],
      variants,
      roles: input.roles,
      requestedClasses: resolvedRoles.requestedClasses,
    });
    const people = verified.slice(0, MAX_PEOPLE_PER_COMPANY);
    const status: CompanyOutcome['status'] = people.some(
      (person) => person.roleScore === 2,
    )
      ? 'matched'
      : people.length > 0
        ? 'related_role_only'
        : 'no_match';

    this.logger.log(
      `find_role_at_companies "${company.name}": ${status}, ${verified.length} verified, ${rejected.length} rejected, $${spentUsd.toFixed(3)}`,
    );

    return {
      company: company.name,
      status,
      people: people.map((person) => ({
        name: person.name,
        title: person.title,
        companyOnProfile: person.companyName,
        linkedinUrl: person.linkedinUrl,
        sources: person.sources,
        roleMatch: person.roleScore === 2 ? 'exact' : 'related',
      })),
      rejected: rejected.slice(0, MAX_REJECTED_PER_COMPANY),
      sourceErrors,
      spentUsd,
    };
  }

  // Tries the first names one at a time and stops at the first that yields a
  // verified person, so a brand that fails is retried under its legal name
  private async searchBrightData({
    variants,
    titles,
    country,
    maxBudgetUsd,
    workspaceId,
    roles,
    requestedClasses,
  }: {
    variants: string[];
    titles: string[];
    country?: string;
    maxBudgetUsd: number;
    workspaceId: string;
    roles: string[];
    requestedClasses: TitleClass[];
  }): Promise<{ candidates: Candidate[]; spentUsd: number }> {
    const candidates: Candidate[] = [];
    let spentUsd = 0;

    for (const variant of variants.slice(
      0,
      MAX_VARIANTS_PER_BRIGHT_DATA_SEARCH,
    )) {
      const rawQuery = `${titles.join(', ')} of ${variant}${isNonEmptyString(country) ? ` ${country}` : ''}`;
      const { result } =
        await this.brightDataLudicrousSearchService.searchNaturalLanguage({
          workspaceId,
          entity: 'people',
          rawQuery,
          maxBudgetUsd,
          targetCount: BRIGHT_DATA_CANDIDATES_PER_SEARCH,
        });

      spentUsd += result.spentUsd;

      for (const document of result.documents) {
        const item = mapBrightDataPersonToSearchItem(document);
        const name = typeof item.name === 'string' ? item.name : '';

        if (name === '') {
          continue;
        }

        candidates.push({
          id: document.brightId,
          name,
          title: typeof item.title === 'string' ? item.title : '',
          companyName:
            typeof item.companyName === 'string' ? item.companyName : '',
          linkedinUrl: typeof item.url === 'string' ? item.url : '',
          evidenceText: '',
          source: 'bright_data',
        });
      }

      const { verified } = await this.verify({
        candidates,
        variants,
        roles,
        requestedClasses,
      });

      if (verified.length > 0) {
        break;
      }
    }

    return { candidates, spentUsd };
  }

  private async searchGoogle({
    variants,
    titles,
    country,
  }: {
    variants: string[];
    titles: string[];
    country?: string;
  }): Promise<Candidate[]> {
    if (!this.brightDataSerpService.isConfigured()) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const query = [
      'site:linkedin.com/in',
      `"${variants[0]}"`,
      `(${titles.map((title) => `"${title}"`).join(' OR ')})`,
      isNonEmptyString(country) ? country : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' ');
    const serp = await this.brightDataSerpService.requestSerpGoogleJson(
      buildGoogleSerpSearchUrl(query, SERP_RESULT_LIMIT),
    );
    const candidates: Candidate[] = [];

    for (const item of mapGoogleSerpOrganicResults(
      serp.organic,
      SERP_RESULT_LIMIT,
    )) {
      const person = parseLinkedinSerpResult(item);

      if (person === null) {
        continue;
      }

      candidates.push({
        id: toId(normalizeLinkedinProfileUrl(person.linkedinUrl)),
        name: person.name,
        title: person.title,
        companyName: person.companyName,
        linkedinUrl: person.linkedinUrl,
        evidenceText: `${item.title} ${person.snippet}`,
        source: 'google',
      });
    }

    return candidates;
  }

  private async verify({
    candidates,
    variants,
    roles,
    requestedClasses,
  }: {
    candidates: Candidate[];
    variants: string[];
    roles: string[];
    requestedClasses: TitleClass[];
  }): Promise<{
    verified: VerifiedCandidate[];
    rejected: RejectedCandidate[];
  }> {
    const byKey = new Map<string, VerifiedCandidate>();
    const rejected: RejectedCandidate[] = [];
    // One taxonomy call for every title seen at this company; null means the
    // service is down and the roles as typed are all there is to compare with
    const titleClasses = await this.titleExpansionService.classifyTitles(
      candidates.map((candidate) => candidate.title),
    );

    for (const candidate of candidates) {
      // A Google result with no company in its title is checked against its text
      const companyMatches =
        matchesAnyCompanyVariant(variants, candidate.companyName) ||
        (candidate.companyName === '' &&
          textMentionsAnyCompanyVariant(variants, candidate.evidenceText));
      const roleScore = scoreRoleMatch({
        title: candidate.title,
        roles,
        requestedClasses,
        candidateClass:
          titleClasses?.get(candidate.title.trim().toLowerCase()) ?? null,
      });

      if (!companyMatches || roleScore === 0) {
        rejected.push({
          name: candidate.name,
          title: candidate.title,
          companyOnProfile: candidate.companyName,
          reason: companyMatches ? 'role_mismatch' : 'company_mismatch',
        });
        continue;
      }

      const key = isNonEmptyString(candidate.linkedinUrl)
        ? normalizeLinkedinProfileUrl(candidate.linkedinUrl)
        : `${candidate.name.toLowerCase()}|${candidate.companyName.toLowerCase()}`;
      const existing = byKey.get(key);

      if (isDefined(existing)) {
        if (!existing.sources.includes(candidate.source)) {
          existing.sources.push(candidate.source);
        }

        continue;
      }

      byKey.set(key, { ...candidate, sources: [candidate.source], roleScore });
    }

    const verified = [...byKey.values()].sort(
      (first, second) =>
        second.roleScore - first.roleScore ||
        second.sources.length - first.sources.length ||
        getRequestedRoleOrder(first.title, roles) -
          getRequestedRoleOrder(second.title, roles),
    );

    return { verified, rejected };
  }

  private async persist(
    input: FindRoleAtCompaniesInput,
    outcomes: CompanyOutcome[],
    context: ToolExecutionContext,
  ): Promise<{ count: number; error?: string }> {
    if (!isNonEmptyString(input.projectId)) {
      return { count: 0 };
    }

    const people = outcomes.flatMap((outcome) =>
      outcome.people.map((person) => ({
        id: toId(
          isNonEmptyString(person.linkedinUrl)
            ? normalizeLinkedinProfileUrl(person.linkedinUrl)
            : `${person.name}|${person.companyOnProfile}`,
        ),
        name: person.name,
        title: person.title,
        headline: '',
        summary: '',
        companyId: '',
        companyName: person.companyOnProfile || outcome.company,
        linkedinUrl: person.linkedinUrl,
        warmPath: '—',
        stage: 'queued',
        email: '',
      })),
    );

    if (people.length === 0) {
      return { count: 0 };
    }

    const output = await this.upsertOutreachTargetPeopleTool.execute(
      { projectId: input.projectId, mode: 'merge', people },
      context,
    );

    return output.success
      ? { count: people.length }
      : { count: 0, error: output.error };
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
