import {
  FieldMetadataType,
  compositeTypeDefinitions,
} from 'twenty-shared/types';
import {
  getKnownRawJsonPathKeysForField,
  getKnownRawJsonPathLeafType,
  isDefined,
} from 'twenty-shared/utils';

import { generateFakeValue } from 'src/engine/utils/generate-fake-value';
import {
  type Leaf,
  type Node,
} from 'src/modules/workflow/workflow-builder/workflow-schema/types/output-schema.type';
import { camelToTitleCase } from 'src/utils/camel-to-title-case';

type GenerateFakeRecordFieldArgs = {
  type: FieldMetadataType;
  label: string;
  fieldMetadataId: string;
  fieldName?: string;
  icon?: string;
  value?: string;
};

export const generateFakeRecordField = ({
  type,
  label,
  icon,
  value,
  fieldMetadataId,
  fieldName,
}: GenerateFakeRecordFieldArgs): (Leaf | Node) & {
  fieldMetadataId: string;
} => {
  const compositeType = compositeTypeDefinitions.get(type);

  if (compositeType) {
    return {
      isLeaf: false,
      type: type,
      icon: icon,
      label: label,
      fieldMetadataId,
      value: compositeType.properties.reduce((acc, property) => {
        // @ts-expect-error legacy noImplicitAny
        acc[property.name] = {
          isLeaf: true,
          type: property.type,
          label: camelToTitleCase(property.name),
          value: value || generateFakeValue(property.type, 'FieldMetadataType'),
          fieldMetadataId,
          isCompositeSubField: true,
        };

        return acc;
      }, {}),
    };
  }

  if (type === FieldMetadataType.RAW_JSON && isDefined(fieldName)) {
    const knownPathKeys = getKnownRawJsonPathKeysForField(fieldName);

    if (isDefined(knownPathKeys) && knownPathKeys.length > 0) {
      return {
        isLeaf: false,
        type,
        icon,
        label,
        fieldMetadataId,
        value: knownPathKeys.reduce((accumulator, pathKey) => {
          const leafType =
            getKnownRawJsonPathLeafType({ fieldName, pathKey }) ??
            FieldMetadataType.TEXT;

          // @ts-expect-error legacy noImplicitAny
          accumulator[pathKey] = {
            isLeaf: true,
            type: leafType,
            label: camelToTitleCase(pathKey),
            value: value || generateFakeValue(leafType, 'FieldMetadataType'),
            fieldMetadataId,
            isCompositeSubField: true,
          };

          return accumulator;
        }, {}),
      };
    }
  }

  return {
    isLeaf: true,
    type: type,
    icon: icon,
    label: label,
    value: value || generateFakeValue(type, 'FieldMetadataType'),
    fieldMetadataId,
  };
};
