import { buildDeletePeopleAndCandidatesPayload } from '@/command-menu-item/engine-command/record/arx/utils/build-delete-people-and-candidates-payload.util';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

const PERSON_ID = '11111111-1111-4111-8111-111111111111';
const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_PERSON_ID = '33333333-3333-4333-8333-333333333333';

describe('buildDeletePeopleAndCandidatesPayload', () => {
  it('should send personIds for outreach people rows (not row ids as candidateIds)', () => {
    const records = [
      {
        id: PERSON_ID,
        isOutreachHomeRow: true,
        peopleId: PERSON_ID,
        personId: PERSON_ID,
        candidateId: CANDIDATE_ID,
        otherFields: { candidateId: CANDIDATE_ID },
      },
    ] as ObjectRecord[];

    expect(buildDeletePeopleAndCandidatesPayload(records, 'candidate')).toEqual(
      {
        personIds: [PERSON_ID],
        candidateIds: [],
      },
    );
  });

  it('should send candidateIds for standard candidate table rows without peopleId', () => {
    const records = [
      {
        id: CANDIDATE_ID,
      },
    ] as ObjectRecord[];

    expect(buildDeletePeopleAndCandidatesPayload(records, 'candidate')).toEqual(
      {
        personIds: [],
        candidateIds: [CANDIDATE_ID],
      },
    );
  });

  it('should prefer personIds when candidate rows include peopleId', () => {
    const records = [
      {
        id: CANDIDATE_ID,
        peopleId: PERSON_ID,
        personId: PERSON_ID,
      },
    ] as ObjectRecord[];

    expect(buildDeletePeopleAndCandidatesPayload(records, 'candidate')).toEqual(
      {
        personIds: [PERSON_ID],
        candidateIds: [],
      },
    );
  });

  it('should use row id as personId on person object pages', () => {
    const records = [
      {
        id: OTHER_PERSON_ID,
      },
    ] as ObjectRecord[];

    expect(buildDeletePeopleAndCandidatesPayload(records, 'person')).toEqual({
      personIds: [OTHER_PERSON_ID],
      candidateIds: [],
    });
  });

  it('should ignore non-uuid ephemeral outreach ids', () => {
    const records = [
      {
        id: 'ephemeral-linkedin-abc',
        isOutreachHomeRow: true,
        peopleId: 'ephemeral-linkedin-abc',
        personId: 'ephemeral-linkedin-abc',
      },
    ] as ObjectRecord[];

    expect(buildDeletePeopleAndCandidatesPayload(records, 'candidate')).toEqual(
      {
        personIds: [],
        candidateIds: [],
      },
    );
  });
});
