import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { getStandardFlatEntitiesToCreateOrThrow } from 'src/database/commands/upgrade-version-command/2-10/utils/get-standard-flat-entities-to-create-or-throw.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';
import { type WorkflowRunWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';

const WORKFLOW_RUN = STANDARD_OBJECTS.workflowRun;

const FIELD_UNIVERSAL_IDENTIFIERS = [
  WORKFLOW_RUN.fields.stateVersion.universalIdentifier,
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000139)
@Command({
  name: 'upgrade:2-25:add-workflow-run-state-version',
  description:
    'Add stateVersion on workflowRun for optimistic concurrency on state updates',
})
export class AddWorkflowRunStateVersionCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
        'flatFieldMetadataMaps',
      ]);

    const workflowRunObject = Object.values(
      flatObjectMetadataMaps.byUniversalIdentifier,
    ).find(
      (objectMetadata): objectMetadata is FlatObjectMetadata =>
        isDefined(objectMetadata) &&
        objectMetadata.universalIdentifier === WORKFLOW_RUN.universalIdentifier,
    );

    if (!isDefined(workflowRunObject)) {
      this.logger.log(
        `workflowRun object not found for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const fieldsToCreate =
      getStandardFlatEntitiesToCreateOrThrow<FlatFieldMetadata>({
        standardFlatEntityMaps: standardAllFlatEntityMaps.flatFieldMetadataMaps,
        existingFlatEntityMaps: flatFieldMetadataMaps,
        universalIdentifiers: FIELD_UNIVERSAL_IDENTIFIERS,
      });

    if (fieldsToCreate.length > 0) {
      this.logger.log(
        `${isDryRun ? '[DRY RUN] ' : ''}Creating workflowRun.stateVersion for workspace ${workspaceId}`,
      );

      if (!isDryRun) {
        const result =
          await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
            {
              isSystemBuild: true,
              applicationUniversalIdentifier:
                twentyStandardFlatApplication.universalIdentifier,
              workspaceId,
              allFlatEntityOperationByMetadataName: {
                fieldMetadata: {
                  flatEntityToCreate: fieldsToCreate,
                  flatEntityToDelete: [],
                  flatEntityToUpdate: [],
                },
              },
            },
          );

        if (result.status === 'fail') {
          this.logger.error(
            `Failed to add workflowRun.stateVersion:\n${JSON.stringify(result, null, 2)}`,
          );

          throw new Error(
            `Failed to add workflowRun.stateVersion for workspace ${workspaceId}`,
          );
        }
      }
    }

    if (isDryRun) {
      return;
    }

    await this.backfillNullStateVersions(workspaceId);
  }

  private async backfillNullStateVersions(workspaceId: string): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowRunRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
          workspaceId,
          'workflowRun',
          { shouldBypassPermissionChecks: true },
        );

      await workflowRunRepository
        .createQueryBuilder()
        .update()
        .set({ stateVersion: 0 })
        .where('"stateVersion" IS NULL')
        .execute();
    }, authContext);
  }
}
