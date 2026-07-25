import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const chromeExtensionIdState = createAtomState<string | null>({
  key: 'chromeExtensionIdState',
  defaultValue: null,
});
