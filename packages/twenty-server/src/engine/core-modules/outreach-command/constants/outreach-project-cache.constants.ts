// Stable file ids for project Find-tab backups (people / companies JSON on S3)
export const OUTREACH_PROJECT_CACHE_FILE_NAMESPACE =
  'a8c3e1f0-5b2d-4e9a-9c7f-1d4e6b8a0f23';

export const OUTREACH_PROJECT_CACHE_TTL_MS = 3 * 30 * 24 * 60 * 60 * 1000; // 3 months

export type OutreachProjectCacheKind = 'people' | 'companies';
