import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { StandardSkillSyncService } from 'src/database/commands/upgrade-version-command/common/standard-skill-sync.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// Replaces the per-skill sync commands: creates any standard skill a workspace
// is missing and refreshes the label and description of the rest.
@RegisteredWorkspaceCommand('2.25.0', 1785600000181)
@Command({
  name: 'upgrade:2-25:sync-standard-skills',
  description:
    'Create missing standard skills and refresh their label and description for existing workspaces',
})
export class SyncStandardSkillsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly standardSkillSyncService: StandardSkillSyncService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    await this.standardSkillSyncService.syncWorkspace({
      workspaceId,
      isDryRun: options.dryRun ?? false,
    });
  }
}
