import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

import { CustomSortState } from '../types/sortTypes';

export const customSortState = createAtomState<CustomSortState>({
  key: 'customSortState',
  defaultValue: {
    field: 'updatedAt',
    direction: 'desc',
  },
});
