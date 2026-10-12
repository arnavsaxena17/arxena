import { Command, CommandRunner, Option } from 'nest-commander';

import { OutreachListTool } from 'src/engine/core-modules/tool/tools/outreach-list-tool/outreach-list-tool';

type AttachOutreachListOptions = {
  workspaceId: string;
  listId: string;
  projectId: string;
};

// Re-runnable repair/convenience: show a list (or an old Bright Data dataset,
// by its plan id) on a project's Companies / People tab.
//   node dist/command/command.js outreach-list:attach -w <workspace> -l <listId|planId> -p <projectId>
@Command({
  name: 'outreach-list:attach',
  description:
    'Show an outreach list (or a saved Bright Data plan id) on a project tab',
})
export class AttachOutreachListCommand extends CommandRunner {
  constructor(private readonly outreachListTool: OutreachListTool) {
    super();
  }

  @Option({ flags: '-w, --workspace-id <id>', required: true })
  parseWorkspaceId(value: string): string {
    return value;
  }

  @Option({ flags: '-l, --list-id <id>', required: true })
  parseListId(value: string): string {
    return value;
  }

  @Option({ flags: '-p, --project-id <id>', required: true })
  parseProjectId(value: string): string {
    return value;
  }

  override async run(
    _passedParams: string[],
    options: AttachOutreachListOptions,
  ): Promise<void> {
    const output = await this.outreachListTool.execute(
      {
        action: 'attach',
        listId: options.listId,
        projectId: options.projectId,
      },
      { workspaceId: options.workspaceId },
    );

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output, null, 2));
  }
}
