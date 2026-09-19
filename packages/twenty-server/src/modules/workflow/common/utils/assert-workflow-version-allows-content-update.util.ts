import { msg } from '@lingui/core/macro';

import {
  WorkflowQueryValidationException,
  WorkflowQueryValidationExceptionCode,
} from 'src/modules/workflow/common/exceptions/workflow-query-validation.exception';
import {
  WorkflowVersionStatus,
  type WorkflowVersionWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';

const CONTENT_UPDATE_ALLOWED_STATUSES: WorkflowVersionStatus[] = [
  WorkflowVersionStatus.DRAFT,
  WorkflowVersionStatus.ACTIVE,
  WorkflowVersionStatus.EXPERIMENT,
];

export const assertWorkflowVersionAllowsContentUpdate = (
  workflowVersion: WorkflowVersionWorkspaceEntity,
) => {
  if (!CONTENT_UPDATE_ALLOWED_STATUSES.includes(workflowVersion.status)) {
    throw new WorkflowQueryValidationException(
      'Workflow version cannot be updated in this status',
      WorkflowQueryValidationExceptionCode.FORBIDDEN,
      {
        userFriendlyMessage: msg`Workflow version cannot be updated in this status`,
      },
    );
  }
};

export const isPublishedWorkflowVersionStatus = (
  status: WorkflowVersionStatus,
): boolean => {
  return (
    status === WorkflowVersionStatus.ACTIVE ||
    status === WorkflowVersionStatus.EXPERIMENT
  );
};
