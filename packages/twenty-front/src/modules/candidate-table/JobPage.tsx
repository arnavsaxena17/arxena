import { ActionMenuComponentInstanceContext } from "@/action-menu/states/contexts/ActionMenuComponentInstanceContext";
import { TableContainer } from "@/candidate-table/components/styled";
// import { StyledTopBar } from "@/activities/chats/components/chat-window/ChatWindowStyles";
import { ArxEnrichmentModal } from '@/arx-ai-filtering/arxEnrichmentModal';
import { useFetchCandidateFields } from '@/arx-ai-filtering/hooks/useFetchCandidateFields';
import { useInitializeEnrichments } from '@/arx-ai-filtering/hooks/useInitializeEnrichments';
import { useSelectedRecordForEnrichment } from "@/arx-ai-filtering/hooks/useSelectedRecordForEnrichment";
import { currentJobIdState, isArxEnrichModalOpenState } from "@/arx-ai-filtering/states/arxEnrichModalOpenState";
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { persistSearchResultsToStorage, searchMetadataState, searchResultsState } from '@/candidate-search/states/searchResultsState';
import { chatSearchQueryState } from "@/candidate-table/states/chatSearchQueryState";
import { filteredCandidatesCountState, processedDataSelector, selectedCandidateIdState, selectedConversationStatusState, tableStateAtom } from "@/candidate-table/states/states";
import { useCheckDataIntegrityOfJob } from '@/object-record/hooks/useCheckDataIntegrityOfJob';
import axios from 'axios';

import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import { ApiKeysProvider } from '@/arx-jd-upload/providers/ApiKeysProvider';
import { parsedJDInternalState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from "@/arx-jd-upload/states/arxUploadJDModalOpenState";
import { isOrgChartEnabledState } from '@/arx-jd-upload/states/isOrgChartEnabledState';
import { ChatOptionsDropdownButton } from "@/candidate-table/ChatOptionsDropdownButton";
import { ArxDownloadModal } from "@/candidate-table/components/ArxDownloadModal";
import { CandidateTablePageHeader } from '@/candidate-table/components/CandidateTablePageHeader';
import { DataTable } from "@/candidate-table/DataTable";
import { HotTableActionMenu } from "@/candidate-table/HotTableActionMenu";
import { jobIdAtom, jobsState } from "@/candidate-table/states/states";
import { ContextStoreComponentInstanceContext } from "@/context-store/states/contexts/ContextStoreComponentInstanceContext";
import { useObjectMetadataItems } from "@/object-metadata/hooks/useObjectMetadataItems";
import { ObjectFilterDropdownButton } from "@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton";
import { ObjectFilterDropdownComponentInstanceContext } from "@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext";
import { FiltersHotkeyScope } from "@/object-record/object-filter-dropdown/types/FiltersHotkeyScope";
import { ObjectSortDropdownButton } from "@/object-record/object-sort-dropdown/components/ObjectSortDropdownButton";
import { ObjectSortDropdownComponentInstanceContext } from "@/object-record/object-sort-dropdown/states/context/ObjectSortDropdownComponentInstanceContext";
import { RecordIndexContextProvider } from "@/object-record/record-index/contexts/RecordIndexContext";
import { RecordFieldValueSelectorContextProvider } from "@/object-record/record-store/contexts/RecordFieldValueSelectorContext";
import { useOpenObjectRecordsSpreadsheetImportDialog } from "@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog";
import { SpreadsheetImportProvider } from "@/spreadsheet-import/provider/components/SpreadsheetImportProvider";
import { ObjectMetadataErrorBoundary } from '@/ui/error-boundary';
import { SnackBarVariant } from "@/ui/feedback/snack-bar-manager/components/SnackBar";
import { useSnackBar } from "@/ui/feedback/snack-bar-manager/hooks/useSnackBar";
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { TopBar } from "@/ui/layout/top-bar/components/TopBar";
import { InterviewCreationModal } from '@/video-interview/interview-creation/InterviewCreationModal';
import { isVideoInterviewModalOpenState } from "@/video-interview/interview-creation/states/videoInterviewModalState";
import { ViewComponentInstanceContext } from "@/views/states/contexts/ViewComponentInstanceContext";
import { useQuery } from '@apollo/client';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { IconCheckbox } from 'twenty-ui';

import { FloatingAIChat } from '@/candidate-search/components/FloatingAIChat/FloatingAIChat';
import { CandidateSearchModal } from '@/candidate-search/components/search-components/CandidateSearchModal';
import { SearchPanel } from '@/candidate-search/components/SearchPanel/SearchPanel';
// import { SearchPanelToggle } from '@/candidate-search/components/SearchPanel/SearchPanelToggle';
import { BulkMessageModal } from '@/ui/layout/modal/components/BulkMessageModal';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';
import { Mixpanel } from '~/mixpanel';
import { WORKSPACE_CREDITS } from '~/modules/billing/graphql/workspaceCredits';
import { useBaileysConnection } from '../baileys/contexts/BaileysContext';
import { useUnipile } from '../unipile/contexts/UnipileContext';
import { ChatKitWidget } from './components/ChatKitWidget';
import { JobStatisticsModal } from './components/JobStatisticsModal';
import { useChromeExtensionDetection } from './hooks/useChromeExtensionDetection';
import { useJobPagination } from './hooks/useJobPagination';
import { useJobRefetch } from './hooks/useJobRefetch';
import { useJobStateReset } from './hooks/useJobStateReset';
import { useJobStatusToggle } from './hooks/useJobStatusToggle';

// Debug logging utility
const DEBUG_LOGS = false;
const debugLog = (...args: any[]) => { if (DEBUG_LOGS) console.log(...args); };

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
`;


const StyledTopBar = styled(TopBar)`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
`;

const StyledPageBody = styled(PageBody)`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;
`;

const StyledTabListContainer = styled.div`
  align-items: end;
  display: flex;
  height: 40px;
  padding: 0 16px;
`;


const StyledRightSection = styled.div`
  display: flex;
  font-weight: ${({ theme }) => theme.font.weight.regular};
  gap: ${({ theme }) => theme.betweenSiblingsGap};
`;

export const JobPage: React.FC = () => {
  debugLog(`JobPage rendering`);
  const [jobId, setJobId] = useRecoilState(jobIdAtom);
  const [, setCurrentJobId] = useRecoilState(currentJobIdState);
  const [jobs, setJobs] = useRecoilState(jobsState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const filteredCount = useRecoilValue(filteredCandidatesCountState);
  const selectedStatus = useRecoilValue(selectedConversationStatusState);
  const tableState = useRecoilValue(tableStateAtom);
  const setTableState = useSetRecoilState(tableStateAtom);
  const setSelectedCandidateId = useSetRecoilState(selectedCandidateIdState);
  const searchQuery = useRecoilValue(chatSearchQueryState);
  const [searchResults, setSearchResults] = useRecoilState(searchResultsState);
  const searchMetadata = useRecoilValue(searchMetadataState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const isOrgChartEnabled = useRecoilValue(isOrgChartEnabledState);
  const { data: creditsData } = useQuery(WORKSPACE_CREDITS, {
    skip: !isOrgChartEnabled,
  });
  const credits = (creditsData as {
    workspaceCredits?: {
      orgChartCredits: number;
      emailContactCredits: number;
      phoneContactCredits: number;
    };
  } | undefined)?.workspaceCredits;
  const orgChartCredits = credits?.orgChartCredits ?? undefined;
  const emailContactCredits = credits?.emailContactCredits ?? undefined;
  const phoneContactCredits = credits?.phoneContactCredits ?? undefined;

  // Feature flag for new search UI
  // const { isNewSearchUIEnabled } = useNewSearchUI();
  const isNewSearchUIEnabled = true; // TODO: Remove this once the feature flag is implemented
  const { resetJobStates } = useJobStateReset();
  const { refetchJobs } = useJobRefetch();
  const refetchJobsRef = useRef(refetchJobs);
  refetchJobsRef.current = refetchJobs;
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const dataTableRef = useRef<{ refreshData: () => Promise<void>; removeFilter: (columnIndex: number) => void; clearAllFilters: () => void; clearAllFiltersAndSorts: () => void; toggleSortingControls?: () => void; loadMoreCandidates?: (pages?: number) => Promise<void>; hasMoreCandidates?: boolean; isLoadingMore?: boolean }>(null);
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  const { hasSelectedRecord, selectedRecordId } = useSelectedRecordForEnrichment();
  const { checkDataIntegrityOfJob } = useCheckDataIntegrityOfJob();
  const { enqueueSnackBar } = useSnackBar();
  const { beginUploadProgressSseSession, endUploadProgressSseSessionAfterDelay } =
    useUploadProgressSseSession();
  const { isBaileysLoggedIn } = useBaileysConnection();
  const { isLinkedinConnected, isWhatsappUnipileConnected } = useUnipile();
  const isWhatsappLoggedIn = isBaileysLoggedIn || isWhatsappUnipileConnected;
  const { isExtensionInstalled } = useChromeExtensionDetection();
  const { candidateFields, fetchCandidateFields } = useFetchCandidateFields();
  const { initializeEnrichments } = useInitializeEnrichments();

  const isVideoInterviewModalOpen = useRecoilValue(isVideoInterviewModalOpenState);
  const [, setIsVideoInterviewModalOpen] = useRecoilState(isVideoInterviewModalOpenState);

  const isArxUploadJDModalOpen = useRecoilValue(isArxUploadJDModalOpenState);
  const [, setIsArxUploadJDModalOpen] = useRecoilState(isArxUploadJDModalOpenState);
  const [arxUploadJDModalMode, setArxUploadJDModalMode] = useRecoilState(arxUploadJDModalModeState);
  const setParsedJDInternalState = useSetRecoilState(parsedJDInternalState);

  // Check if candidate object exists before initializing the spreadsheet import hook
  const { objectMetadataItems } = useObjectMetadataItems();
  const candidateObjectExists = useMemo(() => 
    objectMetadataItems.some(item => item.nameSingular === 'candidate' && item.isActive),
    [objectMetadataItems]
  );

  // Initialize the spreadsheet import hook for candidates only if the object exists
  const { openObjectRecordsSpreasheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');

  // Find the current job based on jobId
  const currentJob = useMemo(() => {
    return jobs.find((job) => job.id === jobId);
  }, [jobs, jobId]);

  // Load current job into jobsState if it's not already there
  useEffect(() => {
    const loadCurrentJob = async () => {
      if (jobId && jobId !== 'job-id' && !currentJob) {
        debugLog('Current job not found in jobsState, loading specific job:', jobId);
        try {
          // Use the dedicated get-job-by-id endpoint for efficiency
          const response = await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-job-by-id`,
            { jobId },
            { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
          );
          
          if (response?.data?.status === 'Success' && response?.data?.job) {
            const jobData = response.data.job;
            setJobs(prevJobs => {
              // Check if job already exists to avoid duplicates
              const existingJob = prevJobs.find(job => job.id === jobId);
              if (existingJob) {
                return prevJobs;
              }
              return [...prevJobs, jobData];
            });
            debugLog('Loaded current job into jobsState:', jobData);
          } else {
            console.warn('Job not found via get-job-by-id, falling back to refetchJobs');
            // Fallback to refetching all jobs if specific job not found
            await refetchJobsRef.current();
          }
        } catch (error) {
          console.error('Error loading specific job, falling back to refetchJobs:', error);
          // Fallback to refetching all jobs if specific job loading fails
          try {
            await refetchJobsRef.current();
          } catch (refetchError) {
            console.error('Error refetching jobs:', refetchError);
          }
        }
      }
    };

    loadCurrentJob();
  }, [jobId, currentJob, setJobs, tokenPair?.accessToken?.token]);

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useRecoilState(isBulkMessageModalOpenState);
  const [isChatKitOpen, setIsChatKitOpen] = useState(false);
  
  // Use the job status toggle hook
  const { isJobActive, toggleJobStatus } = useJobStatusToggle({ 
    jobId, 
    currentJobActive: currentJob?.isActive 
  });

  // Use the job pagination hook
  const {
    hasPreviousJob,
    hasNextJob,
    navigateToPreviousJob,
    navigateToNextJob,
    navigateToJobsList,
    currentJobIndex,
    totalJobs,
  } = useJobPagination(jobId);

  const handleEnrichment = useCallback(() => {
    if (!selectedRecordId) {
      alert('Please select a candidate to enrich');
      return;
    }
    setCurrentJobId(jobId);
    setIsArxEnrichModalOpen(true);
  }, [selectedRecordId, jobId, setCurrentJobId, setIsArxEnrichModalOpen]);

  const handleVideoInterviewEdit = useCallback(() => {
    if (!selectedRecordId) {
      alert('Please select a candidate to create video interview');
      return;
    }
    setIsVideoInterviewModalOpen(true);
  }, [selectedRecordId, setIsVideoInterviewModalOpen]);

  const handleAddJob = useCallback(() => {
    debugLog('Adding job from JobPage');
    // Explicitly reset parsedJDInternalState first to clear any stale data
    setParsedJDInternalState(null);
    // Explicitly set modal mode to create
    setArxUploadJDModalMode('create');
    debugLog('ArxUploadJDModalMode set to create');
    // Use requestAnimationFrame to ensure the mode is set before opening the modal
    requestAnimationFrame(() => {
      setIsArxUploadJDModalOpen(true);
    });
  }, [setArxUploadJDModalMode, setIsArxUploadJDModalOpen, setParsedJDInternalState]);

  const handleEngagement = useCallback(() => {
    debugLog('Modifying job from JobPage handleEngagement');
    // Explicitly set modal mode to edit first
    setArxUploadJDModalMode('edit');
    debugLog('ArxUploadJDModalMode set to edit');
    // Use requestAnimationFrame to ensure the mode is set before opening the modal
    requestAnimationFrame(() => {
      setIsArxUploadJDModalOpen(true);
    });
  }, [setArxUploadJDModalMode, setIsArxUploadJDModalOpen]);

  // Use refs to store latest values to avoid dependency issues
  const importCandidatesRef = useRef({
    candidateObjectExists,
    enqueueSnackBar,
    openObjectRecordsSpreasheetImportDialog,
  });
  
  // Update ref on every render
  importCandidatesRef.current = {
    candidateObjectExists,
    enqueueSnackBar,
    openObjectRecordsSpreasheetImportDialog,
  };

  const handleImportCandidates = useCallback(() => {
    const { candidateObjectExists: currentCandidateObjectExists, enqueueSnackBar: currentEnqueueSnackBar, openObjectRecordsSpreasheetImportDialog: currentOpenDialog } = importCandidatesRef.current;
    
    if (!currentCandidateObjectExists) {
      currentEnqueueSnackBar(
        'Candidate object not found. Please contact support to set up the required objects.',
        {
          variant: SnackBarVariant.Error,
        }
      );
      return;
    }
    currentOpenDialog();
  }, []);

  const handleDownloadClick = useCallback(() => {
    debugLog("Downloading app");
    setIsDownloadModalOpen(true);
  }, [setIsDownloadModalOpen]);

  const handleChatKitToggle = useCallback(() => {
    setIsChatKitOpen(prev => !prev);
  }, []);

  const handleValidateJobData = useCallback(() => {
    if (!jobId) {
      alert('No job selected');
      return;
    }
    checkDataIntegrityOfJob([jobId]);
  }, [jobId, checkDataIntegrityOfJob]);

  const handleSaveSelected = useCallback(async (candidates: any[]) => {
    if (candidates.length === 0) {
      enqueueSnackBar('No candidates selected', {
        variant: SnackBarVariant.Warning,
      });
      return;
    }

    if (!jobId) {
      enqueueSnackBar('No job selected', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    beginUploadProgressSseSession();
    try {
      console.log('Saving selected candidates:', candidates.length);
      
      // Prepare the request body for upload-profiles endpoint
      const uploadRequestBody = {
        linkedin_search_results: candidates,
        data_source: 'linkedin_search',
        job_id: jobId,
        job_name: currentJob?.name || 'LinkedIn Search Results',
        recruiterId: currentWorkspaceMember?.id,
        job: {
          id: jobId,
          name: currentJob?.name || 'LinkedIn Search Results',
          company: '', // Company name not available in current job type
          location: currentJob?.jobLocation || '',
          recruiterId: currentWorkspaceMember?.id,
        },
      };

      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/upload-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
        },
        body: JSON.stringify(uploadRequestBody),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadResult = await response.json();

      if (uploadResult.status === 'ok' || uploadResult.status === 'success') {
        console.log(`Successfully saved ${candidates.length} candidates`);
        
        // Remove saved candidates from search results
        const savedIds = candidates.map(c => (c as any).tempId || c.id);
        setSearchResults((prev: any[]) => prev.filter(candidate => 
          !savedIds.includes((candidate as any).tempId || candidate.id)
        ));
        
        enqueueSnackBar(`Successfully saved ${candidates.length} candidates`, {
          variant: SnackBarVariant.Success,
        });
        
        // Refresh the table to show the newly saved candidates
        setTimeout(() => {
          dataTableRef.current?.refreshData();
        }, 1000);
      } else {
        throw new Error(uploadResult.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error saving candidates:', error);
      enqueueSnackBar('Failed to save candidates. Please try again.', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      endUploadProgressSseSessionAfterDelay();
    }
  }, [
    jobId,
    currentJob,
    currentWorkspaceMember,
    tokenPair,
    setSearchResults,
    enqueueSnackBar,
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  ]);

  const handleDiscardSelected = useCallback(() => {
    // Find selected candidates from search results (these are the fetched candidates that can be discarded)
    // For search results, we need to match against the original id since tempId is only set in mergedData
    const selectedCandidates = searchResults.filter(candidate => 
      tableState.selectedRowIds.includes(candidate?.id || '')
    );
    
    if (selectedCandidates.length === 0) {
      enqueueSnackBar('No fetched candidates selected to discard', {
        variant: SnackBarVariant.Warning,
      });
      return;
    }

    if (window.confirm(`Are you sure you want to discard ${selectedCandidates.length} selected fetched candidates? This action cannot be undone.`)) {
      // Remove only the selected candidates from search results
      const selectedIds = selectedCandidates.map(c => c.id);
      setSearchResults((prev: any[]) => {
        const updatedResults = prev.filter(candidate => !selectedIds.includes(candidate.id));

        // Persist updated results to backend cache so discarded candidates
        // don't reappear after a reload (including when the list becomes empty)
        if (jobId && jobId !== 'job-id' && tokenPair?.accessToken?.token) {
          persistSearchResultsToStorage(updatedResults, jobId, {
            accessToken: tokenPair.accessToken.token,
            metadata: searchMetadata,
          }).catch(error => {
            console.error('Failed to persist search results after discard (non-blocking):', error);
          });
        }

        return updatedResults;
      });

      // Clear selection for discarded candidates
      let nextSelectedIds: string[] = [];
      setTableState(prev => {
        nextSelectedIds = prev.selectedRowIds.filter(id => !selectedIds.includes(id));
        return {
          ...prev,
          selectedRowIds: nextSelectedIds
        };
      });
      setSelectedCandidateId(nextSelectedIds[0] ?? null);
      
      enqueueSnackBar(`Discarded ${selectedCandidates.length} selected candidates`, {
        variant: SnackBarVariant.Success,
      });
    }
  }, [searchResults, searchMetadata, tableState.selectedRowIds, jobId, tokenPair, setSearchResults, setTableState, setSelectedCandidateId, enqueueSnackBar]);

  const handleBulkMessage = useCallback(() => {
    if (tableState.selectedRowIds.length === 0) {
      alert('Please select candidates to send bulk messages');
      return;
    }
    setIsBulkMessageModalOpen(true);
  }, [tableState.selectedRowIds.length, setIsBulkMessageModalOpen]);

  const handleRedirectToObject = useCallback(() => {
    if (!jobId) {
      alert('No job selected');
      return;
    }
    navigate(`/object/job/${jobId}`);
  }, [jobId, navigate]);

  // Filter management functions
  const handleRemoveFilter = useCallback((columnIndex: number) => {
    console.log('JobPage: handleRemoveFilter called with columnIndex:', columnIndex);
    if (dataTableRef.current?.removeFilter) {
      console.log('JobPage: Calling dataTableRef.current.removeFilter');
      dataTableRef.current.removeFilter(columnIndex);
    } else {
      console.log('JobPage: dataTableRef.current.removeFilter is not available');
    }
  }, []);

  const handleClearAllFilters = useCallback(() => {
    console.log('JobPage: handleClearAllFilters called');
    if (dataTableRef.current?.clearAllFilters) {
      console.log('JobPage: Calling dataTableRef.current.clearAllFilters');
      dataTableRef.current.clearAllFilters();
    } else {
      console.log('JobPage: dataTableRef.current.clearAllFilters is not available');
    }
  }, []);

  useEffect(() => {
    const path = location.pathname;
    const pathParts = path.split('/job/');
    if (pathParts.length > 1) {
      const remainingPath = pathParts[1];
      const extractedJobId = remainingPath.split('/')[0];
      
      debugLog('URL changed, extracted jobId:', extractedJobId);
      
      // Only reset states if the jobId actually changed
      if (extractedJobId !== jobId) {
        debugLog('JobId changed from', jobId, 'to', extractedJobId, '- resetting states');
        // CRITICAL: Reset all related states FIRST (including search results)
        // This must happen before setting the new jobId to prevent race conditions
        // where DataTable's useEffect might load persisted results before search results are cleared
        resetJobStates();
        
        // Use requestAnimationFrame to ensure state reset completes before setting new jobId
        // This prevents DataTable from loading persisted results while old search results are still in state
        requestAnimationFrame(() => {
          setJobId(extractedJobId);
          
          // Refresh data after a small delay to ensure all state updates have propagated
          setTimeout(() => {
            dataTableRef.current?.refreshData();
          }, 100);
        });
      } else {
        debugLog('Same jobId, skipping state reset');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, jobId]); // Removed resetJobStates and setJobId from dependencies as they're stable

  // Initialize enrichments when component mounts - only run once
  useEffect(() => {
    debugLog('Initializing enrichments on JobPage mount');
    initializeEnrichments();
  }, []); // Remove initializeEnrichments from dependencies

  // Fetch candidate fields when jobId changes - memoize the callback
  const memoizedFetchCandidateFields = useCallback(() => {
    if (jobId) {
      debugLog('JobId changed, fetching candidate fields for:', jobId);
      fetchCandidateFields(jobId);
    }
  }, [jobId, fetchCandidateFields]);

  useEffect(() => {
    memoizedFetchCandidateFields();
  }, [memoizedFetchCandidateFields]);

  useEffect(() => {
    if (jobId && jobId !== 'job-id') {
      Mixpanel.track('job_view', { jobId });
    }
  }, [jobId]);

  // Listen for job updates when ArxJDUploadModal closes
  useEffect(() => {
    if (!isArxUploadJDModalOpen) {
      // Modal is closed, trigger job refetch to update Jobs component
      refetchJobsRef.current();
    }
  }, [isArxUploadJDModalOpen]);
  
  const handleRefresh = useCallback(() => {
    dataTableRef.current?.refreshData();
    enqueueSnackBar(`Refresh completed`, {
      variant: SnackBarVariant.Success,
    });
  }, [enqueueSnackBar]);

  const handleStatistics = useCallback(() => {
    setIsStatsModalOpen(true);
  }, [setIsStatsModalOpen]);

  const handleSorting = useCallback(() => {
    // Toggle the sorting controls visibility in DataTable
    if (dataTableRef.current?.toggleSortingControls) {
      dataTableRef.current.toggleSortingControls();
    }
  }, []);

  const handleClearAll = useCallback(() => {
    // Clear all filters and sorts in DataTable
    if (dataTableRef.current?.clearAllFiltersAndSorts) {
      dataTableRef.current.clearAllFiltersAndSorts();
      enqueueSnackBar('All filters and sorts cleared', {
        variant: SnackBarVariant.Success,
      });
    }
  }, [enqueueSnackBar]);

  // Memoize JSX elements to prevent unnecessary re-renders
  const leftComponent = useMemo(() => <StyledTabListContainer />, []);
  
  const rightComponent = useMemo(() => (
    <StyledRightSection>
      <ObjectFilterDropdownComponentInstanceContext.Provider value={{ instanceId: jobId }}>
        <ObjectFilterDropdownButton 
          filterDropdownId={jobId} 
          hotkeyScope={{ scope: FiltersHotkeyScope.ObjectFilterDropdownButton }}
        />
      </ObjectFilterDropdownComponentInstanceContext.Provider>
      <ObjectSortDropdownComponentInstanceContext.Provider value={{ instanceId: jobId }}>
        <ObjectSortDropdownButton 
          hotkeyScope={{ scope: FiltersHotkeyScope.ObjectSortDropdownButton }}
        />
      </ObjectSortDropdownComponentInstanceContext.Provider>
      <ChatOptionsDropdownButton />
    </StyledRightSection>
  ), [jobId]);




  const recordIndexContextValue = {
    indexIdentifierUrl: (recordId: string) => `/job/${jobId}/${recordId}` || '',
    onIndexRecordsLoaded: () => {},
    objectNamePlural: 'candidates',
    objectNameSingular: 'candidate',
    objectMetadataItem: { nameSingular: 'job' } as any,
    recordIndexId: jobId || '',
  };

  debugLog("JobPage rendering with jobId:", jobId);
  debugLog("JobPage rendering with recordIndexContextValue:", recordIndexContextValue);
  debugLog("Current job found:", currentJob);
  debugLog("Filtered count:", filteredCount);
  debugLog("Selected status:", selectedStatus);
  debugLog("Search query:", searchQuery);
  
  // Memoize processedData to prevent unnecessary recalculations
  const processedData = useRecoilValue(processedDataSelector);
  debugLog("Processed data length:", processedData);
  
  // Memoize counts calculation to prevent recalculation on every render
  // Use array references as dependencies since length alone doesn't detect reference changes
  const { fetchedCount, savedCount, totalCount } = useMemo(() => {
    const fetched = searchResults.length;
    const saved = processedData.length;
    return {
      fetchedCount: fetched,
      savedCount: saved,
      totalCount: fetched + saved,
    };
  }, [searchResults, processedData]);
  return (
    <ObjectMetadataErrorBoundary>
      <SpreadsheetImportProvider>
        <StyledPageContainer>
        <RecordFieldValueSelectorContextProvider>
          <CandidateTablePageHeader
            title={
              tableState.isLoading
                ? `${currentJob?.name || 'Job'} (Loading...)`
                : `${currentJob?.name || 'Job'} - ${
                    tableState.selectedRowIds.length > 0
                      ? `${tableState.selectedRowIds.length} selected • `
                      : ''
                  }${
                    filteredCount !== totalCount ? `Filtered: ${filteredCount} • ` : ''
                  }Fetched: ${fetchedCount} • Saved: ${savedCount} • Total: ${totalCount}`
            }
            Icon={IconCheckbox}
            hasPaginationButtons={true}
            hasPreviousRecord={hasPreviousJob}
            hasNextRecord={hasNextJob}
            navigateToPreviousRecord={navigateToPreviousJob}
            navigateToNextRecord={navigateToNextJob}
            hasClosePageButton={true}
            onClosePage={navigateToJobsList}
            onAddJob={handleAddJob}
            onChatKitToggle={handleChatKitToggle}
            isExtensionInstalled={isExtensionInstalled}
            onDownloadClick={handleDownloadClick}
            isLinkedinConnected={isLinkedinConnected}
            isWhatsappLoggedIn={isWhatsappLoggedIn}
            orgChartCredits={orgChartCredits}
            emailContactCredits={emailContactCredits}
            phoneContactCredits={phoneContactCredits}
          />
          <StyledPageBody>
            <RecordIndexContextProvider value={recordIndexContextValue}>
              <ViewComponentInstanceContext.Provider value={{ instanceId: jobId }}>
                <StyledTopBar
                  leftComponent={leftComponent}
                  handleRefresh={handleRefresh}
                  handleEnrichment={handleEnrichment}
                  handleVideoInterviewEdit={handleVideoInterviewEdit}
                  handleAddJob={handleAddJob}
                  handleEngagement={handleEngagement}
                  handleImportCandidates={handleImportCandidates}
                  showImportCandidates={true}
                  handleStatistics={handleStatistics}
                  showStatistics={true}
                  showRefetch={true}
                  showEnrichment={true}
                  showVideoInterviewEdit={true}
                  showAddJob={true}
                  showSearch={true}
                  showSorting={true}
                  handleValidateJobData={handleValidateJobData}
                  showValidateJobData={true}
                  // Job status toggle props
                  isJobActive={isJobActive}
                  onJobStatusToggle={toggleJobStatus}
                  showJobStatusToggle={true}
                  // Redirect to object page props
                  handleRedirectToObject={handleRedirectToObject}
                  showRedirectToObject={true}
                  // Filter management props
                  onRemoveFilter={handleRemoveFilter}
                  onClearAllFilters={handleClearAllFilters}
                  showFilterChips={true}
                  // Sorting props
                  handleSorting={handleSorting}
                  // Batch action bar props
                  selectedCandidates={searchResults.filter(candidate => 
                    tableState.selectedRowIds.includes(candidate?.id || '')
                  )}
                  onSelectAll={() => {
                    // TODO: Implement select all functionality
                    console.log('Select all clicked');
                  }}
                  onSelectTop={(count) => {
                    // TODO: Implement select top functionality
                    console.log(`Select top ${count} clicked`);
                  }}
                  onSelectFiltered={() => {
                    // TODO: Implement select filtered functionality
                    console.log('Select filtered clicked');
                  }}
                  onSaveSelected={handleSaveSelected}
                  onDiscardAll={handleDiscardSelected}
                  onLoadMore={dataTableRef.current?.loadMoreCandidates}
                  showBatchActions={isNewSearchUIEnabled}
                  // Clear all functionality
                  onClearAll={handleClearAll}
                  showClearAll={true}
                  // jobId will be automatically retrieved from jobsState
                  rightComponent={rightComponent}
                />
              </ViewComponentInstanceContext.Provider>
            </RecordIndexContextProvider>
            <ContextStoreComponentInstanceContext.Provider value={{ instanceId: jobId }} >
              <ActionMenuComponentInstanceContext.Provider
                value={{
                  instanceId: jobId,
                }}
              >
                <TableContainer>
                  {/* New Search UI Components */}
                  {isNewSearchUIEnabled && (
                    <>
                      {/* Search Panel Toggle */}
                      {/* commented out for now, will see if we need it later */}
                      {/* <SearchPanelToggle /> */}
                      
                      {/* Search Panel */}
                      <SearchPanel />
                      
                      {/* Context Hint Bar */}
                      {/* <ContextHintBar
                        onCreateEnrichment={handleEnrichment}
                        onSaveAll={() => {
                          // TODO: Implement save all functionality
                          console.log('Save all clicked');
                        }}
                        onDiscard={() => {
                          // TODO: Implement discard functionality
                          console.log('Discard clicked');
                        }}
                      /> */}
                      
                    </>
                  )}
                  
                  <DataTable
                    ref={dataTableRef}
                    jobId={jobId}
                    onImportCandidatesClick={handleImportCandidates}
                  />
                </TableContainer>
                
                <div style={{ 
                  position: 'fixed', 
                  bottom: 0, 
                  left: 0, 
                  width: '100%', 
                  zIndex: 1000,
                  backgroundColor: theme.background.primary
                }}>
                  <HotTableActionMenu tableId={jobId} />
                </div>
                
                {/* Floating AI Chat - New UI */}
                {isNewSearchUIEnabled && (
                  <FloatingAIChat />
                )}
              </ActionMenuComponentInstanceContext.Provider>
            </ContextStoreComponentInstanceContext.Provider>

            {isArxEnrichModalOpen ? (
              <ArxEnrichmentModal
                objectNameSingular="job"
                objectRecordId={selectedRecordId || '0'}
                onRefresh={handleRefresh}
              />
            ) : (
              <></>
            )}
            
            {isVideoInterviewModalOpen ? (
              <InterviewCreationModal
                objectNameSingular="job"
                objectRecordId={selectedRecordId || '0'}
              />
            ) : (
              <></>
            )}
            
            {isArxUploadJDModalOpen ? (
              <ApiKeysProvider>
                <ArxJDUploadModal
                  objectNameSingular="job"
                  objectRecordId={arxUploadJDModalMode === 'edit' ? (jobId || '0') : ''}
                />
              </ApiKeysProvider>
            ) : (
              <></>
            )}

               <ArxDownloadModal 
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
              />

            <JobStatisticsModal 
              isOpen={isStatsModalOpen}
              onClose={() => setIsStatsModalOpen(false)}
              processedData={processedData}
            />

            {isBulkMessageModalOpen && (
              <BulkMessageModal />
            )}
            
            {/* Legacy Candidate Search Modal - Only when new UI is disabled and not org chart only */}
            {!isOrgChartEnabled && !isNewSearchUIEnabled && (
              <CandidateSearchModal />
            )}

            {/* ChatKit Widget - Only render when open to prevent initialization loops */}
            {isChatKitOpen && (
              <ChatKitWidget 
                isOpen={isChatKitOpen} 
                onClose={() => setIsChatKitOpen(false)}
              />
            )}
          </StyledPageBody>
        </RecordFieldValueSelectorContextProvider>
      </StyledPageContainer>
    </SpreadsheetImportProvider>
    </ObjectMetadataErrorBoundary>
  );
};