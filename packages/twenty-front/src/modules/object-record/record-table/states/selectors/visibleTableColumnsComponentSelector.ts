import { tableColumnsComponentState } from '@/object-record/record-table/states/tableColumnsComponentState';
import { createComponentReadOnlySelector } from '@/ui/utilities/state/component-state/utils/createComponentReadOnlySelector';

export const visibleTableColumnsComponentSelector =
  createComponentReadOnlySelector({
    key: 'visibleTableColumnsComponentSelector',
    get:
      ({ scopeId }) =>
      ({ get }) => {
        console.log("scopeId for visibleTableColumnsComponentSelector", scopeId);
        console.log("tableColumnsComponentState({ scopeId }) for visibleTableColumnsComponentSelector", tableColumnsComponentState({ scopeId }));
        const columns = get(tableColumnsComponentState({ scopeId }));
        console.log("columns for tableColumnsComponentState", columns);
        return columns
        .filter((column) => column.isVisible ?? true) // Handle undefined case
          .sort((columnA, columnB) => columnA.position - columnB.position);
      },
  });
