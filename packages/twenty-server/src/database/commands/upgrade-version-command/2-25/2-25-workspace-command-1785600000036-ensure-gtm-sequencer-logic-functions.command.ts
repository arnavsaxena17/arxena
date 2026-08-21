import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import { getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';
import { getGtmOutreachLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-gtm-logic-functions.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

@RegisteredWorkspaceCommand('2.25.0', 1785600000036)
@Command({
  name: 'upgrade:2-25:ensure-gtm-sequencer-logic-functions',
  description:
    'Seed upsert-companies, enrich-contact, get-calendar-availability and Candidate linkedinFollowUpCount',
})
export class EnsureGtmSequencerLogicFunctionsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly prefillLogicFunctionService: PrefillLogicFunctionService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Ensuring GTM sequencer logic functions and fields for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.prefillLogicFunctionService.ensureSeeded({
      workspaceId,
      definitions: [
        ...getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions(
          workspaceId,
        ),
        ...getGtmOutreachLogicFunctionDefinitions(workspaceId),
      ],
    });

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );
  }
}
