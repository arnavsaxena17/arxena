import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { OUTREACH_LIST_MAX_ROWS } from 'src/engine/core-modules/outreach-list/outreach-list.constants';
import {
  type OutreachListEntity,
  type OutreachListRow,
} from 'src/engine/core-modules/outreach-list/outreach-list.types';
import { OutreachListService } from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
import {
  outreachListRowToEphemeralCompany,
  outreachListRowToEphemeralPerson,
} from 'src/engine/core-modules/outreach-list/utils/outreach-list-to-ephemeral.util';
import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';

export type WriteOutreachListRowsToProjectTabResult = {
  written: number;
  total: number;
  // Rows that created a tab row vs merged into one already there. The second
  // is the overlap with earlier queries in the same run.
  createdCount: number;
  updatedCount: number;
  error?: string;
};

@Injectable()
export class WriteOutreachListRowsToProjectTabService {
  constructor(
    private readonly outreachListService: OutreachListService,
    private readonly upsertOutreachTargetCompaniesTool: UpsertOutreachTargetCompaniesTool,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
  ) {}

  async write(input: {
    workspaceId: string;
    listId: string;
    projectId: string;
    entity: OutreachListEntity;
    rows: OutreachListRow[];
    context: ToolExecutionContext;
    offset?: number;
    limit?: number;
  }): Promise<WriteOutreachListRowsToProjectTabResult> {
    const { workspaceId, listId, projectId, entity, rows, context } = input;

    if (!isNonEmptyString(projectId) || rows.length === 0) {
      return {
        written: 0,
        total: rows.length,
        createdCount: 0,
        updatedCount: 0,
      };
    }

    const offset = input.offset ?? 0;
    const limit = input.limit ?? OUTREACH_LIST_MAX_ROWS;
    const batch = rows.slice(offset, offset + limit);

    if (batch.length === 0) {
      return {
        written: 0,
        total: rows.length,
        createdCount: 0,
        updatedCount: 0,
      };
    }

    const output =
      entity === 'company'
        ? await this.upsertOutreachTargetCompaniesTool.execute(
            {
              projectId,
              mode: 'merge',
              companies: batch.map(outreachListRowToEphemeralCompany),
            },
            context,
          )
        : await this.upsertOutreachTargetPeopleTool.execute(
            {
              projectId,
              mode: 'merge',
              people: batch.map(outreachListRowToEphemeralPerson),
            },
            context,
          );

    if (!output.success) {
      return {
        written: 0,
        total: rows.length,
        createdCount: 0,
        updatedCount: 0,
        error: output.error ?? output.message,
      };
    }

    const result =
      typeof output.result === 'object' && output.result !== null
        ? (output.result as { createdCount?: unknown; updatedCount?: unknown })
        : {};
    const createdCount =
      typeof result.createdCount === 'number' ? result.createdCount : 0;
    const updatedCount =
      typeof result.updatedCount === 'number' ? result.updatedCount : 0;

    await this.outreachListService.update(workspaceId, listId, (current) => {
      if (!current.meta.projectIds.includes(projectId)) {
        current.meta.projectIds.push(projectId);
      }

      // Kept on the list so the ledger can show the overlap with earlier
      // queries, not only the duplicates inside this one
      current.meta.newUnique = (current.meta.newUnique ?? 0) + createdCount;
      current.meta.alreadyKnown =
        (current.meta.alreadyKnown ?? 0) + updatedCount;
    });

    return {
      written: batch.length,
      total: rows.length,
      createdCount,
      updatedCount,
    };
  }
}
