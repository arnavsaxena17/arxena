import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { isDefined, isValidUuid } from 'twenty-shared/utils';

export type DeletePeopleAndCandidatesPayload = {
  personIds: string[];
  candidateIds: string[];
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const firstUuid = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && isValidUuid(value)) {
      return value;
    }
  }

  return undefined;
};

// Outreach people rows use person id as row id under a candidate context store.
// Prefer personIds so the bulk API can delete associated candidates too.
export const buildDeletePeopleAndCandidatesPayload = (
  records: ObjectRecord[],
  objectNameSingular: string,
): DeletePeopleAndCandidatesPayload => {
  const personIds = new Set<string>();
  const candidateIds = new Set<string>();
  const isPersonObject = objectNameSingular === 'person';

  for (const record of records) {
    const otherFields = asRecord(record.otherFields);
    const isOutreachHomeRow = record.isOutreachHomeRow === true;
    const peopleRelation = asRecord(record.people);

    const personId = firstUuid(
      record.peopleId,
      record.personId,
      peopleRelation?.id,
      isOutreachHomeRow ? record.id : undefined,
      isPersonObject ? record.id : undefined,
    );

    const explicitCandidateId = firstUuid(
      otherFields?.candidateId,
      record.candidateId,
    );
    const candidateIdFromRecord =
      !isOutreachHomeRow &&
      !isPersonObject &&
      typeof record.id === 'string' &&
      isValidUuid(record.id) &&
      record.id !== personId
        ? record.id
        : undefined;

    const candidateId = firstUuid(explicitCandidateId, candidateIdFromRecord);

    if (isDefined(personId)) {
      personIds.add(personId);
    }

    if (isDefined(candidateId)) {
      candidateIds.add(candidateId);
    }
  }

  // Person-centric deletes: API finds + deletes linked candidates from people.
  if (personIds.size > 0) {
    return {
      personIds: [...personIds],
      candidateIds: [],
    };
  }

  return {
    personIds: [],
    candidateIds: [...candidateIds],
  };
};
