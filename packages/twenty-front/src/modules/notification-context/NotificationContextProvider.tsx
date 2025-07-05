import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWebSocketEvent } from '../websocket-context/useWebSocketEvent';

type NotificationOptions = {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
};

type NotificationContextType = {
  showNotification: (options: NotificationOptions) => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

type NotificationProviderProps = {
  children: React.ReactNode;
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }
    setPermission(Notification.permission);
  }, []);

  // Listen for notification events from WebSocket
  useWebSocketEvent<NotificationOptions>(
    'show_notification',
    async (data) => {
      await showNotification(data);
    },
    []
  );

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied' as NotificationPermission;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied' as NotificationPermission;
    }
  };

  const showNotification = async (options: NotificationOptions) => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    if (permission !== 'granted') {
      const newPermission = await requestPermission();
      if (newPermission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
      }
    }

    try {
      new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        requireInteraction: options.requireInteraction
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{ showNotification, requestPermission }}>
      {children}
    </NotificationContext.Provider>
  );
}; 