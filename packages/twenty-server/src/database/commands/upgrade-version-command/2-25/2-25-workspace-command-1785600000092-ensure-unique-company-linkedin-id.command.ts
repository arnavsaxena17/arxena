import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { applyUniqueCompanyLinkedinId } from 'src/database/commands/upgrade-version-command/2-25/utils/apply-unique-company-linkedin-id.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

// Follow-up for workspaces that completed 1785600000066 while it was a no-op
// after the Arxena-manifest index approach failed.
@RegisteredWorkspaceCommand('2.25.0', 1785600000092)
@Command({
  name: 'upgrade:2-25:ensure-unique-company-linkedin-id',
  description:
    'Re-apply unique Company.linkedinId via workspace SQL for workspaces that skipped the original unique-index command',
})
export class EnsureUniqueCompanyLinkedinIdCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;
    const schemaName = getWorkspaceSchemaName(workspaceId);

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Re-ensuring unique Company.linkedinId for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await applyUniqueCompanyLinkedinId({
      coreDataSource: this.coreDataSource,
      workspaceQueryService: this.workspaceQueryService,
      schemaName,
      workspaceId,
      logger: this.logger,
    });
  }
}
