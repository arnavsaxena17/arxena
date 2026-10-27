import {
  GetOutreachAiColumnRunStatusTool,
  RunOutreachAiColumnTool,
} from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/outreach-ai-column-tools';
import {
  AI_COLUMN_MAX_WAIT_SECONDS,
  GetAiColumnRunStatusInputZodSchema,
  RunOutreachAiColumnInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/outreach-ai-column-tool.schema';

const running = {
  runId: 'r1',
  status: 'running',
  total: 10,
  done: 4,
  answered: 4,
  failed: 0,
};
const completed = { ...running, status: 'completed', done: 10, answered: 10 };

const columnService = { getPreviewState: jest.fn(async () => undefined) };

const buildService = () => ({
  startRun: jest.fn(async () => ({ runId: 'r1' })),
  getRun: jest.fn(async () => running),
  waitForRun: jest.fn(async () => completed),
  summarize: jest.fn((state: typeof running) => state),
});

const context = { workspaceId: 'w' } as never;

describe('waiting for an AI column run', () => {
  it('should wait for run_ai_column for 150 seconds unless told otherwise', async () => {
    const service = buildService();
    const tool = new RunOutreachAiColumnTool(
      service as never,
      columnService as never,
    );

    await tool.execute(
      { projectId: 'p', previewId: 'v', tab: 'people' },
      context,
    );

    expect(service.waitForRun).toHaveBeenCalledWith('r1', 150_000);
  });

  it('should let the agent choose the wait', async () => {
    const service = buildService();
    const tool = new RunOutreachAiColumnTool(
      service as never,
      columnService as never,
    );

    await tool.execute(
      { projectId: 'p', previewId: 'v', tab: 'people', waitSeconds: 30 },
      context,
    );

    expect(service.waitForRun).toHaveBeenCalledWith('r1', 30_000);
  });

  it('should make the status call wait for the run, so one call replaces many polls', async () => {
    const service = buildService();
    const tool = new GetOutreachAiColumnRunStatusTool(service as never);
    const output = await tool.execute({ runId: 'r1' });

    expect(service.waitForRun).toHaveBeenCalledWith('r1', 120_000);
    expect((output.result as { status: string }).status).toBe('completed');
  });

  it('should answer at once when the wait is 0', async () => {
    const service = buildService();
    const tool = new GetOutreachAiColumnRunStatusTool(service as never);

    await tool.execute({ runId: 'r1', waitSeconds: 0 });

    expect(service.waitForRun).not.toHaveBeenCalled();
  });

  it('should tell the agent not to poll while a run is still going', async () => {
    const service = buildService();

    service.waitForRun.mockResolvedValue(running as never);

    const output = await new GetOutreachAiColumnRunStatusTool(
      service as never,
    ).execute({ runId: 'r1' });

    expect(output.message).toContain('once');
  });

  it('should refuse a wait longer than the maximum', () => {
    expect(
      RunOutreachAiColumnInputZodSchema.safeParse({
        projectId: 'p',
        previewId: 'v',
        waitSeconds: AI_COLUMN_MAX_WAIT_SECONDS + 1,
      }).success,
    ).toBe(false);
    expect(
      GetAiColumnRunStatusInputZodSchema.safeParse({
        runId: 'r',
        waitSeconds: AI_COLUMN_MAX_WAIT_SECONDS,
      }).success,
    ).toBe(true);
  });
});

describe('cost approval for a full run', () => {
  const previewState = (estimatedRunCostUsd: number | null) => ({
    estimatedRunCostUsd,
    estimatedPerRowUsd:
      estimatedRunCostUsd === null ? null : estimatedRunCostUsd / 100,
  });
  const build = (estimatedRunCostUsd: number | null) => {
    const service = buildService();
    const tool = new RunOutreachAiColumnTool(
      service as never,
      {
        getPreviewState: jest.fn(async () => previewState(estimatedRunCostUsd)),
      } as never,
    );

    return { service, tool };
  };
  const input = { projectId: 'p', previewId: 'v', tab: 'people' };

  it('should run at once when the estimate is under the limit', async () => {
    const { service, tool } = build(2.2);

    await tool.execute(input, context);

    expect(service.startRun).toHaveBeenCalled();
  });

  it('should refuse a run over the limit and say what to do', async () => {
    const { service, tool } = build(32.8);
    const output = await tool.execute(input, context);

    expect(service.startRun).not.toHaveBeenCalled();
    expect(output).toMatchObject({
      success: false,
      error: 'cost_approval_required',
    });
    expect(output.message).toContain('approvedCostUsd');
  });

  it('should run once the approval covers the estimate', async () => {
    const { service, tool } = build(32.8);

    await tool.execute({ ...input, approvedCostUsd: 35 }, context);

    expect(service.startRun).toHaveBeenCalled();
  });

  it('should price a limited run by its rows, not the whole table', async () => {
    const { service, tool } = build(32.8);

    await tool.execute({ ...input, rowLimit: 10 }, context);

    expect(service.startRun).toHaveBeenCalled();
  });

  it('should not block a column that reports no cost', async () => {
    const { service, tool } = build(null);

    await tool.execute(input, context);

    expect(service.startRun).toHaveBeenCalled();
  });
});
