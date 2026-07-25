import { IconCheckbox } from 'twenty-ui/icon';
import { ActionMenuComponentInstanceContext } from "@/action-menu/states/contexts/ActionMenuComponentInstanceContext";
import { TableContainer } from "@/candidate-table/components/styled";
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { ArxEnrichmentModal } from '@/arx-ai-filtering/arxEnrichmentModal';
import { useFetchOtherFieldKeys } from '@/arx-ai-filtering/hooks/useFetchOtherFieldKeys';
import { useInitializeEnrichments } from '@/arx-ai-filtering/hooks/useInitializeEnrichments';
import { useSelectedRecordForEnrichment } from "@/arx-ai-filtering/hooks/useSelectedRecordForEnrichment";
import { currentProjectIdState, isArxEnrichModalOpenState } from "@/arx-ai-filtering/states/arxEnrichModalOpenState";
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { persistSearchResultsToStorage, searchMetadataState, searchResultsState } from '@/candidate-search/states/searchResultsState';
import { chatSearchQueryState } from "@/candidate-table/states/chatSearchQueryState";
import { filteredCandidatesCountState, processedDataSelector, selectedCandidateIdState, selectedConversationStatusState, tableStateAtom } from "@/candidate-table/states/states";
import axios from 'axios';

import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import { useOpenAddProjectModal } from '@/arx-jd-upload/hooks/useOpenAddProjectModal';
import { ApiKeysProvider } from '@/arx-jd-upload/providers/ApiKeysProvider';
import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from "@/arx-jd-upload/states/arxUploadJDModalOpenState";
import { isOrgChartEnabledState } from '@/arx-jd-upload/states/isOrgChartEnabledState';
import { ChatOptionsDropdownButton } from "@/candidate-table/ChatOptionsDropdownButton";
import { ArxDownloadModal } from "@/candidate-table/components/ArxDownloadModal";
import { CandidateTablePageHeader } from '@/candidate-table/components/CandidateTablePageHeader';
import { ProjectTopBar } from '@/candidate-table/components/ProjectTopBar';
import { HotTableActionMenu } from "@/candidate-table/HotTableActionMenu";
import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { projectIdAtom, projectsState } from "@/candidate-table/states/states";
import { ContextStoreComponentInstanceContext } from "@/context-store/states/contexts/ContextStoreComponentInstanceContext";
import { useObjectMetadataItems } from "@/object-metadata/hooks/useObjectMetadataItems";
import { RecordIndexContextProvider } from "@/object-record/record-index/contexts/RecordIndexContext";
import { useOpenObjectRecordsSpreadsheetImportDialog } from "@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog";
import { SpreadsheetImportProvider } from "@/spreadsheet-import/provider/components/SpreadsheetImportProvider";
import { SnackBarVariant } from "@/ui/feedback/snack-bar-manager/components/SnackBar";
import { useSnackBar } from "@/ui/feedback/snack-bar-manager/hooks/useSnackBar";
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { InterviewCreationModal } from '@/video-interview/interview-creation/InterviewCreationModal';
import { isVideoInterviewModalOpenState } from "@/video-interview/interview-creation/states/videoInterviewModalState";
import { ViewComponentInstanceContext } from "@/views/states/contexts/ViewComponentInstanceContext";
import { useQuery } from '@apollo/client/react';
import { useTheme } from 'twenty-ui/theme-constants';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { FloatingAIChat } from '@/candidate-search/components/FloatingAIChat/FloatingAIChat';
import { CandidateSearchModal } from '@/candidate-search/components/search-components/CandidateSearchModal';
import { SearchPanel } from '@/candidate-search/components/SearchPanel/SearchPanel';
import { BulkMessageModal } from '@/ui/layout/modal/components/BulkMessageModal';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';
import { Mixpanel } from '~/mixpanel';
import { WORKSPACE_CREDITS } from '~/modules/billing/graphql/workspaceCredits';
import { useBaileysConnection } from '../baileys/contexts/BaileysContext';
import { useUnipile } from '../unipile/contexts/UnipileContext';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// import { ChatKitWidget } from './components/ChatKitWidget';
import { ProjectStatisticsModal } from './components/ProjectStatisticsModal';
import { useChromeExtensionDetection } from './hooks/useChromeExtensionDetection';
import { useProjectPagination } from './hooks/useProjectPagination';
import { useProjectRefetch } from './hooks/useProjectRefetch';
import { useProjectStateReset } from './hooks/useProjectStateReset';
import { useProjectStatusToggle } from './hooks/useProjectStatusToggle';

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

const StyledPageBody = styled(PageBody)`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;
  /* Above page header (20), below right drawer (30) */
  z-index: 25;
`;

const StyledTabListContainer = styled.div`
  align-items: end;
  display: flex;
  height: 40px;
  padding: 0 16px;
`;

const StyledRightSection = styled.div`
  display: flex;
  font-weight: ${themeCssVariables.font.weight.regular};
  gap: ${themeCssVariables.betweenSiblingsGap};
`;

const DataTable = lazy(() =>
  import('@/candidate-table/DataTable').then((module) => ({
    default: module.DataTable,
  })),
);

export const ProjectPage: React.FC = () => {
  debugLog(`ProjectPage rendering`);
  const [projectId, setProjectId] = useAtomState(projectIdAtom);
  const [, setCurrentProjectId] = useAtomState(currentProjectIdState);
  const [jobs, setJobs] = useAtomState(projectsState);
  const [tokenPair] = useAtomState(tokenPairState);
  const filteredCount = useAtomStateValue(filteredCandidatesCountState);
  const selectedStatus = useAtomStateValue(selectedConversationStatusState);
  const tableState = useAtomStateValue(tableStateAtom);
  const setTableState = useSetAtomState(tableStateAtom);
  const setSelectedCandidateId = useSetAtomState(selectedCandidateIdState);
  const searchQuery = useAtomStateValue(chatSearchQueryState);
  const [searchResults, setSearchResults] = useAtomState(searchResultsState);
  const searchMetadata = useAtomStateValue(searchMetadataState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const isOrgChartEnabled = useAtomStateValue(isOrgChartEnabledState);
  const { data: creditsData } = useQuery(WORKSPACE_CREDITS, {
    skip: !isOrgChartEnabled,
  });
  const credits = (creditsData as {
    workspaceCredits?: {
      orgChartCredits: number;
      revealCredits: number;
      revealCreditsAsEmailEquivalent?: number;
      revealCreditsAsPhoneEquivalent?: number;
      emailRevealCost?: number;
      phoneRevealCost?: number;
    };
  } | undefined)?.workspaceCredits;
  const orgChartCredits = credits?.orgChartCredits ?? undefined;
  const revealCredits = credits?.revealCredits ?? undefined;
  const revealCreditsAsEmailEquivalent =
    credits?.revealCreditsAsEmailEquivalent ?? undefined;
  const revealCreditsAsPhoneEquivalent =
    credits?.revealCreditsAsPhoneEquivalent ?? undefined;
  const emailRevealCost = credits?.emailRevealCost ?? undefined;
  const phoneRevealCost = credits?.phoneRevealCost ?? undefined;

  // Feature flag for new search UI
  // const { isNewSearchUIEnabled } = useNewSearchUI();
  const isNewSearchUIEnabled = true; // TODO: Remove this once the feature flag is implemented
  const { resetJobStates } = useProjectStateReset();
  const { refetchJobs } = useProjectRefetch();
  const refetchJobsRef = useRef(refetchJobs);
  refetchJobsRef.current = refetchJobs;
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const dataTableRef = useRef<{ refreshData: () => Promise<void>; removeFilter: (columnIndex: number) => void; clearAllFilters: () => void; clearAllFiltersAndSorts: () => void; toggleSortingControls?: () => void; loadMoreCandidates?: (pages?: number) => Promise<void>; hasMoreCandidates?: boolean; isLoadingMore?: boolean }>(null);
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useAtomState(isArxEnrichModalOpenState);
  const { hasSelectedRecord, selectedRecordId } = useSelectedRecordForEnrichment();
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();
  const { beginUploadProgressSseSession, endUploadProgressSseSessionAfterDelay } =
    useUploadProgressSseSession();
  const { isBaileysLoggedIn } = useBaileysConnection();
  const { isLinkedinConnected, isWhatsappUnipileConnected } = useUnipile();
  const isWhatsappLoggedIn = isBaileysLoggedIn || isWhatsappUnipileConnected;
  const { isExtensionInstalled, isChecking: isExtensionChecking } =
    useChromeExtensionDetection();
  const { fetchOtherFieldKeys } = useFetchOtherFieldKeys();
  const { initializeEnrichments } = useInitializeEnrichments();

  const isVideoInterviewModalOpen = useAtomStateValue(isVideoInterviewModalOpenState);
  const [, setIsVideoInterviewModalOpen] = useAtomState(isVideoInterviewModalOpenState);

  const isArxUploadJDModalOpen = useAtomStateValue(isArxUploadJDModalOpenState);
  const [, setIsArxUploadJDModalOpen] = useAtomState(isArxUploadJDModalOpenState);
  const [arxUploadJDModalMode, setArxUploadJDModalMode] = useAtomState(arxUploadJDModalModeState);
  const { openAddJobModal } = useOpenAddProjectModal();

  // Check if candidate object exists before initializing the spreadsheet import hook
  const { objectMetadataItems } = useObjectMetadataItems();
  const candidateObjectExists = useMemo(() =>
    objectMetadataItems.some(item => item.nameSingular === 'candidate' && item.isActive),
    [objectMetadataItems]
  );

  // Initialize the spreadsheet import hook for candidates only if the object exists
  const { openObjectRecordsSpreadsheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');

  // Find the current job based on projectId
  const currentJob = useMemo(() => {
    return jobs.find((job) => job.id === projectId);
  }, [jobs, projectId]);

  // Load current job into projectsState if it's not already there
  useEffect(() => {
    const loadCurrentJob = async () => {
      if (projectId && projectId !== 'project-id' && !currentJob) {
        debugLog('Current job not found in projectsState, loading specific job:', projectId);
        try {
          // Use the dedicated get-project-by-id endpoint for efficiency
          const response = await axios.post(
            `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-project-by-id`,
            { projectId },
            { headers: { Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}` } }
          );

          if (
            response?.data?.status === 'Success' &&
            (response?.data?.project || response?.data?.job)
          ) {
            const jobData = response.data.project ?? response.data.job;
            setJobs(prevJobs => {
              // Check if job already exists to avoid duplicates
              const existingJob = prevJobs.find(job => job.id === projectId);
              if (existingJob) {
                return prevJobs;
              }
              return [...prevJobs, jobData];
            });
            debugLog('Loaded current job into projectsState:', jobData);
          } else {
            console.warn('Project not found via get-project-by-id, falling back to refetchJobs');
            // Fallback to refetching all jobs if specific job not found
            await refetchJobsRef.current();
          }
        } catch (error) {
          console.error('Error loading specific job, falling back to refetchJobs:', error);
          // Fallback to refetching all jobs if specific job loading fails
          try {
            await refetchJobsRef.current();
          } catch (refetchError) {
            console.error('Error refetching projects:', refetchError);
          }
        }
      }
    };

    loadCurrentJob();
  }, [projectId, currentJob, setJobs, tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dataTableRefreshFunction = useAtomStateValue(
    dataTableRefreshFunctionState,
  );
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useAtomState(isBulkMessageModalOpenState);
  const [isFloatingAIChatExpanded, setIsFloatingAIChatExpanded] =
    useState(false);

  // Use the job status toggle hook
  const { isJobActive, toggleJobStatus } = useProjectStatusToggle({
    projectId,
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
  } = useProjectPagination(projectId);

  const handleEnrichment = useCallback(() => {
    if (!selectedRecordId) {
      alert('Please select a candidate to enrich');
      return;
    }
    setCurrentProjectId(projectId);
    setIsArxEnrichModalOpen(true);
  }, [selectedRecordId, projectId, setCurrentProjectId, setIsArxEnrichModalOpen]);

  const handleVideoInterviewEdit = useCallback(() => {
    if (!selectedRecordId) {
      alert('Please select a candidate to create video interview');
      return;
    }
    setIsVideoInterviewModalOpen(true);
  }, [selectedRecordId, setIsVideoInterviewModalOpen]);

  const handleEngagement = useCallback(() => {
    debugLog('Modifying job from ProjectPage handleEngagement');
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
    enqueueErrorSnackBar,
    openObjectRecordsSpreadsheetImportDialog,
  });

  importCandidatesRef.current = {
    candidateObjectExists,
    enqueueErrorSnackBar,
    openObjectRecordsSpreadsheetImportDialog,
  };

  const handleImportCandidates = useCallback(() => {
    const {
      candidateObjectExists: currentCandidateObjectExists,
      enqueueErrorSnackBar: currentEnqueueErrorSnackBar,
      openObjectRecordsSpreadsheetImportDialog: currentOpenDialog,
    } = importCandidatesRef.current;

    if (!currentCandidateObjectExists) {
      currentEnqueueErrorSnackBar({
        message:
          'Candidate object not found. Please contact support to set up the required objects.',
      });
      return;
    }
    currentOpenDialog();
  }, []);

  const handleDownloadClick = useCallback(() => {
    debugLog("Downloading app");
    setIsDownloadModalOpen(true);
  }, [setIsDownloadModalOpen]);

  const handleFloatingAIChatToggle = useCallback(() => {
    setIsFloatingAIChatExpanded((prev) => !prev);
  }, []);

  const handleSaveSelected = useCallback(async (candidates: any[]) => {
    if (candidates.length === 0) {
      enqueueWarningSnackBar({ message: 'No candidates selected' });
      return;
    }

    if (!projectId) {
      enqueueErrorSnackBar({ message: 'No job selected' });
      return;
    }

    beginUploadProgressSseSession();
    try {
      console.log('Saving selected candidates:', candidates.length);

      // Prepare the request body for upload-profiles endpoint
      const uploadRequestBody = {
        linkedin_search_results: candidates,
        data_source: 'linkedin_search',
        job_id: projectId,
        job_name: currentJob?.name || 'LinkedIn Search Results',
        recruiterId: currentWorkspaceMember?.id,
        job: {
          id: projectId,
          name: currentJob?.name || 'LinkedIn Search Results',
          company: '', // Company name not available in current job type
          location: currentJob?.jobLocation || '',
          recruiterId: currentWorkspaceMember?.id,
        },
      };

      const response = await fetch(`${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/upload-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
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

        enqueueSuccessSnackBar({ message: `Successfully saved ${candidates.length} candidates` });

        // Refresh the table to show the newly saved candidates
        setTimeout(() => {
          dataTableRef.current?.refreshData();
        }, 1000);
      } else {
        throw new Error(uploadResult.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error saving candidates:', error);
      enqueueErrorSnackBar({ message: 'Failed to save candidates. Please try again.' });
    } finally {
      endUploadProgressSseSessionAfterDelay();
    }
  }, [
    projectId,
    currentJob,
    currentWorkspaceMember,
    tokenPair,
    setSearchResults,
    enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueInfoSnackBar, enqueueWarningSnackBar,
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
      enqueueWarningSnackBar({ message: 'No fetched candidates selected to discard' });
      return;
    }

    if (window.confirm(`Are you sure you want to discard ${selectedCandidates.length} selected fetched candidates? This action cannot be undone.`)) {
      // Remove only the selected candidates from search results
      const selectedIds = selectedCandidates.map(c => c.id);
      setSearchResults((prev: any[]) => {
        const updatedResults = prev.filter(candidate => !selectedIds.includes(candidate.id));

        // Persist updated results to backend cache so discarded candidates
        // don't reappear after a reload (including when the list becomes empty)
        if (projectId && projectId !== 'project-id' && tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
          persistSearchResultsToStorage(updatedResults, projectId, {
            accessToken: tokenPair.accessOrWorkspaceAgnosticToken.token,
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

      enqueueSuccessSnackBar({ message: `Discarded ${selectedCandidates.length} selected candidates` });
    }
  }, [searchResults, searchMetadata, tableState.selectedRowIds, projectId, tokenPair, setSearchResults, setTableState, setSelectedCandidateId, enqueueSuccessSnackBar]);

  const handleBulkMessage = useCallback(() => {
    if (tableState.selectedRowIds.length === 0) {
      alert('Please select candidates to send bulk messages');
      return;
    }
    setIsBulkMessageModalOpen(true);
  }, [tableState.selectedRowIds.length, setIsBulkMessageModalOpen]);

  const handleRedirectToObject = useCallback(() => {
    if (!projectId) {
      alert('No job selected');
      return;
    }
    navigate(`/object/job/${projectId}`);
  }, [projectId, navigate]);

  // Filter management functions
  const handleRemoveFilter = useCallback((columnIndex: number) => {
    console.log('ProjectPage: handleRemoveFilter called with columnIndex:', columnIndex);
    if (dataTableRef.current?.removeFilter) {
      console.log('ProjectPage: Calling dataTableRef.current.removeFilter');
      dataTableRef.current.removeFilter(columnIndex);
    } else {
      console.log('ProjectPage: dataTableRef.current.removeFilter is not available');
    }
  }, []);

  const handleClearAllFilters = useCallback(() => {
    console.log('ProjectPage: handleClearAllFilters called');
    if (dataTableRef.current?.clearAllFilters) {
      console.log('ProjectPage: Calling dataTableRef.current.clearAllFilters');
      dataTableRef.current.clearAllFilters();
    } else {
      console.log('ProjectPage: dataTableRef.current.clearAllFilters is not available');
    }
  }, []);

  useEffect(() => {
    const path = location.pathname;
    const pathParts = path.split('/project/');
    if (pathParts.length > 1) {
      const remainingPath = pathParts[1];
      const extractedProjectId = remainingPath.split('/')[0];

      debugLog('URL changed, extracted projectId:', extractedProjectId);

      // Only reset states if the projectId actually changed
      if (extractedProjectId !== projectId) {
        debugLog('ProjectId changed from', projectId, 'to', extractedProjectId, '- resetting states');
        // CRITICAL: Reset all related states FIRST (including search results)
        // This must happen before setting the new projectId to prevent race conditions
        // where DataTable's useEffect might load persisted results before search results are cleared
        resetJobStates();

        // Use requestAnimationFrame to ensure state reset completes before setting new projectId
        // This prevents DataTable from loading persisted results while old search results are still in state
        requestAnimationFrame(() => {
          setProjectId(extractedProjectId);

          // Refresh data after a small delay to ensure all state updates have propagated
          setTimeout(() => {
            dataTableRef.current?.refreshData();
          }, 100);
        });
      } else {
        debugLog('Same projectId, skipping state reset');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, projectId]); // Removed resetJobStates and setProjectId from dependencies as they're stable

  // Initialize enrichments when component mounts - only run once
  useEffect(() => {
    debugLog('Initializing enrichments on ProjectPage mount');
    initializeEnrichments();
  }, []); // Remove initializeEnrichments from dependencies

  // Fetch candidate fields when projectId changes - memoize the callback
  const memoizedFetchOtherFieldKeys = useCallback(() => {
    if (projectId) {
      debugLog('ProjectId changed, fetching otherField keys for:', projectId);
      fetchOtherFieldKeys(projectId);
    }
  }, [projectId, fetchOtherFieldKeys]);

  useEffect(() => {
    memoizedFetchOtherFieldKeys();
  }, [memoizedFetchOtherFieldKeys]);

  useEffect(() => {
    if (projectId && projectId !== 'project-id') {
      Mixpanel.track('job_view', { projectId });
    }
  }, [projectId]);

  // Listen for job updates when ArxJDUploadModal closes
  useEffect(() => {
    if (!isArxUploadJDModalOpen) {
      // Modal is closed, trigger job refetch to update Projects component
      refetchJobsRef.current();
    }
  }, [isArxUploadJDModalOpen]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    try {
      const refreshData =
        dataTableRef.current?.refreshData ?? dataTableRefreshFunction;

      if (!refreshData) {
        enqueueErrorSnackBar({
          message: 'Refresh is not ready yet. Try again in a moment.',
        });
        return;
      }

      await refreshData();
      enqueueSuccessSnackBar({ message: 'Refresh completed' });
    } catch (error) {
      console.error('Failed to refresh project candidates:', error);
      enqueueErrorSnackBar({
        message: 'Failed to refresh candidates. Please try again.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [
    dataTableRefreshFunction,
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    isRefreshing,
  ]);

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
      enqueueSuccessSnackBar({ message: 'All filters and sorts cleared' });
    }
  }, [enqueueSuccessSnackBar]);

  // Memoize JSX elements to prevent unnecessary re-renders
  const leftComponent = useMemo(() => <StyledTabListContainer />, []);

  const rightComponent = useMemo(
    () => (
      <StyledRightSection>
        <ChatOptionsDropdownButton />
      </StyledRightSection>
    ),
    [],
  );

  const recordIndexContextValue = {
    indexIdentifierUrl: (recordId: string) =>
      `/project/${projectId}/${recordId}` || '',
    onIndexRecordsLoaded: () => {},
    objectNamePlural: 'candidates',
    objectNameSingular: 'candidate',
    objectMetadataItem: { nameSingular: 'project' } as any,
    recordIndexId: projectId || '',
  };

  debugLog("ProjectPage rendering with projectId:", projectId);
  debugLog("ProjectPage rendering with recordIndexContextValue:", recordIndexContextValue);
  debugLog("Current job found:", currentJob);
  debugLog("Filtered count:", filteredCount);
  debugLog("Selected status:", selectedStatus);
  debugLog("Search query:", searchQuery);

  // Memoize processedData to prevent unnecessary recalculations
  const processedData = useAtomStateValue(processedDataSelector);
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
    <SpreadsheetImportProvider>
      <StyledPageContainer>
        <CandidateTablePageHeader
            title={
              tableState.isLoading
                ? `${currentJob?.name || 'Project'} (Loading...)`
                : `${currentJob?.name || 'Project'} - ${
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
            onAddJob={openAddJobModal}
            onFloatingAIChatToggle={handleFloatingAIChatToggle}
            isExtensionInstalled={isExtensionInstalled}
            isExtensionChecking={isExtensionChecking}
            onDownloadClick={handleDownloadClick}
            isLinkedinConnected={isLinkedinConnected}
            isWhatsappLoggedIn={isWhatsappLoggedIn}
            orgChartCredits={orgChartCredits}
            revealCredits={revealCredits}
            revealCreditsAsEmailEquivalent={revealCreditsAsEmailEquivalent}
            revealCreditsAsPhoneEquivalent={revealCreditsAsPhoneEquivalent}
            emailRevealCost={emailRevealCost}
            phoneRevealCost={phoneRevealCost}
          />
          <StyledPageBody>
            <RecordIndexContextProvider value={recordIndexContextValue}>
              <ViewComponentInstanceContext.Provider value={{ instanceId: projectId }}>
                <ProjectTopBar
                  leftComponent={leftComponent}
                  rightComponent={rightComponent}
                  showRefetch={true}
                  onRefresh={() => {
                    void handleRefresh();
                  }}
                  isRefreshing={isRefreshing}
                />
              </ViewComponentInstanceContext.Provider>
            </RecordIndexContextProvider>
            <ContextStoreComponentInstanceContext.Provider value={{ instanceId: projectId }} >
              <ActionMenuComponentInstanceContext.Provider
                value={{
                  instanceId: projectId,
                }}
              >
                <TableContainer>
                  {/* New Search UI Components */}
                  {isNewSearchUIEnabled && (
                    <>
                      {/* <SearchPanelToggle /> */}
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

                  <Suspense fallback={null}>
                    <DataTable
                      ref={dataTableRef}
                      projectId={projectId}
                      onImportCandidatesClick={handleImportCandidates}
                    />
                  </Suspense>
                </TableContainer>

                <div style={{
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  zIndex: 1000,
                  backgroundColor: themeCssVariables.background.primary
                }}>
                  <HotTableActionMenu tableId={projectId} />
                </div>

                {/* Floating AI Chat - New UI */}
                {isNewSearchUIEnabled && (
                  <FloatingAIChat
                    isExpanded={isFloatingAIChatExpanded}
                    onExpandedChange={setIsFloatingAIChatExpanded}
                  />
                )}
              </ActionMenuComponentInstanceContext.Provider>
            </ContextStoreComponentInstanceContext.Provider>

            {isArxEnrichModalOpen ? (
              <ArxEnrichmentModal
                objectNameSingular="project"
                objectRecordId={selectedRecordId || '0'}
                onRefresh={handleRefresh}
              />
            ) : (
              <></>
            )}

            {isVideoInterviewModalOpen ? (
              <InterviewCreationModal
                objectNameSingular="project"
                objectRecordId={selectedRecordId || '0'}
              />
            ) : (
              <></>
            )}

            {isArxUploadJDModalOpen ? (
              <ApiKeysProvider>
                <ArxJDUploadModal
                  objectNameSingular="project"
                  objectRecordId={arxUploadJDModalMode === 'edit' ? (projectId || '0') : ''}
                />
              </ApiKeysProvider>
            ) : (
              <></>
            )}

               <ArxDownloadModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
              />

            <ProjectStatisticsModal
              isOpen={isStatsModalOpen}
              onClose={() => setIsStatsModalOpen(false)}
              processedData={processedData}
            />

            {isBulkMessageModalOpen && (
              <BulkMessageModal />
            )}

            { !isNewSearchUIEnabled && (
              <CandidateSearchModal />
            )}

          </StyledPageBody>
      </StyledPageContainer>
    </SpreadsheetImportProvider>
  );
};
