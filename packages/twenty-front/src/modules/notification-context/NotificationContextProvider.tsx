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

const noopNotificationContext: NotificationContextType = {
  showNotification: async () => {
    console.warn('useNotification: NotificationProvider is not mounted; skipping notification');
  },
  requestPermission: async () => 'denied' as NotificationPermission,
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Avoid crashing the page (e.g. Vite HMR context identity mismatch).
    // Browser notifications are optional; prefer a no-op over an error boundary.
    console.warn('useNotification must be used within a NotificationProvider');
    return noopNotificationContext;
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

  // Listen for WhatsApp message failure events
  useWebSocketEvent<{
    phoneNumber: string;
    message: string;
    error: string;
    timestamp: string;
    jid: string;
  }>(
    'whatsapp_message_failed',
    async (data) => {
      console.log('WhatsApp message failed:', data);
      
      // Show browser notification for WhatsApp failure
      await showNotification({
        title: 'WhatsApp Message Failed',
        body: `Failed to send message to ${data.phoneNumber}. ${data.error}`,
        icon: '/favicon.ico',
        tag: `whatsapp-failed-${data.phoneNumber}`,
        requireInteraction: true
      });
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