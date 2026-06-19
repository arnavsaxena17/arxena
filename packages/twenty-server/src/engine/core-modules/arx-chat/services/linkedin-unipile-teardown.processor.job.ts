import { Injectable, Logger } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

import { LinkedinUnipileTeardownJobData } from '../types/linkedin-unipile-teardown.types';
import { LINKEDIN_UNIPILE_TEARDOWN_PROCESSOR_NAME } from '../utils/linkedin-unipile-teardown-job.util';
import { MemberLinkedinUnipileConnectionService } from './member-linkedin-unipile-connection.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

@Injectable()
@Processor(MessageQueue.linkedinUnipileTeardownQueue)
export class LinkedinUnipileTeardownProcessor {
  private readonly logger = new Logger(LinkedinUnipileTeardownProcessor.name);

  constructor(
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly memberLinkedinUnipileConnectionService: MemberLinkedinUnipileConnectionService,
  ) {}

  @Process(LINKEDIN_UNIPILE_TEARDOWN_PROCESSOR_NAME)
  async handle(jobData: LinkedinUnipileTeardownJobData): Promise<void> {
    const workspaceMemberId = jobData.workspaceMemberId?.trim();
    const workspaceId = jobData.workspaceId?.trim();
    const accountId = jobData.accountId?.trim();
    const authToken = jobData.authToken?.trim();

    if (!workspaceMemberId || !workspaceId || !accountId || !authToken) {
      this.logger.warn(
        `Skipping LinkedIn Unipile idle disconnect due to incomplete job data: ${JSON.stringify(jobData)}`,
      );
      return;
    }

    const storedAccountId =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
        workspaceMemberId,
        workspaceId,
        authToken,
        'linkedin',
      );

    if (storedAccountId?.trim() !== accountId) {
      this.logger.log(
        `Skipping LinkedIn Unipile idle disconnect because profile account changed workspaceMemberId=${workspaceMemberId} expectedAccountId=${accountId} storedAccountId=${storedAccountId ?? 'none'}`,
      );
      return;
    }

    this.logger.log(
      `Running LinkedIn Unipile idle disconnect workspaceMemberId=${workspaceMemberId} accountId=${accountId} scheduledAt=${new Date(jobData.scheduledAt).toISOString()}`,
    );

    await this.memberLinkedinUnipileConnectionService.disconnectMemberLinkedinUnipileAccount(
      {
        accountId,
        context: 'idle timeout after on-demand LinkedIn Unipile session',
        workspaceMemberId,
        workspaceId,
        authToken,
        forceClearProfile: true,
      },
    );
  }
}
