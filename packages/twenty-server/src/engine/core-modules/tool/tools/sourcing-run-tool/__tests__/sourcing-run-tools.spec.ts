import {
  SourcingNextTool,
  SourcingStartTool,
} from 'src/engine/core-modules/tool/tools/sourcing-run-tool/sourcing-run-tools';

const view = {
  runId: 'r1',
  phase: 'PLANNED',
  done: false,
  question: { kind: 'confirm', text: 'ok?', options: [] },
};

describe('sourcing run tools', () => {
  const start = jest.fn().mockResolvedValue(view);
  const next = jest.fn().mockResolvedValue(undefined);
  const service = { start, next };

  it('should start a run as the calling member, on the project in view', async () => {
    const output = await new SourcingStartTool(service as never).execute(
      { request: 'Plant heads in Gujarat', budgetUsd: 5, target: 30 },
      {
        workspaceId: 'w',
        projectId: 'p',
        roleId: 'role',
        userId: 'u',
        threadId: 't',
      },
    );

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p',
        identity: expect.objectContaining({
          roleId: 'role',
          userId: 'u',
          threadId: 't',
        }),
      }),
    );
    expect(output.success).toBe(true);
    expect((output.result as { nextStep: string }).nextStep).toMatch(
      /ask_questions/,
    );
  });

  it('should refuse without a project or a role', async () => {
    const tool = new SourcingStartTool(service as never);

    expect(
      (
        await tool.execute(
          { request: 'abc', budgetUsd: 1 },
          { workspaceId: 'w', roleId: 'r' },
        )
      ).error,
    ).toBe('projectId is missing');
    expect(
      (
        await tool.execute(
          { request: 'abc', budgetUsd: 1 },
          { workspaceId: 'w', projectId: 'p' },
        )
      ).error,
    ).toBe('roleId is missing');
  });

  it('should report an unknown run', async () => {
    const output = await new SourcingNextTool(service as never).execute(
      { runId: 'nope' },
      { workspaceId: 'w', projectId: 'p' },
    );

    expect(output).toEqual(
      expect.objectContaining({ success: false, error: 'run_not_found' }),
    );
  });
});
