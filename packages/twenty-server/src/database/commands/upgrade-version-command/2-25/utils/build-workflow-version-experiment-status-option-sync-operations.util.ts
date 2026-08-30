import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import {
  type FieldMetadataComplexOption,
  FieldMetadataType,
} from 'twenty-shared/types';

import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatEntityToCreateDeleteUpdate } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-to-create-delete-update.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';

const WORKFLOW_VERSION_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  STANDARD_OBJECTS.workflowVersion.fields.status.universalIdentifier;

export const WORKFLOW_VERSION_EXPERIMENT_STATUS_OPTION: FieldMetadataComplexOption =
  {
    id: '20202020-7f3a-4b2c-9e8d-1a4c6b5d3e20',
    value: 'EXPERIMENT',
    label: 'Experiment',
    position: 2,
    color: 'purple',
  };

export const buildWorkflowVersionExperimentStatusOptionSyncOperations = ({
  existingFlatFieldMetadataMaps,
  now,
}: {
  existingFlatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  now: string;
}): FlatEntityToCreateDeleteUpdate<'fieldMetadata'> => {
  const statusField =
    existingFlatFieldMetadataMaps.byUniversalIdentifier[
      WORKFLOW_VERSION_STATUS_FIELD_UNIVERSAL_IDENTIFIER
    ];

  const existingOptions = (statusField?.options ??
    []) as FieldMetadataComplexOption[];

  const experimentOptionIsMissing =
    statusField?.type === FieldMetadataType.SELECT &&
    !existingOptions.some(
      (option) =>
        option.value === WORKFLOW_VERSION_EXPERIMENT_STATUS_OPTION.value ||
        option.id === WORKFLOW_VERSION_EXPERIMENT_STATUS_OPTION.id,
    );

  if (!experimentOptionIsMissing) {
    return {
      flatEntityToCreate: [],
      flatEntityToDelete: [],
      flatEntityToUpdate: [],
    };
  }

  const nextPosition =
    Math.max(...existingOptions.map((option) => option.position), -1) + 1;

  return {
    flatEntityToCreate: [],
    flatEntityToDelete: [],
    flatEntityToUpdate: [
      {
        ...statusField,
        options: [
          ...existingOptions,
          {
            ...WORKFLOW_VERSION_EXPERIMENT_STATUS_OPTION,
            position: nextPosition,
          },
        ],
        updatedAt: now,
      },
    ],
  };
};
