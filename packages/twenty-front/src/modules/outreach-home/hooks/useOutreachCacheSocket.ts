import { isNonEmptyString } from '@sniptt/guards';
import { useEffect } from 'react';
import { isNonEmptyArray } from 'twenty-shared/utils';

import {
  OUTREACH_CACHE_UPDATED_EVENT,
  outreachProjectCacheRoom,
  type OutreachAiColumnRunProgress,
  type OutreachCacheUpdatedPayload,
  type OutreachTableView,
} from '@/outreach-home/constants/outreach-cache-realtime.constants';
import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
import { useWebSocket } from '@/websocket-context/hooks/useWebSocket';
import { useWebSocketEvent } from '@/websocket-context/useWebSocketEvent';

type UseOutreachCacheSocketProps = {
  projectId: string | null;
  onPeopleUpdated: () => void;
  onCompaniesUpdated: () => void;
  onJourneyUpdated?: () => void;
  onAiColumnProgress?: (run: OutreachAiColumnRunProgress) => void;
  onTableViewUpdated?: (view: OutreachTableView) => void;
  // The rows a write added or updated. The tab applies just these instead of
  // refetching the whole list
  onPeopleRowsAppended?: (rows: OutreachPersonRow[]) => void;
  // Called after a dropped connection, to heal whatever the gap lost
  onResync?: () => void;
};

export const useOutreachCacheSocket = ({
  projectId,
  onPeopleUpdated,
  onCompaniesUpdated,
  onJourneyUpdated,
  onAiColumnProgress,
  onTableViewUpdated,
  onPeopleRowsAppended,
  onResync,
}: UseOutreachCacheSocketProps) => {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket || !isNonEmptyString(projectId)) {
      return;
    }

    const room = outreachProjectCacheRoom(projectId);
    const joinRoom = () => {
      socket.emit('join_room', { room });
    };

    joinRoom();
    socket.on('connect', joinRoom);

    return () => {
      socket.off('connect', joinRoom);
      socket.emit('leave_room', { room });
    };
  }, [projectId, socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    let hasConnected = false;
    // Events emitted while the socket was down are gone, so the connection
    // coming back re-reads the list
    const resyncOnReconnect = () => {
      if (hasConnected) {
        onResync?.();
      }

      hasConnected = true;
    };

    socket.on('connect', resyncOnReconnect);

    return () => {
      socket.off('connect', resyncOnReconnect);
    };
  }, [socket, onResync]);

  useWebSocketEvent<OutreachCacheUpdatedPayload>(
    OUTREACH_CACHE_UPDATED_EVENT,
    (payload) => {
      if (payload.projectId !== projectId) {
        return;
      }

      if (payload.kind === 'people') {
        if (isNonEmptyArray(payload.rows) && onPeopleRowsAppended) {
          onPeopleRowsAppended(payload.rows);

          return;
        }

        onPeopleUpdated();

        return;
      }

      if (payload.kind === 'tableView') {
        if (payload.tableView) {
          onTableViewUpdated?.(payload.tableView);
        }

        return;
      }

      if (payload.kind === 'aiColumn') {
        if (payload.aiColumnRun) {
          onAiColumnProgress?.(payload.aiColumnRun);
        }

        return;
      }

      if (payload.kind === 'journey') {
        onJourneyUpdated?.();

        return;
      }

      onCompaniesUpdated();
    },
    [
      onAiColumnProgress,
      onCompaniesUpdated,
      onJourneyUpdated,
      onPeopleRowsAppended,
      onPeopleUpdated,
      onTableViewUpdated,
      projectId,
    ],
  );
};
