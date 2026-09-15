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
  // Live sequencer (Stage B + C merge). Publishing requires deactivating
  // perCandidate + candidateUpdated (see OUTREACH_WORKFLOW_NAMES_TO_DEACTIVATE).
  candidateSequencer: {
    name: 'Outreach — Candidate Sequencer',
    slug: 'candidateSequencer',
    role: 'Sequencer B+C' as const,
    trigger: 'candidate.upserted',
  },
} as const;

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
  // Replaced by Candidate Sequencer
  'Outreach — Per Enrolled Candidate',
  'Outreach — Enrolled Person Updated',
] as const;

export type SeededOutreachWorkflowKey = keyof typeof SEEDED_OUTREACH_WORKFLOW;
