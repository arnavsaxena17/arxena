import { Injectable } from '@nestjs/common';

import { OutreachAiColumnService } from 'src/engine/core-modules/outreach-command/services/outreach-ai-column.service';
import { OUTREACH_SAMPLE_MESSAGE_COLUMN_KEY } from 'src/engine/core-modules/outreach-command/types/outreach-sample-message.types';
import { PreviewSampleMessageColumnInputZodSchema } from 'src/engine/core-modules/tool/tools/outreach-sample-message-tool/preview-sample-message-column-schema';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class PreviewSampleMessageColumnTool implements Tool {
  description = `Preview a "Sample LinkedIn message" AI column: a draft of the first LinkedIn message (the opener sent after a prospect accepts the connection) for each person in the project working set, written with the same prompt and agent as the seeded Candidate Sequencer. Nothing is sent. Choose the context with include flags: senderProfile, prospectEnrichment, profile (one live Unipile call per row), posts, chatHistory, companyNews (off by default; adds a cached web-search lookup). Previews up to 5 rows and returns the drafts plus a previewId. Show the drafts, ask the user whether to run it for all rows, and only then call run_ai_column with the previewId: the messages then appear in a new table column. Do not use for follow-ups or replies.`;

  inputSchema = PreviewSampleMessageColumnInputZodSchema;

  constructor(
    private readonly outreachAiColumnService: OutreachAiColumnService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed =
      PreviewSampleMessageColumnInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid preview_sample_message_column input',
        error: parsed.error.message,
      };
    }

    try {
      const preview = await this.outreachAiColumnService.preview({
        workspaceId: context.workspaceId,
        projectId: parsed.data.projectId,
        subject: 'person',
        rowLimit: parsed.data.rowLimit,
        filter: {
          name: 'Sample LinkedIn message',
          prompt: 'Draft the first LinkedIn message for this prospect.',
          // Not an LLM model id: marks the column as drafted by the opener agent.
          selectedModel: 'linkedin-message-agent',
          fields: [
            {
              name: OUTREACH_SAMPLE_MESSAGE_COLUMN_KEY,
              type: 'text',
              description: 'Draft of the first LinkedIn message',
            },
          ],
          selectedMetadataFields: ['name'],
          sampleMessage: { include: parsed.data.include ?? {} },
        },
      });

      return {
        success: true,
        message: `Drafted ${preview.rows.length} of ${preview.total} row(s). Nothing was sent. Ask the user before running for all.`,
        result: preview,
      };
    } catch (error) {
      return {
        success: false,
        message: 'preview_sample_message_column failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
