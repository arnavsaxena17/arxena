import { type WorkflowToolDependencies } from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

import {
  createRunWorkflowTool,
  RUN_WORKFLOW_PAYLOAD_SCHEMAS,
} from '../run-workflow.tool';

const WORKSPACE_ID = '20202020-aaaa-4d02-bf25-6aeccf7ea419';
const PROJECT_ID = '20202020-bbbb-4d02-bf25-6aeccf7ea419';
const COMPANY_ID = '20202020-cccc-4d02-bf25-6aeccf7ea419';

const buildTool = ({
  workflow,
  version,
  runs = [],
}: {
  workflow: unknown;
  version: unknown;
  runs?: unknown[];
}) => {
  const runWorkflowVersion = jest
    .fn()
    .mockResolvedValue({ workflowRunId: 'run-1' });
  const repositories: Record<string, unknown> = {
    workflow: { findOne: jest.fn().mockResolvedValue(workflow) },
    workflowVersion: { findOne: jest.fn().mockResolvedValue(version) },
    workflowRun: { find: jest.fn().mockResolvedValue(runs) },
  };
  const deps = {
    globalWorkspaceOrmManager: {
      executeInWorkspaceContext: jest.fn().mockImplementation((fn) => fn()),
      getRepository: jest
        .fn()
        .mockImplementation(async (_ws, name) => repositories[name]),
    },
    workflowTriggerService: { runWorkflowVersion },
  };

  return {
    runWorkflowVersion,
    tool: createRunWorkflowTool(
      deps as unknown as Pick<
        WorkflowToolDependencies,
        'globalWorkspaceOrmManager' | 'workflowTriggerService'
      >,
      { workspaceId: WORKSPACE_ID, rolePermissionConfig: {} as never },
    ),
  };
};

const activeWebhook = {
  workflow: {
    id: 'wf-1',
    name: 'Find people by company',
    lastPublishedVersionId: 'v-1',
  },
  version: { id: 'v-1', status: 'ACTIVE', trigger: { type: 'WEBHOOK' } },
};

describe('run_workflow tool', () => {
  it('lists every payload shape in the tool description', () => {
    const { tool } = buildTool(activeWebhook);

    for (const name of Object.keys(RUN_WORKFLOW_PAYLOAD_SCHEMAS)) {
      expect(tool.description).toContain(name);
    }
  });

  it('rejects an invalid payload without starting a run', async () => {
    const { tool, runWorkflowVersion } = buildTool(activeWebhook);

    const result = await tool.execute({
      workflow: 'Find people by company',
      payload: { projectId: PROJECT_ID },
    });

    expect(result.success).toBe(false);
    expect(runWorkflowVersion).not.toHaveBeenCalled();
  });

  it('starts the active webhook version with the validated payload', async () => {
    const { tool, runWorkflowVersion } = buildTool(activeWebhook);

    const result = await tool.execute({
      workflow: 'Find people by company',
      payload: { projectId: PROJECT_ID, companyId: COMPANY_ID, limit: 10 },
    });

    expect(result).toMatchObject({ success: true, workflowRunId: 'run-1' });
    expect(runWorkflowVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowVersionId: 'v-1',
        workspaceId: WORKSPACE_ID,
        payload: { projectId: PROJECT_ID, companyId: COMPANY_ID, limit: 10 },
      }),
    );
  });

  it('skips a company that already has an active run', async () => {
    const { tool, runWorkflowVersion } = buildTool({
      ...activeWebhook,
      runs: [
        {
          id: 'run-9',
          status: 'RUNNING',
          state: {
            stepInfos: { trigger: { result: { companyId: COMPANY_ID } } },
          },
        },
      ],
    });

    const result = await tool.execute({
      workflow: 'Find people by company',
      payload: { projectId: PROJECT_ID, companyId: COMPANY_ID },
    });

    expect(result).toMatchObject({
      success: true,
      skipped: true,
      workflowRunId: 'run-9',
    });
    expect(runWorkflowVersion).not.toHaveBeenCalled();
  });

  it('refuses a workflow that is not webhook triggered', async () => {
    const { tool, runWorkflowVersion } = buildTool({
      workflow: activeWebhook.workflow,
      version: { id: 'v-1', status: 'ACTIVE', trigger: { type: 'MANUAL' } },
    });

    const result = await tool.execute({
      workflow: 'Find companies',
      payload: { projectId: PROJECT_ID },
    });

    expect(result.success).toBe(false);
    expect(runWorkflowVersion).not.toHaveBeenCalled();
  });
});
