import { Injectable, Logger } from '@nestjs/common';

import { createHash } from 'crypto';
import { appendFileSync } from 'fs';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-search.service';
import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { BRIGHT_DATA_COST_PER_RECORD_USD } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { mapBrightDataPersonToSearchItem } from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import {
  buildCompanyVariants,
  matchesAnyCompanyVariant,
  textMentionsAnyCompanyVariant,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/company-name-variants.util';
import {
  FindRoleAtCompaniesInputZodSchema,
  type FindRoleAtCompaniesInput,
  FIND_ROLE_AT_COMPANIES_MAX_PROJECT_COMPANIES,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/find-role-at-companies-tool.schema';
import {
  FindRoleGoogleSearchService,
  type GoogleCompanySearchResult,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/find-role-google-search.service';
import { type GoogleSerpOrganicItem } from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';
import {
  personNamesMatch,
  personNamesRoughlyMatch,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/person-name-matching.util';
import { LinkedinProfileResolverService } from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/linkedin-profile-resolver.service';
import {
  normalizeLinkedinProfileUrl,
  parseLinkedinSerpResult,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/parse-linkedin-serp-result.util';
import {
  GoogleResultExtractionService,
  type ExtractedPerson,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/google-result-extraction.service';
import { packLinkedinUrlLookupQueries } from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/linkedin-url-lookup-query.util';
import {
  getRequestedRoleOrder,
  scoreRoleMatch,
  titleContainsWord,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/role-title-matching.util';
import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';
import {
  TitleExpansionService,
  type ResolvedRoles,
} from 'src/engine/core-modules/title-taxonomy/title-expansion.service';
import {
  BrightDataPersonFitFilterService,
  type PersonJudgement,
} from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import {
  PROFILE_FIELD_KEY,
  isUsableProfile,
  profileToRowProfile,
  type RowProfile,
} from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import {
  buildDeprioritisationFields,
  type DeprioritisationReason,
} from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/outreach-people-deprioritisation.util';
import {
  buildPeopleFoundValues,
  type OutreachPeopleFoundLabel,
} from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import {
  matchesTableFilter,
  OutreachTableViewService,
  readCellText,
} from 'src/engine/core-modules/outreach-command/services/outreach-table-view.service';
import { OutreachWorkingSetService } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

// The input is capped at 25 companies, so the default runs them all at once
type FindRoleAtCompany = NonNullable<
  FindRoleAtCompaniesInput['companies']
>[number];
// The input once the companies are known, whether given or read from the project
type ResolvedInput = Omit<FindRoleAtCompaniesInput, 'companies'> & {
  companies: FindRoleAtCompany[];
};

// Bright Data's SERP limit is 1,000 requests/min on an unfunded account and
// higher once funded (docs.brightdata.com/general/usage-monitoring/serp-rate-limit);
// a company sends about 5 queries, so 50 at a time stays inside it
const DEFAULT_COMPANY_CONCURRENCY = 50;
// A lookup that could not complete (source_error) is run again before the
// model sees it, so a blip or a laptop wake-up does not cost a model round
const DEFAULT_COMPANY_LOOKUP_RETRIES = 2;
const COMPANY_RETRY_BACKOFF_MS = [5_000, 15_000];
const MAX_VARIANTS_PER_BRIGHT_DATA_SEARCH = 2;
const BRIGHT_DATA_CANDIDATES_PER_SEARCH = 5;
const MAX_PEOPLE_PER_COMPANY = 3;
const MAX_REJECTED_PER_COMPANY = 3;
const MAX_TITLES_IN_QUERY = 8;
const MAX_NAMES_TO_RESOLVE = 5;

// web = a person named in a page Google returned, then looked up on LinkedIn
type Source = 'bright_data' | 'google' | 'web';

type Candidate = {
  id: string;
  name: string;
  title: string;
  companyName: string;
  linkedinUrl: string;
  // Free text the company can be checked against when there is no company field
  evidenceText: string;
  source: Source;
  // True when the URL was recovered from a post by this person
  linkedinUrlDerivedFromPost?: boolean;
  location?: string;
  // The full provider record, so the fake-profile screen can read education
  // and experience
  rawProfile?: Record<string, unknown>;
};

type VerifiedCandidate = Candidate & {
  sources: Source[];
  roleScore: 1 | 2;
  verdict?: PersonJudgement;
};

type RejectedCandidate = {
  name: string;
  title: string;
  companyOnProfile: string;
  reason: 'company_mismatch' | 'role_mismatch';
  // The judge's reason, when it ruled
  note?: string;
};

type CompanyOutcome = {
  company: string;
  // Companies-tab row id the lookup was asked for, when the caller gave one
  companyRowId?: string;
  status: 'matched' | 'related_role_only' | 'no_match' | 'source_error';
  people: Array<{
    name: string;
    title: string;
    companyOnProfile: string;
    linkedinUrl: string;
    sources: Source[];
    roleMatch: 'exact' | 'related';
    // related = works at a parent, operator or brand linked to the company asked about
    companyRelation?: 'related';
    note?: string;
    linkedinUrlDerivedFromPost?: boolean;
    deprioritisedReasons: DeprioritisationReason[];
    // The full profile, when the source returned one: stored on the row so the
    // profile fetch skips this person
    profile?: RowProfile;
  }>;
  rejected: RejectedCandidate[];
  sourceErrors: string[];
  spentUsd: number;
};

const PEOPLE_FOUND_LABEL_BY_STATUS: Record<
  CompanyOutcome['status'],
  OutreachPeopleFoundLabel
> = {
  matched: 'Found',
  related_role_only: 'Related role only',
  no_match: 'Not found',
  source_error: 'Lookup failed',
};

const getCompanyConcurrency = (): number => {
  const configured = Number(process.env.FIND_ROLE_COMPANY_CONCURRENCY);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_COMPANY_CONCURRENCY;
};

const getCompanyLookupRetries = (): number => {
  const configured = Number(process.env.FIND_ROLE_COMPANY_LOOKUP_RETRIES);

  return Number.isInteger(configured) && configured >= 0
    ? configured
    : DEFAULT_COMPANY_LOOKUP_RETRIES;
};

const EMPTY_GOOGLE_RESULT: GoogleCompanySearchResult = {
  results: [],
  errors: [],
};

const toId = (value: string): string =>
  createHash('sha1').update(value).digest('hex');

// the upsert is a read-modify-write on the project's cached list, so writes
// from companies finishing at the same time (and from parallel tool calls)
// must be serialized per project or they overwrite each other
const projectWriteQueues = new Map<string, Promise<unknown>>();

const runExclusivelyPerProject = async <TResult>(
  projectId: string,
  task: () => Promise<TResult>,
): Promise<TResult> => {
  const previous = projectWriteQueues.get(projectId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  const tail = next.catch(() => undefined);

  projectWriteQueues.set(projectId, tail);
  void tail.then(() => {
    if (projectWriteQueues.get(projectId) === tail) {
      projectWriteQueues.delete(projectId);
    }
  });

  return next;
};

// One limit for the whole process: parallel tool calls share it, so 11 calls
// of 25 companies do not become 275 simultaneous lookups that all time out
let activeLookups = 0;
const waitingLookups: Array<() => void> = [];

const withGlobalLookupSlot = async <TResult>(
  task: () => Promise<TResult>,
): Promise<TResult> => {
  if (activeLookups >= getCompanyConcurrency()) {
    await new Promise<void>((resolve) => waitingLookups.push(resolve));
  } else {
    activeLookups += 1;
  }

  try {
    return await task();
  } finally {
    const next = waitingLookups.shift();

    if (isDefined(next)) {
      next();
    } else {
      activeLookups -= 1;
    }
  }
};

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

  description = `Find the people who hold given roles (CEO, MD, founder, owner, ...) at named companies, in one call. Pass the companies and the roles in the user's words. The tool looks each role up in the job-title taxonomy service (function, grade and the curated titles for it), searches Bright Data people and Google (LinkedIn profiles) in parallel, checks that every person works at that company and holds the role, merges duplicates by LinkedIn URL, and, when nobody is found that way, reads the pages Google returns for names and looks each name up on LinkedIn (a person with a name but no profile found comes back with an empty linkedinUrl), and returns a short table per company with a status: matched, related_role_only (deputy / vice / acting) or no_match, plus rejected rows with the reason. With projectId the verified people are written to the People tab. Use for requests like "get the CEO of each company"; do not use it to build a large people list.`;

  inputSchema = FindRoleAtCompaniesInputZodSchema;

  constructor(
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
    private readonly googleSearchService: FindRoleGoogleSearchService,
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly googleResultExtractionService: GoogleResultExtractionService,
    private readonly personFitFilterService: BrightDataPersonFitFilterService,
    private readonly linkedinProfileResolverService: LinkedinProfileResolverService,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
    private readonly titleExpansionService: TitleExpansionService,
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
    private readonly outreachTableViewService: OutreachTableViewService,
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

    const resolved = await this.resolveCompanies(
      parsed.data,
      context.workspaceId,
    );

    if (typeof resolved === 'string') {
      return {
        success: false,
        message: 'Failed to find roles at companies',
        error: resolved,
      };
    }

    const input = { ...parsed.data, companies: resolved };
    const startedAt = Date.now();
    const resolvedRoles = await this.titleExpansionService.resolveRoles(
      input.roles,
    );
    const writeResult: { count: number; errors: string[] } = {
      count: 0,
      errors: [],
    };
    const outcomes = await runWithConcurrency(
      input.companies,
      getCompanyConcurrency(),
      async (company) => {
        const outcome = await this.lookupCompanyWithRetries(
          company,
          input,
          resolvedRoles,
          context.workspaceId,
        );

        outcome.companyRowId = company.id;
        this.logOutcome(input, outcome);

        // save each company's people as soon as they are found instead of
        // after the whole batch, so nothing is lost if the call is cut short
        const written = await this.persist(input, [outcome], context);

        await this.recordPeopleFound(input, outcome, context.workspaceId);

        writeResult.count += written.count;
        if (isDefined(written.error)) {
          writeResult.errors.push(written.error);
        }

        return outcome;
      },
    );

    this.logger.log(
      `find_role_at_companies: ${outcomes.length} companies in ${Date.now() - startedAt}ms (concurrency ${getCompanyConcurrency()})`,
    );

    const written = {
      count: writeResult.count,
      error: writeResult.errors[0],
    };
    const spentUsd = outcomes.reduce(
      (total, outcome) => total + outcome.spentUsd,
      0,
    );
    const count = (status: CompanyOutcome['status']) =>
      outcomes.filter((outcome) => outcome.status === status).length;

    return {
      success: true,
      message: `Matched ${count('matched')} of ${outcomes.length} companies (${count('related_role_only')} related role only, ${count('no_match')} no match, ${count('source_error')} lookup failed), Bright Data spend $${spentUsd.toFixed(3)}`,
      result: {
        roles: input.roles,
        companies: outcomes.map(({ spentUsd: _spent, ...outcome }) => outcome),
        summary: {
          matched: count('matched'),
          relatedRoleOnly: count('related_role_only'),
          noMatch: count('no_match'),
          sourceError: count('source_error'),
        },
        // companies with nobody found, and whether that is a real miss or a
        // lookup that could not complete (worth running again)
        withoutResults: outcomes
          .filter((outcome) => outcome.people.length === 0)
          .map((outcome) => ({
            company: outcome.company,
            reason: outcome.status,
            sourceErrors: outcome.sourceErrors,
          })),
        spentUsd: Number(spentUsd.toFixed(4)),
        written: written.count,
        ...(isDefined(written.error) && { writeError: written.error }),
      },
    };
  }

  // The model can pass the companies, or ask for the project's own so it
  // never has to copy hundreds of names and ids through its output. Returns an
  // error text when there is nothing to look up.
  private async resolveCompanies(
    input: FindRoleAtCompaniesInput,
    workspaceId: string,
  ): Promise<FindRoleAtCompany[] | string> {
    if (isDefined(input.companies)) {
      return input.companies;
    }

    if (!input.fromProject || !isNonEmptyString(input.projectId)) {
      return "Pass companies, or set fromProject with a projectId to look up the project's Companies tab";
    }

    const rows = await this.outreachWorkingSetService.getAll({
      workspaceId,
      projectId: input.projectId,
      subject: 'company',
    });
    const view = input.onlyViewMatches
      ? await this.outreachTableViewService.get({
          workspaceId,
          projectId: input.projectId,
          tab: 'companies',
        })
      : null;
    const peopleFoundOf = (row: (typeof rows)[number]): unknown =>
      row.otherFields.peopleFound;
    const selected = rows
      .filter((row) =>
        isDefined(view)
          ? view.filters.every((filter) =>
              matchesTableFilter(readCellText(row, filter.columnId), filter),
            )
          : true,
      )
      .filter((row) =>
        input.onlyFailed
          ? peopleFoundOf(row) === PEOPLE_FOUND_LABEL_BY_STATUS.source_error
          : input.rerunFound ||
            peopleFoundOf(row) !== PEOPLE_FOUND_LABEL_BY_STATUS.matched,
      )
      .filter((row) => isNonEmptyString(row.name));

    if (selected.length === 0) {
      return input.onlyFailed
        ? 'No companies on the project have a failed lookup'
        : 'No companies left to look up on the project (none match, or all are already Found; set rerunFound to run them again)';
    }

    return selected
      .slice(0, FIND_ROLE_AT_COMPANIES_MAX_PROJECT_COMPANIES)
      .map((row) => ({ id: row.id, name: row.name as string }));
  }

  // The slot is released while waiting, so a retrying company does not hold
  // back the others. Nothing was verified when the status is source_error, so
  // the last attempt simply replaces the earlier ones (spend is added up).
  private async lookupCompanyWithRetries(
    company: FindRoleAtCompany,
    input: ResolvedInput,
    resolvedRoles: ResolvedRoles,
    workspaceId: string,
  ): Promise<CompanyOutcome> {
    const maxRetries = getCompanyLookupRetries();
    let spentUsd = 0;
    let outcome: CompanyOutcome | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        const backoff =
          COMPANY_RETRY_BACKOFF_MS[
            Math.min(attempt - 1, COMPANY_RETRY_BACKOFF_MS.length - 1)
          ];

        await new Promise((resolve) =>
          setTimeout(resolve, backoff + Math.random() * 2_000),
        );
      }

      outcome = await withGlobalLookupSlot(() =>
        this.lookupCompany(company, input, resolvedRoles, workspaceId),
      ).catch(
        (error): CompanyOutcome => ({
          company: company.name,
          status: 'source_error',
          people: [],
          rejected: [],
          sourceErrors: [
            error instanceof Error ? error.message : String(error),
          ],
          spentUsd: 0,
        }),
      );
      spentUsd += outcome.spentUsd;

      if (outcome.status !== 'source_error') {
        break;
      }

      this.logger.warn(
        `find_role_at_companies "${company.name}": lookup failed (attempt ${attempt + 1}/${maxRetries + 1}): ${outcome.sourceErrors.join('; ')}`,
      );
    }

    return { ...(outcome as CompanyOutcome), spentUsd };
  }

  private async lookupCompany(
    company: FindRoleAtCompany,
    input: ResolvedInput,
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
    // Where the time went, so a slow run can be traced to a stage
    const stageMilliseconds: Record<string, number> = {};
    const startedAt = Date.now();
    const timed = async <TResult>(
      stage: string,
      task: () => Promise<TResult>,
    ): Promise<TResult> => {
      const stageStartedAt = Date.now();

      try {
        return await task();
      } finally {
        stageMilliseconds[stage] = Date.now() - stageStartedAt;
      }
    };

    const [brightDataCandidates, google] = await Promise.all([
      input.sources.includes('bright_data')
        ? timed('bright_data', () =>
            this.searchBrightData({
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
            }),
          )
        : { candidates: [] as Candidate[], spentUsd: 0 },
      input.sources.includes('google')
        ? timed('google', () =>
            this.googleSearchService.searchCompany({
              variants,
              titles,
              roles: input.roles,
              country: input.country,
            }),
          )
            .then((result) => {
              sourceErrors.push(
                ...result.errors.map((error) => `google: ${error}`),
              );

              return result;
            })
            .catch((error) => {
              sourceErrors.push(`google: ${this.describe(error)}`);

              return EMPTY_GOOGLE_RESULT;
            })
        : EMPTY_GOOGLE_RESULT,
    ]);
    spentUsd += brightDataCandidates.spentUsd;

    // The model reads the raw Google results into name, job title, company and
    // profile; what comes after only enriches and checks those fields
    const extracted = await timed('extract', () =>
      this.extractPeople({
        company: company.name,
        variants,
        roles: input.roles,
        results: google.results,
        workspaceId,
        sourceErrors,
      }),
    );
    const alternateNames = company.alternateNames ?? [];
    const extractedCandidates = extracted
      .filter((person) => person.isCurrentRole)
      .map((person) =>
        this.toCandidate(
          person,
          isNonEmptyString(person.linkedinUrl) ? 'google' : 'web',
        ),
      );

    // Who is worth a paid lookup is decided by name and title matching; the
    // model reads each person once, after the profiles are in
    const worthLookingUp = (candidate: Candidate): boolean =>
      this.worthLookingUp(candidate, variants);
    const toEnrich = extractedCandidates.filter(
      (candidate) =>
        isNonEmptyString(candidate.linkedinUrl) && worthLookingUp(candidate),
    );
    const toResolve = extractedCandidates
      .filter(
        (candidate) =>
          !isNonEmptyString(candidate.linkedinUrl) &&
          isNonEmptyString(candidate.title) &&
          worthLookingUp(candidate),
      )
      .slice(0, MAX_NAMES_TO_RESOLVE);

    // Both need Bright Data, and neither waits for the other
    const [enrichment, named] = await timed('lookup', () =>
      Promise.all([
        input.sources.includes('bright_data')
          ? this.enrichGoogleCandidates({
              googleCandidates: toEnrich,
              knownCandidates: brightDataCandidates.candidates,
              maxSpendUsd: input.maxBudgetUsd - brightDataCandidates.spentUsd,
            }).catch((error) => {
              sourceErrors.push(`google_enrichment: ${this.describe(error)}`);

              return { candidates: [] as Candidate[], spentUsd: 0 };
            })
          : { candidates: [] as Candidate[], spentUsd: 0 },
        this.resolveNamedPeople({ candidates: toResolve, variants }),
      ]),
    );
    const enrichedById = new Map(
      enrichment.candidates.map((candidate) => [candidate.id, candidate]),
    );
    const resolvedIds = new Set(toResolve.map((candidate) => candidate.id));

    spentUsd += enrichment.spentUsd + named.spentUsd;
    sourceErrors.push(
      ...named.errors.map((error) => `linkedin_lookup: ${error}`),
    );

    // One reading, on what the profiles themselves say: company, role, place
    // and whether the profile is real. A profile found by name alone has to
    // be told apart from a namesake.
    const candidates = [
      ...brightDataCandidates.candidates,
      ...extractedCandidates
        .filter((candidate) => !resolvedIds.has(candidate.id))
        .map((candidate) => enrichedById.get(candidate.id) ?? candidate),
      ...named.candidates,
    ];
    const verdicts = await timed('judge', () =>
      this.judgeCandidates({
        workspaceId,
        company: company.name,
        alternateNames,
        roles: input.roles,
        country: input.country,
        candidates,
        sourceErrors,
      }),
    );
    const { verified, rejected } = await this.verify({
      candidates,
      variants,
      roles: input.roles,
      requestedClasses: resolvedRoles.requestedClasses,
      verdicts,
    });
    const topPeople = (await this.mergeDuplicates(verified, workspaceId)).slice(
      0,
      MAX_PEOPLE_PER_COMPANY,
    );
    // nobody found while a source failed is not a miss: the answer is unknown
    const sourceFailed = sourceErrors.some((error) =>
      /deadline|fetch failed|timed out|aborted|HTTP (429|5\d\d)\b|non-JSON|rate/i.test(
        error,
      ),
    );
    const status: CompanyOutcome['status'] = topPeople.some(
      (person) => person.roleScore === 2,
    )
      ? 'matched'
      : topPeople.length > 0
        ? 'related_role_only'
        : sourceFailed
          ? 'source_error'
          : 'no_match';

    this.logger.log(
      `find_role_at_companies timing "${company.name}": ${Object.entries(
        stageMilliseconds,
      )
        .map(
          ([stage, milliseconds]) =>
            `${stage} ${(milliseconds / 1000).toFixed(1)}s`,
        )
        .join(' | ')} | total ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    );
    this.logger.log(
      `find_role_at_companies "${company.name}": ${status}, ${verified.length} verified, ${rejected.length} rejected, $${spentUsd.toFixed(3)}`,
    );

    const deprioritisedByPerson = topPeople.map((person) =>
      this.deprioritisationReasons(person.verdict),
    );

    return {
      company: company.name,
      status,
      people: topPeople.map((person, index) => ({
        deprioritisedReasons: deprioritisedByPerson[index],
        name: person.name,
        title: person.title,
        companyOnProfile: person.companyName,
        linkedinUrl: person.linkedinUrl,
        sources: person.sources,
        roleMatch: person.roleScore === 2 ? 'exact' : 'related',
        ...(person.verdict?.company === 'related' && {
          companyRelation: 'related' as const,
        }),
        ...(isNonEmptyString(this.noteOf(person.verdict)) && {
          note: this.noteOf(person.verdict),
        }),
        ...(person.linkedinUrlDerivedFromPost === true && {
          linkedinUrlDerivedFromPost: true,
        }),
        ...this.profileOf(person),
      })),
      rejected: rejected.slice(0, MAX_REJECTED_PER_COMPANY),
      sourceErrors: [...new Set(sourceErrors)],
      spentUsd,
    };
  }

  // Two rows the model reads as one person (a spelling slip, initials, one with
  // a profile URL and one without) become one row that keeps the URL
  private async mergeDuplicates(
    verified: VerifiedCandidate[],
    workspaceId: string,
  ): Promise<VerifiedCandidate[]> {
    if (verified.length < 2) {
      return verified;
    }

    const duplicates = await this.personFitFilterService
      .findDuplicates({
        workspaceId,
        people: verified.map((person) => ({
          id: person.id,
          name: person.name,
          title: person.title,
          company: person.companyName,
          linkedinUrl: person.linkedinUrl,
        })),
      })
      .catch(() => new Map<string, string>());

    if (duplicates.size === 0) {
      return verified;
    }

    const byId = new Map(verified.map((person) => [person.id, person]));

    for (const [duplicateId, keptId] of duplicates) {
      const duplicate = byId.get(duplicateId);
      const kept = byId.get(keptId);

      if (!isDefined(duplicate) || !isDefined(kept)) {
        continue;
      }

      kept.sources = [...new Set([...kept.sources, ...duplicate.sources])];
      kept.roleScore = Math.max(kept.roleScore, duplicate.roleScore) as 1 | 2;
    }

    return verified.filter((person) => !duplicates.has(person.id));
  }

  // Rows that fail a check are still written, but below the rest of the table
  private deprioritisationReasons(
    verdict: PersonJudgement | undefined,
  ): DeprioritisationReason[] {
    if (!isDefined(verdict)) {
      return [];
    }

    const reasons: DeprioritisationReason[] = [];

    if (
      !verdict.fitsSearch ||
      verdict.company !== 'same' ||
      verdict.role !== 'exact'
    ) {
      reasons.push('query_mismatch');
    }

    if (verdict.likelyFake) {
      reasons.push('likely_fake_profile');
    }

    return reasons;
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
          location: typeof item.location === 'string' ? item.location : '',
          rawProfile: document.data,
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

  // The model reads the raw results; if it is unavailable the LinkedIn result
  // titles are split by pattern instead, so a model outage costs accuracy, not
  // the whole Google source
  private async extractPeople({
    company,
    variants,
    roles,
    results,
    workspaceId,
    sourceErrors,
  }: {
    company: string;
    variants: string[];
    roles: string[];
    results: GoogleSerpOrganicItem[];
    workspaceId: string;
    sourceErrors: string[];
  }): Promise<ExtractedPerson[]> {
    if (results.length === 0) {
      return [];
    }

    try {
      return await this.googleResultExtractionService.extract({
        workspaceId,
        company,
        roles,
        results,
      });
    } catch (error) {
      sourceErrors.push(
        `google_extraction: ${this.describe(error)} (read LinkedIn titles by pattern instead)`,
      );

      return results.flatMap((item): ExtractedPerson[] => {
        const person = parseLinkedinSerpResult(item);

        if (person === null) {
          return [];
        }

        // "Name - Company" has no title: the part after the dash is the company
        const titleIsCompany =
          person.companyName === '' &&
          matchesAnyCompanyVariant(variants, person.title) &&
          !roles.some((role) => titleContainsWord(person.title, role));

        return [
          {
            name: person.name,
            jobTitle: titleIsCompany ? '' : person.title,
            companyName: titleIsCompany ? person.title : person.companyName,
            location: '',
            isCurrentRole: true,
            evidence: `${item.title} ${person.snippet}`,
            linkedinUrl: person.linkedinUrl,
            sourceUrl: item.url,
          },
        ];
      });
    }
  }

  // The employer the results state, or, when they state none, the words the
  // person was read from
  private isAtCompany(variants: string[], person: ExtractedPerson): boolean {
    return isNonEmptyString(person.companyName)
      ? matchesAnyCompanyVariant(variants, person.companyName)
      : textMentionsAnyCompanyVariant(variants, person.evidence);
  }

  private toCandidate(person: ExtractedPerson, source: Source): Candidate {
    return {
      id: toId(
        isNonEmptyString(person.linkedinUrl)
          ? normalizeLinkedinProfileUrl(person.linkedinUrl)
          : `${person.name}|${person.companyName}`,
      ),
      name: person.name,
      title: person.jobTitle,
      companyName: person.companyName,
      linkedinUrl: person.linkedinUrl,
      evidenceText: person.evidence,
      source,
      linkedinUrlDerivedFromPost: person.linkedinUrlDerivedFromPost,
    };
  }

  // A Bright Data record already holds the profile; keep it when it has enough
  // to judge a person on, so no second fetch is paid for
  private profileOf(person: VerifiedCandidate): { profile?: RowProfile } {
    if (!isDefined(person.rawProfile)) {
      return {};
    }

    const profile = profileToRowProfile({
      source: 'bright_data',
      record: person.rawProfile,
      fetchedAt: new Date().toISOString(),
    });

    return isUsableProfile(profile) ? { profile } : {};
  }

  private noteOf(verdict: PersonJudgement | undefined): string {
    if (!isDefined(verdict)) {
      return '';
    }

    return [
      verdict.company === 'related' ? verdict.companyNote : '',
      verdict.roleNote,
    ]
      .filter(isNonEmptyString)
      .join(' ');
  }

  // A model rules on every candidate against the company asked about; if it is
  // unavailable the candidates are checked by name matching instead
  private async judgeCandidates({
    workspaceId,
    company,
    alternateNames,
    roles,
    country,
    candidates,
    sourceErrors,
  }: {
    workspaceId: string;
    company: string;
    alternateNames: string[];
    roles: string[];
    country?: string;
    candidates: Candidate[];
    sourceErrors: string[];
  }): Promise<Map<string, PersonJudgement>> {
    const unique = [
      ...new Map(candidates.map((candidate) => [candidate.id, candidate])),
    ].map(([, candidate]) => candidate);

    try {
      return await this.personFitFilterService.judge({
        workspaceId,
        company,
        alternateNames,
        roles,
        country,
        candidates: unique.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          title: candidate.title,
          company: candidate.companyName,
          location: candidate.location ?? '',
          evidence: candidate.evidenceText,
          profile: candidate.rawProfile,
        })),
      });
    } catch (error) {
      sourceErrors.push(
        `candidate_judge: ${this.describe(error)} (checked by name matching instead)`,
      );

      return new Map();
    }
  }

  // Worth a paid Bright Data lookup only when the company on the result
  // matches by name. A person at a parent or operator is still read by the
  // judge, from the company and title their own result states.
  private worthLookingUp(candidate: Candidate, variants: string[]): boolean {
    return isNonEmptyString(candidate.companyName)
      ? matchesAnyCompanyVariant(variants, candidate.companyName)
      : textMentionsAnyCompanyVariant(variants, candidate.evidenceText);
  }

  // A name with a LinkedIn URL can be contacted, a name alone cannot, so every
  // person found without a profile is chased to one. A person whose profile is
  // not found is still returned, with no URL, rather than dropped.
  private async resolveNamedPeople({
    candidates,
    variants,
  }: {
    candidates: Candidate[];
    variants: string[];
  }): Promise<{
    candidates: Candidate[];
    spentUsd: number;
    errors: string[];
  }> {
    const resolutions = await Promise.all(
      candidates.map((candidate) =>
        this.linkedinProfileResolverService.resolve({
          name: candidate.name,
          // The employer their own results state comes first: a person at a
          // parent or operator is found under that name, not the target's
          companyNames: [candidate.companyName, ...variants],
        }),
      ),
    );

    return {
      spentUsd: resolutions.reduce(
        (total, resolution) => total + resolution.spentUsd,
        0,
      ),
      // Only a name that ended with no profile is reported; a retried failure
      // that then succeeded is not an error
      errors: resolutions.flatMap((resolution) =>
        resolution.profiles.length === 0 ? resolution.errors : [],
      ),
      candidates: candidates.flatMap((candidate, index) => {
        const { profiles } = resolutions[index];

        // No profile: the name is still returned, as a lead without a URL
        if (profiles.length === 0) {
          return [candidate];
        }

        return profiles.map(
          (profile): Candidate => ({
            id: toId(normalizeLinkedinProfileUrl(profile.linkedinUrl)),
            name: candidate.name,
            // What the profile says wins over what a result said
            title: profile.title || candidate.title,
            companyName: profile.companyName,
            linkedinUrl: profile.linkedinUrl,
            evidenceText: [
              candidate.evidenceText,
              profile.evidence !== '' ? `profile: ${profile.evidence}` : '',
              profile.sameNameProfileCount !== null
                ? `${profile.sameNameProfileCount} Bright Data profiles carry exactly this name`
                : '',
            ]
              .filter(isNonEmptyString)
              .join(' | '),
            source: 'web',
            linkedinUrlDerivedFromPost: profile.derivedFromPost,
          }),
        );
      }),
    };
  }

  // Looks the Google-found LinkedIn profiles up in Bright Data (instant mode,
  // several profile URLs per query). A profile it does not know keeps the
  // title and company parsed from the Google result.
  private async enrichGoogleCandidates({
    googleCandidates,
    knownCandidates,
    maxSpendUsd,
  }: {
    googleCandidates: Candidate[];
    knownCandidates: Candidate[];
    maxSpendUsd: number;
  }): Promise<{ candidates: Candidate[]; spentUsd: number }> {
    // Profiles the people search already returned are not paid for twice
    const alreadyKnown = new Set(
      knownCandidates
        .filter((candidate) => isNonEmptyString(candidate.linkedinUrl))
        .map((candidate) => normalizeLinkedinProfileUrl(candidate.linkedinUrl)),
    );
    const urls = googleCandidates
      .map((candidate) => candidate.linkedinUrl)
      .filter(
        (url) =>
          isNonEmptyString(url) &&
          !alreadyKnown.has(normalizeLinkedinProfileUrl(url)),
      );
    const maxRecords = Math.floor(
      maxSpendUsd / BRIGHT_DATA_COST_PER_RECORD_USD,
    );

    if (urls.length === 0 || maxRecords <= 0) {
      return { candidates: googleCandidates, spentUsd: 0 };
    }

    const enrichedByUrl = new Map<string, Candidate>();
    let spentUsd = 0;
    let recordsLeft = maxRecords;
    // Each batch is a separate request, so they can run together
    const batches = await Promise.all(
      packLinkedinUrlLookupQueries(urls.slice(0, maxRecords)).map((batch) =>
        this.brightDataBusinessSearchService
          .search({
            entity: 'people',
            mode: 'instant',
            query: batch.join(' '),
            limit: batch.length,
          })
          .catch(() => null),
      ),
    );

    for (const batch of batches) {
      if (batch === null) {
        continue;
      }

      for (const document of batch.documents) {
        if (recordsLeft <= 0) {
          break;
        }

        recordsLeft -= 1;
        spentUsd += BRIGHT_DATA_COST_PER_RECORD_USD;

        const item = mapBrightDataPersonToSearchItem(document);
        const url = typeof item.url === 'string' ? item.url : '';

        if (url === '') {
          continue;
        }

        enrichedByUrl.set(normalizeLinkedinProfileUrl(url), {
          id: document.brightId,
          name: typeof item.name === 'string' ? item.name : '',
          title: typeof item.title === 'string' ? item.title : '',
          companyName:
            typeof item.companyName === 'string' ? item.companyName : '',
          linkedinUrl: url,
          evidenceText: '',
          source: 'google',
          location: typeof item.location === 'string' ? item.location : '',
          rawProfile: document.data,
        });
      }
    }

    return {
      spentUsd,
      candidates: googleCandidates.map((candidate) => {
        const enriched = enrichedByUrl.get(
          normalizeLinkedinProfileUrl(candidate.linkedinUrl),
        );

        if (!isDefined(enriched)) {
          return candidate;
        }

        return {
          ...candidate,
          name: enriched.name || candidate.name,
          title: enriched.title || candidate.title,
          // An empty company means the profile has none to check against, so
          // the Google text stays the evidence
          companyName: enriched.companyName || candidate.companyName,
          location: enriched.location,
          rawProfile: enriched.rawProfile,
        };
      }),
    };
  }

  private async verify({
    candidates,
    variants,
    roles,
    requestedClasses,
    verdicts = new Map<string, PersonJudgement>(),
  }: {
    candidates: Candidate[];
    variants: string[];
    roles: string[];
    requestedClasses: TitleClass[];
    verdicts?: Map<string, PersonJudgement>;
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
      const verdict = verdicts.get(candidate.id);
      // The judge's reading comes first. Where it has none, or cannot tell the
      // company ("unknown"), the names are matched as text: a result with no
      // company in its title is checked against the words it was read from.
      const companyMatches =
        isDefined(verdict) && verdict.company !== 'unknown'
          ? verdict.company === 'same' || verdict.company === 'related'
          : matchesAnyCompanyVariant(variants, candidate.companyName) ||
            (candidate.companyName === '' &&
              textMentionsAnyCompanyVariant(variants, candidate.evidenceText));
      const roleScore = isDefined(verdict)
        ? ({ exact: 2, related: 1, none: 0 } as const)[verdict.role]
        : scoreRoleMatch({
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
          ...(isDefined(verdict) && {
            note: companyMatches ? verdict.roleNote : verdict.companyNote,
          }),
        });
        continue;
      }

      const key = isNonEmptyString(candidate.linkedinUrl)
        ? normalizeLinkedinProfileUrl(candidate.linkedinUrl)
        : `${candidate.name.toLowerCase()}|${candidate.companyName.toLowerCase()}`;
      // One person read twice, once with a profile URL and once without, under
      // a one-letter spelling slip
      const existing =
        byKey.get(key) ??
        [...byKey.values()].find(
          (other) =>
            (!isNonEmptyString(other.linkedinUrl) ||
              !isNonEmptyString(candidate.linkedinUrl)) &&
            personNamesRoughlyMatch(other.name, candidate.name),
        );

      if (isDefined(existing)) {
        if (
          !isNonEmptyString(existing.linkedinUrl) &&
          isNonEmptyString(candidate.linkedinUrl)
        ) {
          existing.linkedinUrl = candidate.linkedinUrl;
          existing.name = candidate.name;
        }

        if (!existing.sources.includes(candidate.source)) {
          existing.sources.push(candidate.source);
        }

        continue;
      }

      byKey.set(key, {
        ...candidate,
        sources: [candidate.source],
        roleScore,
        verdict,
      });
    }

    const verified = [...byKey.values()].sort(
      (first, second) =>
        second.roleScore - first.roleScore ||
        // The company asked about before one linked to it
        Number(second.verdict?.company !== 'related') -
          Number(first.verdict?.company !== 'related') ||
        second.sources.length - first.sources.length ||
        getRequestedRoleOrder(first.title, roles) -
          getRequestedRoleOrder(second.title, roles),
    );

    return {
      verified,
      // A person can be rejected on one record and verified on another (a
      // profile with no title, then the same person on a page that gives it)
      rejected: rejected.filter(
        (entry) =>
          !verified.some((person) => personNamesMatch(person.name, entry.name)),
      ),
    };
  }

  private otherFieldsOf(
    outcome: CompanyOutcome,
    person: CompanyOutcome['people'][number],
  ): { otherFields?: Record<string, unknown> } {
    const otherFields: Record<string, unknown> = {
      ...(buildDeprioritisationFields(person.deprioritisedReasons)
        .otherFields as Record<string, unknown> | undefined),
      ...(isNonEmptyString(outcome.companyRowId)
        ? {
            sourceCompanyId: outcome.companyRowId,
            sourceCompanyName: outcome.company,
            foundVia: 'find_role_at_companies',
          }
        : {}),
      ...(isDefined(person.profile)
        ? { [PROFILE_FIELD_KEY]: person.profile }
        : {}),
    };

    return Object.keys(otherFields).length > 0 ? { otherFields } : {};
  }

  private async persist(
    input: ResolvedInput,
    outcomes: CompanyOutcome[],
    context: ToolExecutionContext,
  ): Promise<{ count: number; error?: string }> {
    if (!isNonEmptyString(input.projectId)) {
      return { count: 0 };
    }

    const people = outcomes.flatMap((outcome) =>
      outcome.people.map((person) => ({
        ...buildDeprioritisationFields(person.deprioritisedReasons),
        ...this.otherFieldsOf(outcome, person),
        id: toId(
          isNonEmptyString(person.linkedinUrl)
            ? normalizeLinkedinProfileUrl(person.linkedinUrl)
            : `${person.name}|${person.companyOnProfile}`,
        ),
        name: person.name,
        title: person.title,
        headline: '',
        summary: '',
        companyId: outcome.companyRowId ?? '',
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

    const output = await runExclusivelyPerProject(input.projectId, () =>
      this.upsertOutreachTargetPeopleTool.execute(
        { projectId: input.projectId as string, mode: 'merge', people },
        context,
      ),
    );

    return output.success
      ? { count: people.length }
      : { count: 0, error: output.error };
  }

  // Writes the per-company result to the Companies tab, so companies with
  // nobody found (or a lookup that failed) are visible, not just the hits.
  private async recordPeopleFound(
    input: ResolvedInput,
    outcome: CompanyOutcome,
    workspaceId: string,
  ): Promise<void> {
    if (
      !isNonEmptyString(input.projectId) ||
      !isNonEmptyString(outcome.companyRowId)
    ) {
      return;
    }

    try {
      await this.outreachWorkingSetService.writeOtherFields({
        workspaceId,
        projectId: input.projectId,
        subject: 'company',
        valuesByRowId: new Map([
          [
            outcome.companyRowId,
            buildPeopleFoundValues(
              PEOPLE_FOUND_LABEL_BY_STATUS[outcome.status],
              outcome.people.length,
            ),
          ],
        ]),
      });
    } catch (error) {
      // the status column is a convenience; never fail the lookup over it
      this.logger.warn(
        `find_role_at_companies: could not record status for "${outcome.company}": ${this.describe(error)}`,
      );
    }
  }

  // Optional JSONL trail of every company outcome, for run reports
  private logOutcome(input: ResolvedInput, outcome: CompanyOutcome): void {
    const path = process.env.FIND_ROLE_OUTCOME_LOG_PATH;

    if (!isNonEmptyString(path)) {
      return;
    }

    try {
      appendFileSync(
        path,
        `${JSON.stringify({
          at: new Date().toISOString(),
          projectId: input.projectId,
          company: outcome.company,
          status: outcome.status,
          people: outcome.people.length,
          sourceErrors: outcome.sourceErrors,
          rejected: outcome.rejected.map((entry) => entry.name),
        })}\n`,
      );
    } catch {
      // the trail is best effort
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
