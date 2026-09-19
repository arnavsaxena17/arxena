import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
  type PeopleAndCandidateIds,
  resolvePeopleAndCandidateIdsFromRecords,
} from '@/command-menu-item/engine-command/record/arx/utils/resolve-people-and-candidate-ids-from-records.util';

export type DeletePeopleAndCandidatesPayload = PeopleAndCandidateIds;

// Prefer personIds so the bulk API can delete associated candidates too.
export const buildDeletePeopleAndCandidatesPayload = (
  records: ObjectRecord[],
  objectNameSingular: string,
): DeletePeopleAndCandidatesPayload => {
  const resolved = resolvePeopleAndCandidateIdsFromRecords(
    records,
    objectNameSingular,
  );

  if (resolved.personIds.length > 0) {
    return {
      personIds: resolved.personIds,
      candidateIds: [],
    };
  }

  return {
    personIds: [],
    candidateIds: resolved.candidateIds,
  };
};
