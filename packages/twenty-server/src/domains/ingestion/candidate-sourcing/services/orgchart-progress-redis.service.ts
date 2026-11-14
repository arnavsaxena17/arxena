import { Injectable, Logger } from '@nestjs/common';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';

/** Redis channel prefix; full channel = orgchart_progress:{workspaceMemberId} */
export const ORGCHART_PROGRESS_CHANNEL_PREFIX = 'orgchart_progress:';

export type OrgChartSearchProgressSocketPayload = {
  event: string;
  requestId?: string;
  mode?: string;
  searchType?: string;
  companyName?: string;
  data: Record<string, unknown>;
};

/**
 * Publishes org-chart search progress to Redis so the HTTP process can forward it over Socket.IO.
 * Queue workers do not have a Socket.IO server; direct sendToUser is a no-op there.
 */
@Injectable()
export class OrgChartProgressRedisService {
  private readonly logger = new Logger(OrgChartProgressRedisService.name);

  constructor(private readonly redisClientService: RedisClientService) {}

  async publish(
    workspaceMemberId: string,
    payload: OrgChartSearchProgressSocketPayload,
  ): Promise<void> {
    const channel = `${ORGCHART_PROGRESS_CHANNEL_PREFIX}${workspaceMemberId}`;
    const message = JSON.stringify(payload);
    try {
      const client = this.redisClientService.getClient();
      const n = await client.publish(channel, message);
      this.logger.debug(
        `Published orgchart progress to ${channel} (subscribers=${n})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish orgchart progress to ${channel}`,
        error,
      );
    }
  }
}
