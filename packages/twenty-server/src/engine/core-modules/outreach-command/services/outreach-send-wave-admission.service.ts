import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { getRegisteredAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

// Never bounce a run for less than a minute: shorter holds would spin the
// delayed queue and fight the per-method pacing windows.
export const OUTREACH_SEND_WAVE_MIN_DEFER_MS = 60_000;

type WorkspaceMemberSenderRecord = ObjectLiteral & {
  id: string;
  linkedinUnipileAccountId?: string | null;
};

export type OutreachSendWaveAdmissionInput = {
  workspaceMemberId?: string;
  candidateId?: string;
};

export type OutreachSendWaveAdmissionResult = {
  success: boolean;
  admitted: boolean;
  waitMs: number;
  nextSlotAt: string | null;
  linkedinAccountId: string;
  reason: string;
};

/**
 * Admission gate for the QUEUED branch of the candidate sequencer.
 *
 * A queued candidate costs two LinkedIn requests: one profile read and one
 * connection request. Starting a whole queue at once spends the account's
 * shared daily budget on reads before any invitation leaves. This checks the
 * same reservation math the limiter uses and atomically takes one of the
 * day's send-wave slots, then throws the deferred error so the run parks until
 * the next slot instead of draining the day.
 */
@Injectable()
export class OutreachSendWaveAdmissionService {
  private readonly logger = new Logger(OutreachSendWaveAdmissionService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: OutreachSendWaveAdmissionInput;
  }): Promise<OutreachSendWaveAdmissionResult> {
    const workspaceMemberId = input.workspaceMemberId?.trim() ?? '';
    const linkedinAccountId = await this.resolveLinkedinAccountId({
      workspaceId,
      workspaceMemberId,
    });
    const candidateLabel = input.candidateId?.trim() || 'unknown candidate';

    if (!isNonEmptyString(linkedinAccountId)) {
      // No seat yet: let the send step surface the connection problem itself.
      return this.admittedResult({
        linkedinAccountId: '',
        reason: 'no_linkedin_account',
      });
    }

    const limiter = getRegisteredAccountRateLimiter();

    if (!limiter) {
      return this.admittedResult({
        linkedinAccountId,
        reason: 'no_rate_limiter',
      });
    }

    const { admitted, waitMs } = await limiter.reserveLinkedinSendWaveSlot({
      accountId: linkedinAccountId,
    });

    if (admitted) {
      return this.admittedResult({ linkedinAccountId, reason: 'admitted' });
    }

    const deferMs = Math.max(waitMs, OUTREACH_SEND_WAVE_MIN_DEFER_MS);

    this.logger.log(
      `Holding ${candidateLabel} for ${Math.ceil(deferMs / 1000)}s: send wave full on LinkedIn account ${linkedinAccountId}`,
    );

    throw new AccountRateLimitDeferredError({
      waitMs: deferMs,
      accountId: linkedinAccountId,
      method: 'connection_request',
      message: `Send wave full for this LinkedIn account. Retry in ${Math.ceil(deferMs / 1000)}s.`,
    });
  }

  private admittedResult({
    linkedinAccountId,
    reason,
  }: {
    linkedinAccountId: string;
    reason: string;
  }): OutreachSendWaveAdmissionResult {
    return {
      success: true,
      admitted: true,
      waitMs: 0,
      nextSlotAt: null,
      linkedinAccountId,
      reason,
    };
  }

  private async resolveLinkedinAccountId({
    workspaceId,
    workspaceMemberId,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
  }): Promise<string> {
    if (!isNonEmptyString(workspaceMemberId)) {
      return '';
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const memberRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberSenderRecord>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const member = await memberRepository.findOne({
          where: { id: workspaceMemberId },
          select: {
            id: true,
            linkedinUnipileAccountId: true,
          },
        });

        if (!isDefined(member)) {
          return '';
        }

        return member.linkedinUnipileAccountId?.trim() ?? '';
      },
      authContext,
    );
  }
}
