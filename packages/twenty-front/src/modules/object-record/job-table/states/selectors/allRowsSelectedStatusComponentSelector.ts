import { numberOfTableRowsComponentState } from '@/object-record/job-table/states/numberOfTableRowsComponentState';
import { selectedRowIdsComponentSelector } from '@/object-record/job-table/states/selectors/selectedRowIdsComponentSelector';
import { createComponentReadOnlySelector } from '@/ui/utilities/state/component-state/utils/createComponentReadOnlySelector';

import { AllRowsSelectedStatus } from '../../types/AllRowSelectedStatus';

export const allRowsSelectedStatusComponentSelector = createComponentReadOnlySelector<AllRowsSelectedStatus>({
  key: 'allRowsSelectedStatusComponentSelector',
  get:
    ({ scopeId }) =>
    ({ get }) => {
      const numberOfRows = get(numberOfTableRowsComponentState({ scopeId }));

      const selectedRowIds = get(selectedRowIdsComponentSelector({ scopeId }));

      const numberOfSelectedRows = selectedRowIds.length;

      const allRowsSelectedStatus = numberOfSelectedRows === 0 ? 'none' : numberOfRows === numberOfSelectedRows ? 'all' : 'some';

      return allRowsSelectedStatus;
    },
});
