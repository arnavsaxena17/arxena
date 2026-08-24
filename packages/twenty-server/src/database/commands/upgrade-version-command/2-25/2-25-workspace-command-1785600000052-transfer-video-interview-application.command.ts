import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

@RegisteredWorkspaceCommand('2.25.0', 1785600000052)
@Command({
  name: 'upgrade:2-25:transfer-video-interview-application',
  description:
    'Sync Arxena Standard after video-interview entities were extracted to an optional installable app (does not install the Video Interview app)',
})
export class TransferVideoInterviewApplicationCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Syncing Arxena Standard without Video Interview objects for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    // Video Interview is optional: do not create/install the app here.
    // Arxena Standard no longer declares VI objects; sync removes them when
    // they were still owned by Arxena. Workspaces that already installed the
    // app keep it until uninstall (see 1785600000053).
    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      `Arxena Standard synced without default Video Interview install for workspace ${workspaceId}`,
    );
  }
}
