import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';

// Org chart features are always on; workspace `is_org_chart_enabled` is ignored for gating.
export const isOrgChartEnabledState = createAtomSelector<boolean>({
  key: 'isOrgChartEnabledState',
  get: () => true,
});
