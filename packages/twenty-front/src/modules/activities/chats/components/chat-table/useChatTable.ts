import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useTheme } from '@emotion/react';
import { IconCopy } from '@tabler/icons-react';
import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';
import { CandidateNode } from 'twenty-shared';
import { TableData } from './types';

import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { CellChange, ChangeSource } from 'handsontable/common';
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
  onCandidateSelect?: (id: string) => void
): UseChatTableReturn => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const theme = useTheme();

  const tableId = useMemo(() => `chat-table-${crypto.randomUUID()}`, []);
  const [tableData, setTableData] = useRecoilState(tableDataState(tableId));

  const setContextStoreNumberOfSelectedRecords = useSetRecoilComponentStateV2(
    contextStoreNumberOfSelectedRecordsComponentState,
    tableId
  );
  
  const prepareTableData = (candidates: CandidateNode[]): TableData[] => {
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
      console.log("updatedBaseData", updatedBaseData)
      return updatedBaseData;
    });
  };
  
  console.log("tableData", tableData)
  // Initialize table data when individuals change
  useEffect(() => {
    const initialData = prepareTableData(candidates);
    setTableData(initialData);
  }, [candidates, setTableData, selectedIds]);

  const handleAfterChange = (changes: CellChange[] | null, source: ChangeSource) => {
    if (!changes || source === 'loadData') {
      return;
    }
    
    // console.log('handleAfterChange triggered with source:', source, 'changes:', changes);
    
    // Create a new copy of the data to modify
    const newData = [...tableData];
    let dataChanged = false;
    
    // Process each change: [row, prop, oldValue, newValue]
    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue || row < 0 || row >= candidates.length) {
        return;
      }
      
      // console.log('Cell changed:', row, prop, oldValue, newValue);
      dataChanged = true;
      
      // Get the individual's ID for this row
      const candidateId = candidates[row].id;
      
      // Update the tableData state with the new value
      if (typeof prop === 'string' && row < newData.length) {
        // Create a new object for the row to ensure reactivity
        newData[row] = {
          ...newData[row],
          [prop]: newValue
        };
        
        // If the property is composite (like 'name.firstName'), handle it specially
        if (prop.includes('.')) {
          // console.log('Composite property detected:', prop);
          // This would require special handling if we had nested properties
        } else {
          // Save the change to the backend as a direct property update
            saveDataToBackend(candidateId, prop, newValue);
        }
      }
    });
    
    // Only update the state if we made actual changes to avoid unnecessary renders
    if (dataChanged) {
      // console.log('Updating tableData with:', newData);
      // Update with a slight delay to avoid any race conditions with Handsontable
      setTimeout(() => setTableData(newData), 0);
    }
  };
  
  // Function to save data changes to the backend
  const saveDataToBackend = async (individualId: string, field: string, value: any) => {
    try {
      // Implement the API call to update the data on the server
      // This is just an example - you'll need to replace with your actual API endpoint
      await axios.patch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/individuals/${individualId}`,
        { [field]: value },
        { 
          headers: { 
            authorization: `Bearer ${tokenPair?.accessToken?.token}`, 
            'content-type': 'application/json'
          }
        }
      );
      
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
  };

  
  const setContextStoreTargetedRecordsRule = useSetRecoilComponentStateV2(
    contextStoreTargetedRecordsRuleComponentState,
    tableId
  );

  const handleCheckboxChange = (individualId: string) => {
    const newSelectedIds = selectedIds.includes(individualId)
      ? selectedIds.filter((id) => id !== individualId)
      : [...selectedIds, individualId];
    // console.log('handleCheckboxChange - new selectedIds:', newSelectedIds);
    setSelectedIds(newSelectedIds);
    setContextStoreNumberOfSelectedRecords(newSelectedIds.length);
    // console.log('handleCheckboxChange - updating numberOfSelectedRecords to:', newSelectedIds.length);
    setContextStoreTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: newSelectedIds,
    });
    // console.log('handleCheckboxChange - updating targetedRecordsRule with:', {
    //   mode: 'selection',
    //   selectedRecordIds: newSelectedIds,
    // });
    // onSelectionChange?.(newSelectedIds);
  };

  const handleSelectAll = () => {
    const newSelectedIds = selectedIds.length === candidates.length ? [] : candidates.map(candidate => candidate.id);
    // console.log('handleSelectAll - new selectedIds:', newSelectedIds);
    setSelectedIds(newSelectedIds);
    setContextStoreNumberOfSelectedRecords(newSelectedIds.length);
    // console.log('handleSelectAll - updating numberOfSelectedRecords to:', newSelectedIds.length);
    setContextStoreTargetedRecordsRule({
      mode: 'selection',
      selectedRecordIds: newSelectedIds,
    });
    // console.log('handleSelectAll - updating targetedRecordsRule with:', {
    //   mode: 'selection',
    //   selectedRecordIds: newSelectedIds,
    // });
    // onSelectionChange?.(newSelectedIds);
  };
  
  const handleViewChats = (): void => {
    if (selectedIds.length > 0) {
      setIsChatOpen(true);
    }
  };

  const handleViewCVs = (): void => {
    setCurrentCandidateIndex(0);
    setIsAttachmentPanelOpen(true);
  };

  const clearSelection = (): void => {
    setSelectedIds([]);
    // onSelectionChange?.([]);
  };

  const handlePrevCandidate = (): void => {
    setCurrentCandidateIndex(prev => Math.max(0, prev - 1));
  };
  
  const handleNextCandidate = (): void => {
    setCurrentCandidateIndex(prev => Math.min(selectedIds.length - 1, prev + 1));
  };
  
  const currentCandidate = selectedIds.length > 0 ? candidates.find(candidate => candidate.id === selectedIds[currentCandidateIndex]) ?? null : null;
  const selectedCandidates = candidates.filter(candidate => selectedIds.includes(candidate.id));
  const selectedCandidateIds = selectedCandidates.map(candidate => candidate.id);
  
  const createCandidateShortlists = async (): Promise<void> => {
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
  };

  const createChatBasedShortlistDelivery = async (): Promise<void> => {
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
  };

  const createUpdateCandidateStatus = async (): Promise<void> => {
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
  };

  return {
    selectedIds,
    isAttachmentPanelOpen,
    currentCandidateIndex,
    isChatOpen,
    currentCandidate,
    selectedCandidates,
    handleCheckboxChange,
    handleSelectAll,
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