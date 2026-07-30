import { styled } from '@linaria/react';
import { isDefined } from 'twenty-shared/utils';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { InformationBannerBillingSubscriptionPaused } from '@/information-banner/components/billing/InformationBannerBillingSubscriptionPaused';
import { InformationBannerEndTrialPeriod } from '@/information-banner/components/billing/InformationBannerEndTrialPeriod';
import { InformationBannerFailPaymentInfo } from '@/information-banner/components/billing/InformationBannerFailPaymentInfo';
import { InformationBannerNoBillingSubscription } from '@/information-banner/components/billing/InformationBannerNoBillingSubscription';
import { InformationBannerNonProductionInstance } from '@/information-banner/components/enterprise/InformationBannerNonProductionInstance';
import { InformationBannerMaintenance } from '@/information-banner/components/maintenance/InformationBannerMaintenance';
import { InformationBannerReconnectAccountEmailAliases } from '@/information-banner/components/reconnect-account/InformationBannerReconnectAccountEmailAliases';
import { InformationBannerReconnectAccountInsufficientPermissions } from '@/information-banner/components/reconnect-account/InformationBannerReconnectAccountInsufficientPermissions';
import { usePermissionFlagMap } from '@/settings/roles/hooks/usePermissionFlagMap';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useIsWorkspaceActivationStatusEqualsTo } from '@/workspace/hooks/useIsWorkspaceActivationStatusEqualsTo';
import { useSubscriptionStatus } from '@/workspace/hooks/useSubscriptionStatus';
import { hasReachedCurrentBillingPeriodCapSelector } from '@/workspace/states/hasReachedCurrentBillingPeriodCapSelector';

import { InformationBannerNoMoreArxenaCredits } from '@/information-banner/components/billing/InformationBannerNoMoreArxenaCredits';
import { InformationBannerNoMoreCredits } from '@/information-banner/components/billing/InformationBannerNoMoreCredits';
import { WORKSPACE_CREDITS } from '@/billing/graphql/workspaceCredits';
import {
  PermissionFlagType,
  SubscriptionStatus,
} from '~/generated-metadata/graphql';
import { useQuery } from '@apollo/client/react';

const StyledInformationBannerWrapper = styled.div`
  position: relative;

  &:empty {
    height: 0;
  }
`;

export const InformationBannerWrapper = () => {
  const subscriptionStatus = useSubscriptionStatus();
  const permissionMap = usePermissionFlagMap();
  const isAccountSyncEnabled =
    permissionMap[PermissionFlagType.CONNECTED_ACCOUNTS];
  const isWorkspaceSuspended = useIsWorkspaceActivationStatusEqualsTo(
    WorkspaceActivationStatus.SUSPENDED,
  );
  const hasReachedCurrentBillingPeriodCap = useAtomStateValue(
    hasReachedCurrentBillingPeriodCapSelector,
  );

  const { data: workspaceCreditsData } = useQuery<{
    workspaceCredits?: {
      orgChartCredits?: number;
      revealCredits?: number;
      apiCredits?: number;
    };
  }>(WORKSPACE_CREDITS);

  const mapCredits = workspaceCreditsData?.workspaceCredits?.orgChartCredits;
  const revealCredits = workspaceCreditsData?.workspaceCredits?.revealCredits;
  const apiCredits = workspaceCreditsData?.workspaceCredits?.apiCredits;

  const displayBillingSubscriptionPausedBanner =
    isWorkspaceSuspended && subscriptionStatus === SubscriptionStatus.Paused;

  const displayBillingSubscriptionCanceledBanner =
    isWorkspaceSuspended && !isDefined(subscriptionStatus);

  const displayFailPaymentInfoBanner =
    subscriptionStatus === SubscriptionStatus.PastDue ||
    subscriptionStatus === SubscriptionStatus.Unpaid;

  const displayEndTrialPeriodBanner =
    hasReachedCurrentBillingPeriodCap &&
    subscriptionStatus === SubscriptionStatus.Trialing;

  const displayNoMoreCreditsBanner =
    !isWorkspaceSuspended &&
    !displayFailPaymentInfoBanner &&
    !displayEndTrialPeriodBanner &&
    hasReachedCurrentBillingPeriodCap;

  const depletedArxenaCreditKinds = [
    ...(!isWorkspaceSuspended && isDefined(mapCredits) && mapCredits <= 0
      ? (['maps'] as const)
      : []),
    ...(!isWorkspaceSuspended &&
    isDefined(revealCredits) &&
    revealCredits <= 0
      ? (['reveals'] as const)
      : []),
    ...(!isWorkspaceSuspended && isDefined(apiCredits) && apiCredits <= 0
      ? (['api'] as const)
      : []),
  ];

  return (
    <StyledInformationBannerWrapper>
      <InformationBannerNonProductionInstance />
      <InformationBannerMaintenance />
      {isAccountSyncEnabled && (
        <InformationBannerReconnectAccountInsufficientPermissions />
      )}
      {isAccountSyncEnabled && (
        <InformationBannerReconnectAccountEmailAliases />
      )}
      {displayBillingSubscriptionPausedBanner && (
        <InformationBannerBillingSubscriptionPaused /> // TODO: remove this once paused subscriptions are deprecated
      )}
      {displayBillingSubscriptionCanceledBanner && (
        <InformationBannerNoBillingSubscription />
      )}
      {displayFailPaymentInfoBanner && <InformationBannerFailPaymentInfo />}
      {displayEndTrialPeriodBanner && <InformationBannerEndTrialPeriod />}
      {displayNoMoreCreditsBanner && <InformationBannerNoMoreCredits />}
      {depletedArxenaCreditKinds.length > 0 && (
        <InformationBannerNoMoreArxenaCredits
          kinds={depletedArxenaCreditKinds}
        />
      )}
    </StyledInformationBannerWrapper>
  );
};
