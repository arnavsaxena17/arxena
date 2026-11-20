import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { v4 } from 'uuid';

import { OUTREACH_TAB_MAX_ROWS } from 'src/engine/core-modules/outreach-command/constants/outreach-tab.constants';
import {
  type OutreachEntity,
  type OutreachRow,
} from 'src/engine/core-modules/outreach-command/rows/outreach-rows.types';
import {
  outreachRowToEphemeralCompany,
  outreachRowToEphemeralPerson,
} from 'src/engine/core-modules/outreach-command/rows/utils/outreach-rows-to-ephemeral.util';
import { type OutreachEphemeralCompany } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { type OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import {
  describeTabWrite,
  toTabWriteCounts,
} from 'src/engine/core-modules/tool/utils/describe-tab-write.util';

// Rows in the tab's own shape. Missing fields are filled by the upsert tools'
// schemas (defaults, generated ids), so a tool may leave them out.
type TabPerson = Partial<OutreachEphemeralPerson> &
  Pick<OutreachEphemeralPerson, 'name'>;
type TabCompany = Partial<OutreachEphemeralCompany> &
  Pick<OutreachEphemeralCompany, 'name'>;

export type WriteSearchRowsToProjectTabResult = {
  // The search these rows belong to. Every row it wrote carries it in
  // otherFields.resultSetIds, and the rows it added in firstResultSetId
  resultSetId: string;
  // Rows sent to the tab, after the tab cap
  written: number;
  // Rows offered, before the tab cap
  total: number;
  // written split by whether the tab already held the row. Only newRows are
  // finds: a merged row was on the tab before this search
  newRows: number;
  alreadyOnTab: number;
  writtenRowIds: string[];
  // One sentence for the tool message, so every search words it the same
  summary: string;
  error?: string;
};

// The one way a search puts rows on a project tab. Searches only search: they
// hand their rows here, and the merge, the dedupe, the counts and the
// resultSetId stamp happen once, the same for every source.
@Injectable()
export class WriteSearchRowsToProjectTabService {
  constructor(
    private readonly upsertOutreachTargetCompaniesTool: UpsertOutreachTargetCompaniesTool,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
  ) {}

  // A new id for a search that has none of its own
  static newResultSetId(): string {
    return v4();
  }

  // Generic search rows (Arxena tools): mapped to tab rows here
  async write(input: {
    projectId: string;
    entity: OutreachEntity;
    rows: OutreachRow[];
    context: ToolExecutionContext;
    resultSetId?: string;
    offset?: number;
    limit?: number;
  }): Promise<WriteSearchRowsToProjectTabResult> {
    const offset = input.offset ?? 0;
    const limit = input.limit ?? OUTREACH_TAB_MAX_ROWS;
    const batch = input.rows.slice(offset, offset + limit);

    return input.entity === 'company'
      ? this.writeCompanies({
          ...input,
          companies: batch.map(outreachRowToEphemeralCompany),
          total: input.rows.length,
        })
      : this.writePeople({
          ...input,
          people: batch.map(outreachRowToEphemeralPerson),
          total: input.rows.length,
        });
  }

  // Rows a tool already built in the tab shape, with its own otherFields
  // (probe flags, deprioritisation, the company row link)
  async writePeople(input: {
    projectId: string;
    people: TabPerson[];
    context: ToolExecutionContext;
    resultSetId?: string;
    total?: number;
  }): Promise<WriteSearchRowsToProjectTabResult> {
    return this.upsert({
      projectId: input.projectId,
      tab: 'people',
      rows: input.people,
      total: input.total,
      context: input.context,
      resultSetId: input.resultSetId,
    });
  }

  async writeCompanies(input: {
    projectId: string;
    companies: TabCompany[];
    context: ToolExecutionContext;
    resultSetId?: string;
    total?: number;
  }): Promise<WriteSearchRowsToProjectTabResult> {
    return this.upsert({
      projectId: input.projectId,
      tab: 'companies',
      rows: input.companies,
      total: input.total,
      context: input.context,
      resultSetId: input.resultSetId,
    });
  }

  private async upsert({
    projectId,
    tab,
    rows,
    total = rows.length,
    context,
    resultSetId = WriteSearchRowsToProjectTabService.newResultSetId(),
  }: {
    projectId: string;
    tab: 'people' | 'companies';
    rows: Array<TabPerson | TabCompany>;
    total?: number;
    context: ToolExecutionContext;
    resultSetId?: string;
  }): Promise<WriteSearchRowsToProjectTabResult> {
    const empty = (error?: string): WriteSearchRowsToProjectTabResult => {
      const counts = { newRows: 0, alreadyOnTab: 0 };

      return {
        resultSetId,
        written: 0,
        total,
        ...counts,
        writtenRowIds: [],
        summary: error ?? describeTabWrite(counts, tab),
        ...(error !== undefined && { error }),
      };
    };

    // The tab keeps OUTREACH_TAB_MAX_ROWS and the upsert rejects a larger batch
    const batch = rows.slice(0, OUTREACH_TAB_MAX_ROWS).map((row) => ({
      ...row,
      otherFields: {
        ...(row.otherFields ?? {}),
        resultSetIds: [resultSetId],
        firstResultSetId: resultSetId,
      },
    }));

    if (!isNonEmptyString(projectId) || batch.length === 0) {
      return empty();
    }

    const output =
      tab === 'companies'
        ? await this.upsertOutreachTargetCompaniesTool.execute(
            { projectId, mode: 'merge', companies: batch },
            context,
          )
        : await this.upsertOutreachTargetPeopleTool.execute(
            { projectId, mode: 'merge', people: batch },
            context,
          );

    if (!output.success) {
      return empty(output.error ?? output.message);
    }

    const result =
      typeof output.result === 'object' && output.result !== null
        ? (output.result as Record<string, unknown>)
        : {};
    const counts = toTabWriteCounts({
      createdCount:
        typeof result.createdCount === 'number' ? result.createdCount : 0,
      updatedCount:
        typeof result.updatedCount === 'number' ? result.updatedCount : 0,
    });
    const writtenRowIds = Array.isArray(result.writtenRowIds)
      ? result.writtenRowIds.filter(
          (id): id is string => typeof id === 'string',
        )
      : [];

    return {
      resultSetId,
      written: batch.length,
      total,
      ...counts,
      writtenRowIds,
      summary: describeTabWrite(counts, tab),
    };
  }
}
