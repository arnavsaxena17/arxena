import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { OutreachDeferredResumeService } from 'src/engine/core-modules/outreach-command/services/outreach-deferred-resume.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Injectable()
export class OutreachDeferredResumeCronService {
  private readonly logger = new Logger(OutreachDeferredResumeCronService.name);
  private isProcessing = false;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly outreachDeferredResumeService: OutreachDeferredResumeService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'outreach-deferred-resume',
  })
  async resumeDueDeferredCandidates(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const workspaceIds = await this.workspaceQueryService.getWorkspaces();

      for (const workspaceId of workspaceIds) {
        const { resumed } =
          await this.outreachDeferredResumeService.resumeDueCandidates({
            workspaceId,
          });

        if (resumed > 0) {
          this.logger.log(
            `Resumed ${resumed} deferred outreach candidates in workspace ${workspaceId}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to resume deferred outreach candidates', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
