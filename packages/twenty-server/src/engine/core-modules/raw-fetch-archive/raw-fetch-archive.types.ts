export type RawFetchProvider =
  | 'bright-data'
  | 'apify'
  | 'apollo'
  | 'unipile'
  | 'serp';

export type RawFetchArchiveInput = {
  provider: RawFetchProvider;
  // Stable name of the vendor call, e.g. "business-search/people"
  endpoint: string;
  request: unknown;
  response: unknown;
  workspaceId?: string | null;
  // Page, offset or cursor so paginated calls never overwrite each other
  pageKey?: string | number | null;
  costUsd?: number;
  meta?: Record<string, unknown>;
};

export type RawFetchArchiveEnvelope = {
  version: 1;
  provider: RawFetchProvider;
  endpoint: string;
  workspaceId: string | null;
  fetchedAt: string;
  pageKey: string | null;
  requestHash: string;
  costUsd: number | null;
  meta: Record<string, unknown> | null;
  request: unknown;
  response: unknown;
};

export type RawFetchArchiveResult = {
  requestHash: string;
  s3Path: string;
  // True once the durable S3 copy is written; Redis alone is not durable
  durable: boolean;
};
