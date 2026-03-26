import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { useDefaultHomePagePath } from '@/navigation/hooks/useDefaultHomePagePath';
import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { AppPath } from '@/types/AppPath';
import { SettingsPath } from '@/types/SettingsPath';
import { useIsWorkspaceActivationStatusSuspended } from '@/workspace/hooks/useIsWorkspaceActivationStatusSuspended';
import { useParams } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';
import { OnboardingStatus } from '~/generated/graphql';
import { useIsMatchingLocation } from '~/hooks/useIsMatchingLocation';

export const usePageChangeEffectNavigateLocation = () => {
  const { isMatchingLocation } = useIsMatchingLocation();
  const isLoggedIn = useIsLogged();
  const onboardingStatus = useOnboardingStatus();
  const isWorkspaceSuspended = useIsWorkspaceActivationStatusSuspended();
  const { defaultHomePagePath } = useDefaultHomePagePath();

  const isMatchingOpenRoute =
    isMatchingLocation(AppPath.Invite) ||
    isMatchingLocation(AppPath.ResetPassword) ||
    isMatchingLocation(AppPath.VerifyEmail);

  const isMatchingOngoingUserCreationRoute =
    isMatchingOpenRoute ||
    isMatchingLocation(AppPath.SignInUp) ||
    isMatchingLocation(AppPath.Verify);

  const isMatchingOnboardingRoute =
    isMatchingOngoingUserCreationRoute ||
    isMatchingLocation(AppPath.CreateWorkspace) ||
    isMatchingLocation(AppPath.CreateProfile) ||
    isMatchingLocation(AppPath.CollectPhoneNumber) ||
    isMatchingLocation(AppPath.ConnectLinkedin) ||
    isMatchingLocation(AppPath.SyncEmails) ||
    isMatchingLocation(AppPath.InviteTeam);

  const objectNamePlural = useParams().objectNamePlural ?? '';
  const objectMetadataItems = useRecoilValue(objectMetadataItemsState);
  const objectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) => objectMetadataItem.namePlural === objectNamePlural,
  );

  if (isMatchingOpenRoute) {
    return;
  }

  if (!isLoggedIn && !isMatchingOngoingUserCreationRoute) {
    // Don't redirect to SignInUp from onboarding routes when we're in onboarding - 
    // auth state may be settling (e.g. tokenPair hydration, isVerifyPending) and 
    // we'd otherwise flap between CreateWorkspace and SignInUp
    const isOnboardingRouteWithMatchingStatus =
      (isMatchingLocation(AppPath.CreateWorkspace) &&
        onboardingStatus === OnboardingStatus.WORKSPACE_ACTIVATION) ||
      (isMatchingLocation(AppPath.CreateProfile) &&
        onboardingStatus === OnboardingStatus.PROFILE_CREATION) ||
      (isMatchingLocation(AppPath.CollectPhoneNumber) &&
        onboardingStatus === OnboardingStatus.COLLECT_PHONE_NUMBER) ||
      (isMatchingLocation(AppPath.ConnectLinkedin) &&
        onboardingStatus === OnboardingStatus.CONNECT_LINKEDIN) ||
      (isMatchingLocation(AppPath.SyncEmails) &&
        onboardingStatus === OnboardingStatus.SYNC_EMAIL) ||
      (isMatchingLocation(AppPath.InviteTeam) &&
        onboardingStatus === OnboardingStatus.INVITE_TEAM);

    if (isOnboardingRouteWithMatchingStatus) {
      return;
    }

    return AppPath.SignInUp;
  }

  if (isWorkspaceSuspended && !isMatchingLocation(AppPath.SettingsCatchAll)) {
    return `${AppPath.SettingsCatchAll.replace('/*', '')}/${
      SettingsPath.Billing
    }`;
  }

  if (
    onboardingStatus === OnboardingStatus.WORKSPACE_ACTIVATION &&
    !isMatchingLocation(AppPath.CreateWorkspace)
  ) {
    return AppPath.CreateWorkspace;
  }

  if (
    onboardingStatus === OnboardingStatus.PROFILE_CREATION &&
    !isMatchingLocation(AppPath.CreateProfile)
  ) {
    return AppPath.CreateProfile;
  }

  if (
    onboardingStatus === OnboardingStatus.COLLECT_PHONE_NUMBER &&
    !isMatchingLocation(AppPath.CollectPhoneNumber)
  ) {
    return AppPath.CollectPhoneNumber;
  }

  if (
    onboardingStatus === OnboardingStatus.CONNECT_LINKEDIN &&
    !isMatchingLocation(AppPath.ConnectLinkedin)
  ) {
    return AppPath.ConnectLinkedin;
  }

  if (
    onboardingStatus === OnboardingStatus.SYNC_EMAIL &&
    !isMatchingLocation(AppPath.SyncEmails)
  ) {
    return AppPath.SyncEmails;
  }

  if (
    onboardingStatus === OnboardingStatus.INVITE_TEAM &&
    !isMatchingLocation(AppPath.InviteTeam)
  ) {
    return AppPath.InviteTeam;
  }

  if (
    onboardingStatus === OnboardingStatus.COMPLETED &&
    isMatchingOnboardingRoute &&
    isLoggedIn
  ) {
    return defaultHomePagePath;
  }

  if (isMatchingLocation(AppPath.Index) && isLoggedIn) {
    return defaultHomePagePath;
  }

  if (
    isMatchingLocation(AppPath.RecordIndexPage) &&
    !isDefined(objectMetadataItem)
  ) {
    return AppPath.NotFound;
  }

  return;
};
