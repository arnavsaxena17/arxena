import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { StandardSkillSyncService } from 'src/database/commands/upgrade-version-command/common/standard-skill-sync.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// The standard skill keeps its universal identifier, so the sync reconciler
// finds the stored `search` row and renames it. Until it runs, the old name
// still loads (see SKILL_NAME_ALIASES).
@RegisteredWorkspaceCommand('2.25.0', 1785600000184)
@Command({
  name: 'upgrade:2-25:rename-search-skill-to-sourcing',
  description: 'Rename the stored `search` skill to `sourcing`',
})
export class RenameSearchSkillToSourcingCommand extends ProvisionedWorkspaceCommandRunner {
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
