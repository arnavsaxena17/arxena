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
    // Cleanup function for socket
    const cleanup = () => {
      if (socket) {
        console.log('Cleaning up WebSocket connection');
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
    };

    // Only connect if we have valid data and workspaceMemberId is not undefined/null
    if (!tokenPair?.accessToken?.token || !recruiterId || !currentWorkspaceMember?.name) {
      console.log('Missing required data for WebSocket connection:', {
        hasToken: !!tokenPair?.accessToken?.token,
        recruiterId,
        memberName: currentWorkspaceMember?.name
      });
      cleanup();
      return;
    }

    console.log('Connecting to WebSocket with valid credentials:', {
      recruiterId,
      hasToken: !!tokenPair?.accessToken?.token,
      memberName: currentWorkspaceMember.name
    });

    const socketInstance = io(process.env.REACT_APP_SERVER_BASE_URL || 'http://app.arxena.com', {
      query: { 
        token: tokenPair.accessToken.token,
        workspaceMemberId: recruiterId,
      },
      transports: ['websocket', 'polling'],
      path: '/general-socket',
    });
    
    socketInstance.on('connect', () => {
      console.log('Connected to general WebSocket server with recruiterId:', recruiterId);
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from general WebSocket server');
      setConnected(false);
    });
    
    socketInstance.on('connection_established', (data) => {
      console.log('General WebSocket connection established with data:', data);
    });
    
    socketInstance.on('metadata-structure-progress', (data) => {
      console.log('Received metadata structure progress:', data);
    });

    setSocket(socketInstance);

    // Cleanup on unmount or when dependencies change
    return cleanup;
  }, [tokenPair?.accessToken?.token, recruiterId, currentWorkspaceMember?.name]);

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