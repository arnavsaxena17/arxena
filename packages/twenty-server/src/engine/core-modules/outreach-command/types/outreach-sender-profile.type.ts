export type OutreachSenderCollateralFile = {
  fileId: string;
  fileName: string;
  mimeType?: string;
};

export type OutreachSenderProfile = {
  targetTitles: string[];
  locations: string[];
  brief: string;
  collateralFiles?: OutreachSenderCollateralFile[];
};

export type OutreachProspectEnrichment = {
  go: boolean;
  score: number;
  segment: string;
  reason: string;
  first_name: string;
  honorific: string | null;
  company_short: string;
  industry_phrase: string;
  hooks: Array<{ text: string; source: string }>;
  likely_systems: string;
  matching_problem_statement: string;
  referral_source: string | null;
};
