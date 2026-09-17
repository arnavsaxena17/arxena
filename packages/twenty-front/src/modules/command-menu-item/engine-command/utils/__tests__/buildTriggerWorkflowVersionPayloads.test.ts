import { buildTriggerWorkflowVersionPayloads } from '@/command-menu-item/engine-command/utils/buildTriggerWorkflowVersionPayloads';
import { CommandMenuItemAvailabilityType } from '~/generated-metadata/graphql';

const PERSON_ID = '9b31c32d-2306-4c45-b11c-ddd6ac741e51';
const CANDIDATE_ID = '7a125be1-eab7-40e7-8a92-4edeadbefbfd';

describe('buildTriggerWorkflowVersionPayloads', () => {
  it('rewrites outreach home row ids to CRM candidateId', () => {
    const payloads = buildTriggerWorkflowVersionPayloads({
      trigger: {
        name: 'Launch on candidate',
        type: 'MANUAL',
        settings: {
          availability: {
            type: 'SINGLE_RECORD',
            objectNameSingular: 'candidate',
          },
          outputSchema: {},
        },
      } as any,
      availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
      availabilityObjectMetadataId: 'candidate-object-id',
      objectMetadataItems: [
        {
          id: 'candidate-object-id',
          nameSingular: 'candidate',
          namePlural: 'candidates',
        } as any,
      ],
      selectedRecords: [
        {
          id: PERSON_ID,
          isOutreachHomeRow: true,
          candidateId: CANDIDATE_ID,
          name: 'Karl Anthony',
        },
      ],
    });

    expect(payloads).toEqual([
      {
        id: CANDIDATE_ID,
        isOutreachHomeRow: true,
        candidateId: CANDIDATE_ID,
        name: 'Karl Anthony',
      },
    ]);
  });

  it('skips outreach home rows without a candidateId', () => {
    const payloads = buildTriggerWorkflowVersionPayloads({
      trigger: null,
      availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
      availabilityObjectMetadataId: 'candidate-object-id',
      objectMetadataItems: [],
      selectedRecords: [
        {
          id: PERSON_ID,
          isOutreachHomeRow: true,
          name: 'Not enrolled',
        },
      ],
    });

    expect(payloads).toEqual([]);
  });
});
