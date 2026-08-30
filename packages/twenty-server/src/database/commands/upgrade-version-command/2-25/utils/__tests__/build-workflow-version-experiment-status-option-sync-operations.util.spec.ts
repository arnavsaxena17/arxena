import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import {
  type FieldMetadataComplexOption,
  FieldMetadataType,
} from 'twenty-shared/types';

import {
  buildWorkflowVersionExperimentStatusOptionSyncOperations,
  WORKFLOW_VERSION_EXPERIMENT_STATUS_OPTION,
} from 'src/database/commands/upgrade-version-command/2-25/utils/build-workflow-version-experiment-status-option-sync-operations.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';

const STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.workflowVersion.fields.status.universalIdentifier;
const NOW = '2026-08-30T00:00:00.000Z';

const buildStatusOption = (
  value: string,
  position: number,
): FieldMetadataComplexOption => ({
  id: `option-${value}`,
  value,
  label: value,
  position,
  color: 'gray',
});

const buildFlatFieldMetadataMaps = (
  flatFieldMetadatas: FlatFieldMetadata[],
): FlatEntityMaps<FlatFieldMetadata> => ({
  byUniversalIdentifier: Object.fromEntries(
    flatFieldMetadatas.map((flatFieldMetadata) => [
      flatFieldMetadata.universalIdentifier,
      flatFieldMetadata,
    ]),
  ),
  universalIdentifierById: Object.fromEntries(
    flatFieldMetadatas.map((flatFieldMetadata) => [
      flatFieldMetadata.id,
      flatFieldMetadata.universalIdentifier,
    ]),
  ),
  universalIdentifiersByApplicationId: {},
});

const buildStatusField = (options: FieldMetadataComplexOption[]) =>
  getFlatFieldMetadataMock({
    universalIdentifier: STATUS_FIELD_UNIVERSAL_IDENTIFIER,
    objectMetadataId: 'workflow-version-object-id',
    type: FieldMetadataType.SELECT,
    options,
  });

describe('buildWorkflowVersionExperimentStatusOptionSyncOperations', () => {
  it('should append EXPERIMENT without changing existing status options', () => {
    const statusField = buildStatusField([
      buildStatusOption('DRAFT', 0),
      buildStatusOption('ACTIVE', 1),
      buildStatusOption('DEACTIVATED', 2),
      buildStatusOption('ARCHIVED', 3),
    ]);

    const { flatEntityToUpdate } =
      buildWorkflowVersionExperimentStatusOptionSyncOperations({
        existingFlatFieldMetadataMaps: buildFlatFieldMetadataMaps([
          statusField,
        ]),
        now: NOW,
      });

    expect(flatEntityToUpdate).toHaveLength(1);
    expect(flatEntityToUpdate[0]).toMatchObject({
      universalIdentifier: STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      updatedAt: NOW,
      options: [
        ...(statusField.options as FieldMetadataComplexOption[]),
        {
          ...WORKFLOW_VERSION_EXPERIMENT_STATUS_OPTION,
          position: 4,
        },
      ],
    });
  });

  it('should do nothing when EXPERIMENT is already present so the upgrade can be re-run safely', () => {
    const statusField = buildStatusField([
      buildStatusOption('DRAFT', 0),
      WORKFLOW_VERSION_EXPERIMENT_STATUS_OPTION,
    ]);

    const { flatEntityToUpdate } =
      buildWorkflowVersionExperimentStatusOptionSyncOperations({
        existingFlatFieldMetadataMaps: buildFlatFieldMetadataMaps([
          statusField,
        ]),
        now: NOW,
      });

    expect(flatEntityToUpdate).toHaveLength(0);
  });

  it('should do nothing when the workspace has no workflowVersion status field', () => {
    const { flatEntityToUpdate } =
      buildWorkflowVersionExperimentStatusOptionSyncOperations({
        existingFlatFieldMetadataMaps: buildFlatFieldMetadataMaps([]),
        now: NOW,
      });

    expect(flatEntityToUpdate).toHaveLength(0);
  });
});
