import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import {
  WriteLinkedinUrlToolInputZodSchema,
  type WriteLinkedinUrlToolInput,
} from 'src/engine/core-modules/tool/tools/write-linkedin-url-tool/types/write-linkedin-url-tool-input.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class WriteLinkedinUrlTool implements Tool {
  private readonly logger = new Logger(WriteLinkedinUrlTool.name);

  constructor(private readonly outreachTabService: OutreachTabService) {}

  description =
    'Write a resolved LinkedIn URL onto one existing People-tab row (by row id). Use it after resolve_linkedin_url, so the URL and its evidence land on the row without fetching the full profile. The row keeps its name, title and company; the resolution (url, relation current/past/unknown, source, evidence) is stored under otherFields.linkedinResolution. Ephemeral rows only: a CRM-backed row is not updated here.';
  inputSchema = WriteLinkedinUrlToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = WriteLinkedinUrlToolInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Failed to write LinkedIn URL',
        error: parsed.error.message,
      };
    }

    const input = parsed.data as WriteLinkedinUrlToolInput;
    const projectId = isNonEmptyString(input.projectId)
      ? input.projectId
      : context.projectId;

    if (!isNonEmptyString(projectId)) {
      return {
        success: false,
        message: 'Failed to write LinkedIn URL',
        error: 'projectId is required',
      };
    }

    try {
      const updated =
        await this.outreachTabService.updateEphemeralPersonLinkedinUrl({
          workspaceId: context.workspaceId,
          projectId,
          personId: input.personId,
          linkedinUrl: input.linkedinUrl,
          relation: input.relation,
          evidence: input.evidence,
          source: input.source,
        });

      if (updated === null) {
        return {
          success: false,
          message: `No People-tab row with id ${input.personId}`,
          error: 'Row not found; it may have been removed or deduped',
        };
      }

      return {
        success: true,
        message: `Wrote ${input.relation} LinkedIn URL to ${updated.name} (${updated.companyName})`,
        result: {
          id: updated.id,
          name: updated.name,
          companyName: updated.companyName,
          linkedinUrl: updated.linkedinUrl,
          relation: input.relation,
          resolution: updated.otherFields?.linkedinResolution ?? null,
        },
      };
    } catch (error) {
      this.logger.error('Write LinkedIn URL failed', error);

      return {
        success: false,
        message: 'Failed to write LinkedIn URL',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
