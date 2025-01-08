import { availableTableColumnsComponentState } from '@/object-record/record-table/states/availableTableColumnsComponentState';
import { tableColumnsComponentState } from '@/object-record/record-table/states/tableColumnsComponentState';
import { createComponentReadOnlySelector } from '@/ui/utilities/state/component-state/utils/createComponentReadOnlySelector';
import { useMemo } from 'react';
import { mapArrayToObject } from '~/utils/array/mapArrayToObject';

export const hiddenTableColumnsComponentSelector =
  createComponentReadOnlySelector({
    key: 'hiddenTableColumnsComponentSelector',
    get:
      ({ scopeId }) =>
      ({ get }) => {
        const tableColumns = get(tableColumnsComponentState({ scopeId }));
        const availableColumns = get(
          availableTableColumnsComponentState({ scopeId }),
        );
        console.log("tableColumns::", tableColumns)
        console.log("availableColumnsavailableColumns::", availableColumns)
        const tableColumnsByKey = useMemo(() => 
          mapArrayToObject(tableColumns, ({ fieldMetadataId }) => fieldMetadataId),
          [tableColumns]
        );
        console.log("tableColumnsByKey::", tableColumnsByKey)
            const hiddenColumns = availableColumns
          .filter(
            ({ fieldMetadataId }) =>
              !tableColumnsByKey[fieldMetadataId]?.isVisible,
          )
          .map((availableColumn) => {
            const { fieldMetadataId } = availableColumn;
            const existingTableColumn = tableColumnsByKey[fieldMetadataId];

            return {
              ...(existingTableColumn || availableColumn),
              isVisible: false,
            };
          });
          console.log("All hidden columns:", hiddenColumns);

        return hiddenColumns;
      },
  });
