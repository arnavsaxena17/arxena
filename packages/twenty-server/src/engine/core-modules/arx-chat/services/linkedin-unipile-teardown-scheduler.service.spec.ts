import { LinkedinUnipileTeardownSchedulerService } from './linkedin-unipile-teardown-scheduler.service';

describe('LinkedinUnipileTeardownSchedulerService', () => {
  const workspaceMemberId = 'member-1';
  const workspaceId = 'workspace-1';
  const accountId = 'account-1';
  const authToken = 'auth-token';
  const projectId = `linkedin-unipile-teardown-${workspaceMemberId}`;

  const createService = (options?: {
    idleTtlMs?: number;
    queueAvailable?: boolean;
    existingJobs?: Array<{ id: string; data: { workspaceMemberId: string } }>;
  }) => {
    const idleTtlMs = options?.idleTtlMs ?? 300_000;
    const queueAvailable = options?.queueAvailable ?? true;

    const environmentService = {
      get: jest.fn((key: string) => {
        if (key === 'LINKEDIN_UNIPILE_SESSION_IDLE_TTL_MS') {
          return idleTtlMs;
        }

        return undefined;
      }),
    };

    const teardownQueue = queueAvailable
      ? {
          getInFlightJobs: jest
            .fn()
            .mockResolvedValue(options?.existingJobs ?? []),
          removeJob: jest.fn().mockResolvedValue(undefined),
          add: jest.fn().mockResolvedValue(undefined),
        }
      : undefined;

    const service = new LinkedinUnipileTeardownSchedulerService(
      environmentService as never,
      teardownQueue as never,
    );

    return { service, teardownQueue, environmentService };
  };

  it('schedules idle disconnect with stable job id and configured delay', async () => {
    const { service, teardownQueue } = createService({ idleTtlMs: 300_000 });

    await service.scheduleIdleDisconnect({
      workspaceMemberId,
      workspaceId,
      accountId,
      authToken,
    });

    expect(teardownQueue?.add).toHaveBeenCalledWith(
      'LinkedinUnipileTeardownProcessor',
      expect.objectContaining({
        workspaceMemberId,
        workspaceId,
        accountId,
        authToken,
      }),
      {
        id: projectId,
        delay: 300_000,
        allowDuplicatedPrefixes: true,
      },
    );
  });

  it('cancels pending disconnect by workspace member id', async () => {
    const existingJobId = `${projectId}-uuid`;
    const { service, teardownQueue } = createService({
      existingJobs: [
        {
          id: existingJobId,
          data: { workspaceMemberId },
        },
      ],
    });

    await service.cancelPendingDisconnect(workspaceMemberId);

    expect(teardownQueue?.removeJob).toHaveBeenCalledWith(existingJobId);
  });

  it('clamps idle ttl to supported bounds', async () => {
    const { service, teardownQueue } = createService({ idleTtlMs: 1_000 });

    await service.scheduleIdleDisconnect({
      workspaceMemberId,
      workspaceId,
      accountId,
      authToken,
    });

    expect(teardownQueue?.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ delay: 60_000 }),
    );
  });
});
