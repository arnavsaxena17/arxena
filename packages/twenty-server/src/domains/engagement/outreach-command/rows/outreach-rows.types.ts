import { type PickSource } from 'src/domains/ingestion/candidate-sourcing/sources/registry';

export type OutreachEntity = 'company' | 'people';

// Where a row came from, in the source registry's words. 'other' is only
// read: it is what index and Wikidata rows were stored as before those
// sources had a name of their own.
export type OutreachSource =
  | PickSource<
      | 'bright_data'
      | 'apollo'
      | 'linkedin'
      | 'harvest'
      | 'exa'
      | 'index'
      | 'wikidata'
    >
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
