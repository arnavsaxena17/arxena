import { isNonEmptyArray } from '@sniptt/guards';
import {
  isRecordArraySchema,
  isRecordObjectSchema,
} from 'twenty-shared/logic-function';
import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type InputSchemaProperty } from 'twenty-shared/workflow';

type WorkflowCodeFieldsLeafKind =
  | 'array'
  | 'boolean'
  | 'enum'
  | 'json'
  | 'linkedin-parameter'
  | 'number'
  | 'record'
  | 'record-array'
  | 'text';

export const getWorkflowCodeFieldsLeafKind = (
  property: InputSchemaProperty | undefined,
): WorkflowCodeFieldsLeafKind => {
  if (!isDefined(property)) {
    return 'text';
  }

  if (
    property.linkedinParameterType === 'COMPANY' ||
    property.linkedinParameterType === 'LOCATION' ||
    property.linkedinParameterType === 'INDUSTRY'
  ) {
    return 'linkedin-parameter';
  }

  if (isRecordObjectSchema(property)) {
    return 'record';
  }

  if (isRecordArraySchema(property)) {
    return 'record-array';
  }

  if (
    (property.type === 'string' || property.type === FieldMetadataType.TEXT) &&
    isNonEmptyArray(property.enum)
  ) {
    return 'enum';
  }

  if (property.type === 'array' || property.type === FieldMetadataType.ARRAY) {
    const itemType = property.items?.type;

    if (
      itemType === 'string' ||
      itemType === 'number' ||
      itemType === 'boolean'
    ) {
      return 'array';
    }

    if (property.type === 'array') {
      return 'json';
    }

    return 'array';
  }

  switch (property.type) {
    case 'boolean':
    case FieldMetadataType.BOOLEAN:
      return 'boolean';
    case 'number':
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.NUMERIC:
      return 'number';
    default:
      return 'text';
  }
};
