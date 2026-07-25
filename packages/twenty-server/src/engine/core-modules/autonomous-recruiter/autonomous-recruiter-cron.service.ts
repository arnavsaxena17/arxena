import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { In } from 'typeorm';
import { AutonomousRecruiterProcessor } from './autonomous-recruiter.processor';

/** Set to true to disable the autonomous recruiter cron (feature flag for rollout). */
const CRON_DISABLED = true;
const HEARTBEAT_CRON = '0 */15 * * * *';
/** Workspace IDs to skip when enqueuing heartbeat jobs. */
const WORKSPACES_TO_IGNORE: string[] = [];
/** If non-empty, only these workspace IDs receive heartbeat projects(single-workspace rollout). */
const SPECIFIC_WORKSPACES_TO_EXECUTE: string[] = [];

@Injectable()
export class AutonomousRecruiterCronService {
  private readonly logger = new Logger(AutonomousRecruiterCronService.name);
  private isProcessing = false;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    @InjectMessageQueue(MessageQueue.autonomousRecruiterQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  private filterWorkspaces(workspaces: Array<{ id: string; schema: string }>): Array<{ id: string; schema: string }> {
    let filtered = workspaces;
    if (WORKSPACES_TO_IGNORE.length > 0) {
      filtered = filtered.filter((w) => !WORKSPACES_TO_IGNORE.includes(w.id));
    }
    if (SPECIFIC_WORKSPACES_TO_EXECUTE.length > 0) {
      filtered = filtered.filter((w) => SPECIFIC_WORKSPACES_TO_EXECUTE.includes(w.id));
    }
    return filtered;
  }

  @Cron(HEARTBEAT_CRON, { name: 'autonomous-recruiter-heartbeat', disabled: CRON_DISABLED })
  async handleCron(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Previous autonomous recruiter cycle still running, skipping');
      return;
    }
    this.isProcessing = true;
    const runId = `run-${Date.now()}`;
    try {
      this.logger.log('Starting autonomous recruiter heartbeat cycle');
      const workspaceIds = await this.workspaceQueryService.getWorkspaces();
      const dataSources = await this.workspaceQueryService.dataSourceRepository.find({
        where: { workspaceId: In(workspaceIds) },
      });
      const uniqueWorkspaces = Array.from(new Set(dataSources.map((ds) => ds.workspaceId))).map((id) => ({
        id,
        schema: this.workspaceQueryService.workspaceDataSourceService.getSchemaName(id),
      }));
      const filtered = this.filterWorkspaces(uniqueWorkspaces);
      for (const workspace of filtered) {
        try {
          await this.messageQueueService.add<{ workspaceId: string; schema: string; runId: string; timestamp: number }>(
            AutonomousRecruiterProcessor.name,
            {
              workspaceId: workspace.id,
              schema: workspace.schema,
              runId,
              timestamp: Date.now(),
            },
            { id: `autonomous-recruiter-${workspace.id}-${runId}` },
          );
          this.logger.log(`Queued heartbeat for workspace ${workspace.id}`);
        } catch (err) {
          this.logger.error(`Failed to queue workspace ${workspace.id}: ${(err as Error).message}`);
        }
      }
    } finally {
      this.isProcessing = false;
      this.logger.log('Ended autonomous recruiter heartbeat cycle');
    }
  }
}
