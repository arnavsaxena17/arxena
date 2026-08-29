import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import {
  OUTREACH_WORKSPACE_PROFILE_BOOTSTRAP_JOB_NAME,
  type OutreachWorkspaceProfileBootstrapJobData,
} from 'src/engine/core-modules/outreach-command/jobs/outreach-workspace-profile-bootstrap.job-constants';
import { OutreachWorkspaceProfileProvisioningService } from 'src/engine/core-modules/outreach-command/services/outreach-workspace-profile-provisioning.service';

@Processor(MessageQueue.workspaceQueue)
export class OutreachWorkspaceProfileBootstrapJob {
  constructor(
    private readonly gtmWorkspaceProfileProvisioningService: OutreachWorkspaceProfileProvisioningService,
  ) {}

  @Process(OUTREACH_WORKSPACE_PROFILE_BOOTSTRAP_JOB_NAME)
  async handle(data: OutreachWorkspaceProfileBootstrapJobData): Promise<void> {
    await this.gtmWorkspaceProfileProvisioningService.bootstrapWorkspaceProfile(
      data,
    );
  }
}
