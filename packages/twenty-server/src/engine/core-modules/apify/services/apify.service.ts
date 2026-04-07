import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import { ApifyClient } from 'apify-client';

export type ApifyRunResult = {
  runId: string;
  status: string;
  defaultDatasetId: string;
};

export type ApifyActorDatasetItemsResult = {
  run: ApifyRunResult;
  items: Record<string, unknown>[] | null;
  logText: string | null;
};

export type ApifyRunLogProgressArgs = {
  runId: string;
  status: string;
  newLines: string[];
};

const APIFY_TERMINAL_RUN_STATUSES = new Set([
  'SUCCEEDED',
  'FAILED',
  'ABORTED',
  'TIMED-OUT',
]);

@Injectable()
export class ApifyService {
  private readonly logger = new Logger(ApifyService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    const token = this.environmentService.get('APIFY_API_TOKEN');
    return typeof token === 'string' && token.length > 0;
  }

  private getClient(): ApifyClient | null {
    const token = this.environmentService.get('APIFY_API_TOKEN');
    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }
    return new ApifyClient({ token });
  }

  async ensureActorExists(actorId: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    try {
      const actor = await client.actor(actorId).get();
      if (!actor) {
        throw new Error('apify actor not present');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        /not[\s-]?found/i.test(message) ||
        /does not exist/i.test(message) ||
        /404/.test(message)
      ) {
        throw new Error('apify actor not present');
      }

      throw error;
    }
  }

  /**
   * Run an Apify actor and wait for it to finish.
   */
  async runActor(
    actorId: string,
    input: Record<string, unknown>,
  ): Promise<ApifyRunResult | null> {
    const client = this.getClient();
    if (!client) {
      this.logger.warn('APIFY_API_TOKEN not configured, skipping actor run');
      return null;
    }

    try {
      const run = await client.actor(actorId).call(input);
      return {
        runId: run.id,
        status: run.status,
        defaultDatasetId: run.defaultDatasetId,
      };
    } catch (error) {
      this.logger.error(`Apify actor ${actorId} run failed`, error);
      return null;
    }
  }

  /**
   * Fetch run logs from Apify API.
   */
  async getRunLog(runId: string): Promise<string | null> {
    const token = this.environmentService.get('APIFY_API_TOKEN');
    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }

    try {
      const url = `https://api.apify.com/v2/actor-runs/${runId}/log?token=${encodeURIComponent(token)}`;
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Apify run log fetch failed: ${response.status}`);
        return null;
      }
      return await response.text();
    } catch (error) {
      this.logger.error(`Failed to fetch Apify run log for ${runId}`, error);
      return null;
    }
  }

  /**
   * List all items from a dataset (paginated).
   */
  async listDatasetItems(
    datasetId: string,
  ): Promise<Record<string, unknown>[] | null> {
    const client = this.getClient();
    if (!client) {
      return null;
    }
    const items: Record<string, unknown>[] = [];
    let offset = 0;
    const limit = 1000;
    try {
      for (;;) {
        const page = await client.dataset(datasetId).listItems({ offset, limit });
        const batch = page.items ?? [];
        for (const row of batch) {
          items.push(row as Record<string, unknown>);
        }
        if (batch.length < limit) {
          break;
        }
        offset += limit;
      }
      return items;
    } catch (error) {
      this.logger.error(`Apify dataset list failed for ${datasetId}`, error);
      return null;
    }
  }

  /**
   * Run an actor to completion and return all dataset rows.
   */
  async runActorAndListDatasetItems(
    actorId: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>[] | null> {
    const result = await this.runActorAndListDatasetItemsDetailed(actorId, input);

    return result?.items ?? null;
  }

  async runActorAndListDatasetItemsDetailed(
    actorId: string,
    input: Record<string, unknown>,
    options?: {
      /** When set, uses actor start + log polling so progress can be reported while the run executes. */
      onRunLogProgress?: (
        args: ApifyRunLogProgressArgs,
      ) => void | Promise<void>;
      pollIntervalMs?: number;
      maxPollMs?: number;
    },
  ): Promise<ApifyActorDatasetItemsResult | null> {
    await this.ensureActorExists(actorId);
    console.log("Running actor")
    if (options?.onRunLogProgress) {
      return this.runActorAndListDatasetItemsDetailedWithLogPolling(
        actorId,
        input,
        {
          onRunLogProgress: options.onRunLogProgress,
          pollIntervalMs: options.pollIntervalMs,
          maxPollMs: options.maxPollMs,
        },
      );
    }

    const runResult = await this.runActor(actorId, input);
    if (!runResult?.defaultDatasetId) {
      return null;
    }

    const [items, logText] = await Promise.all([
      this.listDatasetItems(runResult.defaultDatasetId),
      this.getRunLog(runResult.runId),
    ]);

    return {
      run: runResult,
      items,
      logText,
    };
  }

  /**
   * Start actor (non-blocking), poll run status + logs until terminal state, then load dataset.
   * Needed because {@link ActorClient.call} blocks until completion — no log lines are available mid-run.
   */
  private async runActorAndListDatasetItemsDetailedWithLogPolling(
    actorId: string,
    input: Record<string, unknown>,
    options: {
      onRunLogProgress: (
        args: ApifyRunLogProgressArgs,
      ) => void | Promise<void>;
      pollIntervalMs?: number;
      maxPollMs?: number;
    },
  ): Promise<ApifyActorDatasetItemsResult | null> {
    const client = this.getClient();
    if (!client) {
      this.logger.warn('APIFY_API_TOKEN not configured, skipping actor run');
      return null;
    }

    const pollIntervalMs = Math.max(
      800,
      options.pollIntervalMs ?? 2500,
    );
    const maxPollMs = options.maxPollMs ?? 3_600_000;
    const deadline = Date.now() + maxPollMs;

    console.log("Running actor and list dataset items detailed with log polling")
    let run = await client.actor(actorId).start(input);
    console.log("Run : ", run)
    const runId = run.id;
    const defaultDatasetId = run.defaultDatasetId;

    if (!defaultDatasetId) {
      this.logger.error(`Apify start returned no defaultDatasetId runId=${runId}`);
      return null;
    }

    let previousLog = '';

    while (Date.now() < deadline) {
      const runInfo = await client.run(runId).get();
      const status = runInfo?.status ?? 'UNKNOWN';
      console.log("Status : ", status)
      const fullLog = (await this.getRunLog(runId)) ?? '';
      console.log("Full Log : ", fullLog)
      const newLines = this.diffAppendLogLines(previousLog, fullLog);
      console.log("New Lines : ", newLines)
      previousLog = fullLog;

      if (newLines.length > 0) {
        await options.onRunLogProgress({ runId, status, newLines });
      }

      if (APIFY_TERMINAL_RUN_STATUSES.has(status)) {
        const [items, logText] = await Promise.all([
          this.listDatasetItems(defaultDatasetId),
          Promise.resolve(fullLog),
        ]);

        return {
          run: {
            runId,
            status,
            defaultDatasetId,
          },
          items,
          logText,
        };
      }

      await this.sleep(pollIntervalMs);
    }

    this.logger.error(
      `Apify run ${runId} polling exceeded maxPollMs=${maxPollMs}`,
    );
    return null;
  }

  private diffAppendLogLines(previous: string, current: string): string[] {
    if (!current) {
      return [];
    }
    if (!previous) {
      return current
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
    if (current.startsWith(previous)) {
      const appended = current.slice(previous.length);
      return appended
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
    return current
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
