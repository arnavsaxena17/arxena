import styled from '@emotion/styled';
import { formatDistanceToNow } from 'date-fns';
import {
    IconAlertCircle,
    IconAlertTriangle,
    IconCheck,
    IconInfoCircle,
} from 'twenty-ui';

import { Notification, NotificationType } from '../types/Notification';

const StyledNotificationItem = styled.div<{
  isRead: boolean;
}>`
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme, isRead }) =>
    isRead ? theme.background.primary : theme.background.secondary};
  cursor: pointer;
  transition: background-color 0.1s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  flex-grow: 1;
`;

const StyledTime = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledMessage = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledIconContainer = styled.div<{
  type: NotificationType;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme, type }) => {
    switch (type) {
      case 'info':
        return theme.color.blue;
      case 'success':
        return theme.color.green;
      case 'warning':
        return theme.color.orange;
      case 'error':
        return theme.color.red;
      default:
        return theme.color.blue;
    }
  }};
`;

type NotificationItemProps = {
  notification: Notification;
  onClick?: () => void;
};

export const NotificationItem = ({
  notification,
  onClick,
}: NotificationItemProps) => {
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'info':
        return <IconInfoCircle size={16} />;
      case 'success':
        return <IconCheck size={16} />;
      case 'warning':
        return <IconAlertTriangle size={16} />;
      case 'error':
        return <IconAlertCircle size={16} />;
      default:
        return <IconInfoCircle size={16} />;
    }
  };

  return (
    <StyledNotificationItem 
      isRead={notification.read}
      onClick={onClick}
    >
      <StyledHeader>
        <StyledIconContainer type={notification.type}>
          {getIcon(notification.type)}
        </StyledIconContainer>
        <StyledTitle>{notification.title}</StyledTitle>
        <StyledTime>
          {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
        </StyledTime>
      </StyledHeader>
      <StyledMessage>{notification.message}</StyledMessage>
    </StyledNotificationItem>
  );
}; 