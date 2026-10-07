/**
 * Canonical seeded outreach workflow display names (neutral CRM spine).
 */
export const SEEDED_OUTREACH_WORKFLOW = {
  harvest: {
    name: 'Find companies',
    slug: 'harvest',
    role: 'Webhook company search + AI fit filter' as const,
    trigger: 'WEBHOOK',
  },
  companySearch: {
    name: 'Find people by company',
    slug: 'companySearch',
    role: 'Webhook people search for one company + AI keep filter' as const,
    trigger: 'WEBHOOK',
  },
  fetchAndSaveProfiles: {
    name: 'Add people',
    slug: 'fetchAndSaveProfiles',
    role: 'Manual enroll' as const,
    trigger: 'MANUAL',
  },
  searchAndUploadPeopleProfiles: {
    name: 'Find people by search',
    slug: 'searchAndUploadPeopleProfiles',
    role: 'Webhook people search + AI keep filter' as const,
    trigger: 'WEBHOOK',
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
  // Live sequencer (Stage B + C merge). Prefill seeds only this graph;
  // perCandidate + candidateUpdated remain named for upgrade/cleanup and
  // OUTREACH_WORKFLOW_NAMES_TO_DEACTIVATE.
  candidateSequencer: {
    name: 'Outreach — Candidate Sequencer',
    slug: 'candidateSequencer',
    role: 'Sequencer B+C' as const,
    trigger: 'candidate.upserted',
  },
  fetchAndSaveLocalBusinesses: {
    name: 'Fetch & Save Local Businesses',
    slug: 'fetchAndSaveLocalBusinesses',
    role: 'Manual city Maps scrape' as const,
    trigger: 'MANUAL',
  },
  classifyAndUpsertLocalPlaces: {
    name: 'Classify & Upsert Local Places',
    slug: 'classifyAndUpsertLocalPlaces',
    role: 'Manual place filter + company upsert' as const,
    trigger: 'MANUAL',
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
  // Renamed to Classify & Upsert Local Places
  'Classify & Upsert QSR Chains',
] as const;

export type SeededOutreachWorkflowKey = keyof typeof SEEDED_OUTREACH_WORKFLOW;
