import { ActionMenuComponentInstanceContext } from "@/action-menu/states/contexts/ActionMenuComponentInstanceContext";
import { TableContainer } from "@/candidate-table/components/styled";
// import { StyledTopBar } from "@/activities/chats/components/chat-window/ChatWindowStyles";
import { ArxEnrichmentModal } from '@/arx-enrich/arxEnrichmentModal';
import { useFetchCandidateFields } from '@/arx-enrich/hooks/useFetchCandidateFields';
import { useInitializeEnrichments } from '@/arx-enrich/hooks/useInitializeEnrichments';
import { useSelectedRecordForEnrichment } from "@/arx-enrich/hooks/useSelectedRecordForEnrichment";
import { currentJobIdState, isArxEnrichModalOpenState } from "@/arx-enrich/states/arxEnrichModalOpenState";
import { chatSearchQueryState } from "@/candidate-table/states/chatSearchQueryState";
import { filteredCandidatesCountState, processedDataSelector, selectedConversationStatusState, tableStateAtom } from "@/candidate-table/states/states";
import { useCheckDataIntegrityOfJob } from '@/object-record/hooks/useCheckDataIntegrityOfJob';

import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import { ApiKeysProvider } from '@/arx-jd-upload/providers/ApiKeysProvider';
import { arxUploadJDModalModeState, isArxUploadJDModalOpenState } from "@/arx-jd-upload/states/arxUploadJDModalOpenState";
import { ChatOptionsDropdownButton } from "@/candidate-table/ChatOptionsDropdownButton";
import { ArxDownloadModal } from "@/candidate-table/components/ArxDownloadModal";
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
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { TopBar } from "@/ui/layout/top-bar/components/TopBar";
import { InterviewCreationModal } from '@/video-interview/interview-creation/InterviewCreationModal';
import { isVideoInterviewModalOpenState } from "@/video-interview/interview-creation/states/videoInterviewModalState";
import { ViewComponentInstanceContext } from "@/views/states/contexts/ViewComponentInstanceContext";
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useRecoilState, useRecoilValue } from "recoil";
import { Button, IconCheck, IconCheckbox, IconDownload, IconPlus, IconX } from 'twenty-ui';

import { BulkMessageModal } from '@/ui/layout/modal/components/BulkMessageModal';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import { useBaileys } from '../baileys/contexts/BaileysContext';
import { JobStatisticsModal } from './components/JobStatisticsModal';
import { useChromeExtensionDetection } from './hooks/useChromeExtensionDetection';
import { useJobPagination } from './hooks/useJobPagination';
import { useJobRefetch } from './hooks/useJobRefetch';
import { useJobStateReset } from './hooks/useJobStateReset';
import { useJobStatusToggle } from './hooks/useJobStatusToggle';

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
const StyledPageHeader = styled(PageHeader)`
  flex-shrink: 0;
  padding: 12px 24px;
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

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledConnectionStatus = styled.div<{ isConnected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme, isConnected }) => 
    isConnected ? theme.color.green : theme.color.gray};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  transition: all 0.2s ease-in-out;
  margin-left: auto;
  width: ${({ isConnected }) => isConnected ? '120px' : '130px'};

  svg {
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.font.color.inverted};
  }
`;

export const JobPage: React.FC = () => {
  const [jobId, setJobId] = useRecoilState(jobIdAtom);
  const [, setCurrentJobId] = useRecoilState(currentJobIdState);
  const [jobs, setJobs] = useRecoilState(jobsState);
  const processedData = useRecoilValue(processedDataSelector);
  const filteredCount = useRecoilValue(filteredCandidatesCountState);
  const selectedStatus = useRecoilValue(selectedConversationStatusState);
  const tableState = useRecoilValue(tableStateAtom);
  const searchQuery = useRecoilValue(chatSearchQueryState);
  const { resetJobStates } = useJobStateReset();
  const { refetchJobs } = useJobRefetch();
  const theme = useTheme();
  const location = useLocation();
  const dataTableRef = useRef<{ refreshData: () => Promise<void> }>(null);
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  const { hasSelectedRecord, selectedRecordId } = useSelectedRecordForEnrichment();
  const { checkDataIntegrityOfJob } = useCheckDataIntegrityOfJob();
  const { enqueueSnackBar } = useSnackBar();
  const { isWhatsappLoggedIn } = useBaileys();
  const { isExtensionInstalled } = useChromeExtensionDetection();
  const { candidateFields, fetchCandidateFields } = useFetchCandidateFields();
  const { initializeEnrichments } = useInitializeEnrichments();

  const isVideoInterviewModalOpen = useRecoilValue(isVideoInterviewModalOpenState);
  const [, setIsVideoInterviewModalOpen] = useRecoilState(isVideoInterviewModalOpenState);

  const isArxUploadJDModalOpen = useRecoilValue(isArxUploadJDModalOpenState);
  const [, setIsArxUploadJDModalOpen] = useRecoilState(isArxUploadJDModalOpenState);
  const [, setArxUploadJDModalMode] = useRecoilState(arxUploadJDModalModeState);

  // Check if candidate object exists before initializing the spreadsheet import hook
  const { objectMetadataItems } = useObjectMetadataItems();
  const candidateObjectExists = objectMetadataItems.some(
    item => item.nameSingular === 'candidate' && item.isActive
  );

  // Initialize the spreadsheet import hook for candidates only if the object exists
  const { openObjectRecordsSpreasheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');

  // Find the current job based on jobId
  const currentJob = useMemo(() => {
    return jobs.find((job) => job.id === jobId);
  }, [jobs, jobId]);

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useRecoilState(isBulkMessageModalOpenState);
  
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

  const handleEnrichment = () => {
    if (!selectedRecordId) {
      alert('Please select a candidate to enrich');
      return;
    }
    setCurrentJobId(jobId);
    setIsArxEnrichModalOpen(true);
  };

  const handleVideoInterviewEdit = () => {
    if (!selectedRecordId) {
      alert('Please select a candidate to create video interview');
      return;
    }
    setIsVideoInterviewModalOpen(true);
  };

  const handleAddJob = () => {
    setArxUploadJDModalMode('create');
    setIsArxUploadJDModalOpen(true);
  };

  const handleEngagement = () => {
    setArxUploadJDModalMode('edit');
    setIsArxUploadJDModalOpen(true);
  };

  const handleImportCandidates = () => {
    if (!candidateObjectExists) {
      enqueueSnackBar(
        'Candidate object not found. Please contact support to set up the required objects.',
        {
          variant: SnackBarVariant.Error,
        }
      );
      return;
    }
    openObjectRecordsSpreasheetImportDialog();
  };

  const handleDownloadClick = () => {
    console.log("Downloading app");
    setIsDownloadModalOpen(true);
  };

  const handleValidateJobData = () => {
    if (!jobId) {
      alert('No job selected');
      return;
    }
    checkDataIntegrityOfJob([jobId]);
  };

  const handleBulkMessage = () => {
    if (tableState.selectedRowIds.length === 0) {
      alert('Please select candidates to send bulk messages');
      return;
    }
    setIsBulkMessageModalOpen(true);
  };

  useEffect(() => {
    const path = location.pathname;
    const pathParts = path.split('/job/');
    if (pathParts.length > 1) {
      const remainingPath = pathParts[1];
      const extractedJobId = remainingPath.split('/')[0];
      
      console.log('URL changed, extracted jobId:', extractedJobId);
      
      // Only reset states if the jobId actually changed
      if (extractedJobId !== jobId) {
        console.log('JobId changed from', jobId, 'to', extractedJobId, '- resetting states');
        // Reset all related states immediately to prevent stale PageHeader data
        resetJobStates();
        
        setJobId(extractedJobId);
        
        setTimeout(() => {
          dataTableRef.current?.refreshData();
        }, 100);
      } else {
        console.log('Same jobId, skipping state reset');
      }
    }
  }, [location.pathname, setJobId, resetJobStates, jobId]);

  // Initialize enrichments when component mounts
  useEffect(() => {
    console.log('Initializing enrichments on JobPage mount');
    initializeEnrichments();
  }, [initializeEnrichments]);

  // Fetch candidate fields when jobId changes
  useEffect(() => {
    if (jobId) {
      console.log('JobId changed, fetching candidate fields for:', jobId);
      fetchCandidateFields(jobId);
    }
  }, [jobId, fetchCandidateFields]);

  // Listen for job updates when ArxJDUploadModal closes
  useEffect(() => {
    if (!isArxUploadJDModalOpen) {
      // Modal is closed, trigger job refetch to update Jobs component
      refetchJobs();
    }
  }, [isArxUploadJDModalOpen, refetchJobs]);
  
  const handleRefresh = () => {
    dataTableRef.current?.refreshData();
    enqueueSnackBar(`Refresh completed`, {
      variant: SnackBarVariant.Success,
    });
  };




  const recordIndexContextValue = {
    indexIdentifierUrl: (recordId: string) => `/job/${jobId}/${recordId}` || '',
    onIndexRecordsLoaded: () => {},
    objectNamePlural: 'candidates',
    objectNameSingular: 'candidate',
    objectMetadataItem: { nameSingular: 'job' } as any,
    recordIndexId: jobId || '',
  };

  console.log("JobPage rendering with jobId:", jobId);
  console.log("JobPage rendering with recordIndexContextValue:", recordIndexContextValue);
  console.log("Current job found:", currentJob);
  console.log("Filtered count:", filteredCount);
  console.log("Selected status:", selectedStatus);
  console.log("Search query:", searchQuery);
  console.log("Processed data length:", processedData.length);

  return (
    <ObjectMetadataErrorBoundary>
      <SpreadsheetImportProvider>
        <StyledPageContainer>
        <RecordFieldValueSelectorContextProvider>
          <StyledPageHeader 
            title={tableState.isLoading ? 
              `${currentJob?.name || 'Job'} (Loading...)` :
              // `${currentJob?.name || 'Job'} (${currentJobIndex} of ${totalJobs}) - ${
              `${currentJob?.name || 'Job'} - ${
                tableState.selectedRowIds.length > 0 ?
                  `${tableState.selectedRowIds.length} selected of ` : ''
                }${
                  filteredCount !== processedData.length ? 
                  `${filteredCount} filtered` : 
                  `${processedData.length} total`
                }${
                  filteredCount !== processedData.length ? 
                  ` • Total ${processedData.length}` : 
                  ''
                }`
            } 
            Icon={IconCheckbox}
            hasPaginationButtons={true}
            hasPreviousRecord={hasPreviousJob}
            hasNextRecord={hasNextJob}
            navigateToPreviousRecord={navigateToPreviousJob}
            navigateToNextRecord={navigateToNextJob}
            hasClosePageButton={true}
            onClosePage={navigateToJobsList}
          >
            <StyledButtonContainer>
              <Button title="Add New Job" Icon={IconPlus} variant="primary" onClick={handleAddJob} />
              {!isExtensionInstalled && (
                <Button title="Download App" Icon={IconDownload} variant="secondary" onClick={handleDownloadClick} />
              )}
              <StyledConnectionStatus isConnected={isWhatsappLoggedIn}>
                {isWhatsappLoggedIn ? (
                  <>
                    <IconCheck />
                    WA Connected
                  </>
                ) : (
                  <>
                    <IconX />
                    WA Disconnected
                  </>
                )}
              </StyledConnectionStatus>
              
              {/* <ExtensionStatusIndicator /> */}
            </StyledButtonContainer>
            {/* <PageAddChatButton /> */}
            {/* <NotificationsButton /> */}
          </StyledPageHeader>
          <StyledPageBody>
            <RecordIndexContextProvider value={recordIndexContextValue}>
              <ViewComponentInstanceContext.Provider value={{ instanceId: jobId }}>
                <StyledTopBar
                  leftComponent={<StyledTabListContainer />}
                  handleRefresh={handleRefresh}
                  handleEnrichment={handleEnrichment}
                  handleVideoInterviewEdit={handleVideoInterviewEdit}
                  handleAddJob={handleAddJob}
                  handleEngagement={handleEngagement}
                  handleImportCandidates={handleImportCandidates}
                  showImportCandidates={true}
                  handleStatistics={() => setIsStatsModalOpen(true)}
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
                  // jobId will be automatically retrieved from jobsState
                  rightComponent={
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
                  }
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
                  <DataTable ref={dataTableRef} jobId={jobId} />
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
                  objectRecordId={jobId || '0'}
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
          </StyledPageBody>
        </RecordFieldValueSelectorContextProvider>
      </StyledPageContainer>
    </SpreadsheetImportProvider>
    </ObjectMetadataErrorBoundary>
  );
};