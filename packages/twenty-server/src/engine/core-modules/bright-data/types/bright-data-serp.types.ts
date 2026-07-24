/** Parsed Google SERP organic row from Bright Data SERP API (format: json). */
export type BrightDataSerpOrganicEntry = {
  url?: string;
  link?: string;
  title?: string;
  description?: string;
  source?: string;
  display_link?: string;
  profile?: {
    name?: string;
  };
  extensions?: Array<{
    inline?: boolean;
    type?: string;
    text?: string;
    rank?: number;
  }>;
  rank?: number;
  global_rank?: number;
};

export type BrightDataSerpPaginationPage = {
  page?: number;
  start?: number;
  link?: string;
};

/** Typical top-level JSON from Bright Data when scraping Google with structured output. */
export type BrightDataSerpGoogleJson = {
  general?: {
    search_engine?: string;
    query?: string;
    results_cnt?: number;
    page_title?: string;
    timestamp?: string;
  };
  input?: {
    original_url?: string;
    request_id?: string;
  };
  organic?: BrightDataSerpOrganicEntry[];
  pagination?: {
    pages?: BrightDataSerpPaginationPage[];
    current_page?: number;
    next_page?: number;
    next_page_start?: number;
    next_page_link?: string;
  };
};

export type BrightDataDatasetSnapshotStatus = 'running' | 'collecting' | 'processing' | 'ready' | 'failed';

export type BrightDataDatasetSnapshotProgress = {
  snapshot_id?: string;
  dataset_id?: string;
  status?: BrightDataDatasetSnapshotStatus | string;
  message?: string;
  created_at?: string;
  updated_at?: string;
};

export type BrightDataDatasetSnapshotListEntry = {
  id?: string;
  snapshot_id?: string;
  status?: BrightDataDatasetSnapshotStatus | string;
  created_at?: string;
  timestamp?: string;
  updated_at?: string;
};

export type BrightDataDatasetSnapshotPaginationEntry = {
  page?: string | number;
  link?: string;
  page_html?: string;
};

export type BrightDataDatasetSnapshotItem = {
  url?: string;
  keyword?: string;
  language?: string;
  country?: string;
  timestamp?: string;
  index?: string | number;
  general?: {
    search_engine?: string;
    language?: string;
    location?: string;
    search_type?: string;
    page_title?: string;
    datetime?: string;
    query?: string;
    results_cnt?: number;
  };
  organic?: BrightDataSerpOrganicEntry[];
  pagination?: BrightDataDatasetSnapshotPaginationEntry[];
  page_html?: string;
};
