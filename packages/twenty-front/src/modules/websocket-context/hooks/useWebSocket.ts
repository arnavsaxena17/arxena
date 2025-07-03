import { useContext } from 'react';
import { WebSocketContext, WebSocketContextValue } from '../WebSocketContext';

export const useWebSocket = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  
  return context;
}; 