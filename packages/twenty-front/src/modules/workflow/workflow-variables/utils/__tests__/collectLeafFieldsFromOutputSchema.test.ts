import { collectLeafFieldsFromOutputSchema } from '@/workflow/workflow-variables/utils/collectLeafFieldsFromOutputSchema';
import { type OutputSchemaV2 } from '@/workflow/workflow-variables/types/StepOutputSchemaV2';
import { FieldMetadataType } from 'twenty-shared/types';

describe('collectLeafFieldsFromOutputSchema', () => {
  it('collects find-records fields including nested record selects', () => {
    const outputSchema = {
      first: {
        isLeaf: false,
        label: 'First',
        value: {
          _outputSchemaType: 'RECORD',
          object: {
            label: 'Candidate',
            objectMetadataId: 'candidate-object',
          },
          fields: {
            outreachSequenceStage: {
              isLeaf: true,
              label: 'Outreach Sequence Stage',
              type: FieldMetadataType.SELECT,
              value: 'CONNECTION_ACCEPTED',
              fieldMetadataId: 'field-1',
              isCompositeSubField: false,
            },
          },
        },
      },
      totalCount: {
        isLeaf: true,
        label: 'Total Count',
        type: 'number',
        value: 1,
      },
    } as const;

    expect(
      collectLeafFieldsFromOutputSchema({
        outputSchema: outputSchema as unknown as OutputSchemaV2,
        stepName: 'Reload candidate before follow-up 2',
      }),
    ).toEqual([
      {
        path: ['first', 'outreachSequenceStage'],
        label: 'Outreach Sequence Stage',
        icon: undefined,
        pathLabel:
          'Reload candidate before follow-up 2 > First > Outreach Sequence Stage',
      },
      {
        path: ['totalCount'],
        label: 'Total Count',
        icon: undefined,
        pathLabel: 'Reload candidate before follow-up 2 > Total Count',
      },
    ]);
  });
});
