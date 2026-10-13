import { Command } from 'nest-commander';

import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { SupersededSkillSyncCommandRunner } from 'src/database/commands/upgrade-version-command/common/superseded-skill-sync.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// Superseded by upgrade:2-25:sync-standard-skills. Kept as a no-op so the
// recorded upgrade step still exists in the sequence.
@RegisteredWorkspaceCommand('2.25.0', 1785600000030)
@Command({
  name: 'upgrade:2-25:sync-gtm-outreach-workflows-skill-content',
  description:
    'Sync gtm-outreach-workflows skill content (upload-profiles enroll + sequential messageObj) for existing workspaces (superseded, no-op)',
})
export class SyncOutreachWorkflowsSkillContentCommand extends SupersededSkillSyncCommandRunner {
  constructor(protected readonly workspaceIteratorService: WorkspaceIteratorService) {
    super(workspaceIteratorService);
  }
}
