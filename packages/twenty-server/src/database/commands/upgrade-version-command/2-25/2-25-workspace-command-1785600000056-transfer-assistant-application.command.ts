import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { AssistantApplicationService } from 'src/engine/workspace-manager/assistant-application/services/assistant-application.service';

@RegisteredWorkspaceCommand('2.25.0', 1785600000056)
@Command({
  name: 'upgrade:2-25:transfer-assistant-application',
  description:
    'Optionally install Assistant only when the workspace already has assistantThread objects; reassign metadata without changing universalIdentifiers, then sync Arxena Standard. Clean/GTM workspaces stay uninstalled.',
})
export class TransferAssistantApplicationCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly assistantApplicationService: AssistantApplicationService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Optionally transferring assistant metadata for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    const installed =
      await this.assistantApplicationService.installIfAlreadyPresent({
        workspaceId,
      });

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      installed
        ? `Transferred assistant application ownership for workspace ${workspaceId}`
        : `Left assistant uninstalled for workspace ${workspaceId}; Arxena Standard synced without assistantThread`,
    );
  }
}
