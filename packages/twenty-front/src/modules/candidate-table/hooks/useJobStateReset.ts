import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { chatSearchQueryState } from '../states/chatSearchQueryState';
import {
  filteredCandidatesCountState,
  selectedConversationStatusState,
  tableStateAtom
} from '../states/states';

/**
 * Custom hook to reset all job-related states when switching jobs
 * This ensures the PageHeader and other components show clean state immediately
 */
export const useJobStateReset = () => {
  const setTableState = useSetRecoilState(tableStateAtom);
  const setFilteredCount = useSetRecoilState(filteredCandidatesCountState);
  const setSelectedStatus = useSetRecoilState(selectedConversationStatusState);
  const setSearchQuery = useSetRecoilState(chatSearchQueryState);

  const resetJobStates = useCallback(() => {
    // Reset table state immediately to prevent stale PageHeader data
    setTableState(prev => ({
      ...prev,
      selectedRowIds: [],
      rawData: [],
      isLoading: true,
      error: null,
      unreadMessagesCounts: {},
      isRightPanelOpen: false,
      currentRightPanelRowId: null,
    }));
    
    // Reset filter and search states
    setFilteredCount(0);
    setSelectedStatus(null);
    setSearchQuery('');
  }, [setTableState, setFilteredCount, setSelectedStatus, setSearchQuery]);

  return { resetJobStates };
};
