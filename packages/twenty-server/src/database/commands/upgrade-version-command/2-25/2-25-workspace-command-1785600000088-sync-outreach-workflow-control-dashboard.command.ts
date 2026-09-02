import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { OUTREACH_DASHBOARD_TITLE } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-page-layout.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000088)
@Command({
  name: 'upgrade:2-25:sync-outreach-workflow-control-dashboard',
  description:
    'Add the Outreach dashboard Workflow control tab, backing TABLE_WIDGET views, and workflow-run chart widgets',
})
export class SyncOutreachWorkflowControlDashboardCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Syncing ${OUTREACH_DASHBOARD_TITLE} workflow control dashboard for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatPageLayoutMaps',
      'flatViewMaps',
    ]);

    this.logger.log(
      `${OUTREACH_DASHBOARD_TITLE} workflow control dashboard synced for workspace ${workspaceId}`,
    );
  }
}
