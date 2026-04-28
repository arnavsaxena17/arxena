import type { WorkspaceActivationStatus } from '../types/WorkspaceActivationStatus';

export const isWorkspaceActiveOrSuspended = (
  workspace?: {
    activationStatus: WorkspaceActivationStatus;
  } | null,
): boolean => {
  return (
    workspace?.activationStatus === 'ACTIVE' ||
    workspace?.activationStatus === 'SUSPENDED'
  );
};
