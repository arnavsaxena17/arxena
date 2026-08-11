import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import {
  GTM_WORKSPACE_PROFILE_BOOTSTRAP_JOB_NAME,
  type GtmWorkspaceProfileBootstrapJobData,
} from 'src/engine/core-modules/gtm-command/jobs/gtm-workspace-profile-bootstrap.job-constants';
import { GtmWorkspaceProfileProvisioningService } from 'src/engine/core-modules/gtm-command/services/gtm-workspace-profile-provisioning.service';

@Processor(MessageQueue.workspaceQueue)
export class GtmWorkspaceProfileBootstrapJob {
  constructor(
    private readonly gtmWorkspaceProfileProvisioningService: GtmWorkspaceProfileProvisioningService,
  ) {}

  @Process(GTM_WORKSPACE_PROFILE_BOOTSTRAP_JOB_NAME)
  async handle(data: GtmWorkspaceProfileBootstrapJobData): Promise<void> {
    await this.gtmWorkspaceProfileProvisioningService.bootstrapWorkspaceProfile(
      data,
    );
  }
}
