import { isNonEmptyString } from '@sniptt/guards';
import { isValidUuid } from 'twenty-shared/utils';

import { personIdentityKeys } from 'src/engine/core-modules/outreach-command/utils/person-identity.util';

// People-tab rows that were never enrolled are keyed by content-hash ids, not
// UUIDs. Only UUIDs can be looked up in the candidate/person tables, so the two
// kinds of id must be handled by different paths.
export const partitionSelectedPersonIds = (
  personIds: string[],
): { uuidPersonIds: string[]; hashPersonIds: string[] } => {
  const uuidPersonIds: string[] = [];
  const hashPersonIds: string[] = [];

  for (const personId of personIds) {
    if (isValidUuid(personId)) {
      uuidPersonIds.push(personId);
    } else {
      hashPersonIds.push(personId);
    }
  }

  return { uuidPersonIds, hashPersonIds };
};

// The shape upload-profiles expects under `linkedin_search_results`. Kept
// minimal on purpose: these are the fields enrollment needs to create the
// Person + Candidate records.
export type EnrollablePersonRow = {
  id: string;
  name: string;
  title?: string;
  companyName: string;
  linkedinUrl: string;
  email?: string;
};

export type EnrollmentProfileRow = {
  name: string;
  title: string;
  company: string;
  companyName: string;
  linkedinUrl: string;
  profileUrl: string;
  email: string;
};

export const buildEnrollmentProfileRows = (
  rows: EnrollablePersonRow[],
): EnrollmentProfileRow[] =>
  rows.map((row) => ({
    name: row.name,
    title: row.title ?? '',
    company: row.companyName,
    companyName: row.companyName,
    linkedinUrl: row.linkedinUrl,
    profileUrl: row.linkedinUrl,
    email: row.email ?? '',
  }));

// A person can be recognised by LinkedIn slug, email, or name+company. The
// index stores every key so a row matches whichever identity survives the
// trip through the People tab.
export type EnrolledPersonIdentity = {
  // Absent for a blocked person who is not enrolled in this project: the key
  // still has to count as do-not-contact, but it resolves to no candidate.
  candidateId?: string;
  name: string;
  companyName: string;
  email: string;
  linkedinUrl: string;
  doNotContact: boolean;
};

export type EnrollmentIndex = {
  candidateIdByKey: Map<string, string>;
  doNotContactKeys: Set<string>;
};

export const buildEnrollmentIndex = (
  people: EnrolledPersonIdentity[],
): EnrollmentIndex => {
  const candidateIdByKey = new Map<string, string>();
  const doNotContactKeys = new Set<string>();

  for (const person of people) {
    const keys = personIdentityKeys({
      name: person.name,
      companyName: person.companyName,
      email: person.email,
      linkedinUrl: person.linkedinUrl,
    });

    for (const key of keys) {
      if (
        isNonEmptyString(person.candidateId) &&
        !candidateIdByKey.has(key)
      ) {
        candidateIdByKey.set(key, person.candidateId);
      }

      if (person.doNotContact) {
        doNotContactKeys.add(key);
      }
    }
  }

  return { candidateIdByKey, doNotContactKeys };
};

export const matchCandidateByPersonIdentity = (
  person: {
    name: string;
    companyName: string;
    email?: string;
    linkedinUrl?: string;
  },
  index: EnrollmentIndex,
): string | undefined => {
  const keys = personIdentityKeys({
    name: person.name,
    companyName: person.companyName,
    email: person.email,
    linkedinUrl: person.linkedinUrl,
  });

  for (const key of keys) {
    const candidateId = index.candidateIdByKey.get(key);

    if (candidateId !== undefined) {
      return candidateId;
    }
  }

  return undefined;
};

export const isPersonKnownDoNotContact = (
  person: {
    name: string;
    companyName: string;
    email?: string;
    linkedinUrl?: string;
  },
  index: EnrollmentIndex,
): boolean => {
  const keys = personIdentityKeys({
    name: person.name,
    companyName: person.companyName,
    email: person.email,
    linkedinUrl: person.linkedinUrl,
  });

  return keys.some((key) => index.doNotContactKeys.has(key));
};
