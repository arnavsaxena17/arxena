import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type DatabaseEventTriggerOutputSchema } from '@/workflow/workflow-variables/types/DatabaseEventTriggerOutputSchema';
import {
  type FieldOutputSchemaV2,
  type RecordOutputSchemaV2,
} from '@/workflow/workflow-variables/types/RecordOutputSchemaV2';
import { generateRecordOutputSchema } from '@/workflow/workflow-variables/utils/generate/generateRecordOutputSchema';
import { DatabaseEventAction } from '~/generated-metadata/graphql';

const generateRecordEventWithPrefix = (
  objectMetadataItem: EnrichedObjectMetadataItem,
  prefix: string,
): RecordOutputSchemaV2 => {
  const recordSchema = generateRecordOutputSchema(objectMetadataItem);
  const prefixedFields = Object.entries(recordSchema.fields).reduce(
    (accumulator, [fieldName, fieldSchema]) => {
      accumulator[`${prefix}.${fieldName}`] = fieldSchema;

      return accumulator;
    },
    {} as Record<string, FieldOutputSchemaV2>,
  );

  return {
    object: {
      ...recordSchema.object,
      fieldIdName: `${prefix}.id`,
    },
    fields: prefixedFields,
    _outputSchemaType: 'RECORD',
  };
};

export const generateRecordEventOutputSchema = (
  objectMetadataItem: EnrichedObjectMetadataItem,
  action: DatabaseEventAction,
): DatabaseEventTriggerOutputSchema => {
  switch (action) {
    case DatabaseEventAction.CREATED:
    case DatabaseEventAction.UPDATED:
      return generateRecordEventWithPrefix(
        objectMetadataItem,
        'properties.after',
      );
    case DatabaseEventAction.DELETED:
    case DatabaseEventAction.DESTROYED:
      return generateRecordEventWithPrefix(
        objectMetadataItem,
        'properties.before',
      );
    default:
      return generateRecordEventWithPrefix(
        objectMetadataItem,
        'properties.after',
      );
  }
};
