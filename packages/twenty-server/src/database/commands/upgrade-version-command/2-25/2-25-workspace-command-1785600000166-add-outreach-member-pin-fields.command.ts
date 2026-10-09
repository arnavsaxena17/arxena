import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import { getOutreachLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-logic-functions.util';

// Adds the candidate sender-pin fields and seeds the select-outreach-workspace-member
// logic function. The sequencer graph is untouched: workspaces opt in through
// Edit Workflow → "Pin outreach sender by warm overlap".
@RegisteredWorkspaceCommand('2.25.0', 1785600000166)
@Command({
  name: 'upgrade:2-25:add-outreach-member-pin-fields',
  description:
    'Add candidate outreachWorkspaceMemberId + assignment fields and seed the select-outreach-workspace-member logic function',
})
export class AddOutreachMemberPinFieldsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly prefillLogicFunctionService: PrefillLogicFunctionService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Adding outreach member pin fields for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    await this.prefillLogicFunctionService.ensureSeeded({
      workspaceId,
      definitions: getOutreachLogicFunctionDefinitions(workspaceId),
    });

    this.logger.log(
      `Outreach member pin fields and logic function ready for workspace ${workspaceId}`,
    );
  }
}
