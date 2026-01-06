import { RightDrawerPages } from "@/ui/layout/right-drawer/types/RightDrawerPages";
import { IconMessages } from "@tabler/icons-react";
import axios from 'axios';
import { SetterOrUpdater } from 'recoil';
import { CandidateNode } from 'twenty-shared';
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

// Helper function to check if an ID is a UUID (permanent ID) vs LinkedIn ID (tempId)
export const isUUID = (id: string): boolean => {
  // UUID format: 8-4-4-4-12 hexadecimal characters
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Helper function to normalize LinkedIn URLs for comparison
const normalizeLinkedInUrl = (url: string | undefined | null | any): string | null => {
  if (!url) return null;
  
  // Ensure url is a string - handle objects that might have url properties
  let urlString: string | null = null;
  
  if (typeof url === 'string') {
    urlString = url.trim();
  } else if (url && typeof url === 'object') {
    // If it's an object, try to extract the URL from common properties
    // Check for primaryLinkUrl first, but only if it's a non-empty string
    if (typeof url.primaryLinkUrl === 'string' && url.primaryLinkUrl.trim().length > 0) {
      urlString = url.primaryLinkUrl.trim();
    } else if (typeof url.url === 'string' && url.url.trim().length > 0) {
      urlString = url.url.trim();
    } else if (typeof url.linkedinUrl === 'string' && url.linkedinUrl.trim().length > 0) {
      urlString = url.linkedinUrl.trim();
    }
    // If none of the above worked, don't try String(url) as it will give [object Object]
  }
  
  // Validate we have a non-empty string
  if (!urlString || typeof urlString !== 'string' || urlString.length === 0 || 
      urlString === 'undefined' || urlString === 'null' || urlString === '[object Object]') {
    return null;
  }
  
  try {
    // Remove query parameters and fragments
    const urlObj = new URL(urlString);
    // Normalize to https://www.linkedin.com/in/{profile-id} format
    const pathname = urlObj.pathname;
    if (pathname.includes('/in/')) {
      const profileId = pathname.split('/in/')[1]?.split('/')[0];
      if (profileId) {
        return `https://www.linkedin.com/in/${profileId}`;
      }
    }
    return urlObj.origin + urlObj.pathname;
  } catch {
    // If URL parsing fails, try to extract profile ID manually using regex
    if (typeof urlString === 'string') {
      const match = urlString.match(/linkedin\.com\/in\/([^/?]+)/i);
      if (match && match[1]) {
        return `https://www.linkedin.com/in/${match[1]}`;
      }
    }
    return urlString;
  }
};

// Helper function to get permanent ID for a candidate
// Checks if a LinkedIn candidate (by tempId) has been saved to database and has a permanent UUID
export const getPermanentId = (rowData: Record<string, unknown>, rawData: CandidateNode[] | Record<string, unknown>[]): string | undefined => {
  // If rowData has a UUID as an id, return it
  if (rowData?.id && isUUID(String(rowData.id))) {
    return String(rowData.id);
  }

  if (!Array.isArray(rawData) || rawData.length === 0) {
    // Fallback: use id if available (even if it's a LinkedIn ID), otherwise tempId
    const fallbackId =
      (typeof rowData?.id === 'string' && rowData?.id.length > 0)
        ? rowData.id
        : (typeof rowData?.tempId === 'string' ? rowData.tempId : undefined);
    return fallbackId;
  }

  // First, try to match by personId (most reliable)
  // rowData has personId, rawData has peopleId
  if (typeof rowData?.personId === 'string' && rowData.personId.length > 0) {
    const matchingCandidate = rawData.find((candidate: any) => {
      return candidate?.peopleId === rowData.personId;
    });
    
    if (matchingCandidate?.id && isUUID(String(matchingCandidate.id))) {
      return String(matchingCandidate.id);
    }
  }

  // Second, try to match by name (fallback)
  if (typeof rowData?.name === 'string' && rowData.name.length > 0) {
    const matchingCandidate = rawData.find((candidate: any) => {
      return candidate?.name === rowData.name;
    });
    
    if (matchingCandidate?.id && isUUID(String(matchingCandidate.id))) {
      return String(matchingCandidate.id);
    }
  }

  // Third, try to find a matching candidate in rawData by LinkedIn URL or uniqueStringKey
  const tempId: string | null =
    typeof rowData?.tempId === 'string'
      ? rowData.tempId
      : (rowData?.id && !isUUID(String(rowData.id))) ? String(rowData.id) : null;

  if (tempId) {
    const rowLinkedInUrl =
      (typeof (rowData?.linkedinUrl as any)?.primaryLinkUrl === 'string' && (rowData?.linkedinUrl as any)?.primaryLinkUrl !== '')
        ? (rowData?.linkedinUrl as any)?.primaryLinkUrl
        : typeof rowData?.linkedinUrl === 'string'
          ? rowData?.linkedinUrl
          : typeof rowData?.profileUrl === 'string'
            ? rowData?.profileUrl
            : undefined;

    const normalizedRowUrl = normalizeLinkedInUrl(rowLinkedInUrl);

    const matchingCandidate = rawData.find((candidate: any) => {
      // LinkedIn URL field logic: prefer primaryLinkUrl if a non-empty string
      const candidateLinkedInUrl =
        (typeof candidate?.linkedinUrl?.primaryLinkUrl === 'string' && candidate?.linkedinUrl?.primaryLinkUrl !== '')
          ? candidate.linkedinUrl.primaryLinkUrl
          : typeof candidate?.linkedinUrl === 'string'
            ? candidate.linkedinUrl
            : undefined;

      const normalizedCandidateUrl = normalizeLinkedInUrl(candidateLinkedInUrl);

      // Compare normalized URLs if both are valid
      if (
        normalizedCandidateUrl &&
        normalizedRowUrl &&
        typeof normalizedCandidateUrl === 'string' &&
        typeof normalizedRowUrl === 'string' &&
        normalizedCandidateUrl.toLowerCase() === normalizedRowUrl.toLowerCase()
      ) {
        return true;
      }

      // Fallback: compare raw LinkedIn URLs directly if both are non-empty strings
      if (
        candidateLinkedInUrl &&
        rowLinkedInUrl &&
        typeof candidateLinkedInUrl === 'string' &&
        typeof rowLinkedInUrl === 'string' &&
        candidateLinkedInUrl.length > 0 &&
        rowLinkedInUrl.length > 0 &&
        candidateLinkedInUrl.toLowerCase() === rowLinkedInUrl.toLowerCase()
      ) {
        return true;
      }

      // Match by uniqueStringKey if both provided as non-empty strings
      if (
        typeof candidate?.uniqueStringKey === 'string' &&
        typeof rowData?.uniqueStringKey === 'string' &&
        candidate.uniqueStringKey.length > 0 &&
        rowData.uniqueStringKey.length > 0 &&
        candidate.uniqueStringKey.toLowerCase() === (rowData.uniqueStringKey as string).toLowerCase()
      ) {
        return true;
      }

      return false;
    });

    if (matchingCandidate?.id && isUUID(String(matchingCandidate.id))) {
      return String(matchingCandidate.id);
    }
  }

  // Fallback: use id if available (even if it's a LinkedIn ID), otherwise tempId
  const fallbackId =
    (typeof rowData?.id === 'string' && rowData?.id.length > 0)
      ? rowData.id
      : (typeof rowData?.tempId === 'string' ? rowData.tempId : undefined);

  return fallbackId;
};

export const afterSelectionEnd = (
  tableRef: any,
  column: number,
  row: number,
  row2: number,
  setTableState: any,
  setSelectedCandidateId: SetterOrUpdater<string | null>,
  setUnreadMessagesCounts: SetterOrUpdater<Record<string, number>>,
  setContextStoreNumberOfSelectedRecords: any,
  setContextStoreTargetedRecordsRule: any,
  openRightDrawer: any,
  tokenPair: any,
  rawData?: any[]
) => {
  console.log("row in afterSelectionEnd", row);
  console.log("row2 in afterSelectionEnd", row2);
  const hot = tableRef.current?.hotInstance;
  if (!hot) return;

  try {
    const selectedIds = hot.getSelected();
    console.log("selectedIds in afterSelectionEnd", selectedIds);
    
    // Handle chat drawer opening
    if (selectedIds.length === 1 && column === 1) {
      const physicalRow = hot.toPhysicalRow(row);
      const selectedRow = hot.getSourceDataAtRow(physicalRow);
      console.log("selectedRow in afterSelectionEnd", selectedRow);
      
      if (selectedRow?.id) {
        // Use getPermanentId to get UUID if available, otherwise use the LinkedIn ID
        // This ensures we can find the candidate in processedData
        const candidateId = getPermanentId(selectedRow, rawData || []) || selectedRow.id;
        setSelectedCandidateId(candidateId);
        // Open the drawer - CandidateChatDrawer will handle fetching messages
          openRightDrawer(RightDrawerPages.CandidateChat, {
            title: `Chat with ${selectedRow.fullName || selectedRow.name || 'Candidate'}`,
            Icon: IconMessages,
            meta: {
              candidateId: candidateId,
              unreadMessageIds: []
            }
        });
      }
    }

    // Handle row selection for both checkbox and regular cell selection
    const selectedRows: string[] = [];
    
    if (column === 0) {
      console.log("column is 0");
      // For checkbox column, toggle the selected state of the clicked row
      const physicalRow = hot.toPhysicalRow(row);
      const rowData = hot.getSourceDataAtRow(physicalRow);
      let updatedSelection: string[] = [];
      let currentSelectedIds: string[] = [];
      
      // Get permanent ID - check if LinkedIn candidate has been saved to database
      const candidateId = getPermanentId(rowData, rawData || []);
      console.log('afterSelectionEnd: rowData.id =', rowData?.id, 'rowData.tempId =', rowData?.tempId, 'candidateId =', candidateId);
      
      if (rowData && candidateId) {
        setTableState((prev: any) => {
          currentSelectedIds = Array.isArray(prev.selectedRowIds) ? [...prev.selectedRowIds] : [];
          const rowId = candidateId;
          
          const index = currentSelectedIds.indexOf(rowId);
          if (index > -1) {
            currentSelectedIds.splice(index, 1);
          } else {
            currentSelectedIds.push(rowId);
          }
          updatedSelection = [...currentSelectedIds];
          return {
            ...prev,
            selectedRowIds: currentSelectedIds
          };
        });
        setSelectedCandidateId(updatedSelection[0] ?? null);

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
        
        // Get permanent ID - check if LinkedIn candidate has been saved to database
        const candidateId = getPermanentId(rowData, rawData || []);
        
        if (rowData && candidateId) {
          selectedRows.push(candidateId);
        }
      }
      console.log("selectedRows::", selectedRows);
      
      setTableState((prev: any) => ({
        ...prev,
        selectedRowIds: selectedRows
      }));
      setSelectedCandidateId(selectedRows[0] ?? null);

      setContextStoreNumberOfSelectedRecords(selectedRows.length);
      setContextStoreTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: selectedRows,
      });
      
      // Note: Checkbox values will be automatically synced via mutatableData
      // which recalculates when selectedRowIds changes in state
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

const handleCheckboxChange = (rowData: any, newValue: boolean, setTableState: any, setSelectedCandidateId: SetterOrUpdater<string | null>, rawData?: any[]) => {
  console.log("prop is checkbox and hence setting table states");
  let nextSelectedIds: string[] = [];
  setTableState((prev: any) => {
    const currentSelectedIds = Array.isArray(prev.selectedRowIds) ? [...prev.selectedRowIds] : [];
    console.log("currentSelectedIds::", currentSelectedIds);
    
    // Get permanent ID - check if LinkedIn candidate has been saved to database
    const candidateId = getPermanentId(rowData, rawData || []);
    console.log("candidateId selected of rowData::", candidateId);
    
    if (candidateId === undefined) {
      nextSelectedIds = currentSelectedIds;
      return prev;
    }
    
    if (newValue === true && !currentSelectedIds.includes(candidateId)) {
      nextSelectedIds = [...currentSelectedIds, candidateId];
      return {
        ...prev,
        selectedRowIds: nextSelectedIds
      };
    } else if (newValue === false) {
      nextSelectedIds = currentSelectedIds.filter((id: string) => id !== candidateId);
      return {
        ...prev,
        selectedRowIds: nextSelectedIds
      };
    }
    nextSelectedIds = currentSelectedIds;
    return prev;
  });
  setSelectedCandidateId(nextSelectedIds[0] ?? null);
};

const updateTableState = (rowData: any, prop: string, newValue: any, setTableState: any, hot: any) => {
  console.log(`Updating field: ${prop} for row ${rowData.id}`);
  console.log(`Column index for ${prop}:`, hot?.propToCol(prop));

  setTableState((prev: any) => {
    const updatedRawData = [...prev.rawData];
    const index = updatedRawData.findIndex(item => item.id === rowData.id);
    
    if (index >= 0) {
      const currentRow = updatedRawData[index];
      
      // Special handling for phone field which is nested under people.phones
      if (prop === 'phone') {
        const currentPhoneValue = currentRow.people?.phones?.primaryPhoneNumber;
        // Skip update if value hasn't actually changed
        if (currentPhoneValue === newValue) {
          return prev;
        }
        
        const updatedRow = { ...currentRow };
        updatedRow.people = {
          ...updatedRow.people,
          phones: {
            ...(updatedRow.people?.phones || {}),
            primaryPhoneNumber: newValue
          }
        };
        updatedRawData[index] = updatedRow;
        return {
          ...prev,
          rawData: updatedRawData
        };
      }

      // Check if this is a direct field on the candidate object
      const isDirectField = Object.prototype.hasOwnProperty.call(currentRow, prop) ||
                          prop === 'remarks' || // Add any other known direct fields here
                          !currentRow.candidateFieldValues?.edges;
      
      if (isDirectField) {
        // Skip update if value hasn't actually changed
        if (currentRow[prop] === newValue) {
          return prev;
        }
        // Update direct field
        const updatedRow = { ...currentRow };
        updatedRow[prop] = newValue;
        updatedRawData[index] = updatedRow;
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
            // Check if value has actually changed
            const currentFieldValue = updatedEdges[fieldIndex].node?.name;
            if (String(currentFieldValue) === String(newValue)) {
              return prev;
            }
            
            // Update existing field value
            updatedEdges[fieldIndex] = {
              ...updatedEdges[fieldIndex],
              node: {
                ...updatedEdges[fieldIndex].node,
                name: String(newValue)
              }
            };
            
            const updatedRow = { ...currentRow };
            updatedRow.candidateFieldValues = {
              ...updatedRow.candidateFieldValues,
              edges: updatedEdges
            };
            updatedRawData[index] = updatedRow;
          } else {
            console.log(`Field ${prop} not found, treating as direct field`);
            // If not found in candidateFieldValues, add as direct field
            // Skip update if value hasn't actually changed
            if (currentRow[prop] === newValue) {
              return prev;
            }
            const updatedRow = { ...currentRow };
            updatedRow[prop] = newValue;
            updatedRawData[index] = updatedRow;
          }
        } else {
          // No candidateFieldValues structure, add as direct field
          // Skip update if value hasn't actually changed
          if (currentRow[prop] === newValue) {
            return prev;
          }
          const updatedRow = { ...currentRow };
          updatedRow[prop] = newValue;
          updatedRawData[index] = updatedRow;
        }
      }
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
  getLatestToken: () => string | undefined,
  setTableState: any,
  tableRef: React.RefObject<any>,
  rawData?: any[]
) => {
  const { prop, oldValue, newValue, rowData, endpoint } = update;
  console.log("rowData in processBackendUpdate::", rowData);
  // Skip backend update if this is a fetched candidate (no personId)
  if (!rowData.personId) {
    console.log(`Skipping backend update for fetched candidate ${rowData.id} - no personId`);
    return;
  }
  
  // Get permanent ID (UUID) - ensure we only send UUIDs, not LinkedIn IDs or tempIds
  const candidateId = getPermanentId(rowData, rawData || []);
  if (!candidateId || !isUUID(candidateId)) {
    console.log(`Skipping backend update for candidate ${rowData.id} - no valid UUID found (candidateId: ${candidateId})`);
    return;
  }
  
  try {
    const latestToken = getLatestToken();
    if (!latestToken) {
      throw new Error('No valid token available');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${latestToken}` },
      body: JSON.stringify({ candidateId, fieldName: prop, value: newValue, personId: rowData.personId })
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

export const afterChange = async (
  tableRef: React.RefObject<any>,
  changes: any,
  source: any,
  jobId: string,
  getLatestToken: () => string | undefined,
  setTableState: any,
  setSelectedCandidateId: SetterOrUpdater<string | null>,
  refreshData: any,
  rawData?: any[]
) => {
  if (!changes) return;

  const hot = tableRef.current?.hotInstance;
  if (!hot) return;

  // Skip processing for internal Handsontable updates that don't represent user edits
  // 'updateData' is triggered when Handsontable updates its internal data structure
  // 'loadData' is triggered when data is loaded into the table
  // These don't represent actual user edits, so we skip them to prevent unnecessary re-renders
  if (source === 'undo' || source === 'redo' || source === 'updateData' || source === 'loadData') {
    // Silently skip - these are internal Handsontable operations, not user edits
    return;
  }

  // Only log when we're actually processing user edits
  console.log("source in afterChange", source);

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
      handleCheckboxChange(rowData, newValue, setTableState, setSelectedCandidateId, rawData);
      continue;
    }

    const isDirectField = 
      Object.prototype.hasOwnProperty.call(rowData, prop) && prop !== 'candidateFieldValues';
    console.log(`Updating field: ${prop}, isDirectField: ${isDirectField}`);
    
    // Check if this is a saved candidate (has personId) or fetched candidate (no personId)
    const isSavedCandidate = !!rowData.personId;
    console.log(`Candidate ${rowData.id} is ${isSavedCandidate ? 'saved' : 'fetched'} (personId: ${rowData.personId})`);
    
    // Update UI immediately (optimistic update)
    updateTableState(rowData, prop, newValue, setTableState, hot);

    // Only queue backend updates for saved candidates
    if (isSavedCandidate) {
      const endpoint = isDirectField 
        ? `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field`
        : `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field-value`;

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
    } else {
      console.log(`Skipping backend update for fetched candidate ${rowData.id} - changes are local only`);
    }
    
    updatedRows.add(rowData.id);
  }

  console.log("updatedRows in afterChange::", updatedRows);

  // Process updates in the background
  pendingUpdates.forEach(update => processBackendUpdate(update, getLatestToken, setTableState, tableRef, rawData));
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