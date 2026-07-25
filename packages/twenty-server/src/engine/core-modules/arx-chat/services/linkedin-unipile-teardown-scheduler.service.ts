import { Injectable, Logger, Optional } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

import { LinkedinUnipileTeardownJobData } from '../types/linkedin-unipile-teardown.types';
import {
    getLinkedinUnipileTeardownProjectId,
    LINKEDIN_UNIPILE_TEARDOWN_PROCESSOR_NAME,
} from '../utils/linkedin-unipile-teardown-job.util';

const DEFAULT_IDLE_TTL_MS = 5 * 60 * 1000;
const MIN_IDLE_TTL_MS = 60 * 1000;
const MAX_IDLE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class LinkedinUnipileTeardownSchedulerService {
  private readonly logger = new Logger(LinkedinUnipileTeardownSchedulerService.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    @Optional()
    @InjectMessageQueue(MessageQueue.linkedinUnipileTeardownQueue)
    private readonly teardownQueue?: MessageQueueService,
  ) {}

  private getIdleTtlMs(): number {
    const configured =
      this.environmentService.get('LINKEDIN_UNIPILE_SESSION_IDLE_TTL_MS') ??
      DEFAULT_IDLE_TTL_MS;

    return Math.min(
      MAX_IDLE_TTL_MS,
      Math.max(MIN_IDLE_TTL_MS, configured),
    );
  }

  async cancelPendingDisconnect(workspaceMemberId: string): Promise<void> {
    const trimmedMemberId = workspaceMemberId.trim();
    if (!trimmedMemberId || !this.teardownQueue) {
      return;
    }

    const projectId = getLinkedinUnipileTeardownProjectId(trimmedMemberId);
    await this.teardownQueue.cancelDelayed(projectId);
    this.logger.log(
      `Cancelled pending LinkedIn Unipile idle disconnect workspaceMemberId=${trimmedMemberId} projectId=${projectId}`,
    );
  }

  async scheduleIdleDisconnect(args: {
    workspaceMemberId: string;
    workspaceId: string;
    accountId: string;
    authToken: string;
  }): Promise<void> {
    const workspaceMemberId = args.workspaceMemberId.trim();
    const workspaceId = args.workspaceId.trim();
    const accountId = args.accountId.trim();
    const authToken = args.authToken.trim();

    if (!workspaceMemberId || !workspaceId || !accountId || !authToken) {
      return;
    }

    if (!this.teardownQueue) {
      this.logger.warn(
        `LinkedIn Unipile teardown queue unavailable; skipping idle disconnect schedule workspaceMemberId=${workspaceMemberId}`,
      );
      return;
    }

    const delayMs = this.getIdleTtlMs();
    const projectId = getLinkedinUnipileTeardownProjectId(workspaceMemberId);
    const jobData: LinkedinUnipileTeardownJobData = {
      workspaceMemberId,
      workspaceId,
      accountId,
      authToken,
      scheduledAt: Date.now(),
    };

    await this.teardownQueue.scheduleOrRescheduleDelayed(
      LINKEDIN_UNIPILE_TEARDOWN_PROCESSOR_NAME,
      jobData,
      { id: projectId, delayMs },
    );

    this.logger.log(
      `Scheduled LinkedIn Unipile idle disconnect workspaceMemberId=${workspaceMemberId} accountId=${accountId} delayMs=${delayMs} projectId=${projectId}`,
    );
  }
}
