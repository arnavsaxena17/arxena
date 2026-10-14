export type OutreachPeopleFoundLabel =
  | 'Found'
  | 'Related role only'
  | 'Not found'
  | 'Lookup failed';

export const OUTREACH_PEOPLE_FOUND_LABELS: OutreachPeopleFoundLabel[] = [
  'Found',
  'Related role only',
  'Not found',
  'Lookup failed',
];

const PEOPLE_FOUND_MODEL = 'find_role_at_companies';

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
