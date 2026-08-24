import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { VideoInterviewApplicationService } from 'src/engine/workspace-manager/video-interview-application/services/video-interview-application.service';

@RegisteredWorkspaceCommand('2.25.0', 1785600000053)
@Command({
  name: 'upgrade:2-25:uninstall-video-interview-application-by-default',
  description:
    'Uninstall the Video Interview app from workspaces (it is optional, not pre-installed) and sync Arxena Standard so chat control fields remain',
})
export class UninstallVideoInterviewApplicationByDefaultCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly videoInterviewApplicationService: VideoInterviewApplicationService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Ensuring Video Interview is not installed by default for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.videoInterviewApplicationService.uninstallVideoInterviewApplicationIfPresent(
      { workspaceId },
    );

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      `Video Interview left uninstalled for workspace ${workspaceId}`,
    );
  }
}
