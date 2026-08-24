import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { ShortlistPresentationApplicationService } from 'src/engine/workspace-manager/shortlist-presentation-application/services/shortlist-presentation-application.service';

@RegisteredWorkspaceCommand('2.25.0', 1785600000054)
@Command({
  name: 'upgrade:2-25:transfer-shortlist-presentation-application',
  description:
    'Optionally install Shortlist Presentation only when the workspace already has shortlist-domain objects; reassign metadata without changing universalIdentifiers, then sync Arxena Standard. Clean/GTM workspaces stay uninstalled.',
})
export class TransferShortlistPresentationApplicationCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly shortlistPresentationApplicationService: ShortlistPresentationApplicationService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Optionally transferring shortlist presentation metadata for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    const installed =
      await this.shortlistPresentationApplicationService.installIfAlreadyPresent(
        { workspaceId },
      );

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      installed
        ? `Transferred shortlist presentation application ownership for workspace ${workspaceId}`
        : `Left shortlist presentation uninstalled for workspace ${workspaceId}; Arxena Standard synced without shortlist-domain objects`,
    );
  }
}
