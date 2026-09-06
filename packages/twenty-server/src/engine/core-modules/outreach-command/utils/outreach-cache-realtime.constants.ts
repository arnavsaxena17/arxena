export const OUTREACH_CACHE_UPDATED_EVENT = 'outreach-cache-updated';

export type OutreachCacheKind = 'people' | 'companies' | 'journey';

export type OutreachCacheUpdatedPayload = {
  projectId: string;
  kind: OutreachCacheKind;
};

export const outreachProjectCacheRoom = (projectId: string): string =>
  `outreach-project-${projectId}`;
