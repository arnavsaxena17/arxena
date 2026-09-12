import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { ARXENA_STANDARD_COMMAND_MENU_ITEMS } from 'src/engine/workspace-manager/twenty-standard-application/constants/arxena-standard-command-menu-item.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const LINKEDIN_FETCH_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS = [
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxFetchLinkedinMessagesCandidate
    .universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxFetchLinkedinMessagesPerson
    .universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxFetchLinkedinPostsCandidate
    .universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxFetchLinkedinPostsPerson
    .universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxFetchLinkedinProfileCandidate
    .universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxFetchLinkedinProfilePerson
    .universalIdentifier,
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000115)
@Command({
  name: 'upgrade:2-25:add-linkedin-fetch-command-menu-items',
  description:
    'Sync candidate linkedinProfile/linkedinPosts fields and add LinkedIn fetch command menu items',
})
export class AddLinkedinFetchCommandMenuItemsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Adding LinkedIn fetch commands for workspace ${workspaceId}`,
    );

    if (!isDryRun) {
      await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
        { workspaceId },
      );
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatCommandMenuItemMaps',
      ]);

    const missingUniversalIdentifiers =
      LINKEDIN_FETCH_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS.filter(
        (universalIdentifier) =>
          !isDefined(
            existingFlatCommandMenuItemMaps.byUniversalIdentifier[
              universalIdentifier
            ],
          ),
      );

    if (missingUniversalIdentifiers.length === 0) {
      this.logger.log(
        `LinkedIn fetch commands already exist for workspace ${workspaceId}`,
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
        `LinkedIn fetch commands missing from standard maps for workspace ${workspaceId}`,
      );

      return;
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] Would create' : 'Creating'} ${itemsToCreate.length} LinkedIn fetch command menu item(s) for workspace ${workspaceId}`,
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
        `Failed to add LinkedIn fetch commands:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );

      throw new Error(
        `Failed to add LinkedIn fetch commands for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Successfully added ${itemsToCreate.length} LinkedIn fetch command(s) for workspace ${workspaceId}`,
    );
  }
}
