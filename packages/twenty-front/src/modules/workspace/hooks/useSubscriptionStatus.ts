import { useRecoilValue } from 'recoil';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { SubscriptionStatus } from '~/generated/graphql';

export const useSubscriptionStatus = (): SubscriptionStatus | undefined => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  console.log("Current workspace status::", currentWorkspace);
  return currentWorkspace?.currentBillingSubscription?.status;
};
