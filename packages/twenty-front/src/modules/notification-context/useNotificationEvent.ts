import { useEffect } from 'react';
import { useNotification } from './NotificationContextProvider';

type NotificationEventCallback<T> = (data: T) => void;

export function useNotificationEvent<T>(
  eventName: string,
  callback: NotificationEventCallback<T>,
  deps: React.DependencyList = []
) {
  const { showNotification } = useNotification();

  useEffect(() => {
    const handleNotification = async (data: T) => {
      if (callback) {
        callback(data);
      }

      // If the data includes notification properties, show the notification
      if (typeof data === 'object' && data !== null) {
        const notificationData = data as any;
        if (notificationData.title && notificationData.body) {
          await showNotification({
            title: notificationData.title,
            body: notificationData.body,
            icon: notificationData.icon,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction
          });
        }
      }
    };

    // You can add additional event listeners or WebSocket handlers here if needed
    return () => {
      // Cleanup if needed
    };
  }, [callback, showNotification, ...deps]);
} 