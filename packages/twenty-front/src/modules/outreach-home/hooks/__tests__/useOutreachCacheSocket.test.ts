import { renderHook } from '@testing-library/react';

import { useOutreachCacheSocket } from '@/outreach-home/hooks/useOutreachCacheSocket';
import { useWebSocket } from '@/websocket-context/hooks/useWebSocket';
import { useWebSocketEvent } from '@/websocket-context/useWebSocketEvent';

jest.mock('@/websocket-context/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(),
}));

jest.mock('@/websocket-context/useWebSocketEvent', () => ({
  useWebSocketEvent: jest.fn(),
}));

const mockedUseWebSocket = useWebSocket as jest.MockedFunction<
  typeof useWebSocket
>;
const mockedUseWebSocketEvent = useWebSocketEvent as jest.MockedFunction<
  typeof useWebSocketEvent
>;

describe('useOutreachCacheSocket', () => {
  it('should join the project cache room and refresh people on socket events', () => {
    const emit = jest.fn();
    const on = jest.fn();
    const off = jest.fn();
    const onPeopleUpdated = jest.fn();
    const onCompaniesUpdated = jest.fn();

    mockedUseWebSocket.mockReturnValue({
      socket: { emit, on, off } as never,
      connected: true,
      recruiterId: undefined,
      sendMessage: jest.fn(),
      sendMessageToRoom: jest.fn(),
    });

    renderHook(() =>
      useOutreachCacheSocket({
        projectId: 'project-1',
        onPeopleUpdated,
        onCompaniesUpdated,
      }),
    );

    expect(emit).toHaveBeenCalledWith('join_room', {
      room: 'outreach-project-project-1',
    });
    expect(on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockedUseWebSocketEvent).toHaveBeenCalledWith(
      'outreach-cache-updated',
      expect.any(Function),
      expect.any(Array),
    );

    const eventHandler = mockedUseWebSocketEvent.mock.calls[0][1];

    eventHandler({ projectId: 'project-1', kind: 'people' });
    expect(onPeopleUpdated).toHaveBeenCalledTimes(1);
    expect(onCompaniesUpdated).not.toHaveBeenCalled();

    eventHandler({ projectId: 'other-project', kind: 'people' });
    expect(onPeopleUpdated).toHaveBeenCalledTimes(1);
  });
});
