import { InformationBannerBillingSubscriptionPaused } from '@/information-banner/components/billing/InformationBannerBillingSubscriptionPaused';
import { InformationBannerFailPaymentInfo } from '@/information-banner/components/billing/InformationBannerFailPaymentInfo';
import { InformationBannerNoBillingSubscription } from '@/information-banner/components/billing/InformationBannerNoBillingSubscription';
import { InformationBannerLinkedinUnipileAutoConnect } from '@/information-banner/components/InformationBannerLinkedinUnipileAutoConnect';
import { InformationBannerReconnectAccountEmailAliases } from '@/information-banner/components/reconnect-account/InformationBannerReconnectAccountEmailAliases';
import { InformationBannerReconnectAccountInsufficientPermissions } from '@/information-banner/components/reconnect-account/InformationBannerReconnectAccountInsufficientPermissions';
import { useIsWorkspaceActivationStatusSuspended } from '@/workspace/hooks/useIsWorkspaceActivationStatusSuspended';
import { useSubscriptionStatus } from '@/workspace/hooks/useSubscriptionStatus';
import styled from '@emotion/styled';
import { isDefined } from 'twenty-shared';
import { MOBILE_VIEWPORT } from 'twenty-ui';
import { SubscriptionStatus } from '~/generated-metadata/graphql';

const StyledInformationBannerWrapper = styled.div`
  min-height: 32px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.background.tertiary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  box-shadow: 0 1px 0 ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(1)};
  padding-left: 0;
  padding-right: ${({ theme }) => theme.spacing(3)};
  gap: ${({ theme }) => theme.spacing(1)};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    box-sizing: border-box;
    padding: ${({ theme }) => theme.spacing(2)};
  }

  &:empty {
    min-height: 0;
    display: none;
  }
`;

export const InformationBannerWrapper = () => {
  const subscriptionStatus = useSubscriptionStatus();
  const isWorkspaceSuspended = useIsWorkspaceActivationStatusSuspended();

  const displayBillingSubscriptionPausedBanner =
    isWorkspaceSuspended && subscriptionStatus === SubscriptionStatus.Paused;

  const displayBillingSubscriptionCanceledBanner =
    isWorkspaceSuspended && !isDefined(subscriptionStatus);

  const displayFailPaymentInfoBanner =
    subscriptionStatus === SubscriptionStatus.PastDue ||
    subscriptionStatus === SubscriptionStatus.Unpaid;

  return (
    <StyledInformationBannerWrapper>
      <InformationBannerLinkedinUnipileAutoConnect />
      <InformationBannerReconnectAccountInsufficientPermissions />
      <InformationBannerReconnectAccountEmailAliases />
      {displayBillingSubscriptionPausedBanner && (
        <InformationBannerBillingSubscriptionPaused />
      )}
      {displayBillingSubscriptionCanceledBanner && (
        <InformationBannerNoBillingSubscription />
      )}
      {displayFailPaymentInfoBanner && <InformationBannerFailPaymentInfo />}
    </StyledInformationBannerWrapper>
  );
};
