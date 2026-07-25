import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export type OrgChartQueryGeneratorPreference = 'python' | 'multi_agent';

export const orgChartQueryGeneratorPreferenceState =
  createAtomState<OrgChartQueryGeneratorPreference>({
    key: 'orgChartQueryGeneratorPreferenceState',
    defaultValue: 'python',
  });
