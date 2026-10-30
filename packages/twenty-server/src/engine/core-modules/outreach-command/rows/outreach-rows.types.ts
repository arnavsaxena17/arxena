export type OutreachEntity = 'company' | 'people';

export type OutreachSource =
  | 'bright_data'
  | 'apollo'
  | 'linkedin'
  | 'harvest'
  | 'exa'
  | 'other';

// One normalized row, whatever the provider. Providers differ a lot, so
// everything the list features need (dedupe, preview, export, save) lives here.
export type OutreachRow = {
  // Stable dedupe key: domain or LinkedIn URL first, name as a last resort
  key: string;
  // Provider id of the record
  id: string;
  name: string;
  // Companies: website host. People: empty
  domain: string;
  website: string;
  linkedinUrl: string;
  // People
  title: string;
  companyName: string;
  email: string;
  // Both
  industry: string;
  location: string;
  country: string;
  size: string;
  about: string;
  source: OutreachSource;
  addedAt: string;
  // Extra columns the project tab shows, one key per column
  otherFields?: Record<string, unknown>;
  // Set by the dedupe action
  inCrm?: boolean;
  inOtherList?: boolean;
};
