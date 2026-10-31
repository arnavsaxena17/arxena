import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, isNonEmptyArray } from 'twenty-shared/utils';

import {
  OUTREACH_CACHE_UPDATED_EVENT,
  outreachProjectCacheRoom,
  type OutreachAiColumnRunProgress,
  type OutreachCacheKind,
  type OutreachCachePersonRow,
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

  // `rows` names exactly what the write changed, so a client can apply the
  // delta. Left out, the event means "refetch": rows may have gone, not just
  // arrived.
  notifyProjectCacheUpdated(
    projectId: string,
    kind: OutreachCacheKind,
    rows?: OutreachCachePersonRow[],
  ): void {
    if (!isNonEmptyString(projectId)) {
      return;
    }

    if (kind === 'journey') {
      this.scheduleJourneyNotify(projectId);

      return;
    }

    this.emit(projectId, kind, isNonEmptyArray(rows) ? { rows } : {});
  }

  notifyAiColumnProgress(
    projectId: string,
    aiColumnRun: OutreachAiColumnRunProgress,
  ): void {
    this.emit(projectId, 'aiColumn', { aiColumnRun });
  }

  notifyTableViewUpdated(
    projectId: string,
    tableView: OutreachTableView,
  ): void {
    this.emit(projectId, 'tableView', { tableView });
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
    extra?: {
      aiColumnRun?: OutreachAiColumnRunProgress;
      tableView?: OutreachTableView;
      rows?: OutreachCachePersonRow[];
    },
  ): void {
    try {
      this.webSocketService.sendToRoom(
        outreachProjectCacheRoom(projectId),
        OUTREACH_CACHE_UPDATED_EVENT,
        {
          projectId,
          kind,
          ...(isDefined(extra?.aiColumnRun)
            ? { aiColumnRun: extra.aiColumnRun }
            : {}),
          ...(isDefined(extra?.tableView)
            ? { tableView: extra.tableView }
            : {}),
          ...(isDefined(extra?.rows) ? { rows: extra.rows } : {}),
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
