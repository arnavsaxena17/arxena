import { RightDrawerPages } from "@/ui/layout/right-drawer/types/RightDrawerPages";
import { IconMessages } from "@tabler/icons-react";
import axios from 'axios';
// import { Change } from './states/tableStateAtom';

export const updateUnreadMessagesStatus = async (unreadMessageIds: string[], tokenPair: any) => {
  if (!unreadMessageIds?.length) return;

  try {
    await axios.post(
      `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/update-whatsapp-delivery-status`,
      { listOfMessagesIds: unreadMessageIds },
      { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } },
    );
    console.log('Successfully marked messages as read');
  } catch (error) {
    console.error('Error updating message status:', error);
  }
};

export const afterSelectionEnd = (tableRef: any, column: number, row: number, row2: number, setTableState: any, setContextStoreNumberOfSelectedRecords: any, setContextStoreTargetedRecordsRule: any, openRightDrawer: any, tokenPair: any) => {
  console.log("row in afterSelectionEnd", row);
  console.log("row2 in afterSelectionEnd", row2);
  const hot = tableRef.current?.hotInstance;
  console.log("hot in afterSelectionEnd", hot);
  if (!hot) return;

  try {
    const selectedIds = hot.getSelected();
    console.log("selectedIds in afterSelectionEnd", selectedIds);
    
    // Handle chat drawer opening
    if (selectedIds.length === 1 && column === 1) {
      // Get physical row index for proper data access after sorting
      const physicalRow = hot.toPhysicalRow(row);
      const selectedRow = hot.getSourceDataAtRow(physicalRow);
      console.log("selectedRow in afterSelectionEnd", selectedRow);
      
      if (selectedRow?.id) {
        // Fetch unread messages for this candidate
        axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
          { candidateId: selectedRow.id },
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
        ).then(response => {
          console.log("Messages response:", response.data);
          const unreadMessageIds = response.data
            ?.filter((msg: any) => msg.whatsappDeliveryStatus === 'receivedFromCandidate')
            ?.map((msg: any) => msg.id) || [];
          
          console.log("Filtered unreadMessageIds:", unreadMessageIds);

          // Open the drawer
          openRightDrawer(RightDrawerPages.CandidateChat, {
            title: `Chat with ${selectedRow.fullName || selectedRow.name || 'Candidate'}`,
            Icon: IconMessages,
            meta: {
              candidateId: selectedRow.id,
              unreadMessageIds
            }
          });

          // Update message status if there are unread messages
          if (unreadMessageIds.length > 0) {
            updateUnreadMessagesStatus(unreadMessageIds, tokenPair);
            
            // Update the table state to clear unread messages count
            setTableState((prev: any) => ({
              ...prev,
              unreadMessagesCounts: {
                ...prev.unreadMessagesCounts,
                [selectedRow.id]: 0
              }
            }));
          }
        }).catch(error => {
          console.error('Error fetching messages:', error);
          // Still open drawer even if message fetch fails
          openRightDrawer(RightDrawerPages.CandidateChat, {
            title: `Chat with ${selectedRow.fullName || selectedRow.name || 'Candidate'}`,
            Icon: IconMessages,
            meta: {
              candidateId: selectedRow.id,
              unreadMessageIds: []
            }
          });
        });
      }
    }
    console.log('Right drawer opened successfully');

    // Handle row selection for both checkbox and regular cell selection
    const selectedRows: string[] = [];
    
    if (column === 0) {
      console.log("column is 0");
      // For checkbox column, toggle the selected state of the clicked row
      const physicalRow = hot.toPhysicalRow(row);
      const rowData = hot.getSourceDataAtRow(physicalRow);
      let currentSelectedIds: string[] = [];
      if (rowData && rowData.id) {
        setTableState((prev: any) => {
          currentSelectedIds = [...prev.selectedRowIds];
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

        setContextStoreNumberOfSelectedRecords(currentSelectedIds.length);
        setContextStoreTargetedRecordsRule({
          mode: 'selection',
          selectedRecordIds: currentSelectedIds,
        });
      }
    } else {
      console.log("column is not 0 and its a regular cell selection");
      // For regular cell selection, select all rows in the range using physical indices
      for (let i = Math.min(row, row2); i <= Math.max(row, row2); i++) {
        const physicalRow = hot.toPhysicalRow(i);
        console.log("physicalRow::", physicalRow);
        const rowData = hot.getSourceDataAtRow(physicalRow);
        console.log("rowData::", rowData);
        if (rowData && rowData.id) {
          selectedRows.push(rowData.id);
        }
      }
      console.log("selectedRows::", selectedRows);
      
      setTableState((prev: any) => ({
        ...prev,
        selectedRowIds: selectedRows
      }));

      setContextStoreNumberOfSelectedRecords(selectedRows.length);
      setContextStoreTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: selectedRows,
      });
    }
  } catch (error) {
    console.error('Error in afterSelectionEnd:', error);
  }
};

type Change = {
  row: number;
  prop: string;
  oldValue: any;
  newValue: any;
  rowId: string;
};

type PendingUpdate = {
  row: number;
  prop: string;
  oldValue: any;
  newValue: any;
  rowData: any;
  endpoint: string;
  isDirectField: boolean;
};

const handleUndoStackUpdate = (changes: any[], hot: any, setTableState: any) => {
  const changesForUndo: Change[] = changes
    .map(([row, prop, oldValue, newValue]: [number, string, any, any]) => {
      const rowData = hot.getSourceDataAtRow(row);
      return {
        row,
        prop,
        oldValue,
        newValue,
        rowId: rowData?.id
      };
    })
    .filter((change: Change) => change.oldValue !== change.newValue);

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
};

const handleCheckboxChange = (rowData: any, newValue: boolean, setTableState: any) => {
  console.log("prop is checkbox and hence setting table states");
  setTableState((prev: any) => {
    const currentSelectedIds = Array.isArray(prev.selectedRowIds) ? prev.selectedRowIds : [];
    console.log("currentSelectedIds::", currentSelectedIds);
    const rowId = rowData.id;
    console.log("rowId selected of rowData::", rowId);
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
};

const updateTableState = (rowData: any, prop: string, newValue: any, setTableState: any, hot: any) => {
  console.log(`Updating field: ${prop} for row ${rowData.id}`);
  console.log(`Column index for ${prop}:`, hot?.propToCol(prop));

  setTableState((prev: any) => {
    const updatedRawData = [...prev.rawData];
    const index = updatedRawData.findIndex(item => item.id === rowData.id);
    
    if (index >= 0) {
      const currentRow = { ...updatedRawData[index] };
      
      // Check if this is a direct field on the candidate object
      const isDirectField = Object.prototype.hasOwnProperty.call(currentRow, prop);
      
      if (isDirectField) {
        // Update direct field
        currentRow[prop] = newValue;
      } else {
        // This might be a candidateFieldValue - need to update within candidateFieldValues
        if (currentRow.candidateFieldValues && currentRow.candidateFieldValues.edges) {
          const updatedEdges = [...currentRow.candidateFieldValues.edges];
          
          // Convert camelCase prop back to snake_case for field lookup
          const snakeCaseFieldName = prop.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          
          // Find the field in candidateFieldValues
          const fieldIndex = updatedEdges.findIndex(edge => 
            edge.node?.candidateFields?.name === snakeCaseFieldName ||
            edge.node?.candidateFields?.name === prop // Also check exact match
          );
          
          if (fieldIndex >= 0) {
            // Update existing field value
            updatedEdges[fieldIndex] = {
              ...updatedEdges[fieldIndex],
              node: {
                ...updatedEdges[fieldIndex].node,
                name: String(newValue)
              }
            };
            
            currentRow.candidateFieldValues = {
              ...currentRow.candidateFieldValues,
              edges: updatedEdges
            };
          } else {
            console.warn(`Field ${prop} (${snakeCaseFieldName}) not found in candidateFieldValues`);
            // Optionally, you could add it as a direct field as fallback
            currentRow[prop] = newValue;
          }
        } else {
          // No candidateFieldValues structure, add as direct field
          currentRow[prop] = newValue;
        }
      }
      
      updatedRawData[index] = currentRow;
    }
    
    console.log('updatedRawData in updateTableState::', updatedRawData);
    return {
      ...prev,
      rawData: updatedRawData
    };
  });

  // IMMEDIATELY update the table's visual state
  if (hot) {
    // Find the current visual row index for this data
    const allData = hot.getSourceData();
    const physicalIndex = allData.findIndex((item: any) => item.id === rowData.id);
    if (physicalIndex >= 0) {
      const visualRow = hot.toVisualRow(physicalIndex);
      const colIndex = hot.propToCol(prop);
      if (visualRow !== null && visualRow !== undefined && colIndex !== null && colIndex !== undefined) {
        hot.setDataAtCell(visualRow, colIndex, newValue, 'external');
      }
    }
  }
};


const revertTableState = (rowData: any, prop: string, oldValue: any, hot: any, setTableState: any) => {
  // First update the state
  setTableState((prev: any) => {
    const updatedRawData = [...prev.rawData];
    const index = updatedRawData.findIndex(item => item.id === rowData.id);
    if (index >= 0) {
      updatedRawData[index] = {
        ...updatedRawData[index],
        [prop]: oldValue
      };
    }
    return {
      ...prev,
      rawData: updatedRawData
    };
  });

  // Then update the UI, accounting for sorting
  if (hot) {
    // Find the current visual row index for this data
    const allData = hot.getSourceData();
    const physicalIndex = allData.findIndex((item: any) => item.id === rowData.id);
    if (physicalIndex >= 0) {
      const visualRow = hot.toVisualRow(physicalIndex);
      if (visualRow !== null && visualRow !== undefined) {
        hot.setDataAtCell(visualRow, hot.propToCol(prop), oldValue, 'external');
      }
    }
  }
};

const processBackendUpdate = async (
  update: PendingUpdate, 
  tokenPair: any, 
  setTableState: any,
  tableRef: React.RefObject<any>
) => {
  const { prop, oldValue, newValue, rowData, endpoint } = update;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenPair?.accessToken?.token}` },
      body: JSON.stringify({ candidateId: rowData.id, fieldName: prop, value: newValue, personId: rowData.personId })
    });
    
    if (!response.ok) {
      console.error('Update failed:', await response.text());
      revertTableState(rowData, prop, oldValue, tableRef.current?.hotInstance, setTableState);
    }
  } catch (error) {
    console.error('Update failed:', error);
    revertTableState(rowData, prop, oldValue, tableRef.current?.hotInstance, setTableState);
  }
};

export const afterChange = async (tableRef: React.RefObject<any>, changes: any, source: any, jobId: string, tokenPair: any, setTableState: any, refreshData: any) => {
  console.log("changes in afterChange", changes);
  console.log("source in afterChange", source);
  
  if (!changes) return;

  const hot = tableRef.current?.hotInstance;
  if (!hot) return;

  if (source === 'undo' || source === 'redo') return;

  // Handle undo stack updates for direct edits
  if (source === 'edit') {
    const changesForUndo: Change[] = changes.map(([row, prop, oldValue, newValue]: [number, string, any, any]) => {
      // Convert visual row to physical row for storage
      const physicalRow = hot.toPhysicalRow(row);
      const rowData = hot.getSourceDataAtRow(physicalRow);
      return {
        row: physicalRow, // Store physical row index
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

  // Track updates
  const updatedRows = new Set();
  const pendingUpdates: PendingUpdate[] = [];
  
  for (const [visualRow, prop, oldValue, newValue] of changes) {
    if (oldValue === newValue) continue;
    
    console.log("oldValue in afterChange::", oldValue);
    console.log("newValue in afterChange::", newValue);

    // Convert visual row to physical row
    const physicalRow = hot.toPhysicalRow(visualRow);
    const rowData = hot.getSourceDataAtRow(physicalRow);
    
    console.log("rowData in afterChange::", rowData);
    if (!rowData || !rowData.id) continue;
    
    // Handle checkbox changes
    if (prop === 'checkbox') {
      handleCheckboxChange(rowData, newValue, setTableState);
      continue;
    }

    const isDirectField = 
      Object.prototype.hasOwnProperty.call(rowData, prop) && prop !== 'candidateFieldValues';
    console.log(`Updating field: ${prop}, isDirectField: ${isDirectField}`);
    
    const endpoint = isDirectField 
      ? `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field`
      : `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field-value`;

    // Update UI immediately
    updateTableState(rowData, prop, newValue, setTableState);

    // Queue for background processing
    pendingUpdates.push({
      row: visualRow,
      prop,
      oldValue,
      newValue,
      rowData,
      endpoint,
      isDirectField
    });
    
    updatedRows.add(rowData.id);
  }

  console.log("updatedRows in afterChange::", updatedRows);

  // Process updates in the background
  pendingUpdates.forEach(update => processBackendUpdate(update, tokenPair, setTableState, tableRef));
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