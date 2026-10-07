import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { type BrightDataLudicrousRunResult } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-search.service';
import {
  mapBrightDataCompanyToEphemeral,
  mapBrightDataCompanyToSearchHit,
  mapBrightDataPersonToEphemeral,
  mapBrightDataPersonToSearchItem,
} from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';
import {
  SearchBrightDataBusinessToolInputZodSchema,
  type SearchBrightDataBusinessToolInput,
} from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool-input.type';
import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class SearchBrightDataBusinessTool implements Tool {
  private readonly logger = new Logger(SearchBrightDataBusinessTool.name);

  description = `Search Bright Data Business Search for companies or people with a raw natural-language request.
Default mode is ludicrous (billed $0.002 per returned record, max $10 per query). It works in two steps:
1. Call without planId. This plans several structured queries and spends a few cents sampling them. You get planId, per-slice match counts, expected accuracy and the cost of fetching N records. Show the user the numbers and ask which budget to fetch. Nothing is fetched yet.
2. After the user confirms, call again with planId and maxBudgetUsd (and optionally targetCount, projectId). Records are fetched slice by slice and low-relevance slices are dropped as the run goes.
Modes smart and instant take a query up to 200 characters, return immediately and need no confirmation.
Pass projectId to merge hits into the Outreach Companies or People tab. Do not create CRM records. Omit projectId in smart/instant for a preview (limit 10) with previewRows.`;

  inputSchema = SearchBrightDataBusinessToolInputZodSchema;

  constructor(
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
    private readonly upsertOutreachTargetCompaniesTool: UpsertOutreachTargetCompaniesTool,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
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

    const input = parsed.data;

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
      const search = await this.brightDataBusinessSearchService.search(input);
      const ephemeral = await this.persistEphemeral(input, search, context);

      return {
        success: true,
        message: `Found ${search.documents.length} ${input.entity} record(s)`,
        result: {
          entity: input.entity,
          mode: search.mode,
          query: input.query.trim(),
          reqId: search.reqId,
          matched: search.matched,
          count: search.documents.length,
          ephemeralWritten: ephemeral.written,
          previewRows: this.buildPreviewRows(input, search),
          companies:
            input.entity === 'company'
              ? search.documents.map(mapBrightDataCompanyToSearchHit)
              : [],
          people:
            input.entity === 'people'
              ? search.documents.map(mapBrightDataPersonToSearchItem)
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
        const run = await this.brightDataLudicrousSearchService.executePlan({
          workspaceId,
          planId: input.planId,
          maxBudgetUsd: input.maxBudgetUsd,
          targetCount: input.targetCount ?? input.limit,
        });

        return this.buildLudicrousRunOutput(input, run, context);
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
  ): Promise<ToolOutput> {
    const search = {
      reqId: run.planId,
      matched: run.documents.length,
      mode: 'ludicrous' as const,
      coveragePercent: 100,
      costUsd: run.spentUsd,
      documents: run.documents.map((document) => ({
        brightId: document.brightId,
        data: document.data,
      })),
    };
    const ephemeral = await this.persistEphemeral(input, search, context);

    return {
      success: true,
      message: `Fetched ${run.documents.length} relevant ${input.entity} record(s) for $${run.spentUsd.toFixed(3)} (budget $${run.budgetUsd.toFixed(2)})`,
      result: {
        entity: input.entity,
        mode: 'ludicrous',
        planId: run.planId,
        spentUsd: run.spentUsd,
        budgetUsd: run.budgetUsd,
        count: run.documents.length,
        ephemeralWritten: ephemeral.written,
        shardReports: run.shardReports,
        previewRows: this.buildPreviewRows(input, search),
        companies:
          input.entity === 'company'
            ? run.documents.map(mapBrightDataCompanyToSearchHit)
            : [],
        people:
          input.entity === 'people'
            ? run.documents.map(mapBrightDataPersonToSearchItem)
            : [],
      },
    };
  }

  private async persistEphemeral(
    input: SearchBrightDataBusinessToolInput,
    search: Awaited<ReturnType<BrightDataBusinessSearchService['search']>>,
    context: ToolExecutionContext,
  ): Promise<{ written: number }> {
    if (!isNonEmptyString(input.projectId) || !context.workspaceId) {
      return { written: 0 };
    }

    if (input.entity === 'company') {
      const companies = search.documents
        .map(mapBrightDataCompanyToEphemeral)
        .filter((company) => company !== null);

      if (companies.length === 0) {
        return { written: 0 };
      }

      await this.upsertOutreachTargetCompaniesTool.execute(
        { projectId: input.projectId, mode: 'merge', companies },
        context,
      );

      return { written: companies.length };
    }

    const people = search.documents
      .map(mapBrightDataPersonToEphemeral)
      .filter((person) => person !== null);

    if (people.length === 0) {
      return { written: 0 };
    }

    await this.upsertOutreachTargetPeopleTool.execute(
      { projectId: input.projectId, mode: 'merge', people },
      context,
    );

    return { written: people.length };
  }
}
