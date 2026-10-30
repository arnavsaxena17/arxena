import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import {
  OutreachCompaniesCacheService,
  type OutreachEphemeralCompany,
} from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import {
  OutreachPeopleCacheService,
  type OutreachEphemeralPerson,
} from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { OutreachTabDedupeService } from 'src/engine/core-modules/outreach-command/services/outreach-tab-dedupe.service';
import { OutreachTabExportService } from 'src/engine/core-modules/outreach-command/services/outreach-tab-export.service';
import { outreachTabRowsToListRows } from 'src/engine/core-modules/outreach-command/utils/outreach-tab-rows.util';
import { OutreachTabToolInputZodSchema } from 'src/engine/core-modules/tool/tools/outreach-tab-tool/outreach-tab-tool-input.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class OutreachTabTool implements Tool {
  private readonly logger = new Logger(OutreachTabTool.name);

  description = `Export or dedupe a project's Companies / People tab. The tab is the only result store; there is no list. actions: export (CSV of the whole tab), dedupe (against the CRM; mark rows inCrm, or remove them). Pass projectId (or use the project the user is on) and tab. Never read the whole tab into the conversation.`;

  inputSchema = OutreachTabToolInputZodSchema;

  constructor(
    private readonly outreachTabService: OutreachTabService,
    private readonly exportService: OutreachTabExportService,
    private readonly dedupeService: OutreachTabDedupeService,
    private readonly companiesCacheService: OutreachCompaniesCacheService,
    private readonly peopleCacheService: OutreachPeopleCacheService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = OutreachTabToolInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return this.fail('Invalid outreach tab input', parsed.error.message);
    }

    const input = parsed.data;
    const projectId = isNonEmptyString(input.projectId)
      ? input.projectId
      : context.projectId;

    if (!isNonEmptyString(projectId)) {
      return this.fail(
        'projectId is required',
        'Open the project whose tab you want to export or dedupe, then retry.',
      );
    }

    const entity = input.tab === 'companies' ? 'company' : 'people';
    const rows = await this.outreachTabService.getAll({
      workspaceId: context.workspaceId,
      projectId,
      tab: input.tab,
    });
    const listRows = outreachTabRowsToListRows(entity, rows);

    if (input.action === 'export') {
      const file = await this.exportService.export({
        workspaceId: context.workspaceId,
        entity,
        rows: listRows,
      });

      return {
        success: true,
        message: `Exported ${file.count} ${input.tab} row(s) to ${file.filename}`,
        result: {
          projectId,
          tab: input.tab,
          count: file.count,
          files: [{ ...file, mimeType: 'text/csv' }],
        },
      };
    }

    const known = await this.dedupeService.findExistingCrmKeys({
      workspaceId: context.workspaceId,
      entity,
      rows: listRows,
    });
    const matchedIds = new Set(
      listRows.filter((row) => known.has(row.key)).map((row) => row.id),
    );
    const remove = input.remove === true;

    if (entity === 'company') {
      const payload = await this.companiesCacheService.get(
        context.workspaceId,
        projectId,
      );
      const next = (payload?.companies ?? []).flatMap<OutreachEphemeralCompany>(
        (company) => {
          if (!matchedIds.has(company.id)) {
            return [company];
          }

          if (remove) {
            return [];
          }

          return [
            {
              ...company,
              otherFields: { ...company.otherFields, inCrm: true },
            },
          ];
        },
      );

      await this.companiesCacheService.set(
        context.workspaceId,
        projectId,
        next,
      );
    } else {
      const payload = await this.peopleCacheService.get(
        context.workspaceId,
        projectId,
      );
      const next = (payload?.people ?? []).flatMap<OutreachEphemeralPerson>(
        (person) => {
          if (!matchedIds.has(person.id)) {
            return [person];
          }

          if (remove) {
            return [];
          }

          return [
            {
              ...person,
              otherFields: { ...person.otherFields, inCrm: true },
            },
          ];
        },
      );

      await this.peopleCacheService.set(context.workspaceId, projectId, next);
    }

    return {
      success: true,
      message: `${matchedIds.size} ${input.tab} row(s) already in the CRM${remove ? `, ${matchedIds.size} removed` : ''}`,
      result: {
        projectId,
        tab: input.tab,
        against: 'crm',
        matched: matchedIds.size,
        removed: remove ? matchedIds.size : 0,
        total: Math.max(0, rows.length - (remove ? matchedIds.size : 0)),
      },
    };
  }

  private fail(message: string, error?: string): ToolOutput {
    return { success: false, message, error: error ?? message };
  }
}
