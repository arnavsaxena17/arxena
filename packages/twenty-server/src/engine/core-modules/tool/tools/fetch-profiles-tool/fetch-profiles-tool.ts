import { Injectable } from '@nestjs/common';

import { v4 } from 'uuid';
import { z } from 'zod';

import {
  FetchProfilesService,
  type FetchProfilesProgress,
} from 'src/engine/core-modules/tool/tools/fetch-profiles-tool/fetch-profiles.service';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const PROGRESS_HEARTBEAT_MS = 5_000;
const MAX_PROGRESS_LOGS = 5;

export const FetchProfilesInputZodSchema = z.object({
  projectId: z.string().describe('Project id from the browsing context'),
  outcomes: z
    .array(z.enum(['pass', 'fail', 'unknown']))
    .optional()
    .describe(
      'Fetch rows whose fitmentOutcome is one of these. Default ["pass", "unknown"]: rows that failed the snapshot score are not fetched. Add "fail" only to fetch rows that were marked fail while they had no profile. Rows with no fitmentOutcome yet are always fetched.',
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
  sources: z
    .array(z.enum(['bright_data', 'harvest']))
    .min(1)
    .optional()
    .describe(
      'Which providers to use. Default ["bright_data", "harvest"]. Pass ["bright_data"] to skip Harvest (validate-profiles).',
    ),
});

@Injectable()
export class FetchProfilesTool implements Tool {
  description = `Profile fetch for the whole People tab in one call: takes the LinkedIn URL of each person and stores the full profile (headline, about, experience, education, followers, connections, photo) on the row, in the "profile" column with its source and the parts the source returned. Bright Data Business Search by LinkedIn URL first (about 2 seconds for many profiles in parallel), then the slower Bright Data profile scrape for the people Business Search does not know. People with no LinkedIn URL are searched by name and company in Business Search, then in Google for the ones it misses, and a URL Google finds goes back through Business Search (resolvedLinkedinUrls counts both); Harvest for the ones Bright Data does not return (omit Harvest with sources: ["bright_data"]). Paid per profile, so pass rowLimit and fetch only people who passed or are unknown at the snapshot stage (the default). Takes up to about a minute and is resumable: people who already have a profile are skipped, so when remaining is above 0 call again. People without a LinkedIn URL are counted in skipped.noLinkedinUrl. Afterwards score again with preview_ai_column fitment stage "profile".`;

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

    const progressId = v4();
    const startedAt = Date.now();
    let latest: FetchProfilesProgress = {
      phase: 'Starting',
      fetched: 0,
      total: 0,
      lookupErrors: 0,
    };
    const logs: string[] = [];
    const log = (line: string) => {
      logs.push(`${new Date().toLocaleTimeString()} ${line}`);
      logs.splice(0, Math.max(0, logs.length - MAX_PROGRESS_LOGS));
    };
    const emit = (state: 'running' | 'completed' | 'error', message: string) =>
      context.onToolProgress?.({
        progressId,
        toolName: 'fetch_profiles',
        state,
        message,
        current: latest.fetched,
        total: latest.total,
        elapsedMs: Date.now() - startedAt,
        logs: [...logs],
      });
    const describe = () =>
      `${latest.phase}: ${latest.fetched} of ${latest.total} fetched, ${Math.round((Date.now() - startedAt) / 1000)}s elapsed` +
      (latest.lookupErrors > 0
        ? `, ${latest.lookupErrors} lookup(s) failed`
        : '');

    emit('running', 'Starting profile fetch');

    // A long call must not look frozen: say so every few seconds even when
    // no new profile has arrived
    const heartbeat = setInterval(
      () => emit('running', `${describe()}. Still working`),
      PROGRESS_HEARTBEAT_MS,
    );

    try {
      const result = await this.fetchProfilesService.fetch({
        workspaceId: context.workspaceId,
        ...parsed.data,
        onProgress: (progress) => {
          if (progress.lookupErrors > latest.lookupErrors) {
            log(`Lookup failed: ${progress.lastError ?? 'unknown error'}`);
          } else if (progress.phase !== latest.phase) {
            log(progress.phase);
          }

          latest = progress;
          emit('running', describe());
        },
      });
      const total = result.fetched.brightData + result.fetched.harvest;

      latest = {
        phase: 'Done',
        fetched: total,
        total: result.requested,
        lookupErrors: result.lookupErrors,
      };
      // Nothing came back and lookups kept failing: the provider is down, and
      // calling again only repeats minutes of timeouts
      if (total === 0 && result.lookupErrors > 0) {
        emit(
          'error',
          `No profiles fetched: ${result.lookupErrors} lookup(s) failed`,
        );

        return {
          success: false,
          message: 'Bright Data lookups are failing',
          error: `No profile could be fetched and ${result.lookupErrors} Bright Data lookup(s) failed on the network or API (not "not found"), so Bright Data looks unreachable or rate limiting. Stop: tell the user, do not retry now, and do not score or mark people who have no profile (a missing profile is unknown, not a fail).`,
        };
      }

      emit(
        'completed',
        `Fetched ${total} of ${result.requested} profile(s) in ${Math.round(result.durationMs / 1000)}s` +
          (result.remaining > 0 ? `, ${result.remaining} still waiting` : ''),
      );

      return {
        success: true,
        message:
          `Fetched ${total} of ${result.requested} profile(s) ` +
          `(${result.fetched.brightData} Bright Data, ${result.fetched.harvest} Harvest), ${result.failed.length} not found. ` +
          (result.lookupErrors > 0
            ? `WARNING: ${result.lookupErrors} Bright Data lookup(s) failed on the network or API (not "not found"), so Bright Data may be unreachable or rate limiting. Tell the user, do not score people who have no profile, and do not retry in a loop. `
            : '') +
          (result.remaining > 0
            ? `${result.remaining} still waiting: call again.`
            : 'None waiting.'),
        result,
      };
    } catch (error) {
      emit('error', 'Profile fetch failed');

      return {
        success: false,
        message: 'fetch_profiles failed',
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearInterval(heartbeat);
    }
  }
}
