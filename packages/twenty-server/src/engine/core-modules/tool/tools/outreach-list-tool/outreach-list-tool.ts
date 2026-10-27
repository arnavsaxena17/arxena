import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-search.service';
import { fromBrightDataDocument } from 'src/engine/core-modules/outreach-list/utils/outreach-list-normalizers.util';
import { SaveOutreachTargetsToCrmService } from 'src/engine/core-modules/outreach-command/services/save-outreach-targets-to-crm.service';
import {
  OUTREACH_LIST_MAX_ROWS,
  OUTREACH_LIST_PEEK_MAX_ROWS,
} from 'src/engine/core-modules/outreach-list/outreach-list.constants';
import { type OutreachListDocument } from 'src/engine/core-modules/outreach-list/outreach-list.types';
import {
  aggregateOutreachListRows,
  OutreachListService,
} from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
import {
  outreachListRowToEphemeralCompany,
  outreachListRowToEphemeralPerson,
} from 'src/engine/core-modules/outreach-list/utils/outreach-list-to-ephemeral.util';
import {
  OutreachListToolInputZodSchema,
  type OutreachListToolInput,
} from 'src/engine/core-modules/tool/tools/outreach-list-tool/outreach-list-tool-input.type';
import { WriteOutreachListRowsToProjectTabService } from 'src/engine/core-modules/tool/tools/outreach-list-tool/write-outreach-list-rows-to-project-tab.service';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const DEFAULT_BATCH_ROWS = OUTREACH_LIST_MAX_ROWS;

@Injectable()
export class OutreachListTool implements Tool {
  private readonly logger = new Logger(OutreachListTool.name);

  description = `Work with search result lists (overflow when a Find search had no projectId, or for export / dedupe). Search tools with projectId already write the project tab. Lists are temporary: 30 days when any source was paid, otherwise 7. actions: list, summary, peek (at most ${OUTREACH_LIST_PEEK_MAX_ROWS} rows), export (CSV link), dedupe (against crm or lists), attach (a list already on that project is skipped), save_to_crm (bag overflow; prefer save_outreach_targets_to_crm once rows are on the tab), delete. Never read a whole list into the conversation.`;

  inputSchema = OutreachListToolInputZodSchema;

  constructor(
    private readonly outreachListService: OutreachListService,
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
    private readonly saveOutreachTargetsToCrmService: SaveOutreachTargetsToCrmService,
    private readonly writeOutreachListRowsToProjectTabService: WriteOutreachListRowsToProjectTabService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = OutreachListToolInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return this.fail('Invalid input', parsed.error.message);
    }

    if (!context.workspaceId) {
      return this.fail('Workspace context is required');
    }

    const input = parsed.data;
    const workspaceId = context.workspaceId;

    try {
      if (input.action === 'list') {
        const lists = await this.outreachListService.list(workspaceId);

        return {
          success: true,
          message: `${lists.length} list(s)`,
          result: {
            lists: lists.map((meta) => ({
              listId: meta.id,
              name: meta.name,
              entity: meta.entity,
              rows: meta.rowCount,
              sources: meta.sources,
              projectIds: meta.projectIds,
              savedToCrm: meta.crmSaved ?? null,
              expiresAt: meta.expiresAt,
            })),
          },
        };
      }

      if (!isNonEmptyString(input.listId)) {
        return this.fail('listId is required for this action');
      }

      if (input.action === 'delete') {
        await this.outreachListService.remove(workspaceId, input.listId);

        return { success: true, message: 'List deleted', result: {} };
      }

      const document =
        (await this.outreachListService.get(workspaceId, input.listId)) ??
        (await this.importBrightDataDataset(workspaceId, input.listId));

      if (!document) {
        return this.fail(
          'List not found',
          `No list ${input.listId}. Lists expire after 30 days (paid sources) or 7 days (free sources); run the search again.`,
        );
      }

      switch (input.action) {
        case 'summary':
          return {
            success: true,
            message: `List has ${document.rows.length} ${document.meta.entity} row(s)`,
            result: {
              listId: document.meta.id,
              name: document.meta.name,
              entity: document.meta.entity,
              sources: document.meta.sources,
              spentUsd: document.meta.spentUsd,
              projectIds: document.meta.projectIds,
              savedToCrm: document.meta.crmSaved ?? null,
              expiresAt: document.meta.expiresAt,
              summary: aggregateOutreachListRows(document.rows),
            },
          };
        case 'peek': {
          const offset = input.offset ?? 0;
          const rows = this.outreachListService.peek(
            document,
            offset,
            input.limit ?? OUTREACH_LIST_PEEK_MAX_ROWS,
          );

          return {
            success: true,
            message: `Showing ${rows.length} of ${document.rows.length} rows`,
            result: {
              listId: document.meta.id,
              total: document.rows.length,
              offset,
              rows,
            },
          };
        }
        case 'export': {
          const file = await this.outreachListService.exportCsv(document);

          return {
            success: true,
            message: `Exported ${document.rows.length} row(s) to ${file.filename}`,
            result: {
              listId: document.meta.id,
              count: document.rows.length,
              files: [{ ...file, mimeType: 'text/csv' }],
            },
          };
        }
        case 'dedupe':
          return this.dedupe(workspaceId, input);
        case 'attach':
          return this.attach(input, document, context);
        case 'save_to_crm':
          return this.saveToCrm(input, document, context);
        default:
          return this.fail('Unknown action');
      }
    } catch (error) {
      this.logger.error('Outreach list action failed', error);

      return this.fail(
        'List action failed',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // Records fetched before lists existed sit in the Bright Data dataset record
  // (planId). Importing them on first use keeps those paid results reachable.
  private async importBrightDataDataset(
    workspaceId: string,
    planId: string,
  ): Promise<OutreachListDocument | undefined> {
    const dataset = await this.brightDataLudicrousSearchService.loadDataset({
      planId,
      workspaceId,
    });

    if (!dataset) {
      return undefined;
    }

    const entity = dataset.entity === 'company' ? 'company' : 'people';

    await this.outreachListService.ingest({
      workspaceId,
      listId: planId,
      name: `Bright Data ${entity === 'company' ? 'companies' : 'people'} (imported)`,
      entity,
      source: 'bright_data',
      spentUsd: dataset.spentUsd,
      rows: dataset.documents
        .map((document) => fromBrightDataDocument(entity, document))
        .filter((row) => row !== null),
    });

    return this.outreachListService.get(workspaceId, planId);
  }

  private async dedupe(
    workspaceId: string,
    input: OutreachListToolInput,
  ): Promise<ToolOutput> {
    const listId = input.listId as string;
    const options = { remove: input.remove === true };
    const outcome =
      input.against === 'lists'
        ? await this.outreachListService.dedupeAgainstOtherLists(
            workspaceId,
            listId,
            options,
          )
        : await this.outreachListService.dedupeAgainstCrm(
            workspaceId,
            listId,
            options,
          );

    if (!outcome) {
      return this.fail('List not found');
    }

    const target = input.against === 'lists' ? 'other lists' : 'the CRM';

    return {
      success: true,
      message: `${outcome.matched} row(s) already in ${target}${options.remove ? `, ${outcome.removed} removed` : ''}`,
      result: { listId, against: input.against ?? 'crm', ...outcome },
    };
  }

  // Overflow only: show list rows on a project tab when the search had no projectId.
  private async attach(
    input: OutreachListToolInput,
    document: OutreachListDocument,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const projectId = isNonEmptyString(input.projectId)
      ? input.projectId
      : context.projectId;

    if (!isNonEmptyString(projectId)) {
      return this.fail(
        'projectId is required',
        'Ask the user which project the list should be shown on.',
      );
    }

    // A search with projectId already wrote these rows; writing them again
    // would only repeat the merge. An explicit offset still pages on.
    if (
      input.offset === undefined &&
      document.meta.projectIds.includes(projectId)
    ) {
      return {
        success: true,
        message: 'This list is already on the project tab',
        result: {
          listId: document.meta.id,
          attached: 0,
          alreadyOnProject: true,
        },
      };
    }

    const offset = input.offset ?? 0;
    const written = await this.writeOutreachListRowsToProjectTabService.write({
      workspaceId: document.meta.workspaceId,
      listId: document.meta.id,
      projectId,
      entity: document.meta.entity,
      rows: document.rows,
      context,
      offset,
      limit: input.limit ?? DEFAULT_BATCH_ROWS,
    });

    if (written.error) {
      return this.fail('Could not write to the project tab', written.error);
    }

    if (written.written === 0) {
      return this.fail('No rows at that offset');
    }

    return {
      success: true,
      message: `Showing ${written.written} row(s) on the project tab`,
      result: {
        listId: document.meta.id,
        attached: written.written,
        nextOffset:
          offset + written.written < document.rows.length
            ? offset + written.written
            : null,
        note: `The project tabs keep at most ${OUTREACH_LIST_MAX_ROWS} rows each.`,
      },
    };
  }

  // Bag overflow: turn list rows into CRM records. Prefer
  // save_outreach_targets_to_crm once rows are already on the tab.
  private async saveToCrm(
    input: OutreachListToolInput,
    document: OutreachListDocument,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const isCompany = document.meta.entity === 'company';

    if (isCompany && !isNonEmptyString(input.projectId)) {
      return this.fail(
        'projectId is required',
        'CRM companies are tagged to a project. Ask the user which project to save them to.',
      );
    }

    const offset = input.offset ?? 0;
    const batch = document.rows.slice(
      offset,
      offset + (input.limit ?? DEFAULT_BATCH_ROWS),
    );

    if (batch.length === 0) {
      return this.fail('No rows at that offset');
    }

    const companies = isCompany
      ? batch.map(outreachListRowToEphemeralCompany)
      : [];
    const people = isCompany ? [] : batch.map(outreachListRowToEphemeralPerson);
    const outcome = await this.saveOutreachTargetsToCrmService.saveRows({
      workspaceId: document.meta.workspaceId,
      projectId: input.projectId ?? '',
      companies,
      people,
      companyById: new Map(companies.map((company) => [company.id, company])),
      result: {
        success: true,
        companies: { created: 0, matched: 0, skipped: 0 },
        people: { created: 0, matched: 0, skipped: 0 },
        crmCompanyIdByEphemeralId: {},
        crmPersonIdByEphemeralId: {},
      },
    });

    if (!outcome.success) {
      return this.fail('Save to CRM failed', outcome.error);
    }

    const savedKeys = new Set([
      ...Object.keys(outcome.crmCompanyIdByEphemeralId),
      ...Object.keys(outcome.crmPersonIdByEphemeralId),
    ]);

    await this.outreachListService.update(
      document.meta.workspaceId,
      document.meta.id,
      (current) => {
        const previous = current.meta.crmSaved ?? { companies: 0, people: 0 };

        current.meta.crmSavedAt = new Date().toISOString();
        current.meta.crmSaved = {
          companies:
            previous.companies +
            outcome.companies.created +
            outcome.companies.matched,
          people:
            previous.people + outcome.people.created + outcome.people.matched,
        };

        for (const row of current.rows) {
          if (savedKeys.has(row.key)) {
            row.inCrm = true;
          }
        }

        if (
          isNonEmptyString(input.projectId) &&
          !current.meta.projectIds.includes(input.projectId)
        ) {
          current.meta.projectIds.push(input.projectId);
        }
      },
    );

    return {
      success: true,
      message: `Saved ${batch.length} row(s) to the CRM`,
      result: {
        listId: document.meta.id,
        companies: outcome.companies,
        people: outcome.people,
        nextOffset:
          offset + batch.length < document.rows.length
            ? offset + batch.length
            : null,
        note: isCompany
          ? 'Companies were created or matched by website and tagged to the project. Not enrolled.'
          : 'People are matched by LinkedIn URL; rows without one were skipped. Not enrolled.',
      },
    };
  }

  private fail(message: string, error?: string): ToolOutput {
    return { success: false, message, error: error ?? message };
  }
}
