import { isNonEmptyString } from '@sniptt/guards';
import { useEffect } from 'react';

import {
  OUTREACH_CACHE_UPDATED_EVENT,
  outreachProjectCacheRoom,
  type OutreachCacheUpdatedPayload,
} from '@/outreach-home/constants/outreach-cache-realtime.constants';
import { useWebSocket } from '@/websocket-context/hooks/useWebSocket';
import { useWebSocketEvent } from '@/websocket-context/useWebSocketEvent';

type UseOutreachCacheSocketProps = {
  projectId: string | null;
  onPeopleUpdated: () => void;
  onCompaniesUpdated: () => void;
};

export const useOutreachCacheSocket = ({
  projectId,
  onPeopleUpdated,
  onCompaniesUpdated,
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

  useWebSocketEvent<OutreachCacheUpdatedPayload>(
    OUTREACH_CACHE_UPDATED_EVENT,
    (payload) => {
      if (payload.projectId !== projectId) {
        return;
      }

      if (payload.kind === 'people') {
        onPeopleUpdated();

        return;
      }

      onCompaniesUpdated();
    },
    [onCompaniesUpdated, onPeopleUpdated, projectId],
  );
};
