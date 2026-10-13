import { Command } from 'nest-commander';

import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { SupersededSkillSyncCommandRunner } from 'src/database/commands/upgrade-version-command/common/superseded-skill-sync.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// Superseded by upgrade:2-25:sync-standard-skills. Kept as a no-op so the
// recorded upgrade step still exists in the sequence.
@RegisteredWorkspaceCommand('2.25.0', 1785600000037)
@Command({
  name: 'upgrade:2-25:sync-gtm-sequencer-skill-recipes',
  description:
    'Sync GTM sequencer skill recipes (harvest CRON, linkedinFollowUpCount, people-tab vs enroll) (superseded, no-op)',
})
export class SyncOutreachSequencerSkillRecipesCommand extends SupersededSkillSyncCommandRunner {
  constructor(protected readonly workspaceIteratorService: WorkspaceIteratorService) {
    super(workspaceIteratorService);
  }
}
