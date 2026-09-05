import { WorkflowVersionStatus } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import { WorkflowStatus } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';
import { computeWorkflowStatuses } from 'src/modules/workflow/workflow-status/utils/compute-workflow-statuses.util';

describe('computeWorkflowStatuses', () => {
  it('should return DRAFT when only a draft version exists', () => {
    expect(computeWorkflowStatuses([WorkflowVersionStatus.DRAFT])).toEqual([
      WorkflowStatus.DRAFT,
    ]);
  });

  it('should return ACTIVE when only an active version exists', () => {
    expect(computeWorkflowStatuses([WorkflowVersionStatus.ACTIVE])).toEqual([
      WorkflowStatus.ACTIVE,
    ]);
  });

  it('should return DRAFT and ACTIVE when both exist', () => {
    expect(
      computeWorkflowStatuses([
        WorkflowVersionStatus.DRAFT,
        WorkflowVersionStatus.ACTIVE,
      ]),
    ).toEqual([WorkflowStatus.DRAFT, WorkflowStatus.ACTIVE]);
  });

  it('should return DEACTIVATED when deactivated and no active', () => {
    expect(
      computeWorkflowStatuses([WorkflowVersionStatus.DEACTIVATED]),
    ).toEqual([WorkflowStatus.DEACTIVATED]);
  });

  it('should ignore archived versions', () => {
    expect(
      computeWorkflowStatuses([
        WorkflowVersionStatus.ARCHIVED,
        WorkflowVersionStatus.ACTIVE,
      ]),
    ).toEqual([WorkflowStatus.ACTIVE]);
  });
});
