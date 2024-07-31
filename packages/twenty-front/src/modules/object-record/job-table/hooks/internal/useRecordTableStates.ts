import { hasUserSelectedAllRowsComponentState } from '@/object-record/job-table/record-table-row/states/hasUserSelectedAllRowsFamilyState';
import { isRowSelectedComponentFamilyState } from '@/object-record/job-table/record-table-row/states/isRowSelectedComponentFamilyState';
import { RecordTableScopeInternalContext } from '@/object-record/job-table/scopes/scope-internal-context/RecordTableScopeInternalContext';
import { availableTableColumnsComponentState } from '@/object-record/job-table/states/availableTableColumnsComponentState';
import { currentTableCellInEditModePositionComponentState } from '@/object-record/job-table/states/currentTableCellInEditModePositionComponentState';
import { isRecordTableInitialLoadingComponentState } from '@/object-record/job-table/states/isRecordTableInitialLoadingComponentState';
import { isSoftFocusActiveComponentState } from '@/object-record/job-table/states/isSoftFocusActiveComponentState';
import { isSoftFocusOnTableCellComponentFamilyState } from '@/object-record/job-table/states/isSoftFocusOnTableCellComponentFamilyState';
import { isTableCellInEditModeComponentFamilyState } from '@/object-record/job-table/states/isTableCellInEditModeComponentFamilyState';
import { numberOfTableRowsComponentState } from '@/object-record/job-table/states/numberOfTableRowsComponentState';
import { onColumnsChangeComponentState } from '@/object-record/job-table/states/onColumnsChangeComponentState';
import { onEntityCountChangeComponentState } from '@/object-record/job-table/states/onEntityCountChangeComponentState';
import { onToggleColumnFilterComponentState } from '@/object-record/job-table/states/onToggleColumnFilterComponentState';
import { onToggleColumnSortComponentState } from '@/object-record/job-table/states/onToggleColumnSortComponentState';
import { recordTablePendingRecordIdComponentState } from '@/object-record/job-table/states/recordTablePendingRecordIdComponentState';
import { resizeFieldOffsetComponentState } from '@/object-record/job-table/states/resizeFieldOffsetComponentState';
import { allRowsSelectedStatusComponentSelector } from '@/object-record/job-table/states/selectors/allRowsSelectedStatusComponentSelector';
import { hiddenTableColumnsComponentSelector } from '@/object-record/job-table/states/selectors/hiddenTableColumnsComponentSelector';
import { numberOfTableColumnsComponentSelector } from '@/object-record/job-table/states/selectors/numberOfTableColumnsComponentSelector';
import { selectedRowIdsComponentSelector } from '@/object-record/job-table/states/selectors/selectedRowIdsComponentSelector';
import { visibleTableColumnsComponentSelector } from '@/object-record/job-table/states/selectors/visibleTableColumnsComponentSelector';
import { softFocusPositionComponentState } from '@/object-record/job-table/states/softFocusPositionComponentState';
import { tableColumnsComponentState } from '@/object-record/job-table/states/tableColumnsComponentState';
import { tableFiltersComponentState } from '@/object-record/job-table/states/tableFiltersComponentState';
import { tableLastRowVisibleComponentState } from '@/object-record/job-table/states/tableLastRowVisibleComponentState';
import { tableRowIdsComponentState } from '@/object-record/job-table/states/tableRowIdsComponentState';
import { tableSortsComponentState } from '@/object-record/job-table/states/tableSortsComponentState';
import { useAvailableScopeIdOrThrow } from '@/ui/utilities/recoil-scope/scopes-internal/hooks/useAvailableScopeId';
import { getScopeIdOrUndefinedFromComponentId } from '@/ui/utilities/recoil-scope/utils/getScopeIdOrUndefinedFromComponentId';
import { extractComponentFamilyState } from '@/ui/utilities/state/component-state/utils/extractComponentFamilyState';
import { extractComponentReadOnlySelector } from '@/ui/utilities/state/component-state/utils/extractComponentReadOnlySelector';
import { extractComponentState } from '@/ui/utilities/state/component-state/utils/extractComponentState';

export const useRecordTableStates = (recordTableId?: string) => {
  const scopeId = useAvailableScopeIdOrThrow(RecordTableScopeInternalContext, getScopeIdOrUndefinedFromComponentId(recordTableId));

  return {
    scopeId,
    availableTableColumnsState: extractComponentState(availableTableColumnsComponentState, scopeId),
    tableFiltersState: extractComponentState(tableFiltersComponentState, scopeId),
    tableSortsState: extractComponentState(tableSortsComponentState, scopeId),
    tableColumnsState: extractComponentState(tableColumnsComponentState, scopeId),
    onToggleColumnFilterState: extractComponentState(onToggleColumnFilterComponentState, scopeId),
    onToggleColumnSortState: extractComponentState(onToggleColumnSortComponentState, scopeId),
    onColumnsChangeState: extractComponentState(onColumnsChangeComponentState, scopeId),
    onEntityCountChangeState: extractComponentState(onEntityCountChangeComponentState, scopeId),
    tableLastRowVisibleState: extractComponentState(tableLastRowVisibleComponentState, scopeId),
    softFocusPositionState: extractComponentState(softFocusPositionComponentState, scopeId),
    numberOfTableRowsState: extractComponentState(numberOfTableRowsComponentState, scopeId),
    currentTableCellInEditModePositionState: extractComponentState(currentTableCellInEditModePositionComponentState, scopeId),
    isTableCellInEditModeFamilyState: extractComponentFamilyState(isTableCellInEditModeComponentFamilyState, scopeId),
    isSoftFocusActiveState: extractComponentState(isSoftFocusActiveComponentState, scopeId),
    tableRowIdsState: extractComponentState(tableRowIdsComponentState, scopeId),
    isRecordTableInitialLoadingState: extractComponentState(isRecordTableInitialLoadingComponentState, scopeId),
    resizeFieldOffsetState: extractComponentState(resizeFieldOffsetComponentState, scopeId),
    isSoftFocusOnTableCellFamilyState: extractComponentFamilyState(isSoftFocusOnTableCellComponentFamilyState, scopeId),
    isRowSelectedFamilyState: extractComponentFamilyState(isRowSelectedComponentFamilyState, scopeId),
    hasUserSelectedAllRowState: extractComponentState(hasUserSelectedAllRowsComponentState, scopeId),
    allRowsSelectedStatusSelector: extractComponentReadOnlySelector(allRowsSelectedStatusComponentSelector, scopeId),
    hiddenTableColumnsSelector: extractComponentReadOnlySelector(hiddenTableColumnsComponentSelector, scopeId),
    numberOfTableColumnsSelector: extractComponentReadOnlySelector(numberOfTableColumnsComponentSelector, scopeId),
    selectedRowIdsSelector: extractComponentReadOnlySelector(selectedRowIdsComponentSelector, scopeId),
    visibleTableColumnsSelector: extractComponentReadOnlySelector(visibleTableColumnsComponentSelector, scopeId),
    pendingRecordIdState: extractComponentState(recordTablePendingRecordIdComponentState, scopeId),
  };
};
