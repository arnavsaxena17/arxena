import { createCreateCompleteWorkflowTool } from 'src/modules/workflow/workflow-tools/tools/create-complete-workflow.tool';

const STEP_ID = '5dca0d7a-cc73-4a24-821a-1bb4dc5150b5';

const buildTool = () => {
  const workflowRepository = {
    insert: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(
      async (callback: () => unknown) => callback(),
    ),
    getRepository: jest.fn().mockResolvedValue(workflowRepository),
  };
  const workflowCommonService = {
    handleWorkflowSubEntities: jest.fn().mockResolvedValue(undefined),
  };
  const workflowVersionEdgeService = {
    createWorkflowVersionEdge: jest
      .fn()
      .mockRejectedValue(
        new Error(
          `Target step 'undefined' not found in workflowVersion 'c6203dc5-6b28-4dc1-a8a7-3c0eba9b5e75'`,
        ),
      ),
  };
  const workflowVersionCoreSyncService = {
    writeWorkflowVersionAndMirror: jest
      .fn()
      .mockImplementation(
        async (
          _workspaceId: string,
          callback: (
            repository: { insert: jest.Mock },
            entityManager: unknown,
          ) => Promise<string>,
        ) =>
          callback({ insert: jest.fn().mockResolvedValue(undefined) }, {}),
      ),
  };
  const recordPositionService = {
    buildRecordPosition: jest.fn().mockResolvedValue(1),
  };

  const tool = createCreateCompleteWorkflowTool(
    {
      globalWorkspaceOrmManager,
      workflowCommonService,
      workflowVersionEdgeService,
      workflowVersionCoreSyncService,
      recordPositionService,
      workflowVersionService: {
        autoLayoutWorkflowVersion: jest.fn(),
      },
      workflowTriggerService: {
        activateWorkflowVersion: jest.fn(),
      },
      workflowValidationService: {
        validateWorkflowDefinition: jest.fn().mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
      },
    } as never,
    {
      workspaceId: 'workspace-id',
      rolePermissionConfig: { shouldBypassPermissionChecks: true },
    } as never,
  );

  return {
    tool,
    workflowRepository,
    workflowCommonService,
    workflowVersionEdgeService,
  };
};

describe('createCreateCompleteWorkflowTool', () => {
  it('coerces from/to edges so createWorkflowVersionEdge receives source/target', async () => {
    const { tool, workflowVersionEdgeService, workflowRepository } = buildTool();

    workflowVersionEdgeService.createWorkflowVersionEdge.mockResolvedValue(
      undefined,
    );

    const result = await tool.execute({
      name: 'Company Created → ICP People Search',
      trigger: {
        type: 'DATABASE_EVENT',
        settings: {
          eventType: 'CREATED',
          objectNameSingular: 'company',
        },
      },
      steps: [
        {
          id: STEP_ID,
          name: 'Search people for company',
          type: 'LOGIC_FUNCTION',
          settings: {
            input: {
              logicFunctionId: '5b0036de-b4ce-5b29-b3b5-63c0530ef8d1',
              companyId: '{{trigger.id}}',
            },
          },
        },
      ],
      edges: [{ from: 'trigger', to: STEP_ID }],
    } as never);

    expect(result.success).toBe(true);
    expect(
      workflowVersionEdgeService.createWorkflowVersionEdge,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'trigger',
        target: STEP_ID,
      }),
    );
    expect(workflowRepository.softDelete).not.toHaveBeenCalled();
  });

  it('rolls back the inserted workflow when edge creation fails after coerce miss', async () => {
    const { tool, workflowRepository, workflowCommonService } = buildTool();

    const result = await tool.execute({
      name: 'Broken',
      trigger: {
        type: 'DATABASE_EVENT',
        settings: { eventName: 'company.created', outputSchema: {} },
      },
      steps: [
        {
          id: STEP_ID,
          name: 'Search people for company',
          type: 'LOGIC_FUNCTION',
          valid: true,
          settings: {
            input: {
              logicFunctionId: '5b0036de-b4ce-5b29-b3b5-63c0530ef8d1',
              logicFunctionInput: {
                companyId: '{{trigger.properties.after.id}}',
              },
            },
            errorHandlingOptions: {
              retryOnFailure: { value: false },
              continueOnFailure: { value: false },
            },
            outputSchema: {},
          },
        },
      ],
      edges: [{ source: 'trigger', target: STEP_ID }],
    } as never);

    expect(result.success).toBe(false);
    expect(workflowRepository.softDelete).toHaveBeenCalled();
    expect(
      workflowCommonService.handleWorkflowSubEntities,
    ).toHaveBeenCalledWith({
      workflowIds: [expect.any(String)],
      workspaceId: 'workspace-id',
      operation: 'delete',
    });
  });
});
