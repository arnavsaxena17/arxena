import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
import {
  fetchOutreachProjectCandidates,
  type OutreachProjectCandidateRecord,
} from '@/outreach-home/utils/fetch-outreach-project-candidates';
import { outreachPersonMergeKey } from '@/outreach-home/utils/merge-ephemeral-and-crm-people.util';

const candidateMergeKey = (candidate: OutreachProjectCandidateRecord): string =>
  outreachPersonMergeKey({
    id: candidate.peopleId ?? candidate.id,
    linkedinUrl: candidate.people?.linkedinLink?.primaryLinkUrl ?? '',
  });

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

// Upload-profiles is async; poll project candidates until selected people
// appear as Candidates (or timeout). Already-enrolled rows resolve immediately.
export const resolveEnrolledCandidateIds = async ({
  projectId,
  accessToken,
  people,
  timeoutMs = 60_000,
  intervalMs = 2_000,
}: {
  projectId: string;
  accessToken: string;
  people: OutreachPersonRow[];
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<string[]> => {
  const pendingByKey = new Map<string, OutreachPersonRow>();
  const resolvedIds = new Set<string>();

  for (const person of people) {
    if (isNonEmptyString(person.candidateId)) {
      resolvedIds.add(person.candidateId);
      continue;
    }

    pendingByKey.set(outreachPersonMergeKey(person), person);
  }

  if (pendingByKey.size === 0) {
    return [...resolvedIds];
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline && pendingByKey.size > 0) {
    const candidates = await fetchOutreachProjectCandidates(
      projectId,
      accessToken,
    );

    for (const candidate of candidates) {
      const key = candidateMergeKey(candidate);

      if (!pendingByKey.has(key)) {
        continue;
      }

      pendingByKey.delete(key);
      resolvedIds.add(candidate.id);
    }

    if (pendingByKey.size === 0) {
      break;
    }

    await sleep(intervalMs);
  }

  return [...resolvedIds];
};

export const collectPeopleNeedingEnrollment = (
  people: OutreachPersonRow[],
): OutreachPersonRow[] =>
  people.filter((person) => !isDefined(person.candidateId));
