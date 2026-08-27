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
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const WORKFLOW_RUN = STANDARD_OBJECTS.workflowRun;

const FIELD_UNIVERSAL_IDENTIFIERS = [
  WORKFLOW_RUN.fields.relatedRecordId.universalIdentifier,
  WORKFLOW_RUN.fields.relatedObjectName.universalIdentifier,
];

const INDEX_UNIVERSAL_IDENTIFIERS = [
  WORKFLOW_RUN.indexes.relatedRecordIdIndex.universalIdentifier,
];

const VIEW_FIELD_UNIVERSAL_IDENTIFIERS = [
  WORKFLOW_RUN.views.allWorkflowRuns.viewFields.relatedObjectName
    .universalIdentifier,
  WORKFLOW_RUN.views.workflowRunRecordPageFields.viewFields.relatedObjectName
    .universalIdentifier,
  WORKFLOW_RUN.views.workflowRunRecordPageFields.viewFields.relatedRecordId
    .universalIdentifier,
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000065)
@Command({
  name: 'upgrade:2-25:add-workflow-run-related-record-fields',
  description:
    'Add relatedRecordId and relatedObjectName on workflowRun so runs can be named and filtered by the trigger record',
})
export class AddWorkflowRunRelatedRecordFieldsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
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

    if (totalOperationCount === 0) {
      this.logger.log(
        `workflowRun related-record metadata already present for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Creating ${totalOperationCount} workflowRun related-record metadata item(s) for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

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
        `Failed to add workflowRun related-record fields:\n${JSON.stringify(result, null, 2)}`,
      );

      throw new Error(
        `Failed to add workflowRun related-record fields for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Added workflowRun related-record metadata for workspace ${workspaceId}`,
    );
  }
}
