import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { OUTREACH_LIST_MAX_ROWS } from 'src/engine/core-modules/outreach-list/outreach-list.constants';
import { OutreachListService } from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
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
  parseBrightDataDomainLookupQuery,
  type BrightDataBusinessSearchDocument,
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

@Injectable()
export class SearchBrightDataBusinessTool implements Tool {
  private readonly logger = new Logger(SearchBrightDataBusinessTool.name);

  description = `Search Bright Data Business Search for companies or people with a raw natural-language request.
Default mode is ludicrous (billed $0.002 per returned record, max $10 per query). It works in two steps:
1. Call without planId. This plans several structured queries and spends a few cents sampling them. You get planId, per-slice match counts, expected accuracy and the cost of fetching N records. Show the user the numbers and ask which budget to fetch. Nothing is fetched yet.
2. After the user confirms, call again with planId and maxBudgetUsd (and optionally targetCount, projectId). Records are fetched slice by slice and rows Jev marks irrelevant are dropped.
Ludicrous is the default. Pass mode "instant" only for company lookup by domain (bare host or URL such as stripe.com); the tool keeps rows whose website/domain matches that host. smart is ignored. Records are fetched with view full.
Ludicrous results never contain the records, only counts and a summary; they go to the project tab and a saved dataset. Fetched records are kept in a list (listId = planId, 30 days); use the outreach_list tool to attach them to a project tab or save them to the CRM, or call again with the same planId and a projectId. Pass projectId to merge hits into the Outreach Companies or People tab. Do not create CRM records. Omit projectId on instant domain lookup for a preview with previewRows / companies.`;

  inputSchema = SearchBrightDataBusinessToolInputZodSchema;

  constructor(
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
    private readonly upsertOutreachTargetCompaniesTool: UpsertOutreachTargetCompaniesTool,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
    private readonly outreachListService: OutreachListService,
    @Optional()
    private readonly personFitFilterService?: BrightDataPersonFitFilterService,
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

    // Instant is only for company-by-domain (see sourcing skill recipe).
    // Everything else stays on the ludicrous planner.
    const wantsInstantDomainLookup =
      parsed.data.mode === 'instant' &&
      parsed.data.entity === 'company' &&
      parseBrightDataDomainLookupQuery(parsed.data.query) !== null;
    const input = {
      ...parsed.data,
      mode: wantsInstantDomainLookup
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

    try {
      const domainHost = parseBrightDataDomainLookupQuery(input.query);
      const search = await this.brightDataBusinessSearchService.search({
        ...input,
        // Instant ranks by tokens; a small page is enough once we filter
        limit: input.limit ?? 20,
      });
      const documents =
        domainHost !== null
          ? filterBrightDataDocumentsByDomain(search.documents, domainHost)
          : search.documents;
      const filteredSearch = { ...search, documents };
      const ephemeral = await this.persistEphemeral(
        input,
        filteredSearch,
        context,
      );

      return {
        success: true,
        message:
          domainHost !== null
            ? `Found ${documents.length} company record(s) for domain ${domainHost}`
            : `Found ${documents.length} ${input.entity} record(s)`,
        result: {
          entity: input.entity,
          mode: search.mode,
          query: input.query.trim(),
          ...(domainHost !== null ? { domainHost } : {}),
          reqId: search.reqId,
          matched: search.matched,
          count: documents.length,
          ephemeralWritten: ephemeral.written,
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

      if (isNonEmptyString(input.planId)) {
        // Records for this plan may already be paid for (a chat that lost the
        // output, or no project at fetch time): reuse them, never buy twice.
        const existing =
          await this.brightDataLudicrousSearchService.loadDataset({
            workspaceId,
            planId: input.planId,
          });
        const run =
          existing ??
          (await this.brightDataLudicrousSearchService.executePlan({
            workspaceId,
            planId: input.planId,
            maxBudgetUsd: input.maxBudgetUsd,
            targetCount: input.targetCount ?? input.limit,
          }));

        return this.buildLudicrousRunOutput(input, run, context, {
          reused: existing !== undefined,
        });
      }

      if (input.autoExecute === true) {
        const { result } =
          await this.brightDataLudicrousSearchService.searchNaturalLanguage({
            workspaceId,
            entity: input.entity,
            rawQuery: input.query.trim(),
            maxBudgetUsd: input.maxBudgetUsd,
            targetCount: input.targetCount ?? input.limit,
          });

        return this.buildLudicrousRunOutput(input, result, context);
      }

      const summary = await this.brightDataLudicrousSearchService.estimate({
        workspaceId,
        entity: input.entity,
        rawQuery: input.query.trim(),
        targetCount: input.targetCount ?? input.limit,
      });

      return {
        success: true,
        message: summary.message,
        result: {
          mode: 'ludicrous',
          query: input.query.trim(),
          awaitingConfirmation: true,
          nextStep:
            'Show the user the slices, counts and cost options, then call again with planId and the maxBudgetUsd they choose.',
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
      reqId: run.planId,
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
      await this.linkListToProject(run.planId, input.projectId, context);
    }

    // Records never go back to the model. They are in the project tab and in
    // the dataset store (planId), so the conversation only gets counts. This
    // keeps tool output tiny and stops rows being truncated or re-pasted.
    return {
      success: true,
      message: `${reused ? 'Reused' : 'Fetched'} ${run.documents.length} relevant of ${documents.length} ${input.entity} record(s)${reused ? ' already paid for' : ` for $${run.spentUsd.toFixed(3)} (budget $${run.budgetUsd.toFixed(2)})`}. The project tab lists every fetched row; otherFields.relevant is the Jev verdict.`,
      result: {
        entity: input.entity,
        mode: 'ludicrous',
        planId: run.planId,
        listId: run.planId,
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
        count: run.documents.length,
        fetchedCount: documents.length,
        ephemeralWritten: ephemeral.written,
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
          ? 'Records were written to the project tab and kept in the list (listId). To create CRM Company / Person records call outreach_list with action save_to_crm and the same projectId.'
          : 'No projectId was given, so nothing was written to a project. The records are kept in the list (listId) for 30 days. Ask the user which project to use, then call outreach_list with action attach (to show them on the project tab) or save_to_crm (to create CRM records).',
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
        listId: run.planId,
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
  ): Promise<{ written: number; total: number; error?: string }> {
    if (!isNonEmptyString(input.projectId) || !context.workspaceId) {
      return { written: 0, total: 0 };
    }

    const projectId = input.projectId;

    if (input.entity === 'company') {
      const companies = search.documents
        .map(mapBrightDataCompanyToEphemeral)
        .filter((company) => company !== null);
      const batch = companies.slice(0, MAX_ROWS_PER_PROJECT_TAB);

      if (batch.length === 0) {
        return { written: 0, total: companies.length };
      }

      const output = await this.upsertOutreachTargetCompaniesTool.execute(
        { projectId, mode: 'merge', companies: batch },
        context,
      );

      return output.success
        ? { written: batch.length, total: companies.length }
        : { written: 0, total: companies.length, error: output.error };
    }

    const people = await this.markDeprioritised(
      input,
      search.documents,
      context.workspaceId,
    );
    const batch = people.slice(0, MAX_ROWS_PER_PROJECT_TAB);

    if (batch.length === 0) {
      return { written: 0, total: people.length };
    }

    const output = await this.upsertOutreachTargetPeopleTool.execute(
      { projectId, mode: 'merge', people: batch },
      context,
    );

    return output.success
      ? { written: batch.length, total: people.length }
      : { written: 0, total: people.length, error: output.error };
  }
}
