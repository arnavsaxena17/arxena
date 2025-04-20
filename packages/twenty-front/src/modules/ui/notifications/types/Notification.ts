export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: Date;
  read: boolean;
  link?: string;
}; 