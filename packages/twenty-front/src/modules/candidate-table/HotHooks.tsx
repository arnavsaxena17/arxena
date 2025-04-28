export const afterSelectionEnd = (tableRef: any, column: number, row: number, row2: number, setTableState: any ) => {
  console.log("row in afterSelectionEnd", row);
  console.log("row in afterSelectionEndHandler", row);
  const hot = tableRef.current?.hotInstance;
  console.log("hot in afterSelectionEnd", hot);
  if (!hot) return;
  
  // Check if this is a checkbox column selection (column === 0)
  if (column === 0) {
    // Get all currently selected rows
    const rowData = hot.getSourceDataAtRow(row);
    if (rowData && rowData.id) {
      setTableState((prev: any) => {
        const currentSelectedIds = [...prev.selectedRowIds];
        const rowId = rowData.id;
        
        // Toggle selection for this row
        const index = currentSelectedIds.indexOf(rowId);
        if (index > -1) {
          // Already selected, remove it
          currentSelectedIds.splice(index, 1);
        } else {
          // Not selected, add it
          currentSelectedIds.push(rowId);
        }
        
        return {
          ...prev,
          selectedRowIds: currentSelectedIds
        };
      });
    }
  } else {
    // For non-checkbox column selections, use the original behavior
    const selectedRows: string[] = [];
    for (let i = Math.min(row, row2); i <= Math.max(row, row2); i++) {
      const rowData = hot.getSourceDataAtRow(i);
      console.log("rowData", rowData);
      if (rowData && rowData.id) {
        selectedRows.push(rowData.id);
      }
    }
    console.log("selectedRows", selectedRows);

    setTableState((prev: any) => ({
      ...prev,
      selectedRowIds: selectedRows
    }));
    return selectedRows;
  }
}

export const afterChange = async (tableRef: React.RefObject<any>, changes: any, source: any, jobId: string, tokenPair: any, setTableState: any, refreshData: any) => {
  console.log("changes in afterChange", changes);
  console.log("source in afterChange", source);
  if (!changes || source !== 'edit') return;
  
  // Track successful updates to refresh data if needed
  const updatedRows = new Set();
  
  for (const [row, prop, oldValue, newValue] of changes) {
    if (oldValue === newValue) continue;
    
    const hot = tableRef.current?.hotInstance;
    if (!hot) continue;
    
    const rowData = hot.getSourceDataAtRow(row);
    if (!rowData || !rowData.id) continue;
    
    try {
      // Special handling for checkbox column
      if (prop === 'checkbox') {
        setTableState((prev: any) => {
          const currentSelectedIds = [...prev.selectedRowIds];
          const rowId = rowData.id;
          
          if (newValue === true && !currentSelectedIds.includes(rowId)) {
            currentSelectedIds.push(rowId);
          } else if (newValue === false) {
            const index = currentSelectedIds.indexOf(rowId);
            if (index > -1) {
              currentSelectedIds.splice(index, 1);
            }
          }
          
          return {
            ...prev,
            selectedRowIds: currentSelectedIds
          };
        });
        continue;
      }
      
      const isDirectField = 
        Object.prototype.hasOwnProperty.call(rowData, prop) && prop !== 'candidateFieldValues';
      console.log(`Updating field: ${prop}, isDirectField: ${isDirectField}`);
      
      const endpoint = isDirectField 
        ? `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field`
        : `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field-value`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}` 
        },
        body: JSON.stringify({ candidateId: rowData.id, fieldName: prop, value: newValue })
      });
      
      if (response.ok) {
        console.log(`Updated candidate field: ${prop} for candidate ${rowData.id}`);
        updatedRows.add(rowData.id);
      } else {
        console.error('Update failed:', await response.text());
        // Revert the cell to its previous value if update failed
        hot.setDataAtRowProp(row, prop, oldValue);
      }

      if (updatedRows.size > 0 && refreshData) {
        console.log("Will be calling refresh data with the changes", updatedRows);
        await refreshData(Array.from(updatedRows));
      }
    
    } catch (error) {
      console.error('Update failed:', error);
      // Revert cell on error
      const hot = tableRef.current?.hotInstance;
      if (hot) hot.setDataAtRowProp(row, prop, oldValue);
    }
  }
  
  // If we have successful updates, refresh the data
  if (updatedRows.size > 0) {
    // Optional: refresh data from server to ensure consistency
    // You could call loadData() here or implement a partial refresh
  }
}


export const handleKeyDown = ( event: KeyboardEvent, tableRef: React.RefObject<any>, tableState: any, setTableState: any ) => {
  // console.log("event in handleKeyDown", event);
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
