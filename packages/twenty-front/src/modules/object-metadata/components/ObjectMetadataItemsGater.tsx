import React from 'react';
import { useRecoilValue } from 'recoil';

import { isAppWaitingForFreshObjectMetadataState } from '@/object-metadata/states/isAppWaitingForFreshObjectMetadataState';
import { AppPath } from '@/types/AppPath';
import { useIsMatchingLocation } from '~/hooks/useIsMatchingLocation';
import { UserOrMetadataLoader } from '~/loading/components/UserOrMetadataLoader';

export const ObjectMetadataItemsGater = ({
  children,
}: React.PropsWithChildren) => {
  const isAppWaitingForFreshObjectMetadata = useRecoilValue(
    isAppWaitingForFreshObjectMetadataState,
  );
  const { isMatchingLocation } = useIsMatchingLocation();

  const isMatchingOnboardingRoute =
    isMatchingLocation(AppPath.CreateWorkspace) ||
    isMatchingLocation(AppPath.CreateProfile) ||
    isMatchingLocation(AppPath.CollectPhoneNumber) ||
    isMatchingLocation(AppPath.IntentChoice) ||
    isMatchingLocation(AppPath.CompetitiveResearchOnboarding) ||
    isMatchingLocation(AppPath.DealDiligenceOnboarding) ||
    isMatchingLocation(AppPath.ExtensionInstallOnboarding) ||
    isMatchingLocation(AppPath.ConnectLinkedin) ||
    isMatchingLocation(AppPath.SyncEmails) ||
    isMatchingLocation(AppPath.InviteTeam);

  const shouldDisplayChildren =
    !isAppWaitingForFreshObjectMetadata || isMatchingOnboardingRoute;

  return (
    <>{shouldDisplayChildren ? <>{children}</> : <UserOrMetadataLoader />}</>
  );
};
