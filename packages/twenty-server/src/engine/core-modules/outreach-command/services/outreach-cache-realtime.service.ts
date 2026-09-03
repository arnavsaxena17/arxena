import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import {
  OUTREACH_CACHE_UPDATED_EVENT,
  outreachProjectCacheRoom,
  type OutreachCacheKind,
} from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';
import { WebSocketService } from 'src/modules/websocket/websocket.service';

@Injectable()
export class OutreachCacheRealtimeService {
  private readonly logger = new Logger(OutreachCacheRealtimeService.name);

  constructor(private readonly webSocketService: WebSocketService) {}

  notifyProjectCacheUpdated(
    projectId: string,
    kind: OutreachCacheKind,
  ): void {
    if (!isNonEmptyString(projectId)) {
      return;
    }

    try {
      this.webSocketService.sendToRoom(
        outreachProjectCacheRoom(projectId),
        OUTREACH_CACHE_UPDATED_EVENT,
        {
          projectId,
          kind,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to emit ${OUTREACH_CACHE_UPDATED_EVENT} for ${kind} ${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
