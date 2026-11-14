import { DataSourceType } from 'src/domains/ingestion/candidate-sourcing/services/data-source-transformer-factory.service';
import { type SourceDescriptor } from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  SOURCE_REGISTRY,
  type SourceAlias,
} from 'src/domains/ingestion/candidate-sourcing/sources/registry';
import { type OrgChartLinkedinCandidateSource } from 'src/domains/org-graph/org-chart/types/orgchart-linkedin-candidate-source.type';
import { type OutreachSource } from 'src/domains/engagement/outreach-command/rows/outreach-rows.types';

// The other spellings of a source, each tied to the registry by one table.
// A table is a Record over the whole encoding, so a value added to an
// encoding without saying which source it is does not compile.
//
// The org-chart and import-format values are kept as they are: they are sent
// by the org-chart client, held in queued jobs and cache keys, and stored on
// imported candidates. Only what they mean is defined here.

// The org chart's candidateSource. 'unipile' is the user's own LinkedIn
// account; 'm7kq' is the public name of Apollo, and 'apollo' its older form.
const ORG_CHART_CANDIDATE_SOURCE: Readonly<
  Record<OrgChartLinkedinCandidateSource, SourceAlias>
> = {
  unipile: 'linkedin',
  apify: 'apify',
  harvest: 'harvest',
  contactout: 'contactout',
  linkedin_xray: 'xray',
  m7kq: 'apollo',
  apollo: 'apollo',
};

// The format a candidate was imported in. A LinkedIn format names the source
// it was searched on; a job board export, an upload or a parsed CV is not a
// search source, so it has none.
const IMPORT_FORMAT: Readonly<Record<DataSourceType, SourceAlias | null>> = {
  [DataSourceType.LINKEDIN_SEARCH]: 'linkedin',
  [DataSourceType.LINKEDIN_PREMIUM]: 'linkedin',
  [DataSourceType.LINKEDIN_PREMIUM_JOBS]: 'linkedin',
  [DataSourceType.LINKEDIN_SALES_NAVIGATOR]: 'linkedin',
  [DataSourceType.LINKEDIN_RECRUITER_LITE]: 'recruiter',
  [DataSourceType.LINKEDIN_RECRUITER_JOBS]: 'recruiter',
  [DataSourceType.LINKEDIN_XRAY]: 'xray',
  [DataSourceType.HIRING_NAUKRI]: null,
  [DataSourceType.RMS_NAUKRI]: null,
  [DataSourceType.RESDEX_NAUKRI]: null,
  [DataSourceType.PROFILE_DATA_NAUKRI]: null,
  [DataSourceType.APNA_DATABASE]: null,
  [DataSourceType.SPREADSHEET_IMPORT]: null,
  [DataSourceType.DATA_UPLOAD]: null,
  [DataSourceType.PARSED_CV]: null,
};

export const sourceOfOrgChartCandidateSource = (
  candidateSource: OrgChartLinkedinCandidateSource,
): SourceDescriptor<SourceAlias> =>
  SOURCE_REGISTRY[ORG_CHART_CANDIDATE_SOURCE[candidateSource]];

export const sourceOfImportFormat = (
  format: DataSourceType,
): SourceDescriptor<SourceAlias> | undefined => {
  const alias = IMPORT_FORMAT[format];

  return alias === null ? undefined : SOURCE_REGISTRY[alias];
};

// A tab row or a ledger search already uses the registry's names. 'other' is
// a row stored before index and Wikidata had one: which of the two it was is
// not recorded, so it has no source.
export const sourceOfTabRow = (
  source: OutreachSource,
): SourceDescriptor<SourceAlias> | undefined =>
  source === 'other' ? undefined : SOURCE_REGISTRY[source];
