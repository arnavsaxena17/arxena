import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  OUTREACH_CACHE_UPDATED_EVENT,
  outreachProjectCacheRoom,
  type OutreachAiColumnRunProgress,
  type OutreachCacheKind,
  type OutreachTableView,
} from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';
import { WebSocketService } from 'src/modules/websocket/websocket.service';

const JOURNEY_NOTIFY_DEBOUNCE_MS = 400;

@Injectable()
export class OutreachCacheRealtimeService {
  private readonly logger = new Logger(OutreachCacheRealtimeService.name);
  private readonly journeyNotifyTimeoutByProjectId = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(private readonly webSocketService: WebSocketService) {}

  notifyProjectCacheUpdated(projectId: string, kind: OutreachCacheKind): void {
    if (!isNonEmptyString(projectId)) {
      return;
    }

    if (kind === 'journey') {
      this.scheduleJourneyNotify(projectId);

      return;
    }

    this.emit(projectId, kind);
  }

  notifyAiColumnProgress(
    projectId: string,
    aiColumnRun: OutreachAiColumnRunProgress,
  ): void {
    this.emit(projectId, 'aiColumn', aiColumnRun);
  }

  notifyTableViewUpdated(projectId: string, tableView: OutreachTableView): void {
    this.emit(projectId, 'tableView', undefined, tableView);
  }

  private scheduleJourneyNotify(projectId: string): void {
    const existingTimeout = this.journeyNotifyTimeoutByProjectId.get(projectId);

    if (isDefined(existingTimeout)) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.journeyNotifyTimeoutByProjectId.delete(projectId);
      this.emit(projectId, 'journey');
    }, JOURNEY_NOTIFY_DEBOUNCE_MS);

    this.journeyNotifyTimeoutByProjectId.set(projectId, timeout);
  }

  private emit(
    projectId: string,
    kind: OutreachCacheKind,
    aiColumnRun?: OutreachAiColumnRunProgress,
    tableView?: OutreachTableView,
  ): void {
    try {
      this.webSocketService.sendToRoom(
        outreachProjectCacheRoom(projectId),
        OUTREACH_CACHE_UPDATED_EVENT,
        {
          projectId,
          kind,
          ...(isDefined(aiColumnRun) ? { aiColumnRun } : {}),
          ...(isDefined(tableView) ? { tableView } : {}),
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
