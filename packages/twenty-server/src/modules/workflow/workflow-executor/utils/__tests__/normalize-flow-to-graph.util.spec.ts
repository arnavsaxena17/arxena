import { WorkflowActionType } from 'twenty-shared';

import { normalizeFlowToGraph } from 'src/modules/workflow/workflow-executor/utils/normalize-flow-to-graph.util';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import {
  type WorkflowTrigger,
  WorkflowTriggerType,
} from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

const buildStep = (id: string): WorkflowAction =>
  ({
    id,
    name: id,
    type: WorkflowActionType.CODE,
    valid: true,
    settings: {
      input: {},
      outputSchema: {},
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: false },
      },
    },
  }) as unknown as WorkflowAction;

const buildTrigger = (): WorkflowTrigger =>
  ({
    type: WorkflowTriggerType.MANUAL,
    name: 'trigger',
    settings: { outputSchema: {} },
  }) as unknown as WorkflowTrigger;

describe('normalizeFlowToGraph', () => {
  it('synthesizes a linear chain for a legacy flow without nextStepIds', () => {
    const trigger = buildTrigger();
    const steps = [buildStep('a'), buildStep('b'), buildStep('c')];

    const result = normalizeFlowToGraph({ trigger, steps });

    // eslint-disable-next-line no-console
    console.log('normalized trigger.nextStepIds', result.trigger.nextStepIds);

    expect(result.trigger.nextStepIds).toEqual(['a']);
    expect(result.steps[0].nextStepIds).toEqual(['b']);
    expect(result.steps[1].nextStepIds).toEqual(['c']);
    expect(result.steps[2].nextStepIds).toEqual([]);
  });

  it('returns the flow untouched when nextStepIds are already present', () => {
    const trigger = { ...buildTrigger(), nextStepIds: ['a'] };
    const stepA = { ...buildStep('a'), nextStepIds: ['b'] };
    const stepB = { ...buildStep('b'), nextStepIds: [] };

    const result = normalizeFlowToGraph({
      trigger,
      steps: [stepA, stepB],
    });

    // eslint-disable-next-line no-console
    console.log('already-graph result', result.trigger.nextStepIds);

    expect(result.trigger).toBe(trigger);
    expect(result.steps).toEqual([stepA, stepB]);
  });

  it('produces an empty chain when there are no steps', () => {
    const trigger = buildTrigger();

    const result = normalizeFlowToGraph({ trigger, steps: [] });

    expect(result.trigger.nextStepIds).toEqual([]);
    expect(result.steps).toEqual([]);
  });
});
