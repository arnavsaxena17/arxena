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
    name: 'Outreach — Per Enrolled Candidate',
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

const SEEDED_OUTREACH_WORKFLOW_LEGACY_ALIASES: Record<string, string[]> = {
  [SEEDED_OUTREACH_WORKFLOW.perCandidate.name]: [
    'Outreach — Per Enrolled Person',
    'GTM Outreach — Per Candidate',
  ],
};

export type SeededOutreachWorkflowKey =
  keyof typeof SEEDED_OUTREACH_WORKFLOW;

export const seededOutreachWorkflowNameAliases = (
  canonicalName: string,
): string[] => {
  const legacyAliases =
    SEEDED_OUTREACH_WORKFLOW_LEGACY_ALIASES[canonicalName] ?? [];

  return [canonicalName, ...legacyAliases];
};

export const isSeededOutreachWorkflowName = (name: string): boolean => {
  return resolveSeededOutreachWorkflowCanonicalName(name) !== null;
};

export const resolveSeededOutreachWorkflowCanonicalName = (
  name: string,
): string | null => {
  for (const entry of Object.values(SEEDED_OUTREACH_WORKFLOW)) {
    if (entry.name === name) {
      return entry.name;
    }

    const legacyAliases =
      SEEDED_OUTREACH_WORKFLOW_LEGACY_ALIASES[entry.name] ?? [];

    if (legacyAliases.includes(name)) {
      return entry.name;
    }
  }

  return null;
};
