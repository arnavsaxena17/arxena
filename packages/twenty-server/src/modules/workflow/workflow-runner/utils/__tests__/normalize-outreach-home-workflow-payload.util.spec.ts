import { normalizeOutreachHomeWorkflowPayload } from '../normalize-outreach-home-workflow-payload.util';

const PERSON_ID = '9b31c32d-2306-4c45-b11c-ddd6ac741e51';
const CANDIDATE_ID = '7a125be1-eab7-40e7-8a92-4edeadbefbfd';

describe('normalizeOutreachHomeWorkflowPayload', () => {
  it('rewrites outreach home row id to the CRM candidateId', () => {
    expect(
      normalizeOutreachHomeWorkflowPayload({
        id: PERSON_ID,
        isOutreachHomeRow: true,
        candidateId: CANDIDATE_ID,
        name: 'Karl Anthony',
      }),
    ).toEqual({
      id: CANDIDATE_ID,
      isOutreachHomeRow: true,
      candidateId: CANDIDATE_ID,
      name: 'Karl Anthony',
    });
  });

  it('rewrites wrapped GraphQL payloads', () => {
    expect(
      normalizeOutreachHomeWorkflowPayload({
        payload: {
          id: PERSON_ID,
          isOutreachHomeRow: true,
          candidateId: CANDIDATE_ID,
        },
        metadata: {},
      }),
    ).toEqual({
      payload: {
        id: CANDIDATE_ID,
        isOutreachHomeRow: true,
        candidateId: CANDIDATE_ID,
      },
      metadata: {},
    });
  });

  it('leaves non-outreach payloads unchanged', () => {
    const payload = {
      id: CANDIDATE_ID,
      name: 'Jane Doe',
    };

    expect(normalizeOutreachHomeWorkflowPayload(payload)).toBe(payload);
  });
});
