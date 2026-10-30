import { Injectable, Logger, Optional } from '@nestjs/common';

import { appendFileSync } from 'fs';

import { isNonEmptyString } from '@sniptt/guards';

import { isDefined } from 'twenty-shared/utils';

import {
  FindPeopleByCompanyInputZodSchema,
  type FindPeopleByCompanyInput,
  FIND_PEOPLE_BY_COMPANY_MAX_PROJECT_COMPANIES,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company-tool.schema';

import { normalizeLinkedinProfileUrl } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/parse-linkedin-serp-result.util';
import { TitleExpansionService } from 'src/engine/core-modules/title-taxonomy/title-expansion.service';
import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { brightDataRecordToPersonOtherFields } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/bright-data-person-row-fields.util';

import { PROFILE_FIELD_KEY } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import { buildDeprioritisationFields } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/outreach-people-deprioritisation.util';

// A note on a kept person is a hint, not the evidence
const MAX_RESULT_NOTE_LENGTH = 120;
import {
  buildPairStatesValues,
  pairKeyOf,
  readPairStates,
  type FindPeoplePairState,
} from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import { SourcingBudgetService } from 'src/engine/core-modules/outreach-command/services/sourcing-budget.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import {
  computePairFunnel,
  summarizePairStates,
  type SourcingBrief,
  SOURCING_PLAN_DEFAULTS,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { isChunkedRunTerminal } from 'src/engine/core-modules/outreach-command/utils/chunked-run.util';
import {
  FIND_PEOPLE_COMPANIES_PER_CHUNK,
  FindPeopleRunService,
  type FindPeopleRunState,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-run.service';

import {
  matchesTableFilter,
  OutreachTableViewService,
  readCellText,
} from 'src/engine/core-modules/outreach-command/services/outreach-table-view.service';

import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';

import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';

import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';

import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';

import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

import {
  type CompanyOutcome,
  type FindPeopleByCompanyTarget,
  type FindPeoplePlan,
  type FindPeopleRoleState,
  type ResolvedInput,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';
import {
  FindPeopleCascadeService,
  getCompanyConcurrency,
  toId,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-cascade.service';

// The lookup's own source names against the keys the brief stores
const SOURCE_KEY_BY_LOOKUP_SOURCE: Record<
  'bright_data' | 'google' | 'harvest',
  string
> = {
  bright_data: 'bright-data',
  google: 'serp',
  harvest: 'harvest',
};

const LOOKUP_SOURCE_BY_KEY: Record<
  string,
  'bright_data' | 'google' | 'harvest'
> = {
  'bright-data': 'bright_data',
  serp: 'google',
  harvest: 'harvest',
};

// Without a brief the lookup keeps related roles, as it always has
const DEFAULT_MAX_RUNG = 3;

const countBy = <TItem>(
  items: TItem[],
  keyOf: (item: TItem) => string,
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const item of items) {
    counts[keyOf(item)] = (counts[keyOf(item)] ?? 0) + 1;
  }

  return counts;
};

const mergeCounts = <TKey extends string>(
  first: Partial<Record<TKey, number>>,
  second: Record<string, number>,
): Partial<Record<TKey, number>> => {
  const merged: Record<string, number> = { ...first } as Record<string, number>;

  for (const [key, value] of Object.entries(second)) {
    merged[key] = (merged[key] ?? 0) + value;
  }

  return merged as Partial<Record<TKey, number>>;
};

// "51-200", "1,001-5,000", "10001+" or "120": the top of the band, so a
// company is small only when it cannot be larger
const parseEmployeeCount = (value: string | undefined): number | undefined => {
  const numbers = (value ?? '').replace(/,/g, '').match(/\d+/g)?.map(Number);

  return isDefined(numbers) && numbers.length > 0
    ? Math.max(...numbers)
    : undefined;
};

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
export class FindPeopleByCompanyTool implements Tool {
  private readonly logger = new Logger(FindPeopleByCompanyTool.name);

  description = `Find the people who hold given roles (CEO, MD, head of e-commerce, ...) at named companies: one company x role pair each, each ending in a final state. Pass the companies (or fromProject), the roles in the user's words, and any person criteria the user stated (criteria), which are judged from each profile. The plan comes from the project's brief (get_sourcing_ledger): the data sources the user picked, the title ladder (maxRung), the confidence to stop at and the spend cap per pair. Per company it runs a cascade, cheapest first: a found answer from an earlier run, then Bright Data people, then (only if no one is confident yet) Google, the pages it returns and the company's own leadership page, then Harvest when the user picked it; every person is checked against the company and the role. Each role at each company returns terminalState found / none_found (reason no_such_role, profile_gaps, budget, source_error) / ambiguous / unresolvable, with the rung used; company-level status rolls the roles up. With projectId the people are written to the People tab and the pair state to the company row. Pass pilotSize 10 on a project's first lookup; more than 25 companies start a background run that returns a runId to read progress with. In the brief's exhaustive mode it does not stop at a target: it looks up only the companies the run cap still covers and returns deferredByBudget for the rest. Use for requests like "get the CEO of each company"; do not use it to build a large people list.`;

  inputSchema = FindPeopleByCompanyInputZodSchema;

  constructor(
    private readonly findPeopleCascadeService: FindPeopleCascadeService,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
    private readonly titleExpansionService: TitleExpansionService,
    private readonly outreachTabService: OutreachTabService,
    private readonly outreachTableViewService: OutreachTableViewService,
    // Optional so the tool still runs inline where these are not wired (tests)
    private readonly sourcingLedgerService?: SourcingLedgerService,
    private readonly findPeopleRunService?: FindPeopleRunService,
    // Writes a company list that was typed into the call onto the Companies
    // tab, so every pair has a row to carry its state
    @Optional()
    private readonly upsertOutreachTargetCompaniesTool?: UpsertOutreachTargetCompaniesTool,
    @Optional()
    private readonly sourcingBudgetService?: SourcingBudgetService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = FindPeopleByCompanyInputZodSchema.safeParse(parameters);

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

    if (isNonEmptyString(parsed.data.runId)) {
      return this.readRun(parsed.data, context.workspaceId);
    }

    const planned = await this.applyPlan(parsed.data, context.workspaceId);

    if (typeof planned === 'string') {
      return {
        success: false,
        message: 'Failed to find roles at companies',
        error: planned,
      };
    }

    const found = await this.resolveCompanies(planned, context.workspaceId);

    if (typeof found === 'string') {
      return {
        success: false,
        message: 'Failed to find roles at companies',
        error: found,
      };
    }

    const resolved = await this.ensureCompanyRows(planned, found, context);
    const budgeted = await this.applyRunBudget(planned, resolved, context);

    if (typeof budgeted === 'string') {
      return {
        success: false,
        message: 'Failed to find roles at companies',
        error: budgeted,
      };
    }

    const isPilot = isDefined(planned.pilotSize);
    const affordable = budgeted.companies;
    const companies = isPilot
      ? affordable.slice(0, planned.pilotSize)
      : affordable;

    // More than one chunk of the project's own companies runs in the
    // background, so a long list survives the chat turn and can be resumed
    if (
      !isPilot &&
      isNonEmptyString(planned.projectId) &&
      companies.length > FIND_PEOPLE_COMPANIES_PER_CHUNK &&
      isDefined(this.findPeopleRunService)
    ) {
      return this.startRun(
        { ...planned, companies },
        context,
        budgeted.deferredByBudget,
      );
    }

    const input = { ...planned, companies };
    const startedAt = Date.now();
    const { outcomes, written } = await this.processCompanies(input, context);
    const spentUsd = outcomes.reduce(
      (total, outcome) => total + outcome.spentUsd,
      0,
    );
    const budget = await this.recordRunSpend(
      planned,
      context.workspaceId,
      spentUsd,
    );

    this.logger.log(
      `find_people_by_company: ${outcomes.length} companies in ${Date.now() - startedAt}ms (concurrency ${getCompanyConcurrency()})`,
    );

    if (isPilot && isNonEmptyString(input.projectId)) {
      await this.recordCheckpoint(
        context.workspaceId,
        input.projectId,
        'pilot',
        undefined,
        input.roles,
      );
    }

    return this.reportOutcomes(input, outcomes, written, {
      ...(isPilot && {
        pilot: {
          done: companies.length,
          remaining: resolved.length - companies.length,
        },
      }),
      ...(budgeted.deferredByBudget > 0 && {
        deferredByBudget: budgeted.deferredByBudget,
      }),
      ...(isDefined(budget) && { budget }),
    });
  }

  // A run cap is a ceiling, not a suggestion: take only the companies whose
  // per-pair caps fit in what is left, and report the rest as deferred rather
  // than pretending they were looked up
  private async applyRunBudget(
    input: FindPeopleByCompanyInput & { plan: FindPeoplePlan },
    companies: FindPeopleByCompanyTarget[],
    context: ToolExecutionContext,
  ): Promise<
    | {
        companies: FindPeopleByCompanyTarget[];
        deferredByBudget: number;
      }
    | string
  > {
    const runCapUsd = input.plan.runCapUsd;

    if (!isDefined(runCapUsd) || !isDefined(this.sourcingBudgetService)) {
      return { companies, deferredByBudget: 0 };
    }

    if (!isNonEmptyString(input.projectId)) {
      return 'A run budget needs a projectId, so the spend can be tracked across calls. Ask which project to use.';
    }

    await this.sourcingBudgetService.configure({
      workspaceId: context.workspaceId,
      projectId: input.projectId,
      runCapUsd,
      // A brief written before budgetRunId existed still gets one stable
      // window per project, so calls do not reset the spend
      budgetRunId: input.plan.budgetRunId ?? input.projectId,
    });
    const status = await this.sourcingBudgetService.getStatus(
      context.workspaceId,
      input.projectId,
    );
    const remainingUsd = status.remainingUsd ?? runCapUsd;
    const affordable = Math.max(
      0,
      Math.floor(remainingUsd / input.plan.perPairUsd),
    );

    if (affordable === 0) {
      return `The run budget of $${runCapUsd.toFixed(2)} is spent ($${status.spentUsd.toFixed(2)}). Raise capsUsd.run before looking up more companies.`;
    }

    return {
      companies: companies.slice(0, affordable),
      deferredByBudget: Math.max(0, companies.length - affordable),
    };
  }

  private async recordRunSpend(
    input: FindPeopleByCompanyInput & { plan: FindPeoplePlan },
    workspaceId: string,
    spentUsd: number,
  ) {
    if (
      !isDefined(input.plan.runCapUsd) ||
      !isDefined(this.sourcingBudgetService) ||
      !isNonEmptyString(input.projectId) ||
      spentUsd <= 0
    ) {
      return undefined;
    }

    await this.sourcingBudgetService.recordSpend({
      workspaceId,
      projectId: input.projectId,
      usd: spentUsd,
    });

    return this.sourcingBudgetService.getStatus(workspaceId, input.projectId);
  }

  // The plan comes from the latest brief; an explicit input wins and is
  // logged. Sources the user did not pick are dropped here, before any spend.
  private async applyPlan(
    input: FindPeopleByCompanyInput,
    workspaceId: string,
  ): Promise<(FindPeopleByCompanyInput & { plan: FindPeoplePlan }) | string> {
    const brief = isNonEmptyString(input.projectId)
      ? await this.readBrief(workspaceId, input.projectId)
      : undefined;
    const allowedByBrief = brief?.sources;

    // The source choice is the user's, at the start of a run: the agent skips
    // the question when it is only skill text, so a project lookup waits for it
    if (isNonEmptyString(input.projectId) && !isDefined(allowedByBrief)) {
      return 'The user has not picked the data sources for this run. Ask once with ask_questions (requirements: Data sources), record the answer with get_sourcing_ledger({ projectId, brief: { sources } }), then call again.';
    }

    // The brief is the user's choice, so a source they picked runs even when
    // the model leaves `sources` at its Bright Data + Google default. Passing
    // `sources` explicitly still narrows the set.
    const briefLookupSources = (allowedByBrief ?? [])
      .map((key) => LOOKUP_SOURCE_BY_KEY[key])
      .filter(
        (source): source is 'bright_data' | 'google' | 'harvest' =>
          source !== undefined,
      );
    const requestedSources = [
      ...new Set([...input.sources, ...briefLookupSources]),
    ];
    const sources = isDefined(allowedByBrief)
      ? requestedSources.filter((source) =>
          allowedByBrief.includes(SOURCE_KEY_BY_LOOKUP_SOURCE[source]),
        )
      : requestedSources;

    if (sources.length === 0) {
      return `The user did not pick a people source this lookup can use (picked: ${(allowedByBrief ?? []).join(', ')}). Ask whether to add Bright Data, Google search or Harvest.`;
    }

    const maxRung =
      input.maxRung ??
      brief?.ladder?.maxRung ??
      (isDefined(brief?.persona)
        ? SOURCING_PLAN_DEFAULTS.maxRungByPersona[brief.persona]
        : DEFAULT_MAX_RUNG);
    const coverage = brief?.coverage ?? 'best_effort';
    const runCapUsd = brief?.capsUsd?.run;
    const perPairUsd =
      input.maxBudgetUsd ??
      brief?.capsUsd?.perPair ??
      SOURCING_PLAN_DEFAULTS.perPairUsd;

    // Exhaustive is a budgeted promise: without a run cap it would either stop
    // silently or spend without a ceiling, so it waits for the user to set one
    if (coverage === 'exhaustive' && !isDefined(runCapUsd)) {
      return 'This run is exhaustive, but the brief has no run cap. Ask the user for the maximum total spend, record it with get_sourcing_ledger({ projectId, brief: { capsUsd: { run } } }), then call again.';
    }

    if (isDefined(runCapUsd) && runCapUsd < perPairUsd) {
      return `The run cap ($${runCapUsd}) is below the per-company cap ($${perPairUsd}), so no company can be looked up. Raise capsUsd.run or lower capsUsd.perPair.`;
    }

    const plan: FindPeoplePlan = {
      maxRung,
      minConfidence:
        input.minConfidence ??
        brief?.thresholds?.minConfidence ??
        SOURCING_PLAN_DEFAULTS.minConfidence,
      freshnessDays:
        brief?.thresholds?.freshnessDays ??
        SOURCING_PLAN_DEFAULTS.freshnessDays,
      perPairUsd,
      ...(runCapUsd !== undefined && { runCapUsd }),
      coverage,
      ...(brief?.budgetRunId !== undefined && {
        budgetRunId: brief.budgetRunId,
      }),
      confidential: brief?.confidential ?? false,
      criteria:
        input.criteria ??
        (brief?.criteria ?? [])
          .filter((criterion) => criterion.mustHave)
          .map((criterion) => criterion.description)
          .filter((description) => description.trim().length > 0),
    };
    const overrides = [
      isDefined(input.maxRung) &&
        isDefined(brief?.ladder?.maxRung) &&
        input.maxRung !== brief.ladder.maxRung &&
        `maxRung ${input.maxRung} (brief ${brief.ladder.maxRung})`,
      isDefined(input.maxBudgetUsd) &&
        isDefined(brief?.capsUsd?.perPair) &&
        `maxBudgetUsd ${input.maxBudgetUsd} (brief ${brief.capsUsd.perPair})`,
    ].filter(isNonEmptyString);

    if (overrides.length > 0) {
      this.logger.log(
        `find_people_by_company overrides the brief: ${overrides.join(', ')}`,
      );
    }

    return { ...input, sources, plan };
  }

  // A list the model typed has no rows, so its pair states would have nowhere
  // to live and the ledger could not report coverage. Merge it onto the tab
  // first and keep the row ids.
  private async ensureCompanyRows(
    input: FindPeopleByCompanyInput & { plan: FindPeoplePlan },
    companies: FindPeopleByCompanyTarget[],
    context: ToolExecutionContext,
  ): Promise<FindPeopleByCompanyTarget[]> {
    if (
      !isNonEmptyString(input.projectId) ||
      input.fromProject === true ||
      !isDefined(this.upsertOutreachTargetCompaniesTool) ||
      companies.every((company) => isNonEmptyString(company.id))
    ) {
      return companies;
    }

    try {
      const written = await this.upsertOutreachTargetCompaniesTool.execute(
        {
          projectId: input.projectId,
          mode: 'merge',
          companies: companies.map((company) => ({
            name: company.name,
            ...(isNonEmptyString(company.domain) && { domain: company.domain }),
            ...(isNonEmptyString(company.industry) && {
              industry: company.industry,
            }),
            ...(isDefined(company.employees) && {
              employees: String(company.employees),
            }),
          })),
        },
        context,
      );
      const writtenRowIds = (
        written.result as { writtenRowIds?: string[] } | undefined
      )?.writtenRowIds;

      if (
        !Array.isArray(writtenRowIds) ||
        writtenRowIds.length !== companies.length
      ) {
        return companies;
      }

      return companies.map((company, index) => ({
        ...company,
        id: company.id ?? writtenRowIds[index],
      }));
    } catch (error) {
      this.logger.warn(
        `find_people_by_company could not write the company list to the tab: ${this.describe(error)}`,
      );

      return companies;
    }
  }

  private async readBrief(
    workspaceId: string,
    projectId: string,
  ): Promise<SourcingBrief | undefined> {
    const events =
      (await this.sourcingLedgerService
        ?.read(workspaceId, projectId)
        .catch(() => [])) ?? [];
    const latest = [...events]
      .reverse()
      .find((event) => event.kind === 'brief');

    return latest?.kind === 'brief' ? latest : undefined;
  }

  // One code path for the inline call and for every background chunk: look
  // each company up, then save its people and its pair state as soon as it
  // finishes, so nothing is lost if the run is cut short
  async processCompanies(
    input: ResolvedInput,
    context: ToolExecutionContext,
    // Called as each company finishes, so a long chunk can show progress
    onOutcome?: (outcome: CompanyOutcome, writtenCount: number) => void,
  ): Promise<{
    outcomes: CompanyOutcome[];
    written: { count: number; error?: string };
  }> {
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
        const outcome =
          company.unresolvable === true
            ? this.unresolvableOutcome(company, input)
            : await this.findPeopleCascadeService.lookupPair(
                company,
                input,
                resolvedRoles,
                context.workspaceId,
              );

        outcome.companyRowId = company.id;
        this.logOutcome(input, outcome);

        const written = await this.persist(input, [outcome], context);

        await this.recordPairState(input, outcome, context.workspaceId);

        writeResult.count += written.count;
        if (isDefined(written.error)) {
          writeResult.errors.push(written.error);
        }

        onOutcome?.(outcome, written.count);

        return outcome;
      },
    );

    return {
      outcomes,
      written: { count: writeResult.count, error: writeResult.errors[0] },
    };
  }

  // A company the import could not identify is not looked up: the spend would
  // go on a guess
  private unresolvableOutcome(
    company: FindPeopleByCompanyTarget,
    input: ResolvedInput,
  ): CompanyOutcome {
    return {
      company: company.name,
      status: 'no_match',
      people: [],
      rejected: [],
      sourceErrors: [],
      spentUsd: 0,
      terminalState: 'unresolvable',
      reason: 'company not identified from the input',
      sourcesUsed: [],
      sourcesAttempted: [],
      titlesTried: input.roles,
      roleStates: [],
    };
  }

  private reportOutcomes(
    input: ResolvedInput,
    outcomes: CompanyOutcome[],
    written: { count: number; error?: string },
    extra: Record<string, unknown> = {},
  ): ToolOutput {
    const spentUsd = outcomes.reduce(
      (total, outcome) => total + outcome.spentUsd,
      0,
    );
    const byState = countBy(outcomes, (outcome) => outcome.terminalState);
    const count = (state: string) => byState[state] ?? 0;
    const pairs = summarizePairStates(
      outcomes.flatMap((outcome) =>
        this.roleStatesOfOutcome(outcome, input.roles).map((state) => ({
          ...state,
          costUsd: 0,
        })),
      ),
      {
        companies: outcomes.length,
        expectedPairs: outcomes.length * input.roles.length,
      },
    );

    return {
      success: true,
      message: `${pairs.byState.found} of ${pairs.expectedPairs} company x role pairs covered (${pairs.byState.none_found} none found, ${pairs.byState.ambiguous} ambiguous, ${pairs.byState.unresolvable} unresolvable), spend $${spentUsd.toFixed(3)}`,
      result: {
        roles: input.roles,
        plan: input.plan,
        pairs,
        // What the model needs to decide and report; the evidence, the
        // profile and the reasons stay on the rows, so ten companies fit in
        // one reply without paging through the output
        companies: outcomes.map((outcome) => ({
          company: outcome.company,
          ...(isNonEmptyString(outcome.companyRowId) && {
            companyRowId: outcome.companyRowId,
          }),
          status: outcome.status,
          terminalState: outcome.terminalState,
          ...(isDefined(outcome.reason) && { reason: outcome.reason }),
          ...(isDefined(outcome.rungUsed) && { rungUsed: outcome.rungUsed }),
          roleStates: this.roleStatesOfOutcome(outcome, input.roles).map(
            (state) => ({
              role: state.role,
              terminalState: state.terminalState,
              ...(state.reason !== undefined && { reason: state.reason }),
              ...(state.rungUsed !== undefined && { rungUsed: state.rungUsed }),
              peopleCount: state.peopleCount,
            }),
          ),
          sourcesUsed: outcome.sourcesUsed,
          sourcesAttempted: outcome.sourcesAttempted,
          // Enough to report and to catch a wrong read; the evidence, the
          // profile and the full rejection list stay on the row
          people: outcome.people.map((person) => ({
            name: person.name,
            title: person.title,
            companyOnProfile: person.companyOnProfile,
            linkedinUrl: person.linkedinUrl,
            sources: person.sources,
            roleMatch: person.roleMatch,
            roleMatches: (person.roleMatches ?? []).map((match) => match.role),
            rungUsed: person.rungUsed,
            confidence: person.confidence,
            ...(person.companyRelation === 'related' && {
              companyRelation: 'related',
            }),
            ...(isNonEmptyString(person.note) && {
              note: person.note.slice(0, MAX_RESULT_NOTE_LENGTH),
            }),
            ...(person.linkedinUrlDerivedFromPost === true && {
              linkedinUrlDerivedFromPost: true,
            }),
            ...(person.criteriaUnknown === true && { criteriaUnknown: true }),
            // Source and link answer "why did you keep this person"; the
            // snippet, query and date stay on the row
            evidence: person.evidence.slice(0, 1).map((entry) => ({
              source: entry.source,
              url: entry.url,
            })),
          })),
          rejectedCount: outcome.rejected.length,
          // Three examples, so a wrong read can be seen without the whole list
          rejected: outcome.rejected.slice(0, 3).map((entry) => ({
            name: entry.name,
            title: entry.title,
            companyOnProfile: entry.companyOnProfile,
            reason: entry.reason,
            ...(isNonEmptyString(entry.note) && {
              note: entry.note.slice(0, MAX_RESULT_NOTE_LENGTH),
            }),
          })),
          sourceErrors: outcome.sourceErrors.slice(0, 2),
        })),
        summary: {
          found: count('found'),
          noneFound: count('none_found'),
          ambiguous: count('ambiguous'),
          unresolvable: count('unresolvable'),
          excluded: count('excluded'),
        },
        // companies with nobody kept, and why: a real miss, a lookup that
        // could not complete (worth running again), the budget or the rung
        withoutResults: outcomes
          .filter((outcome) => outcome.people.length === 0)
          .map((outcome) => ({
            company: outcome.company,
            terminalState: outcome.terminalState,
            reason: outcome.reason,
            sourceErrors: outcome.sourceErrors,
          })),
        // The per-role gaps: a company with a CEO and no manufacturing head
        // appears here once for the missing role.
        pairsWithoutResults: outcomes
          .flatMap((outcome) =>
            this.roleStatesOfOutcome(outcome, input.roles)
              .filter((state) => state.terminalState !== 'found')
              .map((state) => ({
                company: outcome.company,
                role: state.role,
                terminalState: state.terminalState,
                ...(state.reason !== undefined && { reason: state.reason }),
              })),
          )
          .slice(0, 50),
        spentUsd: Number(spentUsd.toFixed(4)),
        written: written.count,
        ...(isDefined(written.error) && { writeError: written.error }),
        ...extra,
      },
    };
  }

  private async startRun(
    input: ResolvedInput,
    context: ToolExecutionContext,
    deferredByBudget = 0,
  ): Promise<ToolOutput> {
    const runService = this.findPeopleRunService as FindPeopleRunService;
    const { companies, ...rest } = input;

    try {
      const run = await runService.start({
        workspaceId: context.workspaceId,
        projectId: input.projectId as string,
        input: rest,
        companies,
        ...(deferredByBudget > 0 && { deferredByBudget }),
        userId: context.userId,
        userWorkspaceId: context.userWorkspaceId,
        threadId: context.threadId,
      });
      const state =
        (await runService.waitForRun(run.runId, input.waitSeconds * 1000)) ??
        run;

      return this.runOutput(state);
    } catch (error) {
      return {
        success: false,
        message: 'Failed to start the people lookup',
        error: this.describe(error),
      };
    }
  }

  private async readRun(
    input: FindPeopleByCompanyInput,
    workspaceId: string,
  ): Promise<ToolOutput> {
    const runService = this.findPeopleRunService;
    const runId = input.runId as string;

    if (!isDefined(runService)) {
      return {
        success: false,
        message: 'Background runs are not available',
        error: 'no run service',
      };
    }

    const state = input.cancel
      ? await runService.cancel(runId)
      : await runService.waitForRun(runId, input.waitSeconds * 1000);

    if (!isDefined(state) || state.workspaceId !== workspaceId) {
      return {
        success: false,
        message: 'Run not found',
        error: `No people lookup run ${runId} (runs are kept 24 hours)`,
      };
    }

    return this.runOutput(state);
  }

  private async runOutput(state: FindPeopleRunState): Promise<ToolOutput> {
    const summary = this.findPeopleRunService?.summarize(state);
    const pairs = isChunkedRunTerminal(state)
      ? computePairFunnel(
          await this.outreachTabService.getAll({
            workspaceId: state.workspaceId,
            projectId: state.projectId,
            tab: 'companies',
          }),
          { roles: state.input.roles },
        )
      : undefined;
    const budget = await this.sourcingBudgetService?.getStatus(
      state.workspaceId,
      state.projectId,
    );

    let message = `Running: ${state.done} of ${state.total} companies looked up. Call again with runId "${state.runId}" to read progress.`;

    if (isChunkedRunTerminal(state)) {
      const deferred = state.deferredByBudget ?? 0;

      message =
        deferred > 0
          ? `Run ${state.status} with ${deferred} companies deferred by the budget: ${pairs?.coverageLine ?? ''} Raise capsUsd.run to cover them.`
          : `Run ${state.status}: ${pairs?.coverageLine ?? ''}`;
    }

    return {
      success: state.status !== 'failed',
      message,
      result: {
        ...summary,
        ...(isDefined(pairs) && { pairs }),
        ...(budget?.runCapUsd !== undefined && { budget }),
      },
    };
  }

  // One chunk of a background run; the job calls it and it queues the next
  async processRunChunk(runId: string): Promise<void> {
    const runService = this.findPeopleRunService;
    const state = await runService?.getRun(runId);

    if (
      !isDefined(runService) ||
      !isDefined(state) ||
      isChunkedRunTerminal(state)
    ) {
      return;
    }

    if (state.cancelRequested) {
      await runService.finish(state, 'cancelled');

      return;
    }

    let chunk = state.companies.slice(
      state.cursor,
      state.cursor + FIND_PEOPLE_COMPANIES_PER_CHUNK,
    );
    let budgetExhausted = false;
    const runCapUsd = state.input.plan.runCapUsd;

    if (isDefined(runCapUsd) && isDefined(this.sourcingBudgetService)) {
      await this.sourcingBudgetService.configure({
        workspaceId: state.workspaceId,
        projectId: state.projectId,
        runCapUsd,
        budgetRunId: state.input.plan.budgetRunId ?? state.projectId,
      });
      const status = await this.sourcingBudgetService.getStatus(
        state.workspaceId,
        state.projectId,
      );
      const remainingUsd = status.remainingUsd ?? runCapUsd;
      const affordable = Math.max(
        0,
        Math.floor(remainingUsd / state.input.plan.perPairUsd),
      );

      if (affordable === 0) {
        await runService.finish(
          {
            ...state,
            budgetExhausted: true,
            deferredByBudget: state.total - state.cursor,
          },
          'cancelled',
          'run_budget_exhausted',
        );

        return;
      }

      if (affordable < chunk.length) {
        // Run only what the remaining budget covers; the rest stay not looked
        // up so a higher cap can pick them up later
        chunk = chunk.slice(0, affordable);
        budgetExhausted = true;
      }
    }

    const context: ToolExecutionContext = {
      workspaceId: state.workspaceId,
      projectId: state.projectId,
      userId: state.userId,
      userWorkspaceId: state.userWorkspaceId,
      threadId: state.threadId,
    };

    try {
      await runService.save({ ...state, status: 'running' });

      // Progress is written every few companies, not only at the chunk end: a
      // 25-company chunk can take minutes and must not look stalled
      const progress = {
        done: state.done,
        byState: { ...state.byState } as typeof state.byState,
        spentUsd: state.spentUsd,
        written: state.written,
        saved: 0,
      };
      const saveProgress = async () => {
        progress.saved = progress.done;

        await runService.save({
          ...state,
          status: 'running',
          done: progress.done,
          byState: progress.byState,
          spentUsd: progress.spentUsd,
          written: progress.written,
        });
      };

      const { outcomes, written } = await this.processCompanies(
        { ...state.input, companies: chunk },
        context,
        (outcome, writtenCount) => {
          progress.done += 1;
          progress.spentUsd += outcome.spentUsd;
          progress.written += writtenCount;
          progress.byState[outcome.terminalState] =
            (progress.byState[outcome.terminalState] ?? 0) + 1;

          if (progress.done - progress.saved >= 5) {
            void saveProgress();
          }
        },
      );
      const latest = (await runService.getRun(runId)) ?? state;

      if (latest.status === 'cancelled') {
        return;
      }

      const chunkSpentUsd = outcomes.reduce(
        (total, outcome) => total + outcome.spentUsd,
        0,
      );

      await this.recordRunSpend(state.input, state.workspaceId, chunkSpentUsd);

      const next: FindPeopleRunState = {
        ...latest,
        status: 'running',
        cursor: state.cursor + chunk.length,
        done: state.done + outcomes.length,
        byState: mergeCounts(
          state.byState,
          countBy(outcomes, (outcome) => outcome.terminalState),
        ),
        spentUsd: state.spentUsd + chunkSpentUsd,
        written: state.written + written.count,
        errors: isDefined(written.error)
          ? [...state.errors, written.error]
          : state.errors,
      };

      if (budgetExhausted && next.cursor < next.total) {
        await runService.finish(
          {
            ...next,
            budgetExhausted: true,
            deferredByBudget: next.total - next.cursor,
          },
          'cancelled',
          'run_budget_exhausted',
        );

        return;
      }

      if (!next.halfwayReported && next.done * 2 >= next.total) {
        next.halfwayReported = true;
        await this.recordCheckpoint(
          next.workspaceId,
          next.projectId,
          'halfway',
          runId,
          next.input.roles,
        );
      }

      if (next.cursor >= next.total) {
        await runService.finish(next, 'completed');
        await this.recordCheckpoint(
          next.workspaceId,
          next.projectId,
          'complete',
          runId,
          next.input.roles,
        );

        return;
      }

      await runService.save(next);
      await runService.enqueueChunk(runId);
    } catch (error) {
      await runService.finish(state, 'failed', this.describe(error));
    }
  }

  private async recordCheckpoint(
    workspaceId: string,
    projectId: string,
    stage: 'pilot' | 'halfway' | 'complete',
    runId?: string,
    roles?: string[],
  ): Promise<void> {
    if (!isDefined(this.sourcingLedgerService)) {
      return;
    }

    try {
      const companyRows = await this.outreachTabService.getAll({
        workspaceId,
        projectId,
        tab: 'companies',
      });

      await this.sourcingLedgerService.append(workspaceId, projectId, {
        kind: 'checkpoint',
        at: new Date().toISOString(),
        stage,
        ...(isDefined(runId) && { runId }),
        pairs: computePairFunnel(companyRows, { roles }),
      });
    } catch (error) {
      this.logger.warn(
        `find_people_by_company: could not record the ${stage} checkpoint: ${this.describe(error)}`,
      );
    }
  }

  // The model can pass the companies, or ask for the project's own so it
  // never has to copy hundreds of names and ids through its output. Returns an
  // error text when there is nothing to look up.
  private async resolveCompanies(
    input: FindPeopleByCompanyInput & { plan: FindPeoplePlan },
    workspaceId: string,
  ): Promise<FindPeopleByCompanyTarget[] | string> {
    if (isDefined(input.companies)) {
      return input.companies;
    }

    if (!input.fromProject || !isNonEmptyString(input.projectId)) {
      return "Pass companies, or set fromProject with a projectId to look up the project's Companies tab";
    }

    const rows = await this.outreachTabService.getAll({
      workspaceId,
      projectId: input.projectId,
      tab: 'companies',
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
    const rolePairKeys = input.roles.map((role) => pairKeyOf([role]));
    const rolePairsOf = (row: (typeof rows)[number]) => {
      const pairs = readPairStates(row.otherFields);

      return rolePairKeys.map((key) => pairs[key]);
    };
    const failed = (row: (typeof rows)[number]): boolean =>
      rolePairsOf(row).some((pair) => pair?.reason === 'source_error') ||
      peopleFoundOf(row) === 'Lookup failed';
    // Every requested role needs a final state. A company with a CEO pair but
    // no manufacturing pair is not done: the next call fills the missing role.
    // Rows from before per-role pairs keep the old Found check.
    const done = (row: (typeof rows)[number]): boolean => {
      const pairs = rolePairsOf(row);

      if (pairs.some(isDefined)) {
        return pairs.every(
          (pair) => isDefined(pair) && pair.reason !== 'source_error',
        );
      }

      return peopleFoundOf(row) === 'Found';
    };
    const selected = rows
      .filter((row) =>
        isDefined(view)
          ? view.filters.every((filter) =>
              matchesTableFilter(readCellText(row, filter.columnId), filter),
            )
          : true,
      )
      .filter((row) =>
        input.onlyFailed ? failed(row) : input.rerunFound || !done(row),
      )
      .filter((row) => isNonEmptyString(row.name));

    if (selected.length === 0) {
      return input.onlyFailed
        ? 'No companies on the project have a failed lookup'
        : 'No companies left to look up on the project for these roles (none match, or all already have a final state; set rerunFound to run them again)';
    }

    return selected
      .slice(0, FIND_PEOPLE_BY_COMPANY_MAX_PROJECT_COMPANIES)
      .map((row) => {
        const employees = parseEmployeeCount(row.employees);

        return {
          id: row.id,
          name: row.name as string,
          ...(isNonEmptyString(row.domain) && { domain: row.domain }),
          ...(isNonEmptyString(row.industry) && { industry: row.industry }),
          ...(isDefined(employees) && { employees }),
          ...(row.otherFields.status === 'unresolvable' && {
            unresolvable: true,
          }),
        };
      });
  }

  private otherFieldsOf(
    outcome: CompanyOutcome,
    person: CompanyOutcome['people'][number],
  ): { otherFields?: Record<string, unknown> } {
    const fromBrightData = isDefined(person.rawProfile)
      ? brightDataRecordToPersonOtherFields(person.rawProfile).otherFields
      : isDefined(person.profile)
        ? { [PROFILE_FIELD_KEY]: person.profile }
        : {};
    const otherFields: Record<string, unknown> = {
      ...fromBrightData,
      ...(buildDeprioritisationFields(person.deprioritisedReasons)
        .otherFields as Record<string, unknown> | undefined),
      ...(isNonEmptyString(outcome.companyRowId)
        ? {
            sourceCompanyId: outcome.companyRowId,
            sourceCompanyName: outcome.company,
            foundVia: 'find_people_by_company',
          }
        : {}),
      confidence: person.confidence,
      freshness: person.freshness,
      rungUsed: person.rungUsed,
      evidence: person.evidence,
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

  // Writes the pair state to the company row, so companies with nobody
  // found (or a lookup that failed) are visible, not just the hits, and a
  // resumed run knows which pairs are done
  // Outcomes from older callers and tests may not carry role states; fall
  // back to the company-level state so the row still gets a pair.
  private roleStatesOfOutcome(
    outcome: CompanyOutcome,
    roles: string[],
  ): FindPeopleRoleState[] {
    if (Array.isArray(outcome.roleStates) && outcome.roleStates.length > 0) {
      return outcome.roleStates;
    }

    return roles.map((role, index) => ({
      role,
      terminalState: outcome.terminalState,
      ...(outcome.reason !== undefined && { reason: outcome.reason }),
      ...(outcome.rungUsed !== undefined && { rungUsed: outcome.rungUsed }),
      personKeys:
        index === 0
          ? outcome.people.map((person) =>
              isNonEmptyString(person.linkedinUrl)
                ? normalizeLinkedinProfileUrl(person.linkedinUrl)
                : person.name,
            )
          : [],
      sourcesUsed: index === 0 ? outcome.sourcesUsed : [],
      peopleCount: index === 0 ? outcome.people.length : 0,
    }));
  }

  private async recordPairState(
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
      const [row] = await this.outreachTabService.getRowsByIds({
        workspaceId,
        projectId: input.projectId,
        tab: 'companies',
        ids: [outcome.companyRowId],
      });
      const previousPairs = readPairStates(row?.otherFields);
      const updatedAt = new Date().toISOString();
      // One pair per role. The cost is charged once, to the first role, so the
      // funnel's sum stays the company's spend rather than multiplying it.
      const pairs = this.roleStatesOfOutcome(outcome, input.roles).map(
        (state, index) => {
          const previous = previousPairs[pairKeyOf([state.role])];

          return {
            roles: [state.role],
            terminalState: state.terminalState,
            ...(isDefined(state.reason) && { reason: state.reason }),
            ...(isDefined(state.rungUsed) && { rungUsed: state.rungUsed }),
            sourcesUsed: state.sourcesUsed,
            titlesTried: outcome.titlesTried,
            costUsd: Number(
              (
                (previous?.costUsd ?? 0) + (index === 0 ? outcome.spentUsd : 0)
              ).toFixed(4),
            ),
            attempts: (previous?.attempts ?? 0) + 1,
            personKeys: state.personKeys,
            updatedAt,
          } satisfies FindPeoplePairState;
        },
      );

      await this.outreachTabService.writeOtherFields({
        workspaceId,
        projectId: input.projectId,
        tab: 'companies',
        valuesByRowId: new Map([
          [
            outcome.companyRowId,
            buildPairStatesValues(row?.otherFields, pairs),
          ],
        ]),
      });
    } catch (error) {
      // the state column is a convenience for the table; the lookup stands
      this.logger.warn(
        `find_people_by_company: could not record the pair state for "${outcome.company}": ${this.describe(error)}`,
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
          terminalState: outcome.terminalState,
          reason: outcome.reason,
          rungUsed: outcome.rungUsed,
          sourcesUsed: outcome.sourcesUsed,
          spentUsd: outcome.spentUsd,
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
