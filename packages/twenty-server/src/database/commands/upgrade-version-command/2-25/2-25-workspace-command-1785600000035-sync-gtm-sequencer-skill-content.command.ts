import { Command } from 'nest-commander';

import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { SupersededSkillSyncCommandRunner } from 'src/database/commands/upgrade-version-command/common/superseded-skill-sync.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

// Superseded by upgrade:2-25:sync-standard-skills. Kept as a no-op so the
// recorded upgrade step still exists in the sequence.
@RegisteredWorkspaceCommand('2.25.0', 1785600000035)
@Command({
  name: 'upgrade:2-25:sync-gtm-sequencer-skill-content',
  description:
    'Sync GTM sequencer skill content (harvest vs Redis, FORM HITL, .result paths) for existing workspaces (superseded, no-op)',
})
export class SyncOutreachSequencerSkillContentCommand extends SupersededSkillSyncCommandRunner {
  constructor(protected readonly workspaceIteratorService: WorkspaceIteratorService) {
    super(workspaceIteratorService);
  }
}
