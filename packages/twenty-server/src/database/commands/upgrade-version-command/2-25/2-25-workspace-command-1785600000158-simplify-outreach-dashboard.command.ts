import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { OUTREACH_DASHBOARD_TITLE } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-page-layout.util';

// Re-syncs the Arxena standard manifest so the Outreach dashboard drops its
// eight tabs and ~55 widgets for the single Overview tab (eight widgets).
// Removed tabs/widgets are deleted by the manifest diff.
@RegisteredWorkspaceCommand('2.25.0', 1785600000158)
@Command({
  name: 'upgrade:2-25:simplify-outreach-dashboard',
  description:
    'Replace the Outreach dashboard tabs with a single Overview tab of eight candidate widgets',
})
export class SimplifyOutreachDashboardCommand extends ProvisionedWorkspaceCommandRunner {
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
      `${isDryRun ? '[DRY RUN] ' : ''}Simplifying ${OUTREACH_DASHBOARD_TITLE} dashboard for workspace ${workspaceId}`,
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
      `${OUTREACH_DASHBOARD_TITLE} dashboard simplified for workspace ${workspaceId}`,
    );
  }
}
