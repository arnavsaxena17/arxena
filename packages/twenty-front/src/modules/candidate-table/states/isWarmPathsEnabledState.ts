import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
import { isWarmPathsEnabledEnv } from 'twenty-shared/arx';

export const isWarmPathsEnabledState = createAtomSelector<boolean>({
  key: 'isWarmPathsEnabledState',
  get: () => isWarmPathsEnabledEnv,
});
