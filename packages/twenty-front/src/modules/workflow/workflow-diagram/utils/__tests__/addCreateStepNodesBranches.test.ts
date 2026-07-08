import { WorkflowStep, WorkflowTrigger } from '@/workflow/types/Workflow';
import { addCreateStepNodes } from '@/workflow/workflow-diagram/utils/addCreateStepNodes';
import { generateWorkflowDiagram } from '@/workflow/workflow-diagram/utils/generateWorkflowDiagram';
import { isCreateStepNode } from '@/workflow/workflow-diagram/utils/isCreateStepNode';

const baseSettings = {
  errorHandlingOptions: {
    retryOnFailure: { value: false },
    continueOnFailure: { value: false },
  },
  input: {},
  outputSchema: {},
};

describe('addCreateStepNodes with branches', () => {
  it('adds a distinct create-step node per empty if-else branch', () => {
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
              { id: 'branch-a', nextStepIds: [], filterGroupId: 'group-a' },
              { id: 'branch-b', nextStepIds: [] },
            ],
          },
        },
      } as unknown as WorkflowStep,
    ];

    const diagram = addCreateStepNodes(
      generateWorkflowDiagram({ trigger, steps }),
    );

    const createStepNodes = diagram.nodes.filter((node) =>
      isCreateStepNode(node),
    );

    expect(createStepNodes).toHaveLength(2);

    const uniqueIds = new Set(createStepNodes.map((node) => node.id));
    expect(uniqueIds.size).toBe(2);

    const branchIds = createStepNodes
      .map((node) =>
        node.data.nodeType === 'create-step'
          ? node.data.connectionOptions?.branchId
          : undefined,
      )
      .sort();

    expect(branchIds).toEqual(['branch-a', 'branch-b']);
  });
});
