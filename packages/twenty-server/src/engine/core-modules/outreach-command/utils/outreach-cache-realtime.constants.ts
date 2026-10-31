export const OUTREACH_CACHE_UPDATED_EVENT = 'outreach-cache-updated';

export type OutreachCacheKind =
  | 'people'
  | 'companies'
  | 'journey'
  | 'aiColumn'
  | 'tableView';

export type OutreachTableTab = 'people' | 'companies';

export type OutreachAiColumnRunProgress = {
  runId: string;
  label: string;
  // Which table the column belongs to, so only that tab shows the progress.
  tab: OutreachTableTab;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  total: number;
  done: number;
  failed: number;
  error?: string;
};

// AI filter engine / workflow FilterSubject uses singular entity names.
export const filterSubjectFromTab = (
  tab: OutreachTableTab,
): 'person' | 'company' => (tab === 'people' ? 'person' : 'company');

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

// One row as the People tab stores it. A write that knows exactly which rows
// it touched sends them along, so the client upserts those rows instead of
// refetching the whole list. Kept here rather than in the cache service so the
// wire shape has no import cycle.
export type OutreachCachePersonRow = {
  id: string;
  name: string;
  title: string;
  headline?: string;
  summary?: string;
  companyId: string;
  companyName: string;
  linkedinUrl: string;
  warmPath: string;
  stage: string;
  email: string;
  connectionDegree?: number;
  personaPriorityScore?: number;
  otherFields?: Record<string, unknown>;
};

export type OutreachCacheUpdatedPayload = {
  projectId: string;
  kind: OutreachCacheKind;
  aiColumnRun?: OutreachAiColumnRunProgress;
  tableView?: OutreachTableView;
  // Present only when the write can name what changed. When it is absent the
  // client must refetch: rows may have been removed, not just added
  rows?: OutreachCachePersonRow[];
};

export const outreachProjectCacheRoom = (projectId: string): string =>
  `outreach-project-${projectId}`;
