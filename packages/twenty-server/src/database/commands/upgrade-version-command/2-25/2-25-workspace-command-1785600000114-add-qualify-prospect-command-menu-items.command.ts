import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ARXENA_STANDARD_COMMAND_MENU_ITEMS } from 'src/engine/workspace-manager/twenty-standard-application/constants/arxena-standard-command-menu-item.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const QUALIFY_PROSPECT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS = [
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxQualifyProspectCandidate
    .universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxQualifyProspectPerson
    .universalIdentifier,
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000114)
@Command({
  name: 'upgrade:2-25:add-qualify-prospect-command-menu-items',
  description:
    'Add Qualify Prospect command menu items for candidate and person',
})
export class AddQualifyProspectCommandMenuItemsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Checking Qualify Prospect commands for workspace ${workspaceId}`,
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
      QUALIFY_PROSPECT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS.filter(
        (universalIdentifier) =>
          !isDefined(
            existingFlatCommandMenuItemMaps.byUniversalIdentifier[
              universalIdentifier
            ],
          ),
      );

    if (missingUniversalIdentifiers.length === 0) {
      this.logger.log(
        `Qualify Prospect commands already exist for workspace ${workspaceId}, skipping`,
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
        `Qualify Prospect commands missing from standard maps for workspace ${workspaceId}`,
      );

      return;
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] Would create' : 'Creating'} ${itemsToCreate.length} Qualify Prospect command menu item(s) for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

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
        `Failed to add Qualify Prospect commands:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );

      throw new Error(
        `Failed to add Qualify Prospect commands for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Successfully added ${itemsToCreate.length} Qualify Prospect command(s) for workspace ${workspaceId}`,
    );
  }
}
