import { type OutreachListSource } from 'src/engine/core-modules/outreach-list/outreach-list.types';

// Lists that cost money to build are kept longer; free sources are cheap to
// run again. Every read or write of a list pushes its expiry out again.
export const OUTREACH_LIST_PAID_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const OUTREACH_LIST_FREE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Sources that bill per record
export const OUTREACH_LIST_PAID_SOURCES: readonly OutreachListSource[] = [
  'bright_data',
  'harvest',
];

export const OUTREACH_LIST_MAX_ROWS = 20_000;
export const OUTREACH_LIST_PEEK_MAX_ROWS = 10;

// Namespace for the stable (list id -> file id) mapping on S3
export const OUTREACH_LIST_FILE_NAMESPACE =
  '6f6c1a52-3c0e-4f0a-9a43-0b7f3d2e8c11';
