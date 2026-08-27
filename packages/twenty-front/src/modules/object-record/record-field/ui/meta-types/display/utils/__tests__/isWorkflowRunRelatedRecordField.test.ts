import { isWorkflowRunRelatedRecordField } from '@/object-record/record-field/ui/meta-types/display/utils/isWorkflowRunRelatedRecordField';

describe('isWorkflowRunRelatedRecordField', () => {
  it('matches related record fields on workflowRun', () => {
    expect(
      isWorkflowRunRelatedRecordField({
        metadata: {
          fieldName: 'relatedRecordId',
          objectMetadataNameSingular: 'workflowRun',
        },
      }),
    ).toBe(true);
    expect(
      isWorkflowRunRelatedRecordField({
        metadata: {
          fieldName: 'relatedObjectName',
          objectMetadataNameSingular: 'workflowRun',
        },
      }),
    ).toBe(true);
  });

  it('does not match other fields or objects', () => {
    expect(
      isWorkflowRunRelatedRecordField({
        metadata: {
          fieldName: 'name',
          objectMetadataNameSingular: 'workflowRun',
        },
      }),
    ).toBe(false);
    expect(
      isWorkflowRunRelatedRecordField({
        metadata: {
          fieldName: 'relatedRecordId',
          objectMetadataNameSingular: 'person',
        },
      }),
    ).toBe(false);
  });
});
