import { useRecoilValue } from 'recoil';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { WorkspaceActivationStatus } from '~/generated/graphql';

export const useIsWorkspaceActivationStatusSuspended = (): boolean => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  console.log("Current workspace status active or suspended::", currentWorkspace?.activationStatus);
  return (
    currentWorkspace?.activationStatus === WorkspaceActivationStatus.SUSPENDED
  );
};
