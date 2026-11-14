export type ContactAvailability = {
  emailAvailable: boolean;
  phoneAvailable: boolean;
  provider?: string;
};

export type ContactResult = {
  emails: string[];
  phones: string[];
  source: string;
  /** From Apollo `people/match` when a public LinkedIn URL is available */
  linkedinUrl?: string;
  /** From provider payloads (e.g. Apollo `person.name` or first/last). */
  fullName?: string;
};

export type ContactEnrichmentOptions = {
  wantEmail?: boolean;
  wantPhone?: boolean;
  /**
   * When set with `companyDomain`, the Apollo step of the waterfall can call
   * `people/match` with `id` + `domain` (and optional profile `linkedinUrl`).
   */
  apolloPersonId?: string;
  companyDomain?: string;
};

export type ContactEnrichmentJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ContactEnrichmentJobProgress = {
  jobId: string;
  status: ContactEnrichmentJobStatus;
  total: number;
  completed: number;
  failed: number;
  results?: Record<string, ContactResult | ContactAvailability>;
  error?: string;
};

export type ContactEnrichmentProviderName =
  | 'arxena'
  | 'pdl'
  | 'contactout'
  | 'lusha'
  | 'apollo';
