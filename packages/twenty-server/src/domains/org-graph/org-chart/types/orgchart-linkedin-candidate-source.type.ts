export type OrgChartLinkedinCandidateSource =
  | 'unipile'
  | 'apify'
  | 'harvest'
  | 'contactout'
  | 'linkedin_xray'
  | 'm7kq'
  /** @deprecated Use m7kq; still accepted on inbound org-chart search bodies. */
  | 'apollo';
