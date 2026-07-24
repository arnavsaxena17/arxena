export type PersonOrgMovementSource = 'pdl' | 'coresignal' | 'contactout';

/** CoreSignal [Multi-source Employee](https://docs.coresignal.com/employee-api/multi-source-employee-api/elasticsearch-dsl) vs [Base Employee](https://docs.coresignal.com/employee-api/base-employee-api/endpoints/elasticsearch-dsl) search/collect endpoints. */
export type CoreSignalEmployeeApi = 'multi_source' | 'employee_base';

export type OrgMovementWindowId = '1w' | '1m' | '3m' | '6m' | '1y';

export type OrgMovementCounts = {
  total: number;
  names: string[];
};

export type PersonOrgMovementWindowResult = {
  window: OrgMovementWindowId;
  range: { startDate: string; endDate: string };
  joined: OrgMovementCounts;
  left: OrgMovementCounts;
  /** Same employer, role/experience metadata updated in the window (PDL: `job_last_changed`; CoreSignal: `experience_change_last_identified_at`; ContactOut: profile `updated_at` while current at company — noisy). */
  experienceChanged: OrgMovementCounts;
};

export type PersonOrgMovementResult = {
  source: PersonOrgMovementSource;
  windows: PersonOrgMovementWindowResult[];
};

/** PDL: use `job_company_id` from enrichment, or lowercased company name. */
export type PdlCompanyRef =
  | { jobCompanyId: string; jobCompanyName?: never }
  | { jobCompanyName: string; jobCompanyId?: never };

/**
 * CoreSignal multi-source employee index: prefer numeric `company_id` from CoreSignal company data.
 * For `companyNameExact`, use the keyword as stored (`company_name.exact` in nested docs).
 */
export type CoreSignalCompanyRef =
  | { companyId: number; companyNameExact?: never }
  | { companyNameExact: string; companyId?: never };

/**
 * ContactOut [People Search](https://api.contactout.com/#people-search-api): filter by `company` name and/or `domain`.
 * Movement is derived client-side from `detailed_experience` (no native join/leave date filters in the API).
 */
export type ContactOutCompanyRef =
  | { companyName: string; domain?: never }
  | { domain: string; companyName?: never };

export type PersonOrgMovementCompanyRef =
  | ({ source: 'pdl' } & PdlCompanyRef)
  | ({ source: 'coresignal' } & CoreSignalCompanyRef)
  | ({ source: 'contactout' } & ContactOutCompanyRef);
