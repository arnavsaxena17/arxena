import React from 'react';
import { useRecoilValue } from 'recoil';

import { isCurrentUserLoadedState } from '@/auth/states/isCurrentUserLoadingState';
import { dateTimeFormatState } from '@/localization/states/dateTimeFormatState';
import { AppPath } from '@/types/AppPath';
import { UserContext } from '@/users/contexts/UserContext';
import { useIsMatchingLocation } from '~/hooks/useIsMatchingLocation';
import { UserOrMetadataLoader } from '~/loading/components/UserOrMetadataLoader';

export const UserProvider = ({ children }: React.PropsWithChildren) => {
  const isCurrentUserLoaded = useRecoilValue(isCurrentUserLoadedState);
  const { isMatchingLocation } = useIsMatchingLocation();

  const dateTimeFormat = useRecoilValue(dateTimeFormatState);
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

  return !isCurrentUserLoaded && !isMatchingOnboardingRoute ? (
    <UserOrMetadataLoader />
  ) : (
    <UserContext.Provider
      value={{
        dateFormat: dateTimeFormat.dateFormat,
        timeFormat: dateTimeFormat.timeFormat,
        timeZone: dateTimeFormat.timeZone,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
