import { WorkflowVersionStatus } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import { WorkflowStatus } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';

export const computeWorkflowStatuses = (
  versionStatuses: WorkflowVersionStatus[],
): WorkflowStatus[] => {
  const statuses: WorkflowStatus[] = [];

  const hasDraftVersion = versionStatuses.some(
    (status) => status === WorkflowVersionStatus.DRAFT,
  );

  if (hasDraftVersion) {
    statuses.push(WorkflowStatus.DRAFT);
  }

  const hasActiveVersion = versionStatuses.some(
    (status) => status === WorkflowVersionStatus.ACTIVE,
  );

  if (hasActiveVersion) {
    statuses.push(WorkflowStatus.ACTIVE);
  }

  const hasDeactivatedVersion = versionStatuses.some(
    (status) => status === WorkflowVersionStatus.DEACTIVATED,
  );

  if (!hasActiveVersion && hasDeactivatedVersion) {
    statuses.push(WorkflowStatus.DEACTIVATED);
  }

  return statuses;
};
