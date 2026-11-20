import { Injectable, Logger, Optional } from '@nestjs/common';

import { createHash } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { OUTREACH_TAB_MAX_ROWS } from 'src/engine/core-modules/outreach-command/constants/outreach-tab.constants';
import { SourcingBudgetService } from 'src/engine/core-modules/outreach-command/services/sourcing-budget.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import {
  type BrightDataLudicrousPlan,
  type BrightDataLudicrousRunResult,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-search.service';
import {
  mapBrightDataCompanyToEphemeral,
  mapBrightDataCompanyToSearchHit,
  mapBrightDataPersonToEphemeral,
  mapBrightDataPersonToSearchItem,
  aggregateBrightDataDocuments,
  filterBrightDataDocumentsByDomain,
  filterBrightDataDocumentsByLinkedinUrl,
  parseBrightDataInstantLookupQuery,
  type BrightDataBusinessSearchDocument,
  type BrightDataInstantLookup,
} from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import {
  SearchBrightDataBusinessToolInputZodSchema,
  type SearchBrightDataBusinessToolInput,
} from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool-input.type';
import { BrightDataPersonFitFilterService } from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import {
  buildDeprioritisationFields,
  type DeprioritisationReason,
} from 'src/engine/core-modules/outreach-command/utils/outreach-people-deprioritisation.util';
import {
  type WriteSearchRowsToProjectTabResult,
  WriteSearchRowsToProjectTabService,
} from 'src/engine/core-modules/tool/tools/outreach-tab-tool/write-search-rows-to-project-tab.service';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

// Kept rows stay the chat count. The tab gets every paid row so the Jev
// verdict can be Yes or No in otherFields.relevant.
const documentsForProjectTab = (
  run: BrightDataLudicrousRunResult,
): BrightDataBusinessSearchDocument[] => {
  const source =
    run.fetchedDocuments.length > 0 ? run.fetchedDocuments : run.documents;

  return source.map((document) => {
    const relevant =
      'relevant' in document && typeof document.relevant === 'boolean'
        ? document.relevant
        : undefined;

    return {
      brightId: document.brightId,
      data: document.data,
      ...(relevant === undefined ? {} : { relevant }),
      // A fetched row is no longer a probe; the merge clears the flag a
      // sampled row may have set earlier.
      probe: false,
      ...(isNonEmptyString(document.shardKey)
        ? { shardKey: document.shardKey }
        : {}),
    };
  });
};

// The paid estimate samples, flattened with the slice that returned them. They
// are written to the tab as probe rows even when the slice is never fetched,
// so a rejected hypothesis is still inspectable.
const documentsForPlanSamples = (
  plan: BrightDataLudicrousPlan,
): BrightDataBusinessSearchDocument[] =>
  Object.entries(plan.sampleDocuments).flatMap(([shardKey, documents]) =>
    documents.map((document) => ({
      brightId: document.brightId,
      data: document.data,
      ...(typeof document.relevant === 'boolean'
        ? { relevant: document.relevant }
        : {}),
      probe: true,
      shardKey: document.shardKey ?? shardKey,
    })),
  );

// OutreachCompaniesCacheService / OutreachPeopleCacheService keep this many
const MAX_ROWS_PER_PROJECT_TAB = OUTREACH_TAB_MAX_ROWS;

// One Bright Data search keeps one id: its estimate samples and its fetch
// share it, and asking the same thing again on the project is the same set
const brightDataResultSetId = (
  input: SearchBrightDataBusinessToolInput,
): string =>
  `bright-data:${input.entity}:${createHash('sha1')
    .update(input.query.trim().toLowerCase())
    .digest('hex')
    .slice(0, 16)}`;

// What every Bright Data result says about the tab write, in one shape
const tabWriteFields = (write: WriteSearchRowsToProjectTabResult) => ({
  resultSetId: write.resultSetId,
  written: write.written,
  newRows: write.newRows,
  alreadyOnTab: write.alreadyOnTab,
  writtenRowIds: write.writtenRowIds,
});

const INSTANT_LOOKUP_DEFAULT_LIMIT = 20;
// A probe is a look, not a fetch: 25 rows cost at most $0.05
const INSTANT_PROBE_DEFAULT_LIMIT = 10;
const INSTANT_PROBE_MAX_LIMIT = 25;

@Injectable()
export class SearchBrightDataBusinessTool implements Tool {
  private readonly logger = new Logger(SearchBrightDataBusinessTool.name);

  description = `Search Bright Data Business Search for companies or people with a raw natural-language request. Every result is written to the project tab; a project is required.
Default mode is ludicrous (billed $0.002 per returned record, max $10 per query). It works in two steps:
1. Call without execute. This plans several structured queries and spends a few cents sampling them. The sampled rows are written to the tab with otherFields.probe=true (and relevant when the judge scored them), so a rejected slice is still inspectable. You get per-slice match counts, expected accuracy and the cost of fetching N records. Show the user the numbers and ask which budget to fetch.
2. After the user confirms, call again with execute: true and maxBudgetUsd (optionally targetCount). The project's active estimate is fetched slice by slice and rows Jev marks irrelevant are dropped. A new estimate for the same project and entity replaces the active one.
Pick the mode by input. Ludicrous (default) is for a set described by attributes (title, employer, industry, location, size, funding); it has no URL, website or domain field. Instant sends one raw string (max 200 characters) with no planner and no estimate:
- Lookup: a company website (entity company, bare host such as stripe.com), a company LinkedIn URL (entity company) or a person's LinkedIn profile URL (entity people). Rows are cut to the exact match and written to the tab.
- Probe: any other short literal ("Smita Jatia Westlife", "CFO fintech Bengaluru"). limit defaults to 10, max 25 (about $0.05). Fuzzy token matches, written to the tab with otherFields.probe=true; matched is Bright Data's total for the string, not a count of fits.
smart is ignored. Records are fetched with view full.
Ludicrous results never contain the records, only counts and a summary. Do not create CRM records (use save_outreach_targets_to_crm). Without a project the tool refuses: open or name the project whose tab should receive the rows.`;

  inputSchema = SearchBrightDataBusinessToolInputZodSchema;

  constructor(
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
    private readonly writeSearchRowsToProjectTabService: WriteSearchRowsToProjectTabService,
    @Optional()
    private readonly personFitFilterService?: BrightDataPersonFitFilterService,
    @Optional()
    private readonly sourcingBudgetService?: SourcingBudgetService,
    @Optional()
    private readonly sourcingLedgerService?: SourcingLedgerService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed =
      SearchBrightDataBusinessToolInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Failed to search Bright Data',
        error: parsed.error.message,
      };
    }

    // smart is not offered; everything that is not instant goes to the planner
    const input = {
      ...parsed.data,
      mode:
        parsed.data.mode === 'instant'
          ? ('instant' as const)
          : ('ludicrous' as const),
      // Every result is written to a project tab, so a project is required.
      projectId: isNonEmptyString(parsed.data.projectId)
        ? parsed.data.projectId
        : context.projectId,
    };

    if (!isNonEmptyString(input.query)) {
      return {
        success: false,
        message: 'Failed to search Bright Data',
        error: 'query is required',
      };
    }

    if (!isNonEmptyString(input.projectId)) {
      return {
        success: false,
        message: 'Bright Data writes to the project tab',
        error:
          'projectId is required. Open the project whose tab should receive the rows, then retry.',
      };
    }

    if (input.mode === 'ludicrous') {
      return this.executeLudicrous(input, context);
    }

    const lookup = parseBrightDataInstantLookupQuery(input.entity, input.query);

    return lookup === null
      ? this.executeInstantProbe(input, context)
      : this.executeInstantLookup(input, lookup, context);
  }

  // A domain or LinkedIn URL names one entity: cut the fuzzy rows to the exact
  // match and write it to the tab like any other search
  private async executeInstantLookup(
    input: SearchBrightDataBusinessToolInput,
    lookup: BrightDataInstantLookup,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    try {
      const search = await this.brightDataBusinessSearchService.search({
        ...input,
        // Instant ranks by tokens; a small page is enough once we filter
        limit: input.limit ?? INSTANT_LOOKUP_DEFAULT_LIMIT,
      });
      const documents =
        lookup.kind === 'domain'
          ? filterBrightDataDocumentsByDomain(
              search.documents,
              lookup.domainHost,
            )
          : filterBrightDataDocumentsByLinkedinUrl(
              search.documents,
              lookup.linkedinUrlKey,
            );
      const filteredSearch = { ...search, documents };
      const ephemeral = await this.persistEphemeral(input, documents, context);

      const runBudget =
        search.costUsd > 0
          ? await this.sourcingBudgetService?.recordSpend({
              workspaceId: context.workspaceId,
              projectId: input.projectId ?? '',
              usd: search.costUsd,
            })
          : undefined;

      return {
        success: true,
        message: `${
          lookup.kind === 'domain'
            ? `Found ${documents.length} company record(s) for domain ${lookup.domainHost}`
            : `Found ${documents.length} ${input.entity} record(s) for LinkedIn URL ${lookup.linkedinUrlKey}`
        }. ${ephemeral.summary}`,
        result: {
          entity: input.entity,
          mode: search.mode,
          lookup: lookup.kind,
          query: input.query.trim(),
          ...(lookup.kind === 'domain'
            ? { domainHost: lookup.domainHost }
            : { linkedinUrl: lookup.linkedinUrlKey }),
          reqId: search.reqId,
          matched: search.matched,
          count: documents.length,
          ...tabWriteFields(ephemeral),
          probe: false,
          ...(runBudget?.runCapUsd !== undefined && { runBudget }),
          totalCountHint:
            ephemeral.written > 0
              ? "Use get_outreach_tab for the tab total; writtenRowIds are this chat's upserts from this call."
              : undefined,
          previewRows: this.buildPreviewRows(input, filteredSearch),
          companies:
            input.entity === 'company'
              ? documents.map(mapBrightDataCompanyToSearchHit)
              : [],
          people:
            input.entity === 'people'
              ? documents.map(mapBrightDataPersonToSearchItem)
              : [],
        },
      };
    } catch (error) {
      this.logger.error('Bright Data business search failed', error);

      return {
        success: false,
        message: 'Failed to search Bright Data',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // A raw query with no identifier: a cheap look at what instant returns. The
  // rows are fuzzy token matches, but they are still paid for and written to
  // the tab/list marked probe=true so the look is inspectable later.
  private async executeInstantProbe(
    input: SearchBrightDataBusinessToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const previewInput = { ...input, projectId: undefined };

    try {
      const search = await this.brightDataBusinessSearchService.search({
        ...previewInput,
        limit: Math.min(
          input.limit ?? INSTANT_PROBE_DEFAULT_LIMIT,
          INSTANT_PROBE_MAX_LIMIT,
        ),
      });
      const documents = search.documents.map((document) => ({
        ...document,
        probe: true,
      }));
      const ephemeral = await this.persistEphemeral(input, documents, context, {
        probe: true,
      });

      return {
        success: true,
        message: `Instant probe returned ${search.documents.length} ${input.entity} record(s); written to the tab as probe rows. ${ephemeral.summary}`,
        result: {
          entity: input.entity,
          mode: search.mode,
          lookup: 'probe',
          query: input.query.trim(),
          reqId: search.reqId,
          // Bright Data's match total for the raw string, not a count of fits
          matched: search.matched,
          count: search.documents.length,
          spentUsd: search.costUsd,
          ...tabWriteFields(ephemeral),
          probe: true,
          previewRows: this.buildPreviewRows(previewInput, search),
        },
      };
    } catch (error) {
      this.logger.error('Bright Data instant probe failed', error);

      return {
        success: false,
        message: 'Failed to search Bright Data',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildPreviewRows(
    input: SearchBrightDataBusinessToolInput,
    search: Awaited<ReturnType<BrightDataBusinessSearchService['search']>>,
  ): unknown[] {
    // Only previews carry rows; persisted searches already wrote them to the tab
    if (isNonEmptyString(input.projectId)) {
      return [];
    }

    return input.entity === 'company'
      ? search.documents
          .map(mapBrightDataCompanyToEphemeral)
          .filter((row) => row !== null)
      : search.documents
          .map(mapBrightDataPersonToEphemeral)
          .filter((row) => row !== null);
  }

  private async executeLudicrous(
    input: SearchBrightDataBusinessToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    if (!context.workspaceId) {
      return {
        success: false,
        message: 'Failed to search Bright Data',
        error: 'Workspace context is required for ludicrous searches',
      };
    }

    const projectId = input.projectId;

    if (!isNonEmptyString(projectId)) {
      return {
        success: false,
        message: 'Bright Data writes to the project tab',
        error: 'projectId is required',
      };
    }

    try {
      const workspaceId = context.workspaceId;

      if (input.execute === true) {
        // Records for this project may already be paid for: reuse them, never
        // buy twice.
        const existing =
          await this.brightDataLudicrousSearchService.loadDataset({
            workspaceId,
            projectId,
            entity: input.entity,
          });

        if (!isDefined(existing)) {
          const budget = await this.sourcingBudgetService?.check({
            workspaceId,
            projectId,
            estimatedUsd: input.maxBudgetUsd ?? 10,
            tool: 'Bright Data fetch',
          });

          if (isDefined(budget) && !budget.allowed) {
            return {
              success: false,
              message: 'Bright Data fetch refused by the run budget',
              error: budget.message,
            };
          }
        }

        const run =
          existing ??
          (await this.brightDataLudicrousSearchService.executePlan({
            workspaceId,
            projectId,
            entity: input.entity,
            rawQuery: input.query.trim(),
            maxBudgetUsd: input.maxBudgetUsd,
            targetCount: input.targetCount ?? input.limit,
          }));

        return this.buildLudicrousRunOutput(input, run, context, {
          reused: existing !== undefined,
        });
      }

      if (input.autoExecute === true) {
        const budget = await this.sourcingBudgetService?.check({
          workspaceId,
          projectId,
          estimatedUsd: input.maxBudgetUsd ?? 10,
          tool: 'Bright Data fetch',
        });

        if (isDefined(budget) && !budget.allowed) {
          return {
            success: false,
            message: 'Bright Data fetch refused by the run budget',
            error: budget.message,
          };
        }

        const { result } =
          await this.brightDataLudicrousSearchService.searchNaturalLanguage({
            workspaceId,
            projectId,
            entity: input.entity,
            rawQuery: input.query.trim(),
            maxBudgetUsd: input.maxBudgetUsd,
            targetCount: input.targetCount ?? input.limit,
            ...(input.entity === 'company' &&
              isDefined(input.industries) && {
                industryLabels: input.industries,
              }),
          });

        return this.buildLudicrousRunOutput(input, result, context);
      }

      const summary = await this.brightDataLudicrousSearchService.estimate({
        workspaceId,
        projectId,
        entity: input.entity,
        rawQuery: input.query.trim(),
        targetCount: input.targetCount ?? input.limit,
        ...(input.entity === 'company' &&
          isDefined(input.industries) && {
            industryLabels: input.industries,
          }),
      });

      // The estimate already paid for the samples; write them before the user
      // chooses a budget. A failure here must not hide the estimate.
      let probes: WriteSearchRowsToProjectTabResult | undefined;
      let probeWriteError: string | undefined;

      try {
        const plan = await this.brightDataLudicrousSearchService.getPlan({
          workspaceId,
          projectId,
          entity: input.entity,
        });

        probes = await this.persistEphemeral(
          input,
          documentsForPlanSamples(plan),
          context,
          { probe: true },
        );
        probeWriteError = probes.error;
      } catch (error) {
        probeWriteError =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Could not write Bright Data probe samples: ${probeWriteError}`,
        );
      }

      return {
        success: true,
        message:
          isDefined(probes) && probes.written > 0
            ? `${summary.message} Sample rows: ${probes.summary}`
            : summary.message,
        result: {
          mode: 'ludicrous',
          query: input.query.trim(),
          awaitingConfirmation: true,
          nextStep:
            'Show the user the slices, counts and cost options, then call again with execute: true and the maxBudgetUsd they choose. The sampled rows are already on the tab with otherFields.probe=true.',
          ...summary,
          // The sampled rows only; the fetch reports its own newRows under the
          // same resultSetId
          resultSetId: probes?.resultSetId ?? brightDataResultSetId(input),
          probeRowsWritten: probes?.written ?? 0,
          probeRowsTotal: probes?.total ?? 0,
          newRows: probes?.newRows ?? 0,
          alreadyOnTab: probes?.alreadyOnTab ?? 0,
          ...(probeWriteError !== undefined ? { probeWriteError } : {}),
        },
      };
    } catch (error) {
      this.logger.error('Bright Data ludicrous search failed', error);

      return {
        success: false,
        message: 'Failed to search Bright Data',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async buildLudicrousRunOutput(
    input: SearchBrightDataBusinessToolInput,
    run: BrightDataLudicrousRunResult,
    context: ToolExecutionContext,
    { reused = false }: { reused?: boolean } = {},
  ): Promise<ToolOutput> {
    const documents = documentsForProjectTab(run);
    const ephemeral = await this.persistEphemeral(input, documents, context);
    const projectId = input.projectId ?? run.projectId;

    if (!reused) {
      const duplicates = run.shardReports.reduce(
        (sum, report) => sum + report.duplicates,
        0,
      );

      await this.sourcingLedgerService?.append(context.workspaceId, projectId, {
        kind: 'search',
        at: new Date().toISOString(),
        source: 'bright_data',
        entity: input.entity,
        query: input.query.trim(),
        fetched: documents.length,
        duplicates,
        newUnique: ephemeral.newRows,
        alreadyKnown: ephemeral.alreadyOnTab,
        spentUsd: run.spentUsd,
      });
    }

    const runBudget =
      !reused && run.spentUsd > 0
        ? await this.sourcingBudgetService?.recordSpend({
            workspaceId: context.workspaceId,
            projectId,
            usd: run.spentUsd,
          })
        : await this.sourcingBudgetService?.getStatus(
            context.workspaceId,
            projectId,
          );

    // Records never go back to the model. They are in the project tab and in
    // the dataset store for this project, so the conversation only gets counts.
    return {
      success: true,
      message: `${reused ? 'Reused' : 'Fetched'} ${run.documents.length} relevant of ${documents.length} ${input.entity} record(s)${reused ? ' already paid for' : ` for $${run.spentUsd.toFixed(3)} (budget $${run.budgetUsd.toFixed(2)})`}. ${ephemeral.summary} The project tab lists every fetched row; otherFields.relevant is the Jev verdict.`,
      result: {
        entity: input.entity,
        mode: 'ludicrous',
        projectId: run.projectId,
        reused,
        spentUsd: reused ? 0 : run.spentUsd,
        budgetUsd: run.budgetUsd,
        ...(runBudget?.runCapUsd !== undefined && { runBudget }),
        count: run.documents.length,
        fetchedCount: documents.length,
        ...tabWriteFields(ephemeral),
        ...(ephemeral.error
          ? {
              ephemeralError: `Could not write to the project tab: ${ephemeral.error}. The rows are kept for this project; retry with execute: true.`,
            }
          : {}),
        ...(ephemeral.total > MAX_ROWS_PER_PROJECT_TAB
          ? {
              tabLimitNote: `The Companies and People tabs keep at most ${MAX_ROWS_PER_PROJECT_TAB} rows per project, so only the first ${MAX_ROWS_PER_PROJECT_TAB} are visible there.`,
            }
          : {}),
        shardReports: run.shardReports,
        nextStep:
          'Records were written to the project tab. To create CRM records call save_outreach_targets_to_crm with the same projectId. Use get_outreach_tab to read the tab.',
        summary: aggregateBrightDataDocuments(input.entity, run.documents),
      },
    };
  }

  // Likely-fake profiles and people who do not fit the query are still
  // written, but below the rest. Both checks are model calls and fail open.
  private async markDeprioritised(
    input: SearchBrightDataBusinessToolInput,
    documents: BrightDataBusinessSearchDocument[],
    workspaceId: string,
  ) {
    const rows = documents
      .map((document) => ({
        document,
        person: mapBrightDataPersonToEphemeral(document),
      }))
      .filter(
        (
          row,
        ): row is typeof row & {
          person: NonNullable<typeof row.person>;
        } => row.person !== null,
      );
    const reasonsById = new Map<string, DeprioritisationReason[]>();
    const flag = (id: string, reason: DeprioritisationReason) =>
      reasonsById.set(id, [...(reasonsById.get(id) ?? []), reason]);

    // Jev already judged some rows; a row it called irrelevant is a mismatch
    rows
      .filter(({ document }) => document.relevant === false)
      .forEach(({ person }) => flag(person.id, 'query_mismatch'));

    const judgements = await (this.personFitFilterService
      ?.screen({
        workspaceId,
        query: input.query,
        people: rows.map(({ person, document }) => ({
          id: person.id,
          name: person.name,
          title: person.title,
          company: person.companyName,
          location:
            typeof document.data.location === 'string'
              ? document.data.location
              : '',
          profile: document.data,
        })),
      })
      .catch(() => undefined) ?? Promise.resolve(undefined));

    judgements?.forEach((judgement, id) => {
      if (!judgement.fitsSearch) {
        flag(id, 'query_mismatch');
      }

      if (judgement.likelyFake) {
        flag(id, 'likely_fake_profile');
      }
    });

    // The flags go beside the fetched Bright Data fields, never in place of them
    return rows.map(({ person }) => ({
      ...person,
      ...(reasonsById.has(person.id)
        ? {
            otherFields: {
              ...person.otherFields,
              ...(buildDeprioritisationFields(reasonsById.get(person.id) ?? [])
                .otherFields ?? {}),
            },
          }
        : {}),
    }));
  }

  // Turns Bright Data documents into tab rows; the shared writer does the
  // merge, the counts and the resultSetId stamp
  private async persistEphemeral(
    input: SearchBrightDataBusinessToolInput,
    documents: BrightDataBusinessSearchDocument[],
    context: ToolExecutionContext,
    { probe = false }: { probe?: boolean } = {},
  ): Promise<WriteSearchRowsToProjectTabResult> {
    const projectId = isNonEmptyString(input.projectId) ? input.projectId : '';
    const resultSetId = brightDataResultSetId(input);

    if (input.entity === 'company') {
      return this.writeSearchRowsToProjectTabService.writeCompanies({
        projectId,
        companies: documents
          .map(mapBrightDataCompanyToEphemeral)
          .filter((company) => company !== null),
        context,
        resultSetId,
      });
    }

    // A probe is a look, not a qualification: skip the person-fit model calls
    // and write the sampled rows as they are, flagged probe=true.
    const people = probe
      ? documents
          .map(mapBrightDataPersonToEphemeral)
          .filter((person) => person !== null)
      : await this.markDeprioritised(input, documents, context.workspaceId);

    return this.writeSearchRowsToProjectTabService.writePeople({
      projectId,
      people,
      context,
      resultSetId,
    });
  }
}
