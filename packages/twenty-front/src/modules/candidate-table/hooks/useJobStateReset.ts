import { parsedJDInternalState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { arxUploadJDModalModeState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { chatSearchQueryState } from '../states/chatSearchQueryState';
import {
    filteredCandidatesCountState,
    selectedCandidateIdState,
    selectedConversationStatusState,
    tableStateAtom,
    unreadMessagesCountsState
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
  const setArxUploadJDModalMode = useSetRecoilState(arxUploadJDModalModeState);
  const setParsedJDInternalState = useSetRecoilState(parsedJDInternalState);
  const setSelectedCandidateId = useSetRecoilState(selectedCandidateIdState);
  const setUnreadMessagesCounts = useSetRecoilState(unreadMessagesCountsState);

  const resetJobStates = useCallback(() => {
    // Reset table state immediately to prevent stale PageHeader data
    setTableState(prev => ({
      ...prev,
      selectedRowIds: [],
      rawData: [],
      isLoading: true,
      error: null,
      isRightPanelOpen: false,
      currentRightPanelRowId: null,
    }));
    setSelectedCandidateId(null);
    setUnreadMessagesCounts({});
    
    // Reset filter and search states
    setFilteredCount(0);
    setSelectedStatus(null);
    setSearchQuery('');
    
    // Reset modal mode to create (default)
    setArxUploadJDModalMode('create');
    
    // Reset parsedJD internal state to allow fresh derivation from job data
    setParsedJDInternalState(null);
  }, [setTableState, setFilteredCount, setSelectedStatus, setSearchQuery, setArxUploadJDModalMode, setParsedJDInternalState, setSelectedCandidateId, setUnreadMessagesCounts]);

  return { resetJobStates };
};
