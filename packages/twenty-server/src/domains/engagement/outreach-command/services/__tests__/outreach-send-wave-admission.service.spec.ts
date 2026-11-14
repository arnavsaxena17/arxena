import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { registerAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';
import {
  OUTREACH_SEND_WAVE_MIN_DEFER_MS,
  OutreachSendWaveAdmissionService,
} from 'src/domains/engagement/outreach-command/services/outreach-send-wave-admission.service';

const buildService = ({
  member,
}: {
  member: Record<string, unknown> | null;
}) => {
  const getRepository = jest.fn(async () => ({
    findOne: jest.fn(async () => member),
  }));
  const ormManager = {
    executeInWorkspaceContext: jest.fn(async (callback: () => Promise<unknown>) =>
      callback(),
    ),
    getRepository,
  };

  return {
    service: new OutreachSendWaveAdmissionService(ormManager as never),
    getRepository,
  };
};

const memberWithAccount = {
  id: 'member-1',
  linkedinUnipileAccountId: 'linkedin-acc-1',
};

describe('OutreachSendWaveAdmissionService', () => {
  it('admits a candidate while the limiter still sees a send slot', async () => {
    const peekLinkedinSendAdmission = jest.fn(async () => ({
      admitted: true,
      waitMs: 0,
    }));
    registerAccountRateLimiter({
      reserveLinkedinSendWaveSlot: peekLinkedinSendAdmission,
    } as never);
    const { service } = buildService({ member: memberWithAccount });

    await expect(
      service.execute({
        workspaceId: 'workspace-1',
        input: { workspaceMemberId: 'member-1', candidateId: 'candidate-1' },
      }),
    ).resolves.toEqual({
      success: true,
      admitted: true,
      waitMs: 0,
      nextSlotAt: null,
      linkedinAccountId: 'linkedin-acc-1',
      reason: 'admitted',
    });
    expect(peekLinkedinSendAdmission).toHaveBeenCalledWith({
      accountId: 'linkedin-acc-1',
    });
  });

  it('defers the run to the next slot when the send wave is full', async () => {
    const waitMs = 4 * 60 * 60 * 1000;
    registerAccountRateLimiter({
      reserveLinkedinSendWaveSlot: jest.fn(async () => ({
        admitted: false,
        waitMs,
      })),
    } as never);
    const { service } = buildService({ member: memberWithAccount });

    await expect(
      service.execute({
        workspaceId: 'workspace-1',
        input: { workspaceMemberId: 'member-1', candidateId: 'candidate-1' },
      }),
    ).rejects.toBeInstanceOf(AccountRateLimitDeferredError);

    const admission = service.execute({
      workspaceId: 'workspace-1',
      input: { workspaceMemberId: 'member-1', candidateId: 'candidate-1' },
    });

    await admission.catch((error: AccountRateLimitDeferredError) => {
      expect(error.waitMs).toBe(waitMs);
      expect(error.accountId).toBe('linkedin-acc-1');
      expect(error.method).toBe('connection_request');
    });
  });

  it('never bounces a run for less than the minimum defer window', async () => {
    registerAccountRateLimiter({
      reserveLinkedinSendWaveSlot: jest.fn(async () => ({
        admitted: false,
        waitMs: 5_000,
      })),
    } as never);
    const { service } = buildService({ member: memberWithAccount });

    await expect(
      service.execute({
        workspaceId: 'workspace-1',
        input: { workspaceMemberId: 'member-1' },
      }),
    ).rejects.toMatchObject({ waitMs: OUTREACH_SEND_WAVE_MIN_DEFER_MS });
  });

  it('lets the run through when the member has no LinkedIn seat yet', async () => {
    const reserveLinkedinSendWaveSlot = jest.fn();
    registerAccountRateLimiter({ reserveLinkedinSendWaveSlot } as never);
    const { service } = buildService({
      member: { id: 'member-1', linkedinUnipileAccountId: null },
    });

    await expect(
      service.execute({
        workspaceId: 'workspace-1',
        input: { workspaceMemberId: 'member-1' },
      }),
    ).resolves.toMatchObject({
      admitted: true,
      linkedinAccountId: '',
      reason: 'no_linkedin_account',
    });
    expect(reserveLinkedinSendWaveSlot).not.toHaveBeenCalled();
  });

  it('lets the run through without touching the database when the member id is missing', async () => {
    registerAccountRateLimiter({} as never);
    const { service, getRepository } = buildService({ member: null });

    await expect(
      service.execute({ workspaceId: 'workspace-1', input: {} }),
    ).resolves.toMatchObject({ admitted: true, reason: 'no_linkedin_account' });
    expect(getRepository).not.toHaveBeenCalled();
  });
});
