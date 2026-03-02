import styled from '@emotion/styled';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { useOpenArxenaSiteWithToken } from '@/auth/hooks/useOpenArxenaSiteWithToken';
import { AppPath } from '@/types/AppPath';
import { IconDatabase, IconPlus } from 'twenty-ui';
import { Mixpanel } from '~/mixpanel';

import { ArxEnrichmentModal } from '@/arx-ai-filtering/arxEnrichmentModal';
import { useSelectedRecordForEnrichment } from '@/arx-ai-filtering/hooks/useSelectedRecordForEnrichment';
import { isArxEnrichModalOpenState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import { ApiKeysProvider } from '@/arx-jd-upload/providers/ApiKeysProvider';
import { parsedJDInternalState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { ArxDownloadModal } from '@/candidate-table/components/ArxDownloadModal';
import { CandidateTablePageHeader } from '@/candidate-table/components/CandidateTablePageHeader';
import { MergeJobsModal } from '@/candidate-table/components/MergeJobsModal';
import { JobCard } from '@/candidate-table/JobCard';
import { jobsState } from '@/candidate-table/states/states';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { RecordFieldValueSelectorContextProvider } from '@/object-record/record-store/contexts/RecordFieldValueSelectorContext';
import { RecordTableContextProvider } from '@/object-record/record-table/contexts/RecordTableContext';
import { RecordTableEmptyStateDisplay } from '@/object-record/record-table/empty-state/components/RecordTableEmptyStateDisplay';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { OrgChartCompanySearchWrapper } from '@/orgchart/components/OrgChartCompanySearchWrapper';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { BulkMessageModal } from '@/ui/layout/modal/components/BulkMessageModal';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { TopBar } from '@/ui/layout/top-bar/components/TopBar';
import { InterviewCreationModal } from '@/video-interview/interview-creation/InterviewCreationModal';
import { isVideoInterviewModalOpenState } from '@/video-interview/interview-creation/states/videoInterviewModalState';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
import { IconHierarchy2 } from '@tabler/icons-react';
import { AnimatedPlaceholder, AnimatedPlaceholderEmptyContainer, AnimatedPlaceholderEmptySubTitle, AnimatedPlaceholderEmptyTextContainer, AnimatedPlaceholderEmptyTitle } from 'twenty-ui';
import { useBaileysConnection } from '../baileys/contexts/BaileysContext';
import { useUnipile } from '../unipile/contexts/UnipileContext';
import { useWebSocket } from '../websocket-context/hooks/useWebSocket';
import { useWebSocketEvent } from '../websocket-context/useWebSocketEvent';
import { useChromeExtensionDetection } from './hooks/useChromeExtensionDetection';
import { useJobRefetch } from './hooks/useJobRefetch';
import { useJobStateReset } from './hooks/useJobStateReset';
import { processedDataSelector } from './states/states';
const ArxOrgChart = React.lazy(() =>
  import('@/orgchart/ArxOrgChart').then((m) => ({ default: m.ArxOrgChart })),
);

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;

  @media (max-width: 768px) {
    flex-direction: column; 
    margin: 0;
    height: 100vh;
  }
`;

const StyledPageBody = styled(PageBody)`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;

  @media (max-width: 768px) {
    overflow: auto;
  }
`;

const StyledTopBar = styled(TopBar)`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;

  @media (max-width: 768px) {
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
  }
`;

const StyledTabListContainer = styled.div``;

const StyledJobCardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(4)};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    padding: ${({ theme }) => theme.spacing(2)};
  }
`;

const StyledJobsSection = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};

  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing(2)};
  }
`;

const StyledContentContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  padding-bottom: ${({ theme }) => theme.spacing(2)};
  border-bottom: 2px solid ${({ theme }) => theme.border.color.light};
`;

const StyledSectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledSectionCount = styled.span`
  background-color: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.secondary};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledSectionDivider = styled.div`
  height: 1px;
  background-color: ${({ theme }) => theme.border.color.light};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledAddButtonWrapper = styled.div`
  @media (max-width: 768px) {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;

    button {
      border-radius: 50%;
      width: 56px;
      height: 56px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px ${({ theme }) => theme.border.color.light};

      span {
        display: none;
      }

      svg {
        width: 24px;
        height: 24px;
      }
    }
  }
`;

const StyledRightSection = styled.div`
  display: flex;
  font-weight: ${({ theme }) => theme.font.weight.regular};
  gap: ${({ theme }) => theme.betweenSiblingsGap};
`;

const StyledEmptyStateOrgChartSearch = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 420px;
`;

const StyledOrgChartEmptyStateWrapper = styled.div`
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: ${({ theme }) => theme.spacing(8)};
  gap: ${({ theme }) => theme.spacing(6)};
  text-align: center;
`;

export const Jobs = () => {
  // const { candidateId } = useParams<{ candidateId: string }>();
  const candidateId = '1'; // Replace with your candidateId
  const filterDropdownId = 'job-filter'; // Define a unique ID for the filter dropdown
  const recordIndexId = 'jobs'; // Define a unique ID for the record index context (adjust if needed)

  // TODO: Get objectMetadataItem and viewType dynamically if needed for ObjectOptionsDropdown
  const mockObjectMetadataItem = { nameSingular: 'job' }; // Placeholder
  const { objectMetadataItems } = useObjectMetadataItems();
  const jobMetadataItem = useMemo(
    () => objectMetadataItems.find(item => item.nameSingular === 'job'),
    [objectMetadataItems]
  );
  let updatedMetadataStructureLoaded = false;

  updatedMetadataStructureLoaded = !!jobMetadataItem;

  // Get jobs from recoil state (populated by useJobRefetch via REST API)
  const jobsFromState = useRecoilValue(jobsState);

  useEffect(() => {
    Mixpanel.track('job_list_view');
  }, []);

  // Placeholder value for RecordIndexContext
  const recordIndexContextValue = {
    indexIdentifierUrl: (recordId: string) => `/jobs/${recordId}`, // Adjust URL path as needed
    onIndexRecordsLoaded: () => {},
    objectNamePlural: 'jobs',
    objectNameSingular: 'job',
    objectMetadataItem: mockObjectMetadataItem as any, // Use placeholder, cast as any
    recordIndexId: recordIndexId,
  };

  // Initialize the spreadsheet import hook for candidates only when metadata is loaded
  const { openObjectRecordsSpreasheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');
  const isArxEnrichModalOpen = useRecoilValue(isArxEnrichModalOpenState);
  const [, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  const { hasSelectedRecord, selectedRecordId } = useSelectedRecordForEnrichment();
  const isVideoInterviewModalOpen = useRecoilValue(isVideoInterviewModalOpenState);
  const [, setIsVideoInterviewModalOpen] = useRecoilState(isVideoInterviewModalOpenState);
  const isArxUploadJDModalOpen = useRecoilValue(isArxUploadJDModalOpenState);
  const [, setIsArxUploadJDModalOpen] = useRecoilState(isArxUploadJDModalOpenState);
  const [, setArxUploadJDModalMode] = useRecoilState(arxUploadJDModalModeState);
  const setParsedJDInternalState = useSetRecoilState(parsedJDInternalState);

  const { enqueueSnackBar } = useSnackBar();
  const { hasToken } = useOpenArxenaSiteWithToken();
  const navigate = useNavigate();

  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const { isBaileysLoggedIn } = useBaileysConnection();
  const { isLinkedinConnected, isWhatsappUnipileConnected } = useUnipile();
  const isWhatsappLoggedIn = isBaileysLoggedIn || isWhatsappUnipileConnected;
  const { isExtensionInstalled } = useChromeExtensionDetection();
  const { resetJobStates } = useJobStateReset();
  const { refetchJobs } = useJobRefetch();
  const refetchJobsRef = useRef(refetchJobs);
  refetchJobsRef.current = refetchJobs;

  const { socket } = useWebSocket();
  const [hasInsufficientCredits, setHasInsufficientCredits] = useState(false);
  const [selectedOrgChartCompany, setSelectedOrgChartCompany] = useState<{
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
  } | null>(null);

  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useRecoilState(isBulkMessageModalOpenState);

  const handleCompanySelect = useCallback(
    (company: {
      companyId: string;
      companyName: string;
      website?: string;
      locationName?: string;
      industry?: string;
      profileCount?: number;
      linkedinUrl?: string;
    }) => {
      setSelectedOrgChartCompany(company);
      navigate(`/${AppPath.OrgChart}/${company.companyId}`, {
        state: { company },
      });
    },
    [navigate],
  );

  const handleClearOrgChart = useCallback(() => {
    setSelectedOrgChartCompany(null);
  }, []);

  // Reset job states when Jobs component mounts to ensure clean state
  useEffect(() => {
    resetJobStates();
    // Explicitly reset modal mode to create when Jobs component mounts
    setArxUploadJDModalMode('create');
  }, [resetJobStates, setArxUploadJDModalMode]);

  // Fetch jobs from REST API when metadata is loaded
  useEffect(() => {
    if (updatedMetadataStructureLoaded && jobMetadataItem) {
      console.log('Metadata loaded, fetching jobs from REST API...');
      refetchJobsRef.current();
    }
  }, [updatedMetadataStructureLoaded, jobMetadataItem?.id]);


  // Track previous modal state to detect when it closes
  const prevModalOpenRef = useRef(false);
  
  // Effect to refetch jobs when ArxJDUploadModal closes
  useEffect(() => {
    // Only refetch if modal was open and is now closed
    if (prevModalOpenRef.current && !isArxUploadJDModalOpen) {
      console.log('ArxJDUploadModal closed, refetching jobs...');
      refetchJobsRef.current();
    }
    
    // Update the previous state
    prevModalOpenRef.current = isArxUploadJDModalOpen;
  }, [isArxUploadJDModalOpen]);

  useWebSocketEvent<{ step: string; message: string }>(
    'metadata-structure-progress',
    (data: { step: string; message: string }) => {
      console.log('Jobs component received WebSocket event:', data);
      if (data?.message) {
        let variant = SnackBarVariant.Info;
        if (data.step === 'candidate-view-updated') {
          variant = SnackBarVariant.Success;
        }
        if (data.step === 'metadata-structure-complete') {
          variant = SnackBarVariant.Success;
          enqueueSnackBar(data.message, { variant });          
          console.log('Jobs: Refetching data due to metadata-structure-complete event');
          // Refetch jobs data instead of reloading the page
          refetchJobsRef.current();
          return;
        }
        enqueueSnackBar(data.message, { variant });
      }

      // Send acknowledgment back to server
      if (socket?.connected) {
        const ackData = {
          event: 'metadata-structure-progress',
          timestamp: new Date().toISOString(),
          status: 'received',
          step: data.step,
          message: data.message,
          userId: currentWorkspaceMember?.id
        };
        console.log('Sending metadata structure progress acknowledgment:', ackData);
        socket.emit('notification_received', ackData);
      } else {
        console.error('Socket not connected, cannot send acknowledgment');
      }
    },
    [socket, currentWorkspaceMember?.id]
  );

  useWebSocketEvent<{ message: string; timestamp: string }>(
    'send_notification_to_recruiter',
    (data) => {
      console.log('Jobs component received WebSocket event:', data);
      try {
        // Send acknowledgment back to server immediately
        if (socket?.connected) {
          const ackData = {
            event: 'send_notification_to_recruiter',
            timestamp: data.timestamp,
            status: 'received',
            message: data.message,
            userId: currentWorkspaceMember?.id // Add userId from context
          };
          console.log('Sending notification acknowledgment:', ackData);
          socket.emit('notification_received', ackData);
        } else {
          console.error('Socket not connected, cannot send acknowledgment');
        }
        
        // Show notification after sending acknowledgment
        enqueueSnackBar(data.message, { variant: SnackBarVariant.Success });
      } catch (error) {
        console.error('Error handling notification:', error);
      }
    },
    [socket, currentWorkspaceMember?.id] // Add currentWorkspaceMember.id to dependencies
  );

  // Add new test-snackbar event listener
  useWebSocketEvent<{ variant: string; message: string }>(
    'test-snackbar',
    (data: { variant: string; message: string }) => {
      console.log('Jobs component received test snackbar event:', data);
      if (data?.message) {
        const variant = data.variant === 'success' 
          ? SnackBarVariant.Success 
          : data.variant === 'error' 
          ? SnackBarVariant.Error 
          : SnackBarVariant.Info;
          
        enqueueSnackBar(data.message, { variant });
      }
    },
    []
  );

  // Add socket event listener for insufficient credits
  useWebSocketEvent<{ hasInsufficientCredits: boolean }>(
    'openai_credits_status',
    (data) => {
      console.log('Received OpenAI credits status:', data);
      setHasInsufficientCredits(data.hasInsufficientCredits);
    },
    []
  );

  const handleAddCredits = () => {
    window.open('https://platform.openai.com/account/billing/overview', '_blank');
  };

  const handleEnrichment = () => {
    if (!candidateId) {
      alert('Please select a chat to enrich');
      return;
    }
    setIsArxEnrichModalOpen(true);
  };

  const handleVideoInterviewEdit = () => {
    if (!candidateId) {
      alert('Please select a chat to create video interview');
      return;
    }
    setIsVideoInterviewModalOpen(true);
  };

  const handleAddJob = () => {
    console.log('Adding job from Jobs');
    // Explicitly reset parsedJDInternalState first to clear any stale data
    setParsedJDInternalState(null);
    // Explicitly set modal mode to create
    setArxUploadJDModalMode('create');
    // Use requestAnimationFrame to ensure the mode is set before opening the modal
    requestAnimationFrame(() => {
      setIsArxUploadJDModalOpen(true);
    });
  };

  const handleImportCandidates = () => {
    if (!updatedMetadataStructureLoaded) {
      alert('System is still loading. Please try again in a moment.');
      return;
    }
    openObjectRecordsSpreasheetImportDialog();
  };

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const processedData = useRecoilValue(processedDataSelector);

  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [isMergeJobsModalOpen, setIsMergeJobsModalOpen] = useState(false);

  const handleMergeJobs = useCallback(() => setIsMergeMode(true), []);
  const handleMergeModeCancel = useCallback(() => {
    setIsMergeMode(false);
    setSelectedJobIds(new Set());
  }, []);
  const handleToggleJobSelect = useCallback((jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }, []);
  const handleMergeSelected = useCallback(() => {
    if (selectedJobIds.size >= 2) {
      setIsMergeJobsModalOpen(true);
    }
  }, [selectedJobIds.size]);
  const handleMergeJobsModalClose = useCallback(() => {
    setIsMergeJobsModalOpen(false);
    handleMergeModeCancel();
  }, [handleMergeModeCancel]);

  const handleDownloadClick = () => {
    console.log("Downloading app");
    setIsDownloadModalOpen(true);
  };

  const hasJobs = jobsFromState && jobsFromState.length > 0;
  
  const showSearch = hasJobs && updatedMetadataStructureLoaded && !!jobMetadataItem;
  
  const sortedJobs = jobsFromState ? [...jobsFromState].sort((a, b) => {
    // First sort by active status (active jobs first)
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    // Then sort by creation date (newest first) within each status group
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  }) : [];
  
  // If metadata isn't loaded yet, show a loading state
  if (!updatedMetadataStructureLoaded || !jobMetadataItem) {
    return (
      <SpreadsheetImportProvider>
        <StyledPageContainer>
          <RecordFieldValueSelectorContextProvider>
            <CandidateTablePageHeader
              title="Jobs"
              Icon={IconDatabase}
              onAddJob={handleAddJob}
              onOrgCharts={() => navigate(`/${AppPath.OrgChart}`)}
              hasToken={!!hasToken}
              isExtensionInstalled={isExtensionInstalled}
              onDownloadClick={handleDownloadClick}
              hasInsufficientCredits={hasInsufficientCredits}
              onAddCredits={handleAddCredits}
              isLinkedinConnected={isLinkedinConnected}
              isWhatsappLoggedIn={isWhatsappLoggedIn}
            />
            <StyledPageBody>
              <AnimatedPlaceholderEmptyContainer>
                <AnimatedPlaceholder type="noRecord" />
                <AnimatedPlaceholderEmptyTextContainer>
                  <AnimatedPlaceholderEmptyTitle>
                    Loading your Recruiter AI Models
                  </AnimatedPlaceholderEmptyTitle>
                  <AnimatedPlaceholderEmptySubTitle>
                    Your AI powered models will be ready in about 10 minutes.
                    <br />
                    We will notify you when they are ready.
                  </AnimatedPlaceholderEmptySubTitle>
                </AnimatedPlaceholderEmptyTextContainer>
              </AnimatedPlaceholderEmptyContainer>
            </StyledPageBody>
          </RecordFieldValueSelectorContextProvider>
        </StyledPageContainer>
      </SpreadsheetImportProvider>
    );
  }
  return (
    <SpreadsheetImportProvider>
      <RecordTableContextProvider value={{
        recordTableId: 'jobs',
        viewBarId: 'jobs',
        objectNameSingular: 'job',
        objectMetadataItem: jobMetadataItem as any,
        visibleTableColumns: [],
      }}>
        <StyledPageContainer>
          <RecordFieldValueSelectorContextProvider>
            <CandidateTablePageHeader
              title="Jobs"
              Icon={IconDatabase}
              onAddJob={handleAddJob}
              onOrgCharts={() => navigate(`/${AppPath.OrgChart}`)}
              onCompanySelect={hasJobs ? handleCompanySelect : undefined}
              hasToken={!!hasToken}
              isExtensionInstalled={isExtensionInstalled}
              onDownloadClick={handleDownloadClick}
              hasInsufficientCredits={hasInsufficientCredits}
              onAddCredits={handleAddCredits}
              isLinkedinConnected={isLinkedinConnected}
              isWhatsappLoggedIn={isWhatsappLoggedIn}
              onMergeJobs={hasJobs && !selectedOrgChartCompany ? handleMergeJobs : undefined}
              isMergeMode={isMergeMode}
              onMergeModeCancel={handleMergeModeCancel}
              mergeSelectedCount={selectedJobIds.size}
              onMergeSelected={handleMergeSelected}
            />
            <StyledPageBody>
              {selectedOrgChartCompany ? (
                <React.Suspense fallback={null}>
                  <ArxOrgChart
                    companyId={selectedOrgChartCompany.companyId}
                    companyName={selectedOrgChartCompany.companyName}
                    website={selectedOrgChartCompany.website}
                    locationName={selectedOrgChartCompany.locationName}
                    industry={selectedOrgChartCompany.industry}
                    profileCount={selectedOrgChartCompany.profileCount}
                    linkedinUrl={selectedOrgChartCompany.linkedinUrl}
                    onBack={handleClearOrgChart}
                  />
                </React.Suspense>
              ) : (
              <RecordIndexContextProvider value={recordIndexContextValue}>
                <ViewComponentInstanceContext.Provider value={{ instanceId: recordIndexId }} >
                  {/* <StyledTopBar
                    leftComponent={ <StyledTabListContainer> </StyledTabListContainer> }
                    handleVideoInterviewEdit={handleVideoInterviewEdit}
                    handleEnrichment={handleEnrichment}
                    handleAddJob={handleAddJob}
                    handleImportCandidates={handleImportCandidates}
                    showEnrichment={true}
                    showVideoInterviewEdit={true}
                    showAddJob={true}
                    showSearch={showSearch}
                    showSorting={showSearch}
                    rightComponent={
                      <StyledRightSection>
                        <ObjectFilterDropdownComponentInstanceContext.Provider value={{ instanceId: filterDropdownId }} >
                          <ObjectFilterDropdownButton filterDropdownId={filterDropdownId} hotkeyScope={{ scope: FiltersHotkeyScope.ObjectFilterDropdownButton, }} />
                        </ObjectFilterDropdownComponentInstanceContext.Provider>
                        <ObjectSortDropdownComponentInstanceContext.Provider value={{ instanceId: recordIndexId }} >
                          <ObjectSortDropdownButton hotkeyScope={{ scope: FiltersHotkeyScope.ObjectSortDropdownButton, }} />
                        </ObjectSortDropdownComponentInstanceContext.Provider>
                        <ChatOptionsDropdownButton />
                      </StyledRightSection>
                    }
                  /> */}

                  <StyledContentContainer>
                    {hasJobs ? (
                      <>
                        <StyledJobsSection>
                          <StyledSectionHeader>
                            <StyledSectionTitle>Active Jobs</StyledSectionTitle>
                            <StyledSectionCount>
                              {sortedJobs.filter(job => job.isActive).length} jobs
                            </StyledSectionCount>
                          </StyledSectionHeader>
                          <StyledJobCardsGrid>
                            {sortedJobs
                              .filter(job => job.isActive)
                              .map((job) => (
                                <JobCard
                                  key={job.id}
                                  id={job.id}
                                  name={job.name}
                                  createdAt={job.createdAt || new Date().toISOString()}
                                  isActive={job.isActive}
                                  jobLocation={job.jobLocation}
                                  searchName={job.searchName}
                                  isMergeMode={isMergeMode}
                                  isSelected={selectedJobIds.has(job.id)}
                                  onToggleSelect={handleToggleJobSelect}
                                />
                              ))}
                          </StyledJobCardsGrid>
                        </StyledJobsSection>

                        {sortedJobs.some(job => !job.isActive) && (
                          <>
                            <StyledSectionDivider />
                            <StyledJobsSection>
                              <StyledSectionHeader>
                                <StyledSectionTitle>Inactive Jobs</StyledSectionTitle>
                                <StyledSectionCount>
                                  {sortedJobs.filter(job => !job.isActive).length} jobs
                                </StyledSectionCount>
                              </StyledSectionHeader>
                              <StyledJobCardsGrid>
                                {sortedJobs
                                  .filter(job => !job.isActive)
                                  .map((job) => (
                                    <JobCard
                                      key={job.id}
                                      id={job.id}
                                      name={job.name}
                                      createdAt={job.createdAt || new Date().toISOString()}
                                      isActive={job.isActive}
                                      jobLocation={job.jobLocation}
                                      searchName={job.searchName}
                                      isMergeMode={isMergeMode}
                                      isSelected={selectedJobIds.has(job.id)}
                                      onToggleSelect={handleToggleJobSelect}
                                    />
                                  ))}
                              </StyledJobCardsGrid>
                            </StyledJobsSection>
                          </>
                        )}
                      </>
                    ) : process.env.IS_ORG_CHART_ENABLED === 'true' ? (
                      <StyledOrgChartEmptyStateWrapper>
                        <AnimatedPlaceholder type="noRecord" />
                        <AnimatedPlaceholderEmptyTextContainer>
                          <AnimatedPlaceholderEmptyTitle>
                            Your workspace is ready
                          </AnimatedPlaceholderEmptyTitle>
                          <AnimatedPlaceholderEmptySubTitle>
                            Search for a company to explore org charts
                          </AnimatedPlaceholderEmptySubTitle>
                        </AnimatedPlaceholderEmptyTextContainer>
                        <StyledEmptyStateOrgChartSearch>
                          <OrgChartCompanySearchWrapper
                            onCompanySelect={handleCompanySelect}
                            placeholder="Search company for org charts..."
                            disabled={!hasToken}
                            startIcon={<IconHierarchy2 size={20} />}
                          />
                        </StyledEmptyStateOrgChartSearch>
                      </StyledOrgChartEmptyStateWrapper>
                    ) : (
                      <RecordTableEmptyStateDisplay
                        buttonTitle="Add New Job"
                        subTitle="No jobs found"
                        title="Your workspace is ready"
                        ButtonIcon={IconPlus}
                        animatedPlaceholderType="noRecord"
                        onClick={handleAddJob}
                      />
                    )}
                  </StyledContentContainer>
                </ViewComponentInstanceContext.Provider>
              </RecordIndexContextProvider>
              )}

              {isArxEnrichModalOpen ? (
                <ArxEnrichmentModal
                  objectNameSingular="job"
                  objectRecordId={candidateId}
                />
              ) : (
                <></>
              )}
              
              {isVideoInterviewModalOpen ? (
                <InterviewCreationModal
                  objectNameSingular="job"
                  objectRecordId={candidateId}
                />
              ) : (
                <></>
              )}
              
              {process.env.IS_ORG_CHART_ENABLED !== 'true' && isArxUploadJDModalOpen ? (
                <ApiKeysProvider>
                  <ArxJDUploadModal
                    objectNameSingular="job"
                    objectRecordId=""
                  />
                </ApiKeysProvider>
              ) : (
                <></>
              )}

              <ArxDownloadModal 
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
              />

              {isMergeJobsModalOpen && (
                <MergeJobsModal
                  isOpen={isMergeJobsModalOpen}
                  onClose={handleMergeJobsModalClose}
                  sourceJobIds={Array.from(selectedJobIds)}
                  sourceJobs={sortedJobs.filter((j) => selectedJobIds.has(j.id)).map((j) => ({ id: j.id, name: j.name }))}
                  onSuccess={() => refetchJobs()}
                />
              )}

              {isBulkMessageModalOpen && (
                <BulkMessageModal />
              )}
            </StyledPageBody>
          </RecordFieldValueSelectorContextProvider>
        </StyledPageContainer>
      </RecordTableContextProvider>
    </SpreadsheetImportProvider>
  );
};
