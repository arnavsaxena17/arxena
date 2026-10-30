import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { OUTREACH_TAB_MAX_ROWS } from 'src/engine/core-modules/outreach-command/constants/outreach-tab.constants';
import {
  type OutreachEntity,
  type OutreachRow,
} from 'src/engine/core-modules/outreach-command/rows/outreach-rows.types';
import {
  outreachRowToEphemeralCompany,
  outreachRowToEphemeralPerson,
} from 'src/engine/core-modules/outreach-command/rows/utils/outreach-rows-to-ephemeral.util';
import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';

export type WriteSearchRowsToProjectTabResult = {
  written: number;
  total: number;
  // Rows that created a tab row vs merged into one already there. The second
  // is the overlap with earlier queries in the same run.
  createdCount: number;
  updatedCount: number;
  error?: string;
};

@Injectable()
export class WriteSearchRowsToProjectTabService {
  constructor(
    private readonly upsertOutreachTargetCompaniesTool: UpsertOutreachTargetCompaniesTool,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
  ) {}

  async write(input: {
    projectId: string;
    entity: OutreachEntity;
    rows: OutreachRow[];
    context: ToolExecutionContext;
    offset?: number;
    limit?: number;
  }): Promise<WriteSearchRowsToProjectTabResult> {
    const { projectId, entity, rows, context } = input;

    if (!isNonEmptyString(projectId) || rows.length === 0) {
      return {
        written: 0,
        total: rows.length,
        createdCount: 0,
        updatedCount: 0,
      };
    }

    const offset = input.offset ?? 0;
    const limit = input.limit ?? OUTREACH_TAB_MAX_ROWS;
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
              companies: batch.map(outreachRowToEphemeralCompany),
            },
            context,
          )
        : await this.upsertOutreachTargetPeopleTool.execute(
            {
              projectId,
              mode: 'merge',
              people: batch.map(outreachRowToEphemeralPerson),
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

    return {
      written: batch.length,
      total: rows.length,
      createdCount,
      updatedCount,
    };
  }
}
