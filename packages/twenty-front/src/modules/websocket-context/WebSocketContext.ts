import { createContext } from 'react';
import { Socket } from 'socket.io-client';

export interface WebSocketContextValue {
  socket: Socket | null;
  connected: boolean;
  recruiterId: string | undefined;
  sendMessage: (event: string, data: any) => void;
  sendMessageToRoom: (event: string, data: any) => void;
}

export const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  connected: false,
  recruiterId: undefined,
  sendMessage: () => {},
  sendMessageToRoom: () => {},
}); 