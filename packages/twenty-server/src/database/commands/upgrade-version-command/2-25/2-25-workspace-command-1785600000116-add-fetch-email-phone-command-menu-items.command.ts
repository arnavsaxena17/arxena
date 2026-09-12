import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import { getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';
import { getOutreachLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-logic-functions.util';
import { ARXENA_STANDARD_COMMAND_MENU_ITEMS } from 'src/engine/workspace-manager/twenty-standard-application/constants/arxena-standard-command-menu-item.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const FETCH_EMAIL_PHONE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS = [
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxFetchEmail.universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxFetchPhone.universalIdentifier,
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000116)
@Command({
  name: 'upgrade:2-25:add-fetch-email-phone-command-menu-items',
  description:
    'Seed fetch-email/fetch-phone logic functions and add Fetch Email / Fetch Phone command menu items',
})
export class AddFetchEmailPhoneCommandMenuItemsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Adding Fetch Email / Fetch Phone for workspace ${workspaceId}`,
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

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatCommandMenuItemMaps',
      ]);

    const missingUniversalIdentifiers =
      FETCH_EMAIL_PHONE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS.filter(
        (universalIdentifier) =>
          !isDefined(
            existingFlatCommandMenuItemMaps.byUniversalIdentifier[
              universalIdentifier
            ],
          ),
      );

    if (missingUniversalIdentifiers.length === 0) {
      this.logger.log(
        `Fetch Email / Fetch Phone commands already exist for workspace ${workspaceId}`,
      );

      return;
    }

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const itemsToCreate = missingUniversalIdentifiers
      .map(
        (universalIdentifier) =>
          standardAllFlatEntityMaps.flatCommandMenuItemMaps
            .byUniversalIdentifier[universalIdentifier],
      )
      .filter(isDefined);

    if (itemsToCreate.length === 0) {
      this.logger.warn(
        `Fetch Email / Fetch Phone commands missing from standard maps for workspace ${workspaceId}`,
      );

      return;
    }

    this.logger.log(
      `Creating ${itemsToCreate.length} Fetch Email / Fetch Phone command menu item(s) for workspace ${workspaceId}`,
    );

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            commandMenuItem: {
              flatEntityToCreate: itemsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      this.logger.error(
        `Failed to add Fetch Email / Fetch Phone commands:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );

      throw new Error(
        `Failed to add Fetch Email / Fetch Phone commands for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Successfully added ${itemsToCreate.length} Fetch Email / Fetch Phone command(s) for workspace ${workspaceId}`,
    );
  }
}
