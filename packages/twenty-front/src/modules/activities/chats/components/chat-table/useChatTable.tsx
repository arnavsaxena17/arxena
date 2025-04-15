import { IconMessages } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { CandidateNode } from 'twenty-shared';
import { useRightDrawer } from '../../../../ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '../../../../ui/layout/right-drawer/types/RightDrawerPages';
import { selectedCandidateIdState } from '../../states/selectedCandidateIdState';

export const useChatTable = (
  candidates: CandidateNode[], 
  onCandidateSelect?: (candidateId: string) => void
) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState<number>(0);
  const [tableData, setTableData] = useState<any[]>([]);
  const tableId = useMemo(() => 'candidate-chat-table', []);
  
  const { openRightDrawer } = useRightDrawer();
  const setSelectedCandidateId = useSetRecoilState(selectedCandidateIdState);

  // Convert candidates to selected candidates array
  const selectedCandidates = useMemo(() => {
    return candidates.filter(candidate => selectedIds.includes(candidate.id));
  }, [candidates, selectedIds]);

  // Get current candidate based on index
  const currentCandidate = useMemo(() => {
    return selectedCandidates[currentCandidateIndex] || null;
  }, [selectedCandidates, currentCandidateIndex]);

  useEffect(() => {
    setTableData(prepareTableData(candidates));
  }, [candidates]);

  // Prepare data for the table
  const prepareTableData = (candidates: CandidateNode[]) => {
    return candidates.map((candidate) => {
      return {
        id: candidate.id,
        name: candidate.name,
        // Add other fields as needed
        selected: selectedIds.includes(candidate.id),
      };
    });
  };

  // Handle checkbox selection change
  const handleCheckboxChange = (candidateId: string) => {
    // When deselecting a checkbox, also clear the drawer if it was displaying this candidate
    const isDeselecting = selectedIds.includes(candidateId);
    const isLastCandidate = candidates.length > 0 && candidates[candidates.length - 1].id === candidateId;
    
    console.log('handleCheckboxChange called for', candidateId);
    console.log('Is deselecting:', isDeselecting);
    console.log('Is last candidate:', isLastCandidate);
    
    // Special handling for the last row in the table to prevent auto-reselection
    if (isLastCandidate) {
      console.log('Special handling for last row candidate');
      
      // For last candidate, we need to ensure the selection state is handled properly
      setSelectedIds((prevSelectedIds) => {
        if (prevSelectedIds.includes(candidateId)) {
          // This will prevent reselection by completely removing the ID
          console.log('Deselecting last candidate:', candidateId);
          return prevSelectedIds.filter(id => id !== candidateId);
        } else {
          // Add the candidate ID to selected IDs
          console.log('Selecting last candidate:', candidateId);
          return [...prevSelectedIds, candidateId];
        }
      });
      
      // If deselecting the last candidate, also clear the drawer
      if (isDeselecting) {
        console.log('Deselecting last candidate, clearing selector');
        setSelectedCandidateId('');
      }
      
      return;
    }
    
    // Normal handling for all other rows
    setSelectedIds((prevSelectedIds) => {
      if (prevSelectedIds.includes(candidateId)) {
        return prevSelectedIds.filter(id => id !== candidateId);
      } else {
        return [...prevSelectedIds, candidateId];
      }
    });
    
    // If we're deselecting the currently displayed candidate, also clear selection state
    if (isDeselecting) {
      console.log('Deselecting candidate:', candidateId);
      
      // Only unset if this is the currently selected candidate
      if (currentCandidate && currentCandidate.id === candidateId) {
        setSelectedCandidateId('');
      }
    }
  };

  // Handle "select all" checkbox change
  const handleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.map(c => c.id));
    }
  };

  // Handle navigation to previous candidate
  const handlePrevCandidate = () => {
    setCurrentCandidateIndex(prevIndex => Math.max(0, prevIndex - 1));
  };

  // Handle navigation to next candidate
  const handleNextCandidate = () => {
    setCurrentCandidateIndex(prevIndex => 
      Math.min(selectedCandidates.length - 1, prevIndex + 1));
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedIds([]);
  };

  // Handle viewing chats
  const handleViewChats = () => {
    // For multiple selected candidates, we should handle batch viewing
    if (selectedIds.length > 0) {
      // For now, just open the first selected candidate
      const firstSelectedCandidate = candidates.find(c => c.id === selectedIds[0]);
      if (firstSelectedCandidate) {
        setSelectedCandidateId(firstSelectedCandidate.id);
        openRightDrawer(RightDrawerPages.CandidateChat, {
          title: `${firstSelectedCandidate.name}`,
          Icon: IconMessages,
        });
      }
    }
    setIsChatOpen(true);
  };

  // Handle viewing CVs
  const handleViewCVs = () => {
    // For multiple selected candidates, we should handle batch viewing
    if (selectedIds.length > 0) {
      // For now, just open the first selected candidate and set active tab to CV
      const firstSelectedCandidate = candidates.find(c => c.id === selectedIds[0]);
      if (firstSelectedCandidate) {
        setSelectedCandidateId(firstSelectedCandidate.id);
        openRightDrawer(RightDrawerPages.CandidateChat, {
          title: `${firstSelectedCandidate.name}`,
          Icon: IconMessages,
        });
        
        // Set the active tab separately
        // We'll need to implement this in the CandidateChatDrawer component
        localStorage.setItem('candidate-chat-default-tab', 'cv');
      }
    }
    setIsAttachmentPanelOpen(true);
  };

  // Handle after change in the Handsontable
  const handleAfterChange = (changes: any[], source: string) => {
    if (source !== 'loadData' && changes) {
      // Process changes if needed
    }
  };

  // Placeholder functions for actions
  const createCandidateShortlists = () => {
    console.log('createCandidateShortlists', selectedIds);
  };

  const createChatBasedShortlistDelivery = () => {
    console.log('createChatBasedShortlistDelivery', selectedIds);
    
    // Open the chat drawer for the selected candidates
    handleViewChats();
  };

  const createUpdateCandidateStatus = () => {
    console.log('createUpdateCandidateStatus', selectedIds);
  };

  return {
    selectedIds,
    isAttachmentPanelOpen,
    currentCandidateIndex,
    isChatOpen,
    currentCandidate,
    selectedCandidates,
    handleCheckboxChange,
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
    handleSelectAll,
    handleAfterChange,
    tableId,
    tableData,
  };
}; 