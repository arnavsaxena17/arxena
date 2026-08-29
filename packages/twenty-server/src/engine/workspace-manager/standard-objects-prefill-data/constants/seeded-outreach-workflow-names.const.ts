/**
 * Canonical seeded outreach workflow display names (neutral CRM spine).
 */
export const SEEDED_OUTREACH_WORKFLOW = {
  harvest: {
    name: 'Harvest — LinkedIn Companies',
    slug: 'harvest',
    role: 'Harvest' as const,
    trigger: 'CRON',
  },
  companySearch: {
    name: 'Company Created → ICP People Search',
    slug: 'companySearch',
    role: 'Enroll-on-company' as const,
    trigger: 'company.created',
  },
  perCandidate: {
    name: 'Outreach — Per Enrolled Person',
    slug: 'perCandidate',
    role: 'Sequencer B' as const,
    trigger: 'candidate.created',
  },
  candidateUpdated: {
    name: 'Outreach — Enrolled Person Updated',
    slug: 'candidateUpdated',
    role: 'Stage updates' as const,
    trigger: 'candidate.updated',
  },
} as const;

export type SeededOutreachWorkflowKey =
  keyof typeof SEEDED_OUTREACH_WORKFLOW;

export const seededOutreachWorkflowNameAliases = (
  canonicalName: string,
): string[] => [canonicalName];

export const isSeededOutreachWorkflowName = (name: string): boolean => {
  for (const entry of Object.values(SEEDED_OUTREACH_WORKFLOW)) {
    if (entry.name === name) {
      return true;
    }
  }

  return false;
};

export const resolveSeededOutreachWorkflowCanonicalName = (
  name: string,
): string | null => {
  for (const entry of Object.values(SEEDED_OUTREACH_WORKFLOW)) {
    if (entry.name === name) {
      return entry.name;
    }
  }

  return null;
};
