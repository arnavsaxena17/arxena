import { Injectable } from '@nestjs/common';

import { OutreachProjectOutreachControlService } from 'src/engine/core-modules/outreach-command/services/outreach-project-outreach-control.service';
import {
  type StartOutreachInput,
  StartOutreachInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-start-tool/start-outreach-tool.schema';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class StartOutreachTool implements Tool {
  description = `Start outreach (the Candidate Sequencer) for enrolled prospects of a project. Same effect as the Start Outreach record action: sets candidateFlags.startOutreach=true so the sequencer fires.
Use this when the user says "start outreach" on /outreach-home. Treat that as execute authorization; do not ask again.
Scope: pass candidateIds from selectedCandidateIds when rows are selected; otherwise personIds from selectedPersonIds; only when the user asked for the whole table and nothing is selected pass startAllQueuedInProject=true.
Prospects must already be enrolled (Candidates). If none are, enroll first (upload-profiles), then call this tool.`;

  inputSchema = StartOutreachInputZodSchema;

  constructor(
    private readonly outreachProjectOutreachControlService: OutreachProjectOutreachControlService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult = StartOutreachInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid start_outreach input',
        error: parseResult.error.message,
      };
    }

    const input: StartOutreachInput = parseResult.data;

    try {
      const { startedCandidates } =
        await this.outreachProjectOutreachControlService.startCandidates({
          workspaceId: context.workspaceId,
          candidateIds: input.candidateIds,
          personIds: input.personIds,
          projectId: input.projectId,
          startAllQueuedInProject: input.startAllQueuedInProject,
        });

      return {
        success: true,
        message:
          startedCandidates === 0
            ? 'No enrolled prospects were started. They may not be enrolled as Candidates yet, or were already started/stopped.'
            : `Started outreach for ${startedCandidates} prospect(s). The Candidate Sequencer runs next; follow it with list_workflow_runs.`,
        result: { projectId: input.projectId, startedCandidates },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        message: `Failed to start outreach: ${message}`,
        error: message,
      };
    }
  }
}
