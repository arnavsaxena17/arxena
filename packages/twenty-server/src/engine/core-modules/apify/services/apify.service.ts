import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import { ApifyClient } from 'apify-client';

export type ApifyRunResult = {
  runId: string;
  status: string;
  defaultDatasetId: string;
};

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
}
