import styled from '@emotion/styled';
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { Button, IconCheck } from 'twenty-ui';

import { notificationsState } from '../states/notificationsState';
import { NotificationItem } from './NotificationItem';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledNoNotifications = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(8)};
  color: ${({ theme }) => theme.font.color.light};
  text-align: center;
  height: 100%;
`;

const StyledNoNotificationsTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledNoNotificationsSubtitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

export const NotificationsDrawer = () => {
  const [notifications, setNotifications] = useRecoilState(notificationsState);

  const hasUnreadNotifications = notifications.some(
    (notification) => !notification.read,
  );

  const handleMarkAllAsRead = useCallback(() => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) => ({
        ...notification,
        read: true,
      })),
    );
  }, [setNotifications]);

  const handleNotificationClick = useCallback(
    (notificationId: string) => {
      setNotifications((prevNotifications) =>
        prevNotifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification,
        ),
      );
    },
    [setNotifications],
  );

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledTitle>Notifications</StyledTitle>
        {hasUnreadNotifications && (
          <Button
            title="Mark all as read"
            Icon={IconCheck}
            variant="secondary"
            size="small"
            onClick={handleMarkAllAsRead}
          />
        )}
      </StyledHeader>

      {notifications.length === 0 ? (
        <StyledNoNotifications>
          <StyledNoNotificationsTitle>
            No notifications yet
          </StyledNoNotificationsTitle>
          <StyledNoNotificationsSubtitle>
            When you get notifications, they'll show up here
          </StyledNoNotificationsSubtitle>
        </StyledNoNotifications>
      ) : (
        notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClick={() => handleNotificationClick(notification.id)}
          />
        ))
      )}
    </StyledContainer>
  );
}; 