import { Command, Option } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import {
  type RunOnWorkspaceArgs,
  type WorkspaceCommandOptions,
} from 'src/database/commands/command-runners/workspace.command-runner';
import { ResyncOutreachSeededWorkflowPromptsCommand } from 'src/database/commands/resync-outreach-seeded-workflow-prompts.command';
import { ResyncSkillsCommand } from 'src/database/commands/resync-skills.command';

type SyncAiCommandOptions = WorkspaceCommandOptions & {
  workflows?: boolean;
};

// One command to run after editing AI text, for fast testing:
//   npx nx build twenty-shared
//   node dist/command/command.js ai:sync [-w <workspaceId>] [--dry-run] [--workflows]
//
// What is synced, and what is not:
// - skills: stored per workspace in core.skill, refreshed here.
// - seeded workflow agent prompts: stored as agents + workflow graphs, refreshed
//   only with --workflows because it replaces DRAFT and ACTIVE graphs.
// - tool definitions and the Ask AI system prompt are read from code on the
//   running server, so there is nothing stored to sync: rebuild twenty-shared
//   and let the server restart (the Arxena tool catalog also has a 5 min cache).
@Command({
  name: 'ai:sync',
  description:
    'Refresh stored AI text from the current code: all standard skills, plus seeded workflow agent prompts with --workflows',
})
export class SyncAiCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly resyncSkillsCommand: ResyncSkillsCommand,
    private readonly resyncOutreachSeededWorkflowPromptsCommand: ResyncOutreachSeededWorkflowPromptsCommand,
  ) {
    super(workspaceIteratorService);
  }

  @Option({
    flags: '--workflows',
    description:
      'Also re-seed outreach workflow agent prompts (replaces DRAFT and ACTIVE seeded workflow graphs)',
    required: false,
  })
  parseWorkflows(): boolean {
    return true;
  }

  override async runOnWorkspace(args: RunOnWorkspaceArgs): Promise<void> {
    const options = args.options as SyncAiCommandOptions;

    await this.resyncSkillsCommand.runOnWorkspace(args);

    if (options.workflows === true) {
      await this.resyncOutreachSeededWorkflowPromptsCommand.runOnWorkspace(
        args,
      );
    } else {
      this.logger.log(
        `Skipped seeded workflow prompts for ${args.workspaceId} (pass --workflows to include)`,
      );
    }
  }
}
