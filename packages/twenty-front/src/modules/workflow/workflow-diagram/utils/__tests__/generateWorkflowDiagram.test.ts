import { WorkflowStep, WorkflowTrigger } from '@/workflow/types/Workflow';
import { generateWorkflowDiagram } from '../generateWorkflowDiagram';

describe('generateWorkflowDiagram', () => {
  it('should generate a single trigger node when no step is provided', () => {
    const trigger: WorkflowTrigger = {
      name: 'Company created',
      type: 'DATABASE_EVENT',
      settings: {
        eventName: 'company.created',
        outputSchema: {},
      },
    };
    const steps: WorkflowStep[] = [];

    const result = generateWorkflowDiagram({ trigger, steps });

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);

    expect(result.nodes[0]).toMatchObject({
      data: {
        nodeType: 'trigger',
        isLeafNode: false,
      },
    });
  });

  it('should generate a diagram with nodes and edges corresponding to the steps', () => {
    const trigger: WorkflowTrigger = {
      name: 'Company created',
      type: 'DATABASE_EVENT',
      settings: {
        eventName: 'company.created',
        outputSchema: {},
      },
    };
    const steps: WorkflowStep[] = [
      {
        id: 'step1',
        name: 'Step 1',
        type: 'CODE',
        valid: true,
        settings: {
          errorHandlingOptions: {
            retryOnFailure: { value: true },
            continueOnFailure: { value: false },
          },
          input: {
            serverlessFunctionId: 'a5434be2-c10b-465c-acec-46492782a997',
            serverlessFunctionVersion: '1',
            serverlessFunctionInput: {},
          },
          outputSchema: {},
        },
      },
      {
        id: 'step2',
        name: 'Step 2',
        type: 'CODE',
        valid: true,
        settings: {
          errorHandlingOptions: {
            retryOnFailure: { value: true },
            continueOnFailure: { value: false },
          },
          input: {
            serverlessFunctionId: 'a5434be2-c10b-465c-acec-46492782a997',
            serverlessFunctionVersion: '1',
            serverlessFunctionInput: {},
          },
          outputSchema: {},
        },
      },
    ];

    const result = generateWorkflowDiagram({ trigger, steps });

    expect(result.nodes).toHaveLength(steps.length + 1); // All steps + trigger
    expect(result.edges).toHaveLength(steps.length - 1 + 1); // Edges are one less than nodes + the edge from the trigger to the first node

    expect(result.nodes[0].data.nodeType).toBe('trigger');

    const stepNodes = result.nodes.slice(1);

    for (const [index, step] of steps.entries()) {
      expect(stepNodes[index].data).toEqual({
        nodeType: 'action',
        actionType: 'CODE',
        name: step.name,
        isLeafNode: false,
      });
    }
  });

  it('should correctly link nodes with edges', () => {
    const trigger: WorkflowTrigger = {
      name: 'Company created',
      type: 'DATABASE_EVENT',
      settings: {
        eventName: 'company.created',
        outputSchema: {},
      },
    };
    const steps: WorkflowStep[] = [
      {
        id: 'step1',
        name: 'Step 1',
        type: 'CODE',
        valid: true,
        settings: {
          errorHandlingOptions: {
            retryOnFailure: { value: true },
            continueOnFailure: { value: false },
          },
          input: {
            serverlessFunctionId: 'a5434be2-c10b-465c-acec-46492782a997',
            serverlessFunctionVersion: '1',
            serverlessFunctionInput: {},
          },
          outputSchema: {},
        },
      },
      {
        id: 'step2',
        name: 'Step 2',
        type: 'CODE',
        valid: true,
        settings: {
          errorHandlingOptions: {
            retryOnFailure: { value: true },
            continueOnFailure: { value: false },
          },
          input: {
            serverlessFunctionId: 'a5434be2-c10b-465c-acec-46492782a997',
            serverlessFunctionVersion: '1',
            serverlessFunctionInput: {},
          },
          outputSchema: {},
        },
      },
    ];

    const result = generateWorkflowDiagram({ trigger, steps });

    expect(result.edges[0].source).toEqual(result.nodes[0].id);
    expect(result.edges[0].target).toEqual(result.nodes[1].id);

    expect(result.edges[1].source).toEqual(result.nodes[1].id);
    expect(result.edges[1].target).toEqual(result.nodes[2].id);
  });

  it('should build branches from nextStepIds when the flow is graph-based', () => {
    const trigger: WorkflowTrigger = {
      name: 'Company created',
      type: 'DATABASE_EVENT',
      nextStepIds: ['if-else'],
      settings: {
        eventName: 'company.created',
        outputSchema: {},
      },
    };

    const baseSettings = {
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: false },
      },
      input: {},
      outputSchema: {},
    };

    const steps: WorkflowStep[] = [
      {
        id: 'if-else',
        name: 'If/Else',
        type: 'IF_ELSE',
        valid: true,
        nextStepIds: [],
        settings: {
          ...baseSettings,
          input: {
            stepFilterGroups: [],
            stepFilters: [],
            branches: [
              {
                id: 'branch-true',
                nextStepIds: ['true-step'],
                filterGroupId: 'group-true',
              },
              {
                id: 'branch-false',
                nextStepIds: ['false-step'],
              },
            ],
          },
        },
      } as unknown as WorkflowStep,
      {
        id: 'true-step',
        name: 'True',
        type: 'CODE',
        valid: true,
        nextStepIds: [],
        settings: baseSettings,
      } as unknown as WorkflowStep,
      {
        id: 'false-step',
        name: 'False',
        type: 'CODE',
        valid: true,
        nextStepIds: [],
        settings: baseSettings,
      } as unknown as WorkflowStep,
    ];

    const result = generateWorkflowDiagram({ trigger, steps });

    // trigger + 3 steps
    expect(result.nodes).toHaveLength(4);
    // trigger->if-else, if-else->true, if-else->false
    expect(result.edges).toHaveLength(3);

    const ifElseOutgoing = result.edges.filter(
      (edge) => edge.source === 'if-else',
    );

    expect(ifElseOutgoing).toHaveLength(2);
    expect(ifElseOutgoing.map((edge) => edge.target).sort()).toEqual([
      'false-step',
      'true-step',
    ]);
  });

  it('should not loop forever when steps form an iterator cycle', () => {
    const trigger: WorkflowTrigger = {
      name: 'Manual',
      type: 'MANUAL',
      nextStepIds: ['iterator'],
      settings: {
        outputSchema: {},
      },
    };

    const baseSettings = {
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: false },
      },
      input: {},
      outputSchema: {},
    };

    const steps: WorkflowStep[] = [
      {
        id: 'iterator',
        name: 'Iterator',
        type: 'ITERATOR',
        valid: true,
        nextStepIds: ['loop-body'],
        settings: baseSettings,
      } as unknown as WorkflowStep,
      {
        id: 'loop-body',
        name: 'Loop body',
        type: 'CODE',
        valid: true,
        nextStepIds: ['iterator'],
        settings: baseSettings,
      } as unknown as WorkflowStep,
    ];

    const result = generateWorkflowDiagram({ trigger, steps });

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(3);
  });
});
