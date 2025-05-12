// src/contexts/WebSocketContext.tsx
import { tokenPairState } from '@/auth/states/tokenPairState';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  connected: boolean;
  sendMessage: (event: string, data: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  connected: false,
  sendMessage: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const tokenPair = useRecoilValue(tokenPairState);
  
  useEffect(() => {
    // Only connect if we have a token
    if (!tokenPair?.accessToken?.token) {
      return;
    }
    
    console.log('Connecting to WebSocket with auth token');
    
    const socketInstance = io(process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3000', {
      query: {
        token: tokenPair.accessToken.token
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
    });
    
    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket server');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setConnected(false);
    });
    
    socketInstance.on('connection_established', (data) => {
      console.log('WebSocket connection established:', data);
    });
    
    socketInstance.on('metadata-structure-progress', (data) => {
      console.log('Received metadata structure progress:', data);
    });

    setSocket(socketInstance);

    return () => {
      console.log('Disconnecting WebSocket');
      socketInstance.disconnect();
    };
  }, [tokenPair?.accessToken?.token]);

  const sendMessage = (event: string, data: any) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, connected, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};