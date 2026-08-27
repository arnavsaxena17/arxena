import { WorkflowTriggerType } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

import {
  buildWorkflowRunName,
  extractWorkflowRunTriggerRecord,
} from '../extract-workflow-run-trigger-record.util';

const CANDIDATE_ID = '6bba55b1-6be2-49d3-adcd-470a56547c73';

describe('extractWorkflowRunTriggerRecord', () => {
  it('extracts candidate id and name from a DATABASE_EVENT payload', () => {
    const result = extractWorkflowRunTriggerRecord({
      trigger: {
        name: 'Candidate updated',
        type: WorkflowTriggerType.DATABASE_EVENT,
        settings: {
          eventName: 'candidate.updated',
          outputSchema: {},
        },
      },
      triggerPayload: {
        recordId: CANDIDATE_ID,
        properties: {
          after: {
            id: CANDIDATE_ID,
            name: 'Jane Doe',
          },
        },
      },
    });

    expect(result).toEqual({
      recordId: CANDIDATE_ID,
      objectNameSingular: 'candidate',
      recordLabel: 'Jane Doe',
    });
  });

  it('joins person full name from a DATABASE_EVENT payload', () => {
    const result = extractWorkflowRunTriggerRecord({
      trigger: {
        name: 'Person created',
        type: WorkflowTriggerType.DATABASE_EVENT,
        settings: {
          eventName: 'person.created',
          outputSchema: {},
        },
      },
      triggerPayload: {
        recordId: CANDIDATE_ID,
        properties: {
          after: {
            id: CANDIDATE_ID,
            name: { firstName: 'Ada', lastName: 'Lovelace' },
          },
        },
      },
    });

    expect(result?.recordLabel).toBe('Ada Lovelace');
    expect(result?.objectNameSingular).toBe('person');
  });

  it('extracts a MANUAL single-record payload, including wrapped GraphQL payloads', () => {
    const result = extractWorkflowRunTriggerRecord({
      trigger: {
        name: 'Manual',
        type: WorkflowTriggerType.MANUAL,
        settings: {
          outputSchema: {},
          availability: {
            type: 'SINGLE_RECORD',
            objectNameSingular: 'candidate',
          },
        },
      },
      triggerPayload: {
        payload: {
          id: CANDIDATE_ID,
          name: 'Jane Doe',
        },
        metadata: {},
      },
    });

    expect(result).toEqual({
      recordId: CANDIDATE_ID,
      objectNameSingular: 'candidate',
      recordLabel: 'Jane Doe',
    });
  });

  it('does not extract a related record for cron triggers', () => {
    const result = extractWorkflowRunTriggerRecord({
      trigger: {
        name: 'Cron',
        type: WorkflowTriggerType.CRON,
        settings: {
          outputSchema: {},
          type: 'MINUTES',
          schedule: { minute: 5 },
        },
      },
      triggerPayload: {},
    });

    expect(result).toBeUndefined();
  });

  it('does not extract a related record for bulk manual triggers', () => {
    const result = extractWorkflowRunTriggerRecord({
      trigger: {
        name: 'Manual',
        type: WorkflowTriggerType.MANUAL,
        settings: {
          outputSchema: {},
          availability: {
            type: 'BULK_RECORDS',
            objectNameSingular: 'candidate',
          },
        },
      },
      triggerPayload: {
        id: CANDIDATE_ID,
        name: 'Jane Doe',
      },
    });

    expect(result).toBeUndefined();
  });
});

describe('buildWorkflowRunName', () => {
  it('includes the record label when present', () => {
    expect(
      buildWorkflowRunName({
        runNumber: 47,
        workflowName: 'GTM Outreach — Candidate Updated',
        recordLabel: 'Jane Doe',
      }),
    ).toBe('#47 - Jane Doe · GTM Outreach — Candidate Updated');
  });

  it('falls back to the workflow name', () => {
    expect(
      buildWorkflowRunName({
        runNumber: 1,
        workflowName: 'GTM Outreach — Candidate Updated',
      }),
    ).toBe('#1 - GTM Outreach — Candidate Updated');
  });
});
