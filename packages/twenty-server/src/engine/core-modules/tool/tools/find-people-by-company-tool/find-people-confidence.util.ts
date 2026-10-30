import {
  type FindPeopleNoneFoundReason,
  type FindPeopleRung,
  type FindPeopleTerminalState,
} from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import { type SourcingConfidence } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { titleContainsWord } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/role-title-matching.util';

export type PersonFreshness = 'current' | 'unverified' | 'unknown';

const CONFIDENCE_ORDER: Record<SourcingConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Bright Data has not documented which field dates a person record; these are
// the names provider records use for it. None present means the age is unknown.
const RECORD_DATE_KEYS = [
  'timestamp',
  'updated_at',
  'last_updated',
  'scraped_at',
  'crawled_at',
];

export const meetsConfidence = (
  actual: SourcingConfidence,
  minimum: SourcingConfidence,
): boolean => CONFIDENCE_ORDER[actual] >= CONFIDENCE_ORDER[minimum];

export const readRecordDate = (
  record: Record<string, unknown> | undefined,
): Date | null => {
  for (const key of RECORD_DATE_KEYS) {
    const value = record?.[key];

    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
};

export const freshnessOf = (
  record: Record<string, unknown> | undefined,
  freshnessDays: number,
  now: number = Date.now(),
): PersonFreshness => {
  const date = readRecordDate(record);

  if (date === null) {
    return 'unknown';
  }

  return now - date.getTime() > freshnessDays * DAY_MS
    ? 'unverified'
    : 'current';
};

// Google and the pages it returns are one source, so a person found on both
// is still seen by one source only
const independentSourceCount = (sources: string[]): number =>
  new Set(sources.map((source) => (source === 'web' ? 'google' : source))).size;

// A paid provider record with title and company is a primary source; Google
// and a page it returned are one, weaker, source.
const hasPrimarySource = (sources: string[]): boolean =>
  sources.some((source) => source === 'bright_data' || source === 'harvest');

// High needs two independent sources agreeing on the person, or one fresh
// profile read by the judge. Without the judge (it failed, or it was not
// asked) one source reaches medium only with a Bright Data record whose
// company and title match by name; a person read from a search snippet alone
// stays low. Anything older than the
// freshness window is low.
export const confidenceOf = ({
  sources,
  judged,
  exactRole,
  relatedCompany,
  freshness,
  hasLinkedinUrl,
}: {
  sources: string[];
  judged: boolean;
  exactRole: boolean;
  relatedCompany: boolean;
  freshness: PersonFreshness;
  hasLinkedinUrl: boolean;
}): SourcingConfidence => {
  if (freshness === 'unverified') {
    return 'low';
  }

  if (!judged) {
    if (!exactRole) {
      return 'low';
    }

    if (independentSourceCount(sources) >= 2) {
      return 'high';
    }

    return hasPrimarySource(sources) ? 'medium' : 'low';
  }

  if (
    exactRole &&
    !relatedCompany &&
    (independentSourceCount(sources) >= 2 ||
      (freshness === 'current' && hasPrimarySource(sources)))
  ) {
    return 'high';
  }

  return hasLinkedinUrl || hasPrimarySource(sources) ? 'medium' : 'low';
};

export const rungOf = ({
  roleScore,
  title,
  roles,
  ownerPass,
}: {
  roleScore: 1 | 2;
  title: string;
  roles: string[];
  // Found by the owner / promoter / MD pass for a small company
  ownerPass: boolean;
}): FindPeopleRung => {
  if (ownerPass) {
    return 4;
  }

  if (roleScore === 1) {
    return 3;
  }

  return roles.some((role) => titleContainsWord(title, role)) ? 1 : 2;
};

export const terminalStateOf = ({
  people,
  maxRung,
  minConfidence,
  sourceFailed,
  budgetExhausted,
  rejectedCount,
}: {
  people: Array<{
    rungUsed: FindPeopleRung;
    confidence: SourcingConfidence;
    relatedCompany: boolean;
  }>;
  maxRung: FindPeopleRung;
  minConfidence: SourcingConfidence;
  sourceFailed: boolean;
  budgetExhausted: boolean;
  rejectedCount: number;
}): {
  terminalState: FindPeopleTerminalState;
  reason?: FindPeopleNoneFoundReason | string;
} => {
  const eligible = people.filter((person) => person.rungUsed <= maxRung);

  if (eligible.length > 0) {
    if (
      eligible.some(
        (person) =>
          !person.relatedCompany &&
          meetsConfidence(person.confidence, minConfidence),
      )
    ) {
      return { terminalState: 'found' };
    }

    return {
      terminalState: 'ambiguous',
      reason: eligible.every((person) => person.relatedCompany)
        ? 'company_match'
        : 'low_confidence',
    };
  }

  if (sourceFailed) {
    return { terminalState: 'none_found', reason: 'source_error' };
  }

  if (budgetExhausted) {
    return { terminalState: 'none_found', reason: 'budget' };
  }

  return {
    terminalState: 'none_found',
    reason:
      people.length > 0
        ? 'no_such_role'
        : rejectedCount > 0
          ? 'profile_gaps'
          : 'no_such_role',
  };
};
