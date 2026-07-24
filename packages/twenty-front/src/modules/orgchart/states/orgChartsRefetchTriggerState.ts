import { atom } from 'recoil';

/**
 * Global trigger for refetching the org charts list in the navigation drawer.
 *
 * Increment this counter from any hook / component that creates or changes an
 * `orgChart` CRM row (e.g. when the backend emits `event: 'complete'` for an
 * org-chart search). The nav drawer listens to this value and re-fetches the
 * `FindManyOrgCharts` query so the newly created chart shows up immediately
 * without requiring a page reload.
 */
export const orgChartsRefetchTriggerState = atom<number>({
  key: 'orgchart/orgChartsRefetchTriggerState',
  default: 0,
});
