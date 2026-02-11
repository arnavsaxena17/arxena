export type ContactAvailability = {
  emailAvailable: boolean;
  phoneAvailable: boolean;
  provider?: string;
};

export type ContactResult = {
  emails: string[];
  phones: string[];
  source: string;
};

export type ContactEnrichmentOptions = {
  wantEmail?: boolean;
  wantPhone?: boolean;
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
