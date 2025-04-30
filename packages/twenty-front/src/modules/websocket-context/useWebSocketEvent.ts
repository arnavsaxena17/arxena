// src/hooks/useWebSocketEvent.ts
import { useEffect, useRef } from 'react';
import { useWebSocket } from './websocketContext';

export function useWebSocketEvent<T>(
  eventName: string, 
  callback: (data: T) => void,
  deps: React.DependencyList = []
) {
  const { socket } = useWebSocket();
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!socket) return;

    const eventListener = (data: T) => {
      savedCallback.current(data);
    };

    socket.on(eventName, eventListener);

    return () => {
      socket.off(eventName, eventListener);
    };
  }, [eventName, socket, ...deps]);
}