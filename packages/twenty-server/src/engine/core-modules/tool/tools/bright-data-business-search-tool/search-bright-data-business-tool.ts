import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { OUTREACH_LIST_MAX_ROWS } from 'src/engine/core-modules/outreach-list/outreach-list.constants';
import { OutreachListService } from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
import { SourcingBudgetService } from 'src/engine/core-modules/outreach-command/services/sourcing-budget.service';
import { fromBrightDataDocument } from 'src/engine/core-modules/outreach-list/utils/outreach-list-normalizers.util';
import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { type BrightDataLudicrousRunResult } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
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
import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { BrightDataPersonFitFilterService } from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import {
  buildDeprioritisationFields,
  type DeprioritisationReason,
} from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/outreach-people-deprioritisation.util';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
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
    };
  });
};

// OutreachCompaniesCacheService / OutreachPeopleCacheService keep this many
const MAX_ROWS_PER_PROJECT_TAB = OUTREACH_LIST_MAX_ROWS;

const INSTANT_LOOKUP_DEFAULT_LIMIT = 20;
// A probe is a look, not a fetch: 25 rows cost at most $0.05
const INSTANT_PROBE_DEFAULT_LIMIT = 10;
const INSTANT_PROBE_MAX_LIMIT = 25;

@Injectable()
export class SearchBrightDataBusinessTool implements Tool {
  private readonly logger = new Logger(SearchBrightDataBusinessTool.name);

  description = `Search Bright Data Business Search for companies or people with a raw natural-language request.
Default mode is ludicrous (billed $0.002 per returned record, max $10 per query). It works in two steps:
1. Call without listId. This plans several structured queries and spends a few cents sampling them. You get listId, per-slice match counts, expected accuracy and the cost of fetching N records. Show the user the numbers and ask which budget to fetch. Nothing is fetched yet.
2. After the user confirms, call again with listId and maxBudgetUsd (and optionally targetCount, projectId). Records are fetched slice by slice and rows Jev marks irrelevant are dropped.
Pick the mode by input. Ludicrous (default) is for a set described by attributes (title, employer, industry, location, size, funding); it has no URL, website or domain field. Instant sends one raw string (max 200 characters) with no planner and no estimate:
- Lookup: a company website (entity company, bare host such as stripe.com), a company LinkedIn URL (entity company) or a person's LinkedIn profile URL (entity people). Rows are cut to the exact match and written to the tab.
- Probe: any other short literal ("Smita Jatia Westlife", "CFO fintech Bengaluru"). limit defaults to 10, max 25 (about $0.05). Fuzzy token matches, returned as previewRows only, never written; matched is Bright Data's total for the string, not a count of fits. Use it to check a name or see what a phrase returns before a ludicrous estimate.
smart is ignored. Records are fetched with view full.
Ludicrous results never contain the records, only counts and a summary. On Find, pass projectId on the fetch so hits write the Outreach tab — do not call outreach_list attach afterward. Fetched records are also kept in a list (listId, 30 days) for export or for attach only when projectId was omitted. Do not create CRM records (use save_outreach_targets_to_crm). Omit projectId on an instant lookup for a preview with previewRows.`;

  inputSchema = SearchBrightDataBusinessToolInputZodSchema;

  constructor(
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
    private readonly upsertOutreachTargetCompaniesTool: UpsertOutreachTargetCompaniesTool,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
    private readonly outreachListService: OutreachListService,
    @Optional()
    private readonly personFitFilterService?: BrightDataPersonFitFilterService,
    @Optional()
    private readonly sourcingBudgetService?: SourcingBudgetService,
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
      // The project the user is on, so a fetch still writes its tab when the
      // model omits it. An estimate ignores projectId.
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

    if (input.mode === 'ludicrous') {
      return this.executeLudicrous(input, context);
    }

    const lookup = parseBrightDataInstantLookupQuery(input.entity, input.query);

    return lookup === null
      ? this.executeInstantProbe(input)
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
      const ephemeral = await this.persistEphemeral(
        input,
        filteredSearch,
        context,
      );
      const runBudget =
        isNonEmptyString(input.projectId) && search.costUsd > 0
          ? await this.sourcingBudgetService?.recordSpend({
              workspaceId: context.workspaceId,
              projectId: input.projectId,
              usd: search.costUsd,
            })
          : undefined;

      return {
        success: true,
        message:
          lookup.kind === 'domain'
            ? `Found ${documents.length} company record(s) for domain ${lookup.domainHost}`
            : `Found ${documents.length} ${input.entity} record(s) for LinkedIn URL ${lookup.linkedinUrlKey}`,
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
          ephemeralWritten: ephemeral.written,
          writtenRowIds: ephemeral.writtenRowIds,
          createdCount: ephemeral.createdCount,
          updatedCount: ephemeral.updatedCount,
          newUnique: ephemeral.createdCount,
          alreadyKnown: ephemeral.updatedCount,
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
  // rows are fuzzy token matches, so they are shown, never written to the tab.
  private async executeInstantProbe(
    input: SearchBrightDataBusinessToolInput,
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

      return {
        success: true,
        message: `Instant probe returned ${search.documents.length} ${input.entity} record(s); not written to the tab`,
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
          ephemeralWritten: 0,
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

    try {
      const workspaceId = context.workspaceId;

      if (isNonEmptyString(input.listId)) {
        // Records for this plan may already be paid for (a chat that lost the
        // output, or no project at fetch time): reuse them, never buy twice.
        const existing =
          await this.brightDataLudicrousSearchService.loadDataset({
            workspaceId,
            listId: input.listId,
          });

        if (!isDefined(existing)) {
          const budget = await this.sourcingBudgetService?.check({
            workspaceId,
            ...(isNonEmptyString(input.projectId) && {
              projectId: input.projectId,
            }),
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
            listId: input.listId,
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
          ...(isNonEmptyString(input.projectId) && {
            projectId: input.projectId,
          }),
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
        entity: input.entity,
        rawQuery: input.query.trim(),
        targetCount: input.targetCount ?? input.limit,
        ...(input.entity === 'company' &&
          isDefined(input.industries) && {
            industryLabels: input.industries,
          }),
      });

      return {
        success: true,
        message: summary.message,
        result: {
          mode: 'ludicrous',
          query: input.query.trim(),
          awaitingConfirmation: true,
          nextStep:
            'Show the user the slices, counts and cost options, then call again with listId and the maxBudgetUsd they choose.',
          ...summary,
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
    const search = {
      reqId: run.listId,
      matched: run.documents.length,
      mode: 'ludicrous' as const,
      coveragePercent: 100,
      costUsd: reused ? 0 : run.spentUsd,
      documents,
    };
    const ephemeral = await this.persistEphemeral(input, search, context);
    const hasProject = isNonEmptyString(input.projectId);
    const list = await this.saveToList(input, documents, run, context, reused);

    if (
      isDefined(list) &&
      isNonEmptyString(input.projectId) &&
      ephemeral.written > 0
    ) {
      await this.linkListToProject(run.listId, input.projectId, context);
      // The ledger reads these to separate a new row from a row an earlier
      // query already put on the tab
      await this.outreachListService
        .update(context.workspaceId, run.listId, (current) => {
          current.meta.newUnique =
            (current.meta.newUnique ?? 0) + ephemeral.createdCount;
          current.meta.alreadyKnown =
            (current.meta.alreadyKnown ?? 0) + ephemeral.updatedCount;
        })
        .catch(() => undefined);
    }

    const runBudget =
      !reused && run.spentUsd > 0 && isNonEmptyString(input.projectId)
        ? await this.sourcingBudgetService?.recordSpend({
            workspaceId: context.workspaceId,
            projectId: input.projectId,
            usd: run.spentUsd,
          })
        : await this.sourcingBudgetService?.getStatus(
            context.workspaceId,
            input.projectId ?? '',
          );

    // Records never go back to the model. They are in the project tab and in
    // the dataset store (listId), so the conversation only gets counts. This
    // keeps tool output tiny and stops rows being truncated or re-pasted.
    return {
      success: true,
      message: `${reused ? 'Reused' : 'Fetched'} ${run.documents.length} relevant of ${documents.length} ${input.entity} record(s)${reused ? ' already paid for' : ` for $${run.spentUsd.toFixed(3)} (budget $${run.budgetUsd.toFixed(2)})`}. The project tab lists every fetched row; otherFields.relevant is the Jev verdict.`,
      result: {
        entity: input.entity,
        mode: 'ludicrous',
        listId: run.listId,
        list: list
          ? {
              name: list.name,
              added: list.added,
              duplicates: list.duplicates,
              total: list.total,
            }
          : null,
        reused,
        spentUsd: reused ? 0 : run.spentUsd,
        budgetUsd: run.budgetUsd,
        ...(runBudget?.runCapUsd !== undefined && { runBudget }),
        count: run.documents.length,
        fetchedCount: documents.length,
        ephemeralWritten: ephemeral.written,
        writtenRowIds: ephemeral.writtenRowIds,
        createdCount: ephemeral.createdCount,
        updatedCount: ephemeral.updatedCount,
        ...(ephemeral.error
          ? {
              ephemeralError: `Could not write to the project tab: ${ephemeral.error}. The rows are still in the list (listId); retry with outreach_list attach.`,
            }
          : {}),
        ...(ephemeral.total > MAX_ROWS_PER_PROJECT_TAB
          ? {
              tabLimitNote: `The Companies and People tabs keep at most ${MAX_ROWS_PER_PROJECT_TAB} rows per project, so only the first ${MAX_ROWS_PER_PROJECT_TAB} are visible there.`,
            }
          : {}),
        shardReports: run.shardReports,
        nextStep: hasProject
          ? 'Records were written to the project tab and kept in the list (listId). To create CRM records call save_outreach_targets_to_crm with the same projectId. Use get_outreach_tab to read the tab.'
          : 'No projectId was given, so nothing was written to a project. The records are kept in the list (listId) for 30 days. Ask which project to use, then outreach_list attach (show on the tab) or attach then save_outreach_targets_to_crm.',
        summary: aggregateBrightDataDocuments(input.entity, run.documents),
      },
    };
  }

  // The sourcing ledger counts a list's searches and spend only once the list
  // names the project, as an attach does
  private async linkListToProject(
    listId: string,
    projectId: string,
    context: ToolExecutionContext,
  ): Promise<void> {
    try {
      await this.outreachListService.update(
        context.workspaceId,
        listId,
        (current) => {
          if (!current.meta.projectIds.includes(projectId)) {
            current.meta.projectIds.push(projectId);
          }
        },
      );
    } catch (error) {
      this.logger.error('Failed to link Bright Data list to project', error);
    }
  }

  // Every fetched record lands in a list (Redis + S3 backup) so it survives a
  // missing project or a lost chat. A failure here must not hide paid results.
  private async saveToList(
    input: SearchBrightDataBusinessToolInput,
    documents: BrightDataBusinessSearchDocument[],
    run: BrightDataLudicrousRunResult,
    context: ToolExecutionContext,
    reused: boolean,
  ) {
    if (!context.workspaceId) {
      return undefined;
    }

    try {
      return await this.outreachListService.ingest({
        workspaceId: context.workspaceId,
        listId: run.listId,
        name: `Bright Data ${input.entity === 'company' ? 'companies' : 'people'}: ${input.query.trim().slice(0, 60)}`,
        entity: input.entity,
        source: 'bright_data',
        query: input.query.trim(),
        spentUsd: reused ? 0 : run.spentUsd,
        rows: documents
          .map((document) => fromBrightDataDocument(input.entity, document))
          .filter((row) => row !== null),
      });
    } catch (error) {
      this.logger.error('Failed to save Bright Data results to a list', error);

      return undefined;
    }
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
              ...buildDeprioritisationFields(reasonsById.get(person.id) ?? [])
                .otherFields,
            },
          }
        : {}),
    }));
  }

  // The project tabs hold MAX_ROWS_PER_PROJECT_TAB rows and the upsert tools
  // reject a larger batch outright, so only that many are sent. A failed upsert
  // is reported, never counted as written.
  private async persistEphemeral(
    input: SearchBrightDataBusinessToolInput,
    search: Awaited<ReturnType<BrightDataBusinessSearchService['search']>>,
    context: ToolExecutionContext,
  ): Promise<{
    written: number;
    total: number;
    writtenRowIds: string[];
    createdCount: number;
    updatedCount: number;
    error?: string;
  }> {
    if (!isNonEmptyString(input.projectId) || !context.workspaceId) {
      return {
        written: 0,
        total: 0,
        writtenRowIds: [],
        createdCount: 0,
        updatedCount: 0,
      };
    }

    const projectId = input.projectId;
    const emptyWrite = {
      writtenRowIds: [] as string[],
      createdCount: 0,
      updatedCount: 0,
    };
    const readWriteMeta = (output: {
      success: boolean;
      result?: unknown;
      error?: string;
    }) => {
      const result =
        typeof output.result === 'object' && output.result !== null
          ? (output.result as Record<string, unknown>)
          : {};
      const writtenRowIds = Array.isArray(result.writtenRowIds)
        ? result.writtenRowIds.filter(
            (id): id is string => typeof id === 'string',
          )
        : [];

      return {
        writtenRowIds,
        createdCount:
          typeof result.createdCount === 'number' ? result.createdCount : 0,
        updatedCount:
          typeof result.updatedCount === 'number' ? result.updatedCount : 0,
      };
    };

    if (input.entity === 'company') {
      const companies = search.documents
        .map(mapBrightDataCompanyToEphemeral)
        .filter((company) => company !== null);
      const batch = companies.slice(0, MAX_ROWS_PER_PROJECT_TAB);

      if (batch.length === 0) {
        return { written: 0, total: companies.length, ...emptyWrite };
      }

      const output = await this.upsertOutreachTargetCompaniesTool.execute(
        { projectId, mode: 'merge', companies: batch },
        context,
      );

      return output.success
        ? {
            written: batch.length,
            total: companies.length,
            ...readWriteMeta(output),
          }
        : {
            written: 0,
            total: companies.length,
            ...emptyWrite,
            error: output.error,
          };
    }

    const people = await this.markDeprioritised(
      input,
      search.documents,
      context.workspaceId,
    );
    const batch = people.slice(0, MAX_ROWS_PER_PROJECT_TAB);

    if (batch.length === 0) {
      return { written: 0, total: people.length, ...emptyWrite };
    }

    const output = await this.upsertOutreachTargetPeopleTool.execute(
      { projectId, mode: 'merge', people: batch },
      context,
    );

    return output.success
      ? {
          written: batch.length,
          total: people.length,
          ...readWriteMeta(output),
        }
      : {
          written: 0,
          total: people.length,
          ...emptyWrite,
          error: output.error,
        };
  }
}
