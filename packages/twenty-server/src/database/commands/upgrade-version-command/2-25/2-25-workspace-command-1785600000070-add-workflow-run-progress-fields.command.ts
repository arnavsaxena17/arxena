import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { getStandardFlatEntitiesToCreateOrThrow } from 'src/database/commands/upgrade-version-command/2-10/utils/get-standard-flat-entities-to-create-or-throw.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';
import {
  WorkflowRunStatus,
  type WorkflowRunWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { computeWorkflowRunProgressFields } from 'src/modules/workflow/workflow-runner/utils/compute-workflow-run-progress-fields.util';

const WORKFLOW_RUN = STANDARD_OBJECTS.workflowRun;

const FIELD_UNIVERSAL_IDENTIFIERS = [
  WORKFLOW_RUN.fields.currentStepName.universalIdentifier,
  WORKFLOW_RUN.fields.currentStepKind.universalIdentifier,
  WORKFLOW_RUN.fields.resumeAt.universalIdentifier,
  WORKFLOW_RUN.fields.upcomingSteps.universalIdentifier,
];

const INDEX_UNIVERSAL_IDENTIFIERS = [
  WORKFLOW_RUN.indexes.currentStepKindIndex.universalIdentifier,
];

const VIEW_FIELD_UNIVERSAL_IDENTIFIERS = [
  WORKFLOW_RUN.views.allWorkflowRuns.viewFields.currentStepName
    .universalIdentifier,
  WORKFLOW_RUN.views.allWorkflowRuns.viewFields.currentStepKind
    .universalIdentifier,
  WORKFLOW_RUN.views.allWorkflowRuns.viewFields.resumeAt.universalIdentifier,
  WORKFLOW_RUN.views.allWorkflowRuns.viewFields.upcomingSteps
    .universalIdentifier,
  WORKFLOW_RUN.views.workflowRunRecordPageFields.viewFields.currentStepName
    .universalIdentifier,
  WORKFLOW_RUN.views.workflowRunRecordPageFields.viewFields.currentStepKind
    .universalIdentifier,
  WORKFLOW_RUN.views.workflowRunRecordPageFields.viewFields.resumeAt
    .universalIdentifier,
  WORKFLOW_RUN.views.workflowRunRecordPageFields.viewFields.upcomingSteps
    .universalIdentifier,
];

const OPEN_RUN_STATUSES = [
  WorkflowRunStatus.NOT_STARTED,
  WorkflowRunStatus.ENQUEUED,
  WorkflowRunStatus.RUNNING,
  WorkflowRunStatus.STOPPING,
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000070)
@Command({
  name: 'upgrade:2-25:add-workflow-run-progress-fields',
  description:
    'Add current step, step state, resume time, and upcoming steps on workflowRun so running runs can be filtered by progress',
})
export class AddWorkflowRunProgressFieldsCommand extends ProvisionedWorkspaceCommandRunner {
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

    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatIndexMaps,
      flatViewFieldMaps,
    } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMaps',
      'flatIndexMaps',
      'flatViewFieldMaps',
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

    const indexesToCreate =
      getStandardFlatEntitiesToCreateOrThrow<FlatIndexMetadata>({
        standardFlatEntityMaps: standardAllFlatEntityMaps.flatIndexMaps,
        existingFlatEntityMaps: flatIndexMaps,
        universalIdentifiers: INDEX_UNIVERSAL_IDENTIFIERS,
      });

    const viewFieldsToCreate =
      getStandardFlatEntitiesToCreateOrThrow<FlatViewField>({
        standardFlatEntityMaps: standardAllFlatEntityMaps.flatViewFieldMaps,
        existingFlatEntityMaps: flatViewFieldMaps,
        universalIdentifiers: VIEW_FIELD_UNIVERSAL_IDENTIFIERS,
      });

    const totalOperationCount =
      fieldsToCreate.length +
      indexesToCreate.length +
      viewFieldsToCreate.length;

    if (totalOperationCount > 0) {
      this.logger.log(
        `${isDryRun ? '[DRY RUN] ' : ''}Creating ${totalOperationCount} workflowRun progress metadata item(s) for workspace ${workspaceId}`,
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
                index: {
                  flatEntityToCreate: indexesToCreate,
                  flatEntityToDelete: [],
                  flatEntityToUpdate: [],
                },
                viewField: {
                  flatEntityToCreate: viewFieldsToCreate,
                  flatEntityToDelete: [],
                  flatEntityToUpdate: [],
                },
              },
            },
          );

        if (result.status === 'fail') {
          this.logger.error(
            `Failed to add workflowRun progress fields:\n${JSON.stringify(result, null, 2)}`,
          );

          throw new Error(
            `Failed to add workflowRun progress fields for workspace ${workspaceId}`,
          );
        }
      }
    }

    if (isDryRun) {
      return;
    }

    await this.backfillOpenRuns(workspaceId);
  }

  private async backfillOpenRuns(workspaceId: string): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowRunRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
          workspaceId,
          'workflowRun',
          { shouldBypassPermissionChecks: true },
        );

      const openRuns = await workflowRunRepository.find({
        where: { status: In(OPEN_RUN_STATUSES) },
        select: ['id', 'status', 'state'],
      });

      if (openRuns.length === 0) {
        return;
      }

      this.logger.log(
        `Backfilling progress fields on ${openRuns.length} open workflow run(s) for workspace ${workspaceId}`,
      );

      for (const workflowRun of openRuns) {
        await workflowRunRepository.update(
          workflowRun.id,
          computeWorkflowRunProgressFields({
            state: workflowRun.state,
            status: workflowRun.status,
          }),
        );
      }
    }, authContext);
  }
}
