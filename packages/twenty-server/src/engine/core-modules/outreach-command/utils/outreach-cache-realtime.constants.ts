export const OUTREACH_CACHE_UPDATED_EVENT = 'outreach-cache-updated';

export type OutreachCacheKind =
  | 'people'
  | 'companies'
  | 'journey'
  | 'aiColumn'
  | 'tableView';

export type OutreachAiColumnRunProgress = {
  runId: string;
  label: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  total: number;
  done: number;
  failed: number;
  error?: string;
};

export type OutreachTableTab = 'people' | 'companies';

export type OutreachTableFilter =
  | { columnId: string; kind: 'values'; values: string[] }
  | {
      columnId: string;
      kind: 'condition';
      operator:
        | 'contains'
        | 'notContains'
        | 'equals'
        | 'empty'
        | 'notEmpty'
        | 'greaterThan'
        | 'greaterThanOrEqual'
        | 'lessThan'
        | 'lessThanOrEqual';
      value: string;
    };

export type OutreachTableSort = {
  columnId: string;
  direction: 'asc' | 'desc';
};

// The filters and sort the agent applied to a table, shared with everyone
// looking at the project.
export type OutreachTableView = {
  tab: OutreachTableTab;
  filters: OutreachTableFilter[];
  sort: OutreachTableSort | null;
  summary: string;
  updatedAt: string;
};

export type OutreachCacheUpdatedPayload = {
  projectId: string;
  kind: OutreachCacheKind;
  aiColumnRun?: OutreachAiColumnRunProgress;
  tableView?: OutreachTableView;
};

export const outreachProjectCacheRoom = (projectId: string): string =>
  `outreach-project-${projectId}`;
