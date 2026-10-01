import { workflowFormRejectContinues } from 'src/modules/workflow/workflow-executor/workflow-actions/form/utils/workflow-form-reject-continues.util';

describe('workflowFormRejectContinues', () => {
  it('continues only when the form opts in', () => {
    expect(
      workflowFormRejectContinues({ settings: { rejectContinues: true } }),
    ).toBe(true);
    expect(workflowFormRejectContinues({ settings: {} })).toBe(false);
    expect(workflowFormRejectContinues({})).toBe(false);
  });
});
