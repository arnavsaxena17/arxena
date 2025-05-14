import { RightDrawerPages } from "@/ui/layout/right-drawer/types/RightDrawerPages";
import { IconMessages } from "@tabler/icons-react";
import axios from 'axios';
import { Change } from './states/tableStateAtom';

const updateUnreadMessagesStatus = async (unreadMessageIds: string[], tokenPair: any) => {
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
      const selectedRow = hot.getSourceDataAtRow(row);
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