// src/contexts/WebSocketContext.tsx
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import React, { useContext, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { io, Socket } from 'socket.io-client';
import { WebSocketContext, WebSocketContextValue } from './WebSocketContext';

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [recruiterId, setRecruiterId] = useState<string | undefined>(undefined);
  const tokenPair = useRecoilValue(tokenPairState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  console.log("currentWorkspaceMember::", currentWorkspaceMember);
  useEffect(() => {
    if (!currentWorkspaceMember?.id) {
      return;
    }

    const socketURL = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:3000';
    const socketInstance = io(socketURL, {
      path: '/general-socket',
      query: {
        userId: currentWorkspaceMember?.id,
        userName: currentWorkspaceMember?.name.firstName +' '+ currentWorkspaceMember?.name.lastName,
        token: tokenPair?.accessToken?.token,
        origin: window?.location?.origin,
      },
    });

    socketInstance.on('connect', () => {
      console.log('Connected to WebSocket server with userId:', currentWorkspaceMember?.id);
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setConnected(false);
    });

    socketInstance.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    setSocket(socketInstance);

    return () => {
      console.log('Cleaning up socket connection');
      socketInstance.disconnect();
    };
  }, [currentWorkspaceMember?.id]);

  const sendMessage = (event: string, data: any) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  };

  const sendMessageToRoom = (event: string, data: any) => {
    if (socket && connected && recruiterId) {
      socket.emit(event, {
        recruiterId,
        message: data,
      });
    }
  };

  const contextValue: WebSocketContextValue = {
    socket,
    connected,
    recruiterId,
    sendMessage,
    sendMessageToRoom,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};