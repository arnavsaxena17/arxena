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
  fetchAndSaveProfiles: {
    name: 'Outreach — Fetch & Save People Profiles',
    slug: 'fetchAndSaveProfiles',
    role: 'Manual enroll' as const,
    trigger: 'MANUAL',
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
  [SEEDED_OUTREACH_WORKFLOW.harvest.name]: ['GTM Harvest — LinkedIn Companies'],
  [SEEDED_OUTREACH_WORKFLOW.companySearch.name]: [
    'Company Created -> ICP People Search',
  ],
  [SEEDED_OUTREACH_WORKFLOW.fetchAndSaveProfiles.name]: [
    'GTM Outreach - Fetch & Save People Profiles',
  ],
  [SEEDED_OUTREACH_WORKFLOW.perCandidate.name]: [
    'Outreach — Per Enrolled Person',
    'Outreach — Per Candidate',
    'GTM Outreach — Per Candidate',
  ],
  [SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name]: [
    'GTM Outreach — Candidate Updated',
    'GTM Outreach — Candidate Updated - Connection Accepted',
    // Projectivetech / legacy live name (never matched without this alias)
    'GTM Outreach — Candidate Updated - Connection Accepted Onwards',
    'GTM Outreach — Connection Accepted',
    'GTM Outreach — Reply',
    'GTM Outreach — Negotiating',
    'GTM Outreach — Deferred',
    'GTM Outreach — Meeting Booked',
    'Outreach — Reply',
    'Outreach — Negotiating',
    'Outreach — Deferred',
    'Outreach — Meeting Booked',
  ],
};

// Obsolete graphs removed during workspace upgrade (not seeded for new workspaces).
export const OUTREACH_WORKFLOW_NAMES_TO_DEACTIVATE = [
  'GTM Outreach — Per Candidate (Manual)',
  'GTM Outreach — Connection Accepted',
  'GTM Outreach — Reply',
  'GTM Outreach — Negotiating',
  'GTM Outreach — Deferred',
  'GTM Outreach — Meeting Booked',
  'Outreach — Reply',
  'Outreach — Negotiating',
  'Outreach — Deferred',
  'Outreach — Meeting Booked',
] as const;

export type SeededOutreachWorkflowKey = keyof typeof SEEDED_OUTREACH_WORKFLOW;

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

export const getSeededOutreachWorkflowRenamePairs = (): Array<{
  from: string;
  to: string;
}> => {
  const pairs: Array<{ from: string; to: string }> = [];

  for (const [canonicalName, aliases] of Object.entries(
    SEEDED_OUTREACH_WORKFLOW_LEGACY_ALIASES,
  )) {
    for (const alias of aliases) {
      pairs.push({ from: alias, to: canonicalName });
    }
  }

  return pairs;
};
