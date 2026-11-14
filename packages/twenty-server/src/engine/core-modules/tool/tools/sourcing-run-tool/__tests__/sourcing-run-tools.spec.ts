import { type RunView } from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';
import {
  SourcingNextTool,
  SourcingStartTool,
} from 'src/engine/core-modules/tool/tools/sourcing-run-tool/sourcing-run-tools';

const view = (overrides: Partial<RunView> = {}): RunView => ({
  runId: 'run-1',
  done: false,
  phase: 'PLANNED',
  target: 40,
  qualified: 0,
  toConfirm: 0,
  unknown: 0,
  failed: 0,
  spentUsd: 0,
  budgetUsd: 2,
  rounds: 0,
  candidates: [],
  ...overrides,
});

const CONTEXT = { workspaceId: 'workspace-1', projectId: 'project-1' };

const createFactory = (latestBrief: unknown = { who: 'CFOs' }) => {
  const run = {
    start: jest.fn(async (_args: Record<string, unknown>) => view()),
    next: jest.fn(async () => view({ rounds: 1, qualified: 12 })),
    cancel: jest.fn(async () => view({ done: true, phase: 'CANCELLED' })),
  };
  const factory = {
    // null stands for a project with no brief yet
    latestBrief: jest.fn(async () => latestBrief ?? undefined),
    readState: jest.fn(async () => ({ scoring: { previewId: 'preview-1' } })),
    create: jest.fn(
      (_context: unknown, _projectId: string, _scoring: unknown) => run,
    ),
  };

  return { run, factory };
};

describe('SourcingStartTool', () => {
  it('should start a run on the brief the project already has', async () => {
    const { run, factory } = createFactory();
    const tool = new SourcingStartTool(factory as never);

    const output = await tool.execute(
      { budgetUsd: 2, scoringPreviewId: 'preview-1' },
      CONTEXT,
    );

    expect(factory.create).toHaveBeenCalledWith(CONTEXT, 'project-1', {
      previewId: 'preview-1',
    });
    expect(run.start.mock.calls[0][0]).toMatchObject({
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      brief: { who: 'CFOs' },
      budgetUsd: 2,
      scoring: { previewId: 'preview-1' },
    });
    expect(output).toMatchObject({
      success: true,
      result: { runId: 'run-1', done: false },
    });
  });

  it('should refuse without a brief or a project', async () => {
    const noBrief = new SourcingStartTool(createFactory(null).factory as never);
    const noProject = new SourcingStartTool(createFactory().factory as never);

    expect(
      await noBrief.execute(
        { budgetUsd: 2, scoringPreviewId: 'preview-1' },
        CONTEXT,
      ),
    ).toMatchObject({ success: false, message: 'No brief' });
    expect(
      await noProject.execute(
        { budgetUsd: 2, scoringPreviewId: 'preview-1' },
        { workspaceId: 'workspace-1' },
      ),
    ).toMatchObject({ success: false, message: 'No project' });
  });

  it('should reject input without a budget', async () => {
    const tool = new SourcingStartTool(createFactory().factory as never);

    expect(
      await tool.execute({ scoringPreviewId: 'preview-1' }, CONTEXT),
    ).toMatchObject({
      success: false,
      message: 'Invalid sourcing_start input',
    });
  });
});

describe('SourcingNextTool', () => {
  it('should run the next round with the scoring the run was started with', async () => {
    const { run, factory } = createFactory();
    const tool = new SourcingNextTool(factory as never);

    const output = await tool.execute({ runId: 'run-1' }, CONTEXT);

    expect(factory.create).toHaveBeenCalledWith(CONTEXT, 'project-1', {
      previewId: 'preview-1',
    });
    expect(run.next).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      runId: 'run-1',
    });
    expect(output).toMatchObject({
      success: true,
      result: { rounds: 1, qualified: 12 },
    });
  });

  it('should cancel instead of running a round when asked to', async () => {
    const { run, factory } = createFactory();
    const tool = new SourcingNextTool(factory as never);

    const output = await tool.execute(
      { runId: 'run-1', cancel: true },
      CONTEXT,
    );

    expect(run.next).not.toHaveBeenCalled();
    expect(output).toMatchObject({
      success: true,
      result: { phase: 'CANCELLED' },
    });
  });

  it('should report a failed round as an error the run can resume from', async () => {
    const { run, factory } = createFactory();

    run.next.mockRejectedValue(new Error('Preview not found or expired.'));

    const output = await new SourcingNextTool(factory as never).execute(
      { runId: 'run-1' },
      CONTEXT,
    );

    expect(output).toMatchObject({
      success: false,
      error: 'Preview not found or expired.',
    });
  });
});
