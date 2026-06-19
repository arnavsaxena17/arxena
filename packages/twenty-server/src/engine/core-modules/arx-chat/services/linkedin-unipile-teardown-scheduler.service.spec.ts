import { LinkedinUnipileTeardownSchedulerService } from './linkedin-unipile-teardown-scheduler.service';

describe('LinkedinUnipileTeardownSchedulerService', () => {
  const workspaceMemberId = 'member-1';
  const workspaceId = 'workspace-1';
  const accountId = 'account-1';
  const authToken = 'auth-token';

  const createService = (options?: {
    idleTtlMs?: number;
    queueAvailable?: boolean;
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
          scheduleOrRescheduleDelayed: jest.fn(),
          cancelDelayed: jest.fn(),
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

    expect(teardownQueue?.scheduleOrRescheduleDelayed).toHaveBeenCalledWith(
      'LinkedinUnipileTeardownProcessor',
      expect.objectContaining({
        workspaceMemberId,
        workspaceId,
        accountId,
        authToken,
      }),
      {
        id: `linkedin-unipile-teardown-${workspaceMemberId}`,
        delayMs: 300_000,
      },
    );
  });

  it('cancels pending disconnect by workspace member id', async () => {
    const { service, teardownQueue } = createService();

    await service.cancelPendingDisconnect(workspaceMemberId);

    expect(teardownQueue?.cancelDelayed).toHaveBeenCalledWith(
      `linkedin-unipile-teardown-${workspaceMemberId}`,
    );
  });

  it('clamps idle ttl to supported bounds', async () => {
    const { service, teardownQueue } = createService({ idleTtlMs: 1_000 });

    await service.scheduleIdleDisconnect({
      workspaceMemberId,
      workspaceId,
      accountId,
      authToken,
    });

    expect(teardownQueue?.scheduleOrRescheduleDelayed).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ delayMs: 60_000 }),
    );
  });
});
