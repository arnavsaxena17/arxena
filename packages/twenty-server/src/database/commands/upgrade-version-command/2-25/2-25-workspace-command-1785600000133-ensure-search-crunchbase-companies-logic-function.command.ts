import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import { getOutreachLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-logic-functions.util';
import { getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000133)
@Command({
  name: 'upgrade:2-25:ensure-search-crunchbase-companies-logic-function',
  description:
    'Seed native search-crunchbase-companies logic function for existing workspaces',
})
export class EnsureSearchCrunchbaseCompaniesLogicFunctionCommand extends ProvisionedWorkspaceCommandRunner {
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
      `${isDryRun ? '[DRY RUN] ' : ''}Ensuring search-crunchbase-companies logic function for workspace ${workspaceId}`,
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
        ...getOutreachLogicFunctionDefinitions(workspaceId),
      ],
    });

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );
  }
}
