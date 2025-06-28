// src/contexts/WebSocketContext.tsx
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  connected: boolean;
  recruiterId: string | null;
  sendMessage: (event: string, data: any) => void;
  sendMessageToRoom: (event: string, data: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  connected: false,
  recruiterId: null,
  sendMessage: () => {},
  sendMessageToRoom: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const tokenPair = useRecoilValue(tokenPairState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const recruiterId = currentWorkspaceMember?.id || null;
  
  useEffect(() => {
    // Only connect if we have a token and recruiterId
    if (!tokenPair?.accessToken?.token || !recruiterId) {
      return;
    }

    console.log('Connecting to WebSocket with auth token to process.env.REACT_APP_SERVER_BASE_URL', process.env.REACT_APP_SERVER_BASE_URL);
    const socketInstance = io(process.env.REACT_APP_SERVER_BASE_URL || 'http://app.arxena.com', {
      query: { 
        token: tokenPair.accessToken.token,
        workspaceMemberId: recruiterId,
      },
      transports: ['websocket', 'polling'],
      path: '/baileys-socket',
    });
    
    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket server in websocket context provider');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from WebSocket server in websocket context provider');
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
  }, [tokenPair?.accessToken?.token, recruiterId]);

  const sendMessage = (event: string, data: any) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  const sendMessageToRoom = (event: string, data: any) => {
    if (socket && recruiterId) {
      socket.emit(event, {
        recruiterId,
        message: data,
      });
    }
  };

  return (
    <WebSocketContext.Provider 
      value={{ 
        socket, 
        connected, 
        recruiterId,
        sendMessage,
        sendMessageToRoom,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};