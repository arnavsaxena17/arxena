import { Injectable } from '@nestjs/common';

import { SaveOutreachTargetsToCrmService } from 'src/engine/core-modules/outreach-command/services/save-outreach-targets-to-crm.service';
import {
  type SaveOutreachTargetsToCrmToolInput,
  SaveOutreachTargetsToCrmInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-save-to-crm-tool/save-outreach-targets-to-crm-tool.schema';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class SaveOutreachTargetsToCrmTool implements Tool {
  description = `Save the ephemeral Companies / People tab rows of a project as plain CRM Company and Person records. This is "Save to CRM": it never creates a Candidate and never enrolls anyone.
Use it only after the user confirms they want the Find results saved to the CRM. To enroll people in outreach, use the enroll flow instead.
Rows already in the CRM (matched by LinkedIn URL for people, domain / LinkedIn / name for companies) are linked, not duplicated. People without a LinkedIn URL are skipped.
Pass projectId from the outreachCommand browsing context; pass companyIds / personIds for selected rows, or omit them to save the whole tab.`;

  inputSchema = SaveOutreachTargetsToCrmInputZodSchema;

  constructor(
    private readonly saveOutreachTargetsToCrmService: SaveOutreachTargetsToCrmService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult =
      SaveOutreachTargetsToCrmInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid save_outreach_targets_to_crm input',
        error: parseResult.error.message,
      };
    }

    const input: SaveOutreachTargetsToCrmToolInput = parseResult.data;

    try {
      const result = await this.saveOutreachTargetsToCrmService.execute({
        workspaceId: context.workspaceId,
        input,
      });

      if (!result.success) {
        return {
          success: false,
          message: 'Nothing was saved to the CRM',
          error: result.error,
        };
      }

      return {
        success: true,
        message: `Saved to CRM. Companies: ${result.companies.created} created, ${result.companies.matched} already existed. People: ${result.people.created} created, ${result.people.matched} already existed, ${result.people.skipped} skipped. No Candidates were created.`,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        message: `Failed to save to CRM: ${message}`,
        error: message,
      };
    }
  }
}
