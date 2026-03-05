import { selector } from 'recoil';

import { apiKeysState } from './apiKeysState';

export const isOrgChartEnabledState = selector<boolean>({
  key: 'isOrgChartEnabledState',
  get: ({ get }) => {
    const apiKeys = get(apiKeysState);
    const flag = apiKeys?.is_org_chart_enabled;
    if (flag === undefined) {
      return process.env.IS_ORG_CHART_ENABLED === 'true';
    }
    return flag === 'true';
  },
});
