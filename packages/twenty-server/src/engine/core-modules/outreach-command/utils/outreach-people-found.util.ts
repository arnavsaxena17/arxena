export type OutreachPeopleFoundLabel =
  | 'Found'
  | 'Related role only'
  | 'Not found'
  | 'Ambiguous'
  | 'Unresolvable'
  | 'Excluded'
  | 'Lookup failed';

export const OUTREACH_PEOPLE_FOUND_LABELS: OutreachPeopleFoundLabel[] = [
  'Found',
  'Related role only',
  'Not found',
  'Ambiguous',
  'Unresolvable',
  'Excluded',
  'Lookup failed',
];

const PEOPLE_FOUND_MODEL = 'find_people_by_company';

// A company x role pair is the unit of a list-building run: the run is done
// when every pair has one of these states, not when a list reaches a size
export type FindPeopleTerminalState =
  | 'found'
  | 'none_found'
  | 'ambiguous'
  | 'unresolvable'
  | 'excluded';

export type FindPeopleNoneFoundReason =
  | 'no_such_role'
  | 'profile_gaps'
  | 'budget'
  | 'source_error';

// 1 = title as typed, 2 = taxonomy equivalent, 3 = related role or one level
// down, 4 = owner / promoter / MD of a small company
export type FindPeopleRung = 1 | 2 | 3 | 4;

export type FindPeoplePairState = {
  roles: string[];
  terminalState: FindPeopleTerminalState;
  reason?: FindPeopleNoneFoundReason | string;
  rungUsed?: FindPeopleRung;
  sourcesUsed: string[];
  titlesTried: string[];
  costUsd: number;
  attempts: number;
  // LinkedIn URLs (or names when there is none) of the people kept
  personKeys: string[];
  updatedAt: string;
};

export const pairKeyOf = (roles: string[]): string =>
  [...new Set(roles.map((role) => role.trim().toLowerCase()))]
    .filter((role) => role.length > 0)
    .sort()
    .join('+');

// The "People found" label is a view of the pair state, so the table and the
// existing onlyFailed rerun keep working
export const peopleFoundLabelOf = (
  pair: Pick<FindPeoplePairState, 'terminalState' | 'reason' | 'rungUsed'>,
): OutreachPeopleFoundLabel => {
  switch (pair.terminalState) {
    case 'found':
      return (pair.rungUsed ?? 1) >= 3 ? 'Related role only' : 'Found';
    case 'ambiguous':
      return 'Ambiguous';
    case 'unresolvable':
      return 'Unresolvable';
    case 'excluded':
      return 'Excluded';
    case 'none_found':
      return pair.reason === 'source_error' ? 'Lookup failed' : 'Not found';
  }
};

// The otherFields write for a company row's "People found" / "People count"
// columns, in the shape the table reads for AI columns.
export const buildPeopleFoundValues = (
  label: OutreachPeopleFoundLabel,
  count: number,
): Record<string, unknown> => {
  const ranAt = new Date().toISOString();

  return {
    peopleFound: label,
    peopleFoundCount: count,
    aiColumns: {
      peopleFound: {
        label: 'People found',
        type: 'enum',
        enumValues: OUTREACH_PEOPLE_FOUND_LABELS,
        model: PEOPLE_FOUND_MODEL,
        ranAt,
        status: 'ok',
      },
      peopleFoundCount: {
        label: 'People count',
        type: 'integer',
        model: PEOPLE_FOUND_MODEL,
        ranAt,
        status: 'ok',
      },
    },
  };
};

export const readPairStates = (
  otherFields: Record<string, unknown> | null | undefined,
): Record<string, FindPeoplePairState> => {
  const pairs = otherFields?.findPeoplePairs;

  return typeof pairs === 'object' && pairs !== null && !Array.isArray(pairs)
    ? (pairs as Record<string, FindPeoplePairState>)
    : {};
};

// The pair state plus the "People found" columns, merged over the pairs the
// row already holds for other roles
export const buildPairStateValues = (
  otherFields: Record<string, unknown> | null | undefined,
  pair: FindPeoplePairState,
): Record<string, unknown> => ({
  ...buildPeopleFoundValues(peopleFoundLabelOf(pair), pair.personKeys.length),
  findPeoplePairs: {
    ...readPairStates(otherFields),
    [pairKeyOf(pair.roles)]: pair,
  },
});
