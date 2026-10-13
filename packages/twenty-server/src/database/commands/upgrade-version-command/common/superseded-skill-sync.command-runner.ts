import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';

// Skill text used to be copied into every workspace by one command per edit.
// It is now served from code and the rows are reconciled by SyncStandardSkillsCommand.
// The old commands stay registered, as no-ops, because each workspace's upgrade
// cursor is the name of the last command it ran and the pipeline throws when
// that name is missing from the sequence.
export abstract class SupersededSkillSyncCommandRunner extends ProvisionedWorkspaceCommandRunner {
  override async runOnWorkspace({
    workspaceId,
  }: RunOnWorkspaceArgs): Promise<void> {
    this.logger.log(
      `Skipping ${this.constructor.name} for workspace ${workspaceId}: superseded by upgrade:2-25:sync-standard-skills`,
    );
  }
}
