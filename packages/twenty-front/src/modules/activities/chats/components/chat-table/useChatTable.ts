import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useTheme } from '@emotion/react';
import { IconCopy } from '@tabler/icons-react';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';
import { CandidateNode } from 'twenty-shared';
import { TableData } from './types';

import { recordsToEnrichState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { CellChange, ChangeSource } from 'handsontable/common';
import { refreshTableDataTriggerState } from '../../states/refreshTableDataTriggerState';
import { tableDataState } from './states/tableDataState';

// Utility function to create a deep, mutable copy of an object
const createMutableCopy = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => createMutableCopy(item)) as unknown as T;
  }
  
  // Handle objects
  const mutableCopy = {} as T;
  Object.keys(obj as object).forEach(key => {
    const value = (obj as any)[key];
    (mutableCopy as any)[key] = createMutableCopy(value);
  });
  
  return mutableCopy;
};

type UseChatTableReturn = {
  selectedIds: string[];
  isAttachmentPanelOpen: boolean;
  currentCandidateIndex: number;
  isChatOpen: boolean;
  currentCandidate: CandidateNode | null;
  selectedCandidates: CandidateNode[];
  handleCheckboxChange: (candidateId: string) => void;
  handleSelectAll: () => void;
  handleSelectRows: (rowStartIndex: number, rowEndIndex: number) => void;
  handleViewChats: () => void;
  handleViewCVs: () => void;
  clearSelection: () => void;
  handlePrevCandidate: () => void;
  handleNextCandidate: () => void;
  prepareTableData: (candidates: CandidateNode[]) => TableData[];
  createCandidateShortlists: () => Promise<void>;
  createChatBasedShortlistDelivery: () => Promise<void>;
  createUpdateCandidateStatus: () => Promise<void>;
  setIsAttachmentPanelOpen: (value: boolean) => void;
  setIsChatOpen: (value: boolean) => void;
  handleAfterChange: (changes: CellChange[] | null, source: ChangeSource) => void;
  tableId: string;
  tableData: TableData[];
};

export const useChatTable = (
  candidates: CandidateNode[], 
  // onSelectionChange?: (selectedIds: string[]) => void,
  onCandidateSelect?: (id: string) => void,
  refreshData?: () => Promise<void>
): UseChatTableReturn => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const theme = useTheme();
  const [recordsToEnrich, setRecordsToEnrich] = useRecoilState(recordsToEnrichState);
  const [refreshTrigger, setRefreshTrigger] = useRecoilState(refreshTableDataTriggerState);

  const tableId = useMemo(() => `chat-table-${crypto.randomUUID()}`, []);
  const [tableData, setTableData] = useRecoilState(tableDataState(tableId));

  const setContextStoreNumberOfSelectedRecords = useSetRecoilComponentStateV2(
    contextStoreNumberOfSelectedRecordsComponentState,
    tableId
  );
  
  const setContextStoreTargetedRecordsRule = useSetRecoilComponentStateV2(
    contextStoreTargetedRecordsRuleComponentState,
    tableId
  );

  // Initialize selectedIds from recordsToEnrichState if it has values
  useEffect(() => {
    if (recordsToEnrich?.length > 0) {
      // Filter to only include IDs that exist in the candidates list
      const validIds = recordsToEnrich.filter(id => 
        candidates.some(candidate => candidate.id === id)
      );
      if (validIds.length > 0) {
        setSelectedIds(validIds);
      }
    }
  }, [recordsToEnrich, candidates]);

  // Update context store when recordsToEnrichState changes
  useEffect(() => {
    if (selectedIds.length > 0) {
      setContextStoreNumberOfSelectedRecords(selectedIds.length);
      setContextStoreTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: selectedIds,
      });
    }
  }, [selectedIds, setContextStoreNumberOfSelectedRecords, setContextStoreTargetedRecordsRule]);

  // Add effect to listen for refresh trigger
  useEffect(() => {
    if (refreshTrigger && refreshData) {
      console.log('Refreshing table data due to enrichment creation');
      
      // Reset the trigger first to avoid infinite loops
      setRefreshTrigger(false);
      
      // Call the refreshData function provided by the parent
      refreshData().catch(error => {
        console.error('Error refreshing table data:', error);
      });
    }
  }, [refreshTrigger, refreshData, setRefreshTrigger]);

  const prepareTableData = useCallback((candidates: CandidateNode[]): TableData[] => {
    return candidates.map(candidate => {
      const baseData = {
        id: candidate.id,
        phoneNumber: candidate.phoneNumber || 'N/A',
        email: candidate.email || 'N/A',
        status: candidate.status || 'N/A',
        candidateFieldValues: candidate.candidateFieldValues || 'N/A',
        chatCount: candidate?.chatCount || 'N/A',
        clientInterview: candidate?.clientInterview || 'N/A',    
        hiringNaukriUrl: candidate?.hiringNaukriUrl || 'N/A',
        lastEngagementChatControl: candidate?.lastEngagementChatControl || 'N/A',
        name: candidate?.name || 'N/A',
        resdexNaukriUrl: candidate?.resdexNaukriUrl || 'N/A',
        source: candidate?.source || 'N/A',
        startChat: candidate?.startChat || 'N/A',
        startChatCompleted: candidate?.startChatCompleted || 'N/A',
        startMeetingSchedulingChat: candidate?.startMeetingSchedulingChat || 'N/A',
        startMeetingSchedulingChatCompleted: candidate?.startMeetingSchedulingChatCompleted || 'N/A',
        startVideoInterviewChat: candidate?.startVideoInterviewChat || 'N/A',
        startVideoInterviewChatCompleted: candidate?.startVideoInterviewChatCompleted || 'N/A',
        stopChat: candidate?.stopChat || 'N/A',
        stopChatCompleted: candidate?.stopChatCompleted || 'N/A',
        stopMeetingSchedulingChat: candidate?.stopMeetingSchedulingChat || 'N/A',
        stopMeetingSchedulingChatCompleted: candidate?.stopMeetingSchedulingChatCompleted || 'N/A',
        stopVideoInterviewChat: candidate?.stopVideoInterviewChat || 'N/A',
        stopVideoInterviewChatCompleted: candidate?.stopVideoInterviewChatCompleted || 'N/A',
        checkbox: selectedIds.includes(candidate?.id),
      };
      
      
      const fieldValues: Record<string, string> = {};
      if (candidate.candidateFieldValues?.edges) {
        candidate.candidateFieldValues.edges.forEach(edge => {
          if (edge.node) {
            const fieldName = edge.node.candidateFields?.name;
            const camelCaseFieldName = fieldName.replace(/_([a-z])/g, (match: string, letter: string) => letter.toUpperCase());
            let fieldValue = edge.node?.name;
            if (fieldName && fieldValue !== undefined) {
              fieldValues[camelCaseFieldName] = fieldValue;
            }
            if (typeof fieldValue === 'object') {
              fieldValue = JSON.stringify(fieldValue);
              fieldValues[camelCaseFieldName] = fieldValue;
            }
          }
        });
      }
      const updatedBaseData = {
        ...baseData,
        ...fieldValues
      };
      return updatedBaseData;
    });
  }, [selectedIds]);
  
  // Initialize table data when individuals change
  useEffect(() => {
    const initialData = prepareTableData(candidates);
    
    // Compare with current tableData to avoid unnecessary updates
    if (tableData.length === 0 || JSON.stringify(tableData) !== JSON.stringify(initialData)) {
      setTableData(initialData);
    }
  }, [candidates, setTableData, prepareTableData]);

  // Function to update local candidate data
  const updateLocalCandidateData = useCallback((candidateId: string, field: string, value: any) => {
    // Create a new deep copy of the tableData
    const newData = createMutableCopy(tableData);
    
    // Find the row index for this candidate
    const rowIndex = newData.findIndex(row => row.id === candidateId);
    
    if (rowIndex !== -1) {
      // Update the field in our local data
      newData[rowIndex] = {
        ...newData[rowIndex],
        [field]: value
      };
      
      // Update the tableData state immediately
      setTableData(newData);
    }
  }, [tableData, setTableData]);
  
  const saveDataToBackend = useCallback(async (candidateId: string, field: string, value: any) => {
    try {
      // Dynamically check if the field exists directly on the candidate object
      // by examining the first candidate in the array (if available)
      const isDirectField = candidates.length > 0 && 
        Object.prototype.hasOwnProperty.call(candidates[0], field) && 
        field !== 'candidateFieldValues';
      
      console.log(`Updating field: ${field}, isDirectField: ${isDirectField}`);
      
      // Choose the appropriate endpoint based on field type
      const endpoint = isDirectField 
        ? `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field`
        : `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-candidate-field-value`;
      
      const payload = { candidateId, fieldName: field, value };
      
      const response = await axios.post(
        endpoint,
        payload,
        { 
          headers: { 
            authorization: `Bearer ${tokenPair?.accessToken?.token}`, 
            'content-type': 'application/json'
          }
        }
      );
      
      console.log('Update response:', response.data);
      
      // After successful update, refresh data if the function is provided
      if (refreshData) {
        await refreshData();
      } else {
        // If no refreshData provided, update local state manually
        // This provides immediate feedback while waiting for any background refreshes
        updateLocalCandidateData(candidateId, field, value);
      }
      
      enqueueSnackBar('Data updated successfully', {
        variant: SnackBarVariant.Success,
        duration: 2000,
      });
    } catch (error) {
      console.error('Error updating data:', error);
      
      // Show an error notification
      enqueueSnackBar('Failed to update data', {
        variant: SnackBarVariant.Error,
        duration: 2000,
      });
    }
  }, [candidates, tokenPair, enqueueSnackBar, updateLocalCandidateData, refreshData]);

  const handleAfterChange = useCallback((changes: CellChange[] | null, source: ChangeSource) => {
    if (!changes || source === 'loadData') {
      return;
    }
    
    // Process each change: [row, prop, oldValue, newValue]
    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue || row < 0 || row >= candidates.length) {
        return;
      }
      
      // Get the candidate's ID for this row
      const candidateId = candidates[row].id;
      
      // Skip updates to the checkbox field, as it's handled by selection logic
      if (prop === 'checkbox') {
        return;
      }
      
      // Only proceed if prop is a string and valid
      if (typeof prop === 'string') {
        // Save the change to the backend
        saveDataToBackend(candidateId, prop, newValue);
      }
    });
  }, [candidates, saveDataToBackend]);
  
  const handleCheckboxChange = useCallback((individualId: string) => {
    const newSelectedIds = selectedIds.includes(individualId)
      ? selectedIds.filter((id) => id !== individualId)
      : [...selectedIds, individualId];
    setSelectedIds(newSelectedIds);
    setRecordsToEnrich(newSelectedIds);
    setContextStoreNumberOfSelectedRecords(newSelectedIds.length);
    setContextStoreTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: newSelectedIds,
    });
  }, [selectedIds, setContextStoreNumberOfSelectedRecords, setContextStoreTargetedRecordsRule, setRecordsToEnrich]);

  const handleSelectAll = useCallback(() => {
    const newSelectedIds = selectedIds.length === candidates.length ? [] : candidates.map(candidate => candidate.id);
    setSelectedIds(newSelectedIds);
    setRecordsToEnrich(newSelectedIds);
    setContextStoreNumberOfSelectedRecords(newSelectedIds.length);
    setContextStoreTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: newSelectedIds,
    });
  }, [candidates, selectedIds, setContextStoreNumberOfSelectedRecords, setContextStoreTargetedRecordsRule, setRecordsToEnrich]);
  
  const handleSelectRows = useCallback((rowStartIndex: number, rowEndIndex: number) => {
    // Make sure indices are valid
    if (rowStartIndex < 0 || rowEndIndex < 0 || 
        rowStartIndex >= candidates.length || rowEndIndex >= candidates.length) {
      return;
    }
    
    // Get the candidate IDs for the selected range
    const startIdx = Math.min(rowStartIndex, rowEndIndex);
    const endIdx = Math.max(rowStartIndex, rowEndIndex);
    
    // Get IDs for all candidates in the range
    const rangeIds = candidates.slice(startIdx, endIdx + 1).map(candidate => candidate.id);
    
    // Create a new set that includes currently selected IDs plus new range IDs
    // Using a Set to ensure no duplicates
    const newSelectedSet = new Set([...selectedIds, ...rangeIds]);
    const newSelectedIds = Array.from(newSelectedSet);

    // Update selections
    setSelectedIds(newSelectedIds);
    setRecordsToEnrich(newSelectedIds);
    setContextStoreNumberOfSelectedRecords(newSelectedIds.length);
    setContextStoreTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: newSelectedIds,
    });
    
    // Update the checkbox state in the tableData
    const newTableData = createMutableCopy(tableData);
    for (let i = 0; i < newTableData.length; i++) {
      const row = newTableData[i];
      if (row.id && rangeIds.includes(row.id)) {
        row.checkbox = true;
      }
    }
    setTableData(newTableData);
  }, [candidates, selectedIds, setRecordsToEnrich, setContextStoreNumberOfSelectedRecords, setContextStoreTargetedRecordsRule, tableData, setTableData]);
  
  const handleViewChats = useCallback((): void => {
    if (selectedIds.length > 0) {
      setIsChatOpen(true);
    }
  }, [selectedIds]);

  const handleViewCVs = useCallback((): void => {
    setCurrentCandidateIndex(0);
    setIsAttachmentPanelOpen(true);
  }, []);

  const clearSelection = useCallback((): void => {
    setSelectedIds([]);
    setRecordsToEnrich([]);
  }, [setRecordsToEnrich]);

  const handlePrevCandidate = useCallback((): void => {
    setCurrentCandidateIndex(prev => Math.max(0, prev - 1));
  }, []);
  
  const handleNextCandidate = useCallback((): void => {
    setCurrentCandidateIndex(prev => Math.min(selectedIds.length - 1, prev + 1));
  }, [selectedIds.length]);
  
  const currentCandidate = useMemo(() => {
    return selectedIds.length > 0 ? candidates.find(candidate => candidate.id === selectedIds[currentCandidateIndex]) ?? null : null;
  }, [candidates, selectedIds, currentCandidateIndex]);
  
  const selectedCandidates = useMemo(() => {
    return candidates.filter(candidate => selectedIds.includes(candidate.id));
  }, [candidates, selectedIds]);

  const selectedCandidateIds = useMemo(() => {
    return selectedCandidates.map(candidate => candidate.id);
  }, [selectedCandidates]);
  
  const createCandidateShortlists = useCallback(async (): Promise<void> => {
    try {
      await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/create-shortlist',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Shortlist created successfully', {
        variant: SnackBarVariant.Success,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error creating shortlist', {
        variant: SnackBarVariant.Error,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    }
  }, [selectedCandidateIds, tokenPair, enqueueSnackBar, theme.icon.size.md]);

  const createChatBasedShortlistDelivery = useCallback(async (): Promise<void> => {
    try {
      await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/chat-based-shortlist-delivery',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Shortlist created successfully', {
        variant: SnackBarVariant.Success,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error creating shortlist', {
        variant: SnackBarVariant.Error,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    }
  }, [selectedCandidateIds, tokenPair, enqueueSnackBar, theme.icon.size.md]);

  const createUpdateCandidateStatus = useCallback(async (): Promise<void> => {
    try {
      await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/refresh-chat-status-by-candidates',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Status updated successfully', {
        variant: SnackBarVariant.Success,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error updating status', {
        variant: SnackBarVariant.Error,
        icon: React.createElement(IconCopy, { size: theme.icon.size.md }),
        duration: 2000,
      });
    }
  }, [selectedCandidateIds, tokenPair, enqueueSnackBar, theme.icon.size.md]);

  return {
    selectedIds,
    isAttachmentPanelOpen,
    currentCandidateIndex,
    isChatOpen,
    currentCandidate,
    selectedCandidates,
    handleCheckboxChange,
    handleSelectAll,
    handleSelectRows,
    handleViewChats,
    handleViewCVs,
    clearSelection,
    handlePrevCandidate,
    handleNextCandidate,
    prepareTableData,
    createCandidateShortlists,
    createChatBasedShortlistDelivery,
    createUpdateCandidateStatus,
    setIsAttachmentPanelOpen,
    setIsChatOpen,
    handleAfterChange,
    tableId,
    tableData,
  };
};