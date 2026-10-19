import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import { FetchProfilesService } from 'src/engine/core-modules/tool/tools/fetch-profiles-tool/fetch-profiles.service';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

export const FetchProfilesInputZodSchema = z.object({
  projectId: z.string().describe('Project id from the browsing context'),
  outcomes: z
    .array(z.enum(['pass', 'unknown']))
    .optional()
    .describe(
      'Fetch rows whose fitmentOutcome is one of these. Default ["pass", "unknown"]: rows that failed the snapshot score are never fetched. Rows with no fitmentOutcome yet are always fetched.',
    ),
  rowLimit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe('Most profiles to fetch in this call (default 100, max 500)'),
  refresh: z
    .boolean()
    .optional()
    .describe('true fetches again people who already have a profile'),
});

@Injectable()
export class FetchProfilesTool implements Tool {
  description = `Profile fetch for the whole People tab in one call: takes the LinkedIn URL of each person and stores the full profile (headline, about, experience, education, followers, connections, photo) on the row, in the "profile" column with its source and the parts the source returned. Bright Data first, many profiles in parallel; Harvest for the ones Bright Data does not return. Paid per profile, so pass rowLimit and fetch only people who passed or are unknown at the snapshot stage (the default). Takes up to about a minute and is resumable: people who already have a profile are skipped, so when remaining is above 0 call again. People without a LinkedIn URL are counted in skipped.noLinkedinUrl. Afterwards score again with preview_ai_column fitment stage "profile".`;

  inputSchema = FetchProfilesInputZodSchema;

  constructor(private readonly fetchProfilesService: FetchProfilesService) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = FetchProfilesInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid fetch_profiles input',
        error: parsed.error.message,
      };
    }

    try {
      const result = await this.fetchProfilesService.fetch({
        workspaceId: context.workspaceId,
        ...parsed.data,
      });
      const total = result.fetched.brightData + result.fetched.harvest;

      return {
        success: true,
        message:
          `Fetched ${total} of ${result.requested} profile(s) ` +
          `(${result.fetched.brightData} Bright Data, ${result.fetched.harvest} Harvest), ${result.failed.length} not found. ` +
          (result.remaining > 0
            ? `${result.remaining} still waiting: call again.`
            : 'None waiting.'),
        result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'fetch_profiles failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
