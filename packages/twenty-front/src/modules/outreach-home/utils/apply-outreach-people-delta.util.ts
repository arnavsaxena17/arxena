import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
import { outreachPersonMergeKey } from '@/outreach-home/utils/merge-ephemeral-and-crm-people.util';

const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// The same name at the same company is one person, which is the rule the
// server merges by, so the tab must not keep two rows for it
const nameAndCompanyKey = (person: OutreachPersonRow): string =>
  `${normalizeName(person.name)}|${normalizeName(person.companyName)}`;

// A likely-fake or off-target row: the server writes this flag into
// otherFields and sorts those rows last
const isDeprioritisedOutreachPerson = (person: OutreachPersonRow): boolean => {
  const otherFields = person.otherFields;

  return (
    typeof otherFields === 'object' &&
    otherFields !== null &&
    (otherFields as Record<string, unknown>).deprioritised === true
  );
};

// Applies the rows a write touched to the list already on screen. This is the
// streaming replacement for "refetch the whole list": the server names what it
// wrote, and the tab upserts those rows.
//
// A written row can carry the id of a row that was already there under a
// different one (the server folds a spelling slip or a second profile URL into
// the row it kept), so identity here is the same one the merge uses — profile
// slug, then id, then name at company — and the old row is dropped rather than
// left behind as a duplicate.
export const applyOutreachPeopleDelta = (
  previous: OutreachPersonRow[],
  delta: OutreachPersonRow[],
): OutreachPersonRow[] => {
  if (delta.length === 0) {
    return previous;
  }

  const byKey = new Map<string, OutreachPersonRow>();

  for (const person of previous) {
    byKey.set(outreachPersonMergeKey(person), person);
  }

  for (const person of delta) {
    const key = outreachPersonMergeKey(person);
    const nameKey = nameAndCompanyKey(person);

    for (const [otherKey, other] of byKey) {
      // Setting the same key again keeps the row where it is, so an update
      // does not make it jump to the bottom of the table
      if (otherKey === key) {
        continue;
      }

      if (other.id === person.id || nameAndCompanyKey(other) === nameKey) {
        byKey.delete(otherKey);
      }
    }

    byKey.set(key, person);
  }

  // ids are the table's row keys, so the same row must not appear twice
  const seenIds = new Set<string>();
  const people: OutreachPersonRow[] = [];

  for (const person of byKey.values()) {
    if (seenIds.has(person.id)) {
      continue;
    }

    seenIds.add(person.id);
    people.push(person);
  }

  // The server keeps likely-fake and off-target rows below the rest, and its
  // sort is stable, so the two groups only ever change by a row joining one.
  // Re-partition to keep that: appending alone would put a new row under the
  // demoted block, and a row that becomes demoted would stay where it was
  return [
    ...people.filter((person) => !isDeprioritisedOutreachPerson(person)),
    ...people.filter((person) => isDeprioritisedOutreachPerson(person)),
  ];
};
