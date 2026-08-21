import { type StepOutputSchemaV2 } from '@/workflow/workflow-variables/types/StepOutputSchemaV2';
import { getCurrentSubStepFromPath } from '@/workflow/workflow-variables/utils/getCurrentSubStepFromPath';
import { getFilterFieldPickerInitialPath } from '@/workflow/workflow-variables/utils/getFilterFieldPickerInitialPath';
import { FieldMetadataType } from 'twenty-shared/types';
import { TRIGGER_STEP_ID } from 'twenty-shared/workflow';

const triggerEventStep = {
  id: TRIGGER_STEP_ID,
  name: 'Candidate is Updated',
  type: 'DATABASE_EVENT',
  outputSchema: {
    object: {
      label: 'Candidate',
      objectMetadataId: 'candidate-object-id',
      fieldIdName: 'properties.after.id',
    },
    fields: {
      'properties.after.outreachSequenceStage': {
        isLeaf: true,
        type: FieldMetadataType.SELECT,
        label: 'Outreach Sequence Stage',
        value: 'QUEUED',
        fieldMetadataId: 'stage-field-id',
        isCompositeSubField: false,
      },
      'properties.after.address': {
        isLeaf: false,
        type: FieldMetadataType.ADDRESS,
        label: 'Address',
        fieldMetadataId: 'address-field-id',
        value: {
          addressCity: {
            isLeaf: true,
            type: FieldMetadataType.TEXT,
            label: 'City',
            value: 'SF',
            fieldMetadataId: 'address-field-id',
            isCompositeSubField: true,
          },
        },
      },
    },
    _outputSchemaType: 'RECORD',
  },
} satisfies StepOutputSchemaV2;

describe('getFilterFieldPickerInitialPath', () => {
  it('opens at the record root for a DATABASE_EVENT prefixed leaf field', () => {
    expect(
      getFilterFieldPickerInitialPath({
        step: triggerEventStep,
        stepOutputKey: '{{trigger.properties.after.outreachSequenceStage}}',
      }),
    ).toEqual([]);
  });

  it('does not throw when walking properties.after on a prefixed record-event schema', () => {
    expect(() =>
      getCurrentSubStepFromPath(
        triggerEventStep,
        getFilterFieldPickerInitialPath({
          step: triggerEventStep,
          stepOutputKey: '{{trigger.properties.after.outreachSequenceStage}}',
        }),
      ),
    ).not.toThrow();
  });

  it('opens inside a prefixed composite field for a sub-field variable', () => {
    expect(
      getFilterFieldPickerInitialPath({
        step: triggerEventStep,
        stepOutputKey: '{{trigger.properties.after.address.addressCity}}',
      }),
    ).toEqual(['properties.after.address']);
  });

  it('returns an empty path when the schema cannot resolve the variable', () => {
    expect(
      getFilterFieldPickerInitialPath({
        step: {
          ...triggerEventStep,
          outputSchema: {},
        },
        stepOutputKey: '{{trigger.properties.after.outreachSequenceStage}}',
      }),
    ).toEqual([]);
  });
});
