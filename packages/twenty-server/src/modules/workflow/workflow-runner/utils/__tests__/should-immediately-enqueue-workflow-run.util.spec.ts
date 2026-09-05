import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { shouldImmediatelyEnqueueWorkflowRun } from 'src/modules/workflow/workflow-runner/utils/should-immediately-enqueue-workflow-run.util';
import { WorkflowTriggerType } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

describe('shouldImmediatelyEnqueueWorkflowRun', () => {
  it('should enqueue manual triggers immediately', () => {
    expect(
      shouldImmediatelyEnqueueWorkflowRun({
        triggerType: WorkflowTriggerType.MANUAL,
        workflowName: SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
      }),
    ).toBe(true);
  });

  it('should soft-throttle Stage B sequencer workflows', () => {
    expect(
      shouldImmediatelyEnqueueWorkflowRun({
        triggerType: WorkflowTriggerType.DATABASE_EVENT,
        workflowName: SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
      }),
    ).toBe(false);
  });

  it('should soft-throttle Stage C sequencer workflows', () => {
    expect(
      shouldImmediatelyEnqueueWorkflowRun({
        triggerType: WorkflowTriggerType.DATABASE_EVENT,
        workflowName: SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
      }),
    ).toBe(false);
  });

  it('should soft-throttle Stage C legacy aliases', () => {
    expect(
      shouldImmediatelyEnqueueWorkflowRun({
        triggerType: WorkflowTriggerType.DATABASE_EVENT,
        workflowName: 'GTM Outreach — Candidate Updated - Connection Accepted',
      }),
    ).toBe(false);
  });

  it('should enqueue webhook Test runs immediately', () => {
    expect(
      shouldImmediatelyEnqueueWorkflowRun({
        triggerType: WorkflowTriggerType.WEBHOOK,
        workflowName: 'Test a workflow',
      }),
    ).toBe(true);
  });

  it('should enqueue non-sequencer automated workflows immediately', () => {
    expect(
      shouldImmediatelyEnqueueWorkflowRun({
        triggerType: WorkflowTriggerType.DATABASE_EVENT,
        workflowName: SEEDED_OUTREACH_WORKFLOW.companySearch.name,
      }),
    ).toBe(true);

    expect(
      shouldImmediatelyEnqueueWorkflowRun({
        triggerType: WorkflowTriggerType.CRON,
        workflowName: SEEDED_OUTREACH_WORKFLOW.harvest.name,
      }),
    ).toBe(true);
  });
});
