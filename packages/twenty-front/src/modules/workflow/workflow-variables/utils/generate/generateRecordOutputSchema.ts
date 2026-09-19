import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { getRelationIdFieldNames } from '@/object-metadata/utils/getRelationIdFieldNames';
import {
  type FieldOutputSchemaV2,
  type RecordFieldLeaf,
  type RecordOutputSchemaV2,
} from '@/workflow/workflow-variables/types/RecordOutputSchemaV2';
import { generateFakeValue } from '@/workflow/workflow-variables/utils/generate/generateFakeValue';
import {
  compositeTypeDefinitions,
  FieldMetadataType,
  RelationType,
} from 'twenty-shared/types';
import {
  capitalize,
  getKnownRawJsonPathKeysForField,
  getKnownRawJsonPathLeafType,
  isDefined,
} from 'twenty-shared/utils';

const camelToTitleCase = (camelCaseText: string): string =>
  capitalize(
    camelCaseText
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase()),
  );

const EXCLUDED_SYSTEM_FIELDS = ['searchVector', 'position'];

const shouldGenerateFieldOutput = (
  fieldMetadataItem: FieldMetadataItem,
): boolean => {
  if (!fieldMetadataItem.isActive) {
    return false;
  }

  const isExcludedSystemField =
    (fieldMetadataItem.isSystem &&
      EXCLUDED_SYSTEM_FIELDS.includes(fieldMetadataItem.name)) ??
    false;

  if (isExcludedSystemField) {
    return false;
  }

  if (
    fieldMetadataItem.type === FieldMetadataType.RELATION &&
    fieldMetadataItem.relation?.type !== RelationType.MANY_TO_ONE
  ) {
    return false;
  }

  if (
    fieldMetadataItem.type === FieldMetadataType.MORPH_RELATION &&
    fieldMetadataItem.settings?.relationType !== RelationType.MANY_TO_ONE
  ) {
    return false;
  }

  return true;
};

const generateKnownRawJsonPathLeaves = ({
  fieldName,
  fieldMetadataId,
}: {
  fieldName: string;
  fieldMetadataId: string;
}): Record<string, RecordFieldLeaf> | undefined => {
  const knownPathKeys = getKnownRawJsonPathKeysForField(fieldName);

  if (!isDefined(knownPathKeys) || knownPathKeys.length === 0) {
    return undefined;
  }

  return knownPathKeys.reduce(
    (accumulator, pathKey) => {
      const leafType =
        getKnownRawJsonPathLeafType({ fieldName, pathKey }) ??
        FieldMetadataType.TEXT;

      accumulator[pathKey] = {
        isLeaf: true,
        type: leafType,
        label: camelToTitleCase(pathKey),
        value: generateFakeValue(leafType, 'FieldMetadataType'),
        fieldMetadataId,
        isCompositeSubField: true,
      };

      return accumulator;
    },
    {} as Record<string, RecordFieldLeaf>,
  );
};

const generateRecordField = (
  fieldMetadataItem: FieldMetadataItem,
): FieldOutputSchemaV2 => {
  const compositeType = compositeTypeDefinitions.get(fieldMetadataItem.type);
  const icon = fieldMetadataItem.icon ?? undefined;

  if (isDefined(compositeType)) {
    return {
      isLeaf: false,
      icon,
      type: fieldMetadataItem.type,
      label: fieldMetadataItem.label,
      fieldMetadataId: fieldMetadataItem.id,
      value: compositeType.properties.reduce(
        (acc, property) => {
          acc[property.name] = {
            isLeaf: true,
            type: property.type,
            label: camelToTitleCase(property.name),
            value: generateFakeValue(property.type, 'FieldMetadataType'),
            fieldMetadataId: fieldMetadataItem.id,
            isCompositeSubField: true,
          };

          return acc;
        },
        {} as Record<string, RecordFieldLeaf>,
      ),
    };
  }

  if (fieldMetadataItem.type === FieldMetadataType.RAW_JSON) {
    const knownPathLeaves = generateKnownRawJsonPathLeaves({
      fieldName: fieldMetadataItem.name,
      fieldMetadataId: fieldMetadataItem.id,
    });

    if (isDefined(knownPathLeaves)) {
      return {
        isLeaf: false,
        icon,
        type: fieldMetadataItem.type,
        label: fieldMetadataItem.label,
        fieldMetadataId: fieldMetadataItem.id,
        value: knownPathLeaves,
      };
    }
  }

  return {
    isLeaf: true,
    icon,
    type: fieldMetadataItem.type,
    label: fieldMetadataItem.label,
    value: generateFakeValue(fieldMetadataItem.type, 'FieldMetadataType'),
    fieldMetadataId: fieldMetadataItem.id,
    isCompositeSubField: false,
  };
};

const generateRecordFields = (
  objectMetadataItem: EnrichedObjectMetadataItem,
): Record<string, FieldOutputSchemaV2> => {
  const result: Record<string, FieldOutputSchemaV2> = {};

  for (const fieldMetadataItem of objectMetadataItem.fields) {
    if (!shouldGenerateFieldOutput(fieldMetadataItem)) {
      continue;
    }

    const isRelationField =
      fieldMetadataItem.type === FieldMetadataType.RELATION ||
      fieldMetadataItem.type === FieldMetadataType.MORPH_RELATION;

    if (isRelationField) {
      for (const relationIdFieldName of getRelationIdFieldNames(
        fieldMetadataItem,
      )) {
        result[relationIdFieldName] = {
          isLeaf: true,
          icon: fieldMetadataItem.icon ?? undefined,
          type: FieldMetadataType.UUID,
          label: camelToTitleCase(relationIdFieldName),
          value: generateFakeValue(FieldMetadataType.UUID, 'FieldMetadataType'),
          fieldMetadataId: fieldMetadataItem.id,
          isCompositeSubField: false,
        };
      }
    } else {
      result[fieldMetadataItem.name] = generateRecordField(fieldMetadataItem);
    }
  }

  return result;
};

export const generateRecordOutputSchema = (
  objectMetadataItem: EnrichedObjectMetadataItem,
): RecordOutputSchemaV2 => {
  return {
    object: {
      icon: objectMetadataItem.icon ?? undefined,
      label: objectMetadataItem.labelSingular,
      objectMetadataId: objectMetadataItem.id,
      fieldIdName: 'id',
    },
    fields: generateRecordFields(objectMetadataItem),
    _outputSchemaType: 'RECORD',
  };
};
