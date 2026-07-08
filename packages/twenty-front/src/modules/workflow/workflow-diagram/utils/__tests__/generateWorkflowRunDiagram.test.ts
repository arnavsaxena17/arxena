import { WorkflowStep, WorkflowTrigger } from '@/workflow/types/Workflow';
import { generateWorkflowRunDiagram } from '@/workflow/workflow-diagram/utils/generateWorkflowRunDiagram';

const baseSettings = {
  errorHandlingOptions: {
    retryOnFailure: { value: false },
    continueOnFailure: { value: false },
  },
  input: {},
  outputSchema: {},
};

describe('generateWorkflowRunDiagram', () => {
  it('renders if-else branches with labeled edges from branch handles', () => {
    const trigger: WorkflowTrigger = {
      name: 'Manual',
      type: 'MANUAL',
      nextStepIds: ['if-else'],
      settings: { outputSchema: {} },
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
                id: 'branch-if',
                nextStepIds: ['then-step'],
                filterGroupId: 'group-if',
              },
              { id: 'branch-else', nextStepIds: ['else-step'] },
            ],
          },
        },
      } as unknown as WorkflowStep,
      {
        id: 'then-step',
        name: 'Then',
        type: 'CODE',
        valid: true,
        nextStepIds: [],
        settings: baseSettings,
      } as unknown as WorkflowStep,
      {
        id: 'else-step',
        name: 'Else',
        type: 'CODE',
        valid: true,
        nextStepIds: [],
        settings: baseSettings,
      } as unknown as WorkflowStep,
    ];

    const result = generateWorkflowRunDiagram({
      trigger,
      steps,
      stepInfos: {
        'if-else': { status: 'SUCCESS' },
        'then-step': { status: 'SUCCESS' },
      },
    });

    expect(result.nodes).toHaveLength(4);

    const branchEdges = result.edges.filter(
      (edge) => edge.source === 'if-else',
    );

    expect(branchEdges).toHaveLength(2);
    expect(
      branchEdges.map((edge) => edge.sourceHandle).sort(),
    ).toEqual(['branch-else', 'branch-if']);
    expect(
      branchEdges.map((edge) => edge.data?.labelOptions?.label).sort(),
    ).toEqual(['Else', 'If']);
  });
});
