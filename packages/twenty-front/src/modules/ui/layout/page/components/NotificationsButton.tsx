import { isRightDrawerOpenState } from '@/ui/layout/right-drawer/states/isRightDrawerOpenState';
import { rightDrawerPageState } from '@/ui/layout/right-drawer/states/rightDrawerPageState';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { notificationsState } from '@/ui/notifications/states/notificationsState';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { Button, IconBell, IconButton, useIsMobile } from 'twenty-ui';
import { FeatureFlagKey } from '~/generated/graphql';

const StyledNotificationBadge = styled.div`
  position: absolute;
  top: -4px;
  right: -4px;
  background-color: ${({ theme }) => theme.color.red};
  color: ${({ theme }) => theme.background.primary};
  border-radius: 50%;
  min-height: ${({ theme }) => theme.spacing(4)};
  min-width: ${({ theme }) => theme.spacing(4)};
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledButtonContainer = styled.div`
  position: relative;
`;

type NotificationsButtonProps = {
  onClick?: () => void;
  notificationsCount?: number;
};

export const NotificationsButton = ({ 
  onClick,
  notificationsCount,
}: NotificationsButtonProps) => {
  const isCommandMenuV2Enabled = useIsFeatureEnabled(
    FeatureFlagKey.IsCommandMenuV2Enabled,
  );
  const isMobile = useIsMobile();
  const setIsRightDrawerOpen = useSetRecoilState(isRightDrawerOpenState);
  const setRightDrawerPage = useSetRecoilState(rightDrawerPageState);
  const notifications = useRecoilValue(notificationsState);

  // If notificationsCount is explicitly provided, use it, otherwise calculate from state
  const unreadCount = notificationsCount !== undefined
    ? notificationsCount
    : notifications.filter(notification => !notification.read).length;

  const { t } = useLingui();

  const handleNotificationsClick = () => {
    // Open the right drawer with the Notifications page
    setRightDrawerPage(RightDrawerPages.Notifications);
    setIsRightDrawerOpen(true);
    
    // Call the provided onClick handler if it exists
    if (onClick) {
      onClick();
    }
  };

  return (
    <>
      {isCommandMenuV2Enabled ? (
        <StyledButtonContainer>
          <Button
            Icon={IconBell}
            dataTestId="notifications-button"
            size={isMobile ? 'medium' : 'small'}
            variant="secondary"
            accent="default"
            title={isMobile ? '' : t`Notifications`}
            onClick={handleNotificationsClick}
            ariaLabel={t`Notifications`}
          />
          {unreadCount > 0 && (
            <StyledNotificationBadge>{unreadCount}</StyledNotificationBadge>
          )}
        </StyledButtonContainer>
      ) : (
        <StyledButtonContainer>
          <IconButton
            Icon={IconBell}
            dataTestId="notifications-button"
            size="medium"
            variant="secondary"
            accent="default"
            ariaLabel={t`Notifications`}
            onClick={handleNotificationsClick}
          />
          {unreadCount > 0 && (
            <StyledNotificationBadge>{unreadCount}</StyledNotificationBadge>
          )}
        </StyledButtonContainer>
      )}
    </>
  );
};
