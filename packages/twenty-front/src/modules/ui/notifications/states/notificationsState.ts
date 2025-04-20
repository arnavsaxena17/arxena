import { Notification } from '@/ui/notifications/types/Notification';
import { createState } from '@ui/utilities/state/utils/createState';

// Sample notifications for testing
const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'New task assigned',
    message: 'You have been assigned a new task: "Complete quarterly report"',
    type: 'info',
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    read: false,
  },
  {
    id: '2',
    title: 'Meeting reminder',
    message: 'Your meeting with the team starts in 15 minutes',
    type: 'warning',
    createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    read: false,
  },
  {
    id: '3',
    title: 'Project completed',
    message: 'The project "Website Redesign" has been marked as completed',
    type: 'success',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    read: false,
  },
];

export const notificationsState = createState<Notification[]>({
  key: 'ui/notifications',
  defaultValue: mockNotifications,
}); 