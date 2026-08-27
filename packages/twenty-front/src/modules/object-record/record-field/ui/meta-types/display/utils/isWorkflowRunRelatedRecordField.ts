import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import { type FieldMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import { CoreObjectNameSingular } from 'twenty-shared/types';

export const isWorkflowRunRelatedRecordField = (
  fieldDefinition: Pick<FieldDefinition<FieldMetadata>, 'metadata'>,
): boolean => {
  const { fieldName, objectMetadataNameSingular } = fieldDefinition.metadata;

  return (
    objectMetadataNameSingular === CoreObjectNameSingular.WorkflowRun &&
    (fieldName === 'relatedRecordId' || fieldName === 'relatedObjectName')
  );
};
