import { selector } from 'recoil';

/** Org chart features are always on; workspace `is_org_chart_enabled` is ignored for gating. */
export const isOrgChartEnabledState = selector<boolean>({
  key: 'isOrgChartEnabledState',
  get: () => true,
});
