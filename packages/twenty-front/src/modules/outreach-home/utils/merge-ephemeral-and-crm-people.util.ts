import { isNonEmptyString } from '@sniptt/guards';

import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';

const LINKEDIN_IN_PATH = /linkedin\.com\/(?:mwlite\/)?in\/([^/?#]+)/i;

const safeDecodeUriComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// Match CRM + Redis rows across www / in / bare hosts by profile slug.
export const normalizeOutreachPersonLinkedinKey = (
  linkedinUrl: string,
): string => {
  const trimmed = linkedinUrl.trim();

  if (!trimmed) {
    return '';
  }

  const inMatch = LINKEDIN_IN_PATH.exec(trimmed);

  if (isNonEmptyString(inMatch?.[1])) {
    const slug = safeDecodeUriComponent(inMatch[1])
      .replace(/\/+$/, '')
      .normalize('NFC')
      .toLowerCase();

    return `in/${slug}`;
  }

  return trimmed
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('?')[0];
};

export const outreachPersonMergeKey = (person: {
  id: string;
  linkedinUrl: string;
}): string => {
  const linkedinKey = normalizeOutreachPersonLinkedinKey(person.linkedinUrl);

  if (isNonEmptyString(linkedinKey)) {
    return `linkedin:${linkedinKey}`;
  }

  return `id:${person.id}`;
};

// CRM enrolled rows win: Stage / Next come from Candidate.outreachSequenceStage.
export const mergeEphemeralAndCrmPeople = (
  ephemeralPeople: OutreachPersonRow[],
  crmPeople: OutreachPersonRow[],
): OutreachPersonRow[] => {
  const byKey = new Map<string, OutreachPersonRow>();

  for (const person of ephemeralPeople) {
    byKey.set(outreachPersonMergeKey(person), person);
  }

  for (const person of crmPeople) {
    byKey.set(outreachPersonMergeKey(person), person);
  }

  return [...byKey.values()];
};
