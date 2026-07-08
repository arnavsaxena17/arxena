import { WorkflowStep, WorkflowTrigger } from '@/workflow/types/Workflow';
import { insertStepInWorkflowVersion } from '@/workflow/workflow-steps/utils/insertStepInWorkflowVersion';

const TRIGGER_STEP_ID = 'trigger';

const baseSettings = {
  errorHandlingOptions: {
    retryOnFailure: { value: false },
    continueOnFailure: { value: false },
  },
  input: {},
  outputSchema: {},
};

const buildStep = (id: string): WorkflowStep =>
  ({
    id,
    name: id,
    type: 'CODE',
    valid: true,
    settings: baseSettings,
  }) as unknown as WorkflowStep;

const buildTrigger = (): WorkflowTrigger =>
  ({
    type: 'MANUAL',
    name: 'trigger',
    settings: { outputSchema: {} },
  }) as unknown as WorkflowTrigger;

describe('insertStepInWorkflowVersion', () => {
  it('materializes the whole legacy flow into a graph when adding a step', () => {
    const trigger = buildTrigger();
    const steps = [buildStep('a'), buildStep('b')];
    const newStep = { ...buildStep('c'), nextStepIds: [] } as WorkflowStep;

    const result = insertStepInWorkflowVersion({
      steps,
      trigger,
      newStep,
      parentStepId: 'b',
      connectionOptions: { sourceHandleId: 'default' },
      triggerStepId: TRIGGER_STEP_ID,
    });

    // eslint-disable-next-line no-console
    console.log(
      'insertStepInWorkflowVersion legacy result',
      JSON.stringify(result, null, 2),
    );

    // Every pre-existing node keeps an explicit outgoing connection: no
    // orphaned steps that would scatter the diagram.
    expect(result.trigger?.nextStepIds).toEqual(['a']);

    const stepById = Object.fromEntries(
      result.steps.map((step) => [step.id, step]),
    );

    expect(stepById['a'].nextStepIds).toEqual(['b']);
    expect(stepById['b'].nextStepIds).toEqual(['c']);
    expect(stepById['c'].nextStepIds).toEqual([]);
  });

  it('leaves an already graph-based flow untouched apart from the new link', () => {
    const trigger = { ...buildTrigger(), nextStepIds: ['a'] };
    const steps: WorkflowStep[] = [
      { ...buildStep('a'), nextStepIds: [] } as WorkflowStep,
    ];
    const newStep = { ...buildStep('b'), nextStepIds: [] } as WorkflowStep;

    const result = insertStepInWorkflowVersion({
      steps,
      trigger,
      newStep,
      parentStepId: 'a',
      connectionOptions: { sourceHandleId: 'default' },
      triggerStepId: TRIGGER_STEP_ID,
    });

    // eslint-disable-next-line no-console
    console.log(
      'insertStepInWorkflowVersion graph result',
      JSON.stringify(result, null, 2),
    );

    expect(result.trigger?.nextStepIds).toEqual(['a']);

    const stepById = Object.fromEntries(
      result.steps.map((step) => [step.id, step]),
    );

    expect(stepById['a'].nextStepIds).toEqual(['b']);
    expect(stepById['b'].nextStepIds).toEqual([]);
  });
});
