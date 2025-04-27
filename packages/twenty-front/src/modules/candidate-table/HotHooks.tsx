export const afterSelectionEnd = (tableRef: any, row: number, row2: number, setTableState: any ) => {
  console.log("row in afterSelectionEnd", row);
  console.log("row in afterSelectionEndHandler", row);
  const hot = tableRef.current?.hotInstance;
  if (!hot) return;
  const selectedRows: string[] = [];
  for (let i = Math.min(row, row2); i <= Math.max(row, row2); i++) {
    const rowData = hot.getSourceDataAtRow(i);
    console.log("rowData", rowData);
    if (rowData && rowData.id) {
      selectedRows.push(rowData.id);
    }
  }
  console.log("selectedRows", selectedRows);

  // const selectedRows = afterSelectionEnd(hot, row, row2);
  setTableState((prev: any) => ({
    ...prev,
    selectedRowIds: selectedRows
  }));
  return selectedRows;
}

export const afterChange = (tableRef: React.RefObject<any>, changes: any, source: any, jobId: string) => {
  console.log("changes in afterChange", changes);
  console.log("source in afterChange", source);
  if (source !== 'edit') return;
  changes.forEach(async ([row, prop, oldValue, newValue]: any) => {
  if (oldValue === newValue) return;
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;
    const rowData = hot.getSourceDataAtRow(row);
    try {
      await fetch(`/api/candidates/${jobId}/${rowData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [prop]: newValue })
      });
    } catch (error) {
      console.error('Update failed:', error);
    }
  });
}



export const handleKeyDown = ( event: KeyboardEvent, tableRef: React.RefObject<any>, tableState: any, setTableState: any ) => {
  console.log("event in handleKeyDown", event);
  if (tableState.isRightPanelOpen && event.key === 'ArrowDown') {
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;
    
    const selection = hot.getSelected();
    if (!selection) return;
    
    const [row] = selection[0];
    const nextRowData = hot.getSourceDataAtRow(row + 1);
    
    console.log("nextRowData", nextRowData);
    if (nextRowData) {
      setTableState((prev: any) => ({
        ...prev,
        currentRightPanelRowId: nextRowData.id
      }));
    }
    event.stopImmediatePropagation();
  }
};


export const beforeOnCellMouseDown = (hot: any, event: any, coords: any, tableState: any, setTableState: any ): string[] | undefined => {
  console.log("coords in beforeOnCellMouseDown", coords);
  if (coords.col === 0) {
    const rowData = hot.getSourceDataAtRow(coords.row);
    const rowId = rowData.id;
    const newSelectedIds = [...tableState.selectedRowIds];
    const index = newSelectedIds.indexOf(rowId);
    if (index > -1) {
      newSelectedIds.splice(index, 1);
    } else {
      newSelectedIds.push(rowId);
    }
    setTableState((prev: any) => ({
      ...prev,
      selectedRowIds: newSelectedIds || []
    }));

    return newSelectedIds;
  }
}
