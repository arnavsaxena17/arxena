import { createHash } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import { type OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { mergeOutreachOtherFields } from 'src/engine/core-modules/outreach-command/utils/merge-outreach-other-fields.util';
import { isDeprioritisedPerson } from 'src/engine/core-modules/outreach-command/utils/outreach-people-deprioritisation.util';
import {
  isOpaqueLinkedinId,
  linkedinUrlsAreComparable,
  normalizeCompanyName,
  personIdentityKey,
  personIdentityKeys,
} from 'src/engine/core-modules/outreach-command/utils/person-identity.util';
import { personNamesRoughlyMatch } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/person-name-matching.util';

const chooseText = (
  previous: string,
  incoming: string,
  preferIncoming: boolean,
): string => {
  if (preferIncoming) {
    return isNonEmptyString(incoming) ? incoming : previous;
  }

  return isNonEmptyString(previous) ? previous : incoming;
};

const chooseOptionalText = (
  previous: string | undefined,
  incoming: string | undefined,
  preferIncoming: boolean,
): string | undefined => {
  if (preferIncoming) {
    return isNonEmptyString(incoming) ? incoming : previous;
  }

  return isNonEmptyString(previous) ? previous : incoming;
};

// A vanity slug is the stable public identity; an opaque member id (ACwAAA…)
// is a second URL for the same person, so it never replaces a vanity slug.
const chooseLinkedinUrl = (previous: string, incoming: string): string => {
  if (!isNonEmptyString(incoming)) {
    return previous;
  }

  if (!isNonEmptyString(previous)) {
    return incoming;
  }

  if (isOpaqueLinkedinId(previous) && !isOpaqueLinkedinId(incoming)) {
    return incoming;
  }

  return previous;
};

const mergePerson = (
  base: OutreachEphemeralPerson,
  incoming: OutreachEphemeralPerson,
  preferIncoming: boolean,
): OutreachEphemeralPerson => {
  const merged: OutreachEphemeralPerson = { ...base };

  merged.name = chooseText(base.name, incoming.name, preferIncoming);
  merged.title = chooseText(base.title, incoming.title, preferIncoming);
  merged.companyId = chooseText(
    base.companyId,
    incoming.companyId,
    preferIncoming,
  );
  merged.companyName = chooseText(
    base.companyName,
    incoming.companyName,
    preferIncoming,
  );
  merged.warmPath = chooseText(
    base.warmPath,
    incoming.warmPath,
    preferIncoming,
  );
  merged.stage = chooseText(base.stage, incoming.stage, preferIncoming);
  merged.email = chooseText(base.email, incoming.email, preferIncoming);
  merged.linkedinUrl = chooseLinkedinUrl(
    base.linkedinUrl,
    incoming.linkedinUrl,
  );

  const headline = chooseOptionalText(
    base.headline,
    incoming.headline,
    preferIncoming,
  );

  if (headline !== undefined) {
    merged.headline = headline;
  } else {
    delete merged.headline;
  }

  const summary = chooseOptionalText(
    base.summary,
    incoming.summary,
    preferIncoming,
  );

  if (summary !== undefined) {
    merged.summary = summary;
  } else {
    delete merged.summary;
  }

  if (preferIncoming && typeof incoming.connectionDegree === 'number') {
    merged.connectionDegree = incoming.connectionDegree;
  } else if (
    merged.connectionDegree === undefined &&
    typeof incoming.connectionDegree === 'number'
  ) {
    merged.connectionDegree = incoming.connectionDegree;
  }

  if (preferIncoming && typeof incoming.personaPriorityScore === 'number') {
    merged.personaPriorityScore = incoming.personaPriorityScore;
  } else if (
    merged.personaPriorityScore === undefined &&
    typeof incoming.personaPriorityScore === 'number'
  ) {
    merged.personaPriorityScore = incoming.personaPriorityScore;
  }

  // otherFields are never dropped: a merge only adds keys and refreshes the
  // ones that are not answers written by an AI column
  const otherFields = mergeOutreachOtherFields(
    base.otherFields,
    incoming.otherFields,
  );

  if (otherFields !== undefined) {
    merged.otherFields = otherFields;
  } else {
    delete merged.otherFields;
  }

  return merged;
};

// One row per person. Rows are matched on every identity key they carry — the
// profile URL in any of its forms, the email, and the name together with the
// employer (legal suffixes such as "Ltd." removed) — so a Harvest row and a
// Google row for one person collapse even when their URL strings differ.
export type MergePeopleOptions = {
  // Every identity key a row answers to, mapped to that row's id after the
  // merge. Callers use it to tell which merged row an incoming row landed on.
  keyIndex?: Map<string, string>;
};

export const mergePeople = (
  existing: OutreachEphemeralPerson[],
  incoming: OutreachEphemeralPerson[],
  options?: MergePeopleOptions,
): OutreachEphemeralPerson[] => {
  const rows = new Map<string, OutreachEphemeralPerson>();
  // A merged row keeps every identity key it absorbed, not only the URL that
  // won: the opaque member URL, the vanity slug and the name + employer key all
  // still find that row on the next write.
  const keysByAnchor = new Map<string, Set<string>>();
  const anchorByKey = new Map<string, string>();
  const anchorsByCompany = new Map<string, string[]>();
  let sequence = 0;

  const unregister = (anchor: string) => {
    for (const key of keysByAnchor.get(anchor) ?? []) {
      if (anchorByKey.get(key) === anchor) {
        anchorByKey.delete(key);
      }
    }

    keysByAnchor.delete(anchor);

    for (const [company, anchors] of anchorsByCompany) {
      const remaining = anchors.filter((entry) => entry !== anchor);

      if (remaining.length === 0) {
        anchorsByCompany.delete(company);
      } else {
        anchorsByCompany.set(company, remaining);
      }
    }
  };

  const register = (
    anchor: string,
    person: OutreachEphemeralPerson,
    inheritedKeys: Iterable<string> = [],
  ) => {
    const keys = keysByAnchor.get(anchor) ?? new Set<string>();

    for (const key of personIdentityKeys(person)) {
      keys.add(key);
    }

    for (const key of inheritedKeys) {
      keys.add(key);
    }

    for (const key of keys) {
      anchorByKey.set(key, anchor);
    }

    keysByAnchor.set(anchor, keys);

    const company = normalizeCompanyName(person.companyName);
    const anchors = anchorsByCompany.get(company) ?? [];

    if (!anchors.includes(anchor)) {
      anchorsByCompany.set(company, [...anchors, anchor]);
    }
  };

  const matchingAnchors = (person: OutreachEphemeralPerson): string[] => {
    const matches: string[] = [];

    for (const key of personIdentityKeys(person)) {
      const anchor = anchorByKey.get(key);

      if (anchor !== undefined && !matches.includes(anchor)) {
        matches.push(anchor);
      }
    }

    if (matches.length > 0) {
      return matches;
    }

    // A one-letter spelling slip or a dropped middle name, only for rows at the
    // same employer whose profile URLs cannot settle it (see
    // linkedinUrlsAreComparable). Two comparable, different URLs are two
    // different people until another key says otherwise.
    const company = normalizeCompanyName(person.companyName);
    const spellingMatch = (anchorsByCompany.get(company) ?? []).find(
      (anchor) => {
        const other = rows.get(anchor);

        if (other === undefined) {
          return false;
        }

        if (linkedinUrlsAreComparable(other.linkedinUrl, person.linkedinUrl)) {
          return false;
        }

        return personNamesRoughlyMatch(other.name, person.name);
      },
    );

    return spellingMatch === undefined ? [] : [spellingMatch];
  };

  const add = (person: OutreachEphemeralPerson, isIncoming: boolean) => {
    const matches = matchingAnchors(person);

    if (matches.length === 0) {
      const anchor = `row-${sequence++}`;

      rows.set(anchor, person);
      register(anchor, person);

      return;
    }

    // The earliest row keeps its id and its place in the list
    const anchor = matches[0];
    const inheritedKeys = new Set<string>(personIdentityKeys(person));
    let merged = rows.get(anchor) ?? person;

    for (const key of keysByAnchor.get(anchor) ?? []) {
      inheritedKeys.add(key);
    }

    // A new row can bridge two rows that were previously separate: absorb both
    for (const otherAnchor of matches.slice(1)) {
      const other = rows.get(otherAnchor);

      if (other === undefined) {
        continue;
      }

      for (const key of keysByAnchor.get(otherAnchor) ?? []) {
        inheritedKeys.add(key);
      }

      unregister(otherAnchor);
      rows.delete(otherAnchor);
      merged = mergePerson(merged, other, false);
    }

    merged = mergePerson(merged, person, isIncoming);
    unregister(anchor);
    rows.set(anchor, merged);
    register(anchor, merged, inheritedKeys);
  };

  existing.forEach((person) => add(person, false));
  incoming.forEach((person) => add(person, true));

  // ids are row keys in the table: they must be unique
  const seenIds = new Set<string>();

  const finalRowByAnchor = new Map<string, OutreachEphemeralPerson>();

  const mergedRows = [...rows.entries()].map(([anchor, person]) => {
    let finalRow = person;

    if (seenIds.has(person.id)) {
      const seed = personIdentityKey(person);
      const id = createHash('sha256').update(seed).digest('hex').slice(0, 32);
      let uniqueId = id;
      let suffix = 1;

      while (seenIds.has(uniqueId)) {
        uniqueId = `${id}-${suffix}`;
        suffix += 1;
      }

      finalRow = { ...person, id: uniqueId };
    }

    seenIds.add(finalRow.id);
    finalRowByAnchor.set(anchor, finalRow);

    return finalRow;
  });

  if (options?.keyIndex !== undefined) {
    for (const [key, anchor] of anchorByKey) {
      const row = finalRowByAnchor.get(anchor);

      if (row !== undefined) {
        options.keyIndex.set(key, row.id);
      }
    }
  }

  // Likely-fake and off-target rows go below the rest; the sort is stable, so
  // every other row keeps its position
  return [
    ...mergedRows.filter((person) => !isDeprioritisedPerson(person)),
    ...mergedRows.filter((person) => isDeprioritisedPerson(person)),
  ];
};

// Compacts a list that may already hold duplicates (a stale cache, an import,
// a client PUT) without adding anything.
export const compactPeople = (
  people: OutreachEphemeralPerson[],
): OutreachEphemeralPerson[] => mergePeople(people, []);
