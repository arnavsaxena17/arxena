import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { type SourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

// Cheap word checks before the judge, used only when judging every row would
// cost more than the triage gate (judge.util shouldTriageBeforeJudge). It
// rejects a row only when a field is present and plainly misses; an empty
// field is left for the judge.

const textOf = (...values: Array<string | undefined>): string =>
  values
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

const mentionsAny = (text: string, terms: string[]): boolean =>
  terms.some((term) => term.length > 0 && text.includes(term));

export type TriageVerdict = { pass: true } | { pass: false; missed: string[] };

export const triageRow = (
  row: Pick<OutreachTabRow, 'title' | 'headline' | 'locationName'>,
  spec: Pick<SourcingSpec, 'hard' | 'normalized'>,
): TriageVerdict => {
  const missed: string[] = [];
  const titleText = textOf(row.title, row.headline);
  const locationText = textOf(row.locationName);

  for (const constraint of spec.hard) {
    if (constraint.field === 'title' && titleText !== '') {
      const terms = [...constraint.normalized, ...spec.normalized.titles];

      if (!mentionsAny(titleText, terms)) {
        missed.push(constraint.userWords);
      }
    }

    if (constraint.field === 'location' && locationText !== '') {
      if (!mentionsAny(locationText, constraint.normalized)) {
        missed.push(constraint.userWords);
      }
    }
  }

  return missed.length === 0 ? { pass: true } : { pass: false, missed };
};
