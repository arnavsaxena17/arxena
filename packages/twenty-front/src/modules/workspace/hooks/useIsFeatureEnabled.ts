import { useRecoilValue } from 'recoil';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { FeatureFlagKey } from '@/workspace/types/FeatureFlagKey';

export const useIsFeatureEnabled = (featureKey: FeatureFlagKey | null) => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  console.log("This si the current workspace:", currentWorkspace)
  console.log("This si the featureKey:", featureKey)
  if (!featureKey) {
    return false;
  }
  console.log("This si the current workspace feature flags:", currentWorkspace?.featureFlags)
  const featureFlag = currentWorkspace?.featureFlags?.find(
    (flag) => flag.key === featureKey,
  );

  return !!featureFlag?.value;
};
