import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

@RegisteredWorkspaceCommand('2.25.0', 1785600000066)
@Command({
  name: 'upgrade:2-25:unique-company-linkedin-id',
  description:
    'No-op: unique Company.linkedinId index is not applied (Arxena manifest cannot index Twenty standard Company)',
})
export class UniqueCompanyLinkedinIdCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    this.logger.log(
      `${options.dryRun ? '[DRY RUN] ' : ''}Skipping unique Company.linkedinId index for workspace ${workspaceId}`,
    );
  }
}
