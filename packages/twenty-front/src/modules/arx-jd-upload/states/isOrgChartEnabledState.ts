import { selector } from 'recoil';
import { isOrgChartEnabledEnv } from 'twenty-shared';

import { apiKeysState } from './apiKeysState';

export const isOrgChartEnabledState = selector<boolean>({
  key: 'isOrgChartEnabledState',
  get: ({ get }) => {
    const apiKeys = get(apiKeysState);
    const flag = apiKeys?.is_org_chart_enabled;
    if (flag === undefined) {
      return isOrgChartEnabledEnv;
    }
    return flag === 'true';
  },
});
