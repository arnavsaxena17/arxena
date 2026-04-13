import { atom } from 'recoil';

export type OrgChartQueryGeneratorPreference = 'python' | 'multi_agent';

export const orgChartQueryGeneratorPreferenceState =
  atom<OrgChartQueryGeneratorPreference>({
    key: 'orgChartQueryGeneratorPreferenceState',
    default: 'python',
  });
