export type OutreachListEntity = 'company' | 'people';

export type OutreachListSource =
  | 'bright_data'
  | 'apollo'
  | 'linkedin'
  | 'exa'
  | 'other';

// One normalized row, whatever the provider. Providers differ a lot, so
// everything the list features need (dedupe, preview, export, save) lives here.
export type OutreachListRow = {
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
  source: OutreachListSource;
  addedAt: string;
  // Set by the dedupe action
  inCrm?: boolean;
  inOtherList?: boolean;
};

export type OutreachListMeta = {
  id: string;
  workspaceId: string;
  name: string;
  entity: OutreachListEntity;
  sources: OutreachListSource[];
  rowCount: number;
  // A list belongs to the workspace and can feed several projects
  projectIds: string[];
  query?: string;
  spentUsd: number;
  // Paid sources (Bright Data) keep the list 30 days, free ones 7. Reads and
  // writes extend it; an expired list is gone from Redis and ignored on S3.
  paid: boolean;
  expiresAt: string;
  // Set once the rows were turned into CRM Company / Person records
  crmSavedAt?: string;
  crmSaved?: { companies: number; people: number };
  createdAt: string;
  updatedAt: string;
};

export type OutreachListDocument = {
  meta: OutreachListMeta;
  rows: OutreachListRow[];
};

export type OutreachListIngestResult = {
  listId: string;
  name: string;
  entity: OutreachListEntity;
  added: number;
  duplicates: number;
  total: number;
};
