import { RightDrawerPages } from "@/ui/layout/right-drawer/types/RightDrawerPages";
import { IconMessages } from "@tabler/icons-react";
import { Change } from './states/tableStateAtom';

export const afterSelectionEnd = (tableRef: any, column: number, row: number, row2: number, setTableState: any, setContextStoreNumberOfSelectedRecords: any, setContextStoreTargetedRecordsRule: any, openRightDrawer: any ) => {
  console.log("row in afterSelectionEnd", row);
  console.log("row2 in afterSelectionEnd", row2);
  const hot = tableRef.current?.hotInstance;
  console.log("hot in afterSelectionEnd", hot);
  if (!hot) return;
  

  try {
    const selectedIds = hot.getSelected();
    console.log("selectedIds in afterSelectionEnd", selectedIds);
    console.log("opening right drawer");
    if (selectedIds.length === 1 && column === 1) {
      openRightDrawer(RightDrawerPages.CandidateChat, {
        title: `Chat`,
        Icon: IconMessages,
      });
    }
    console.log('Right drawer opened successfully');
  } catch (error) {
    console.error('Error opening right drawer:', error);
  }

  
  if (column === 0) {
    const rowData = hot.getSourceDataAtRow(row);
    console.log("rowData in afterSelectionEnd", rowData);
    if (rowData && rowData.id) {
      setTableState((prev: any) => {
        const currentSelectedIds = [...prev.selectedRowIds];
        const rowId = rowData.id;
        
        const index = currentSelectedIds.indexOf(rowId);
        if (index > -1) {
          currentSelectedIds.splice(index, 1);
        } else {
          currentSelectedIds.push(rowId);
        }
        return {
          ...prev,
          selectedRowIds: currentSelectedIds
        };
      });
    }
  } else {
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

    setContextStoreNumberOfSelectedRecords(selectedRows.length);
    setContextStoreTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: selectedRows,
    });
    return selectedRows;
  }


}

export const afterChange = async (tableRef: React.RefObject<any>, changes: any, source: any, jobId: string, tokenPair: any, setTableState: any, refreshData: any) => {
  console.log("changes in afterChange", changes);
  console.log("source in afterChange", source);
  
  if (!changes) return;

  const hot = tableRef.current?.hotInstance;
  if (!hot) return;

  if (source === 'undo' || source === 'redo') {
    return;
  }

  // For direct edits, save to undo stack
  if (source === 'edit') {
    const changesForUndo: Change[] = changes.map(([row, prop, oldValue, newValue]: [number, string, any, any]) => {
      const rowData = hot.getSourceDataAtRow(row);
      return {
        row,
        prop,
        oldValue,
        newValue,
        rowId: rowData?.id
      };
    }).filter((change: Change) => change.oldValue !== change.newValue);

    if (changesForUndo.length > 0) {
      setTableState((prev: any) => {
        const currentUndoStack = Array.isArray(prev.undoStack) ? prev.undoStack : [];
        return {
          ...prev,
          undoStack: [...currentUndoStack, ...changesForUndo],
          redoStack: [] // Clear redo stack on new edit
        };
      });
    }
  }

  // Track successful updates to refresh data if needed
  const updatedRows = new Set();
  
  for (const [row, prop, oldValue, newValue] of changes) {
    if (oldValue === newValue) continue;
    
    const rowData = hot.getSourceDataAtRow(row);
    if (!rowData || !rowData.id) continue;
    
    try {
      // Special handling for checkbox column
      if (prop === 'checkbox') {
        setTableState((prev: any) => {
          const currentSelectedIds = Array.isArray(prev.selectedRowIds) ? prev.selectedRowIds : [];
          const rowId = rowData.id;
          
          if (newValue === true && !currentSelectedIds.includes(rowId)) {
            return {
              ...prev,
              selectedRowIds: [...currentSelectedIds, rowId]
            };
          } else if (newValue === false) {
            return {
              ...prev,
              selectedRowIds: currentSelectedIds.filter((id: string) => id !== rowId)
            };
          }
          return prev;
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
        body: JSON.stringify({ candidateId: rowData.id, fieldName: prop, value: newValue, personId: rowData.personId })
      });
      
      if (response.ok) {
        console.log(`Updated candidate field: ${prop} for candidate ${rowData.id}`);
        updatedRows.add(rowData.id);
      } else {
        console.error('Update failed:', await response.text());
        hot.setDataAtRowProp(row, prop, oldValue, 'external');
      }
    } catch (error) {
      console.error('Update failed:', error);
      if (hot) hot.setDataAtRowProp(row, prop, oldValue, 'external');
    }
  }
  
  if (updatedRows.size > 0 && refreshData) {
    await refreshData(Array.from(updatedRows));
  }
};

export const performUndo = async (tableRef: React.RefObject<any>, setTableState: any) => {
  const hot = tableRef.current?.hotInstance;
  if (!hot) return;

  setTableState((prev: any) => {
    const currentUndoStack = Array.isArray(prev.undoStack) ? prev.undoStack : [];
    const currentRedoStack = Array.isArray(prev.redoStack) ? prev.redoStack : [];

    if (currentUndoStack.length === 0) return prev;

    const lastChange = currentUndoStack[currentUndoStack.length - 1];
    const { row, prop, oldValue, rowId } = lastChange;

    // Update the cell with the old value
    hot.setDataAtRowProp(row, prop, oldValue, 'undo');

    return {
      ...prev,
      undoStack: currentUndoStack.slice(0, -1),
      redoStack: [...currentRedoStack, lastChange]
    };
  });
};

export const performRedo = async (tableRef: React.RefObject<any>, setTableState: any) => {
  const hot = tableRef.current?.hotInstance;
  if (!hot) return;

  setTableState((prev: any) => {
    const currentUndoStack = Array.isArray(prev.undoStack) ? prev.undoStack : [];
    const currentRedoStack = Array.isArray(prev.redoStack) ? prev.redoStack : [];

    if (currentRedoStack.length === 0) return prev;

    const lastChange = currentRedoStack[currentRedoStack.length - 1];
    const { row, prop, newValue, rowId } = lastChange;

    // Update the cell with the new value
    hot.setDataAtRowProp(row, prop, newValue, 'redo');

    return {
      ...prev,
      redoStack: currentRedoStack.slice(0, -1),
      undoStack: [...currentUndoStack, lastChange]
    };
  });
};

// export const handleKeyDown = ( event: KeyboardEvent, tableRef: React.RefObject<any>, tableState: any, setTableState: any ) => {
//   // console.log("event in handleKeyDown", event);
//   if (tableState.isRightPanelOpen && event.key === 'ArrowDown') {
//     const hot = tableRef.current?.hotInstance;
//     if (!hot) return;
    
//     const selection = hot.getSelected();
//     if (!selection) return;
    
//     const [row] = selection[0];
//     const nextRowData = hot.getSourceDataAtRow(row + 1);
    
//     console.log("nextRowData", nextRowData);
//     if (nextRowData) {
//       setTableState((prev: any) => ({
//         ...prev,
//         currentRightPanelRowId: nextRowData.id
//       }));
//     }
//     event.stopImmediatePropagation();
    
//   }
// };


// export const beforeOnCellMouseDown = (hot: any, event: any, coords: any, tableState: any, setTableState: any ): string[] | undefined => {
//   console.log("coords in beforeOnCellMouseDown", coords);
//   if (coords.col === 0) {
//     const rowData = hot.getSourceDataAtRow(coords.row);
//     const rowId = rowData.id;
//     const newSelectedIds = [...tableState.selectedRowIds];
//     const index = newSelectedIds.indexOf(rowId);
//     if (index > -1) {
//       newSelectedIds.splice(index, 1);
//     } else {
//       newSelectedIds.push(rowId);
//     }
//     setTableState((prev: any) => ({
//       ...prev,
//       selectedRowIds: newSelectedIds || []
//     }));

//     return newSelectedIds;
//   }
// }
