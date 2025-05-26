import styled from '@emotion/styled';
import { useRecoilState, useRecoilValue } from 'recoil';

import { Button, IconDatabase, IconPlus } from 'twenty-ui';

import { useSelectedRecordForEnrichment } from '@/arx-enrich/hooks/useSelectedRecordForEnrichment';
import { isArxEnrichModalOpenState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import { isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { ChatOptionsDropdownButton } from '@/candidate-table/ChatOptionsDropdownButton';
import { JobCard } from '@/candidate-table/JobCard';
import { PageAddChatButton } from '@/candidate-table/PageAddChatButton';
import { jobsState } from '@/candidate-table/states';
import { ObjectFilterDropdownButton } from '@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { FiltersHotkeyScope } from '@/object-record/object-filter-dropdown/types/FiltersHotkeyScope';
import { ObjectSortDropdownButton } from '@/object-record/object-sort-dropdown/components/ObjectSortDropdownButton';
import { ObjectSortDropdownComponentInstanceContext } from '@/object-record/object-sort-dropdown/states/context/ObjectSortDropdownComponentInstanceContext';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { RecordFieldValueSelectorContextProvider } from '@/object-record/record-store/contexts/RecordFieldValueSelectorContext';
import { RecordTableEmptyStateDisplay } from '@/object-record/record-table/empty-state/components/RecordTableEmptyStateDisplay';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { TopBar } from '@/ui/layout/top-bar/components/TopBar';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
import { useWebSocketEvent } from '../websocket-context/useWebSocketEvent';

import { ArxEnrichmentModal } from '@/arx-enrich/arxEnrichmentModal';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { RecordTableContextProvider } from '@/object-record/record-table/contexts/RecordTableContext';
import { InterviewCreationModal } from '@/video-interview/interview-creation/InterviewCreationModal';
import { isVideoInterviewModalOpenState } from '@/video-interview/interview-creation/states/videoInterviewModalState';
import { AnimatedPlaceholder, AnimatedPlaceholderEmptyContainer, AnimatedPlaceholderEmptySubTitle, AnimatedPlaceholderEmptyTextContainer, AnimatedPlaceholderEmptyTitle } from 'twenty-ui';

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

const StyledPageHeader = styled(PageHeader)`
  flex-shrink: 0;
  padding: 12px 24px;

  @media (max-width: 768px) {
    padding: 8px 16px;
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
  overflow-y: auto;
  height: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    padding: ${({ theme }) => theme.spacing(2)};
  }
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

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

export const Jobs = () => {
  // const { candidateId } = useParams<{ candidateId: string }>();
  const candidateId = '1'; // Replace with your candidateId
  const filterDropdownId = 'job-filter'; // Define a unique ID for the filter dropdown
  const recordIndexId = 'jobs'; // Define a unique ID for the record index context (adjust if needed)

  // TODO: Get objectMetadataItem and viewType dynamically if needed for ObjectOptionsDropdown
  const mockObjectMetadataItem = { nameSingular: 'job' }; // Placeholder
  const { objectMetadataItems } = useObjectMetadataItems();
  const jobMetadataItem = objectMetadataItems.find(item => item.nameSingular === 'job');
  let updatedMetadataStructureLoaded = false;

  updatedMetadataStructureLoaded = !!jobMetadataItem;

  const jobs = updatedMetadataStructureLoaded 
    ? useFindManyRecords({
        objectNameSingular: 'job',
      })
    : {records:[]};

  // Get jobs from recoil state
  const jobsFromState = useRecoilValue(jobsState);
  
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
  const openObjectRecordsSpreasheetImportDialog = updatedMetadataStructureLoaded
    ? useOpenObjectRecordsSpreadsheetImportDialog('candidate').openObjectRecordsSpreasheetImportDialog
    : () => null;
  console.log('jobsFromState', jobsFromState);

  const isArxEnrichModalOpen = useRecoilValue(isArxEnrichModalOpenState);
  const [, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  const { hasSelectedRecord, selectedRecordId } = useSelectedRecordForEnrichment();

  const isVideoInterviewModalOpen = useRecoilValue(isVideoInterviewModalOpenState);
  const [, setIsVideoInterviewModalOpen] = useRecoilState(isVideoInterviewModalOpenState);
  const isArxUploadJDModalOpen = useRecoilValue(isArxUploadJDModalOpenState);
  const [, setIsArxUploadJDModalOpen] = useRecoilState(isArxUploadJDModalOpenState);

  // Add useSnackBar hook
  const { enqueueSnackBar } = useSnackBar();

  // Add WebSocket event listener for metadata structure progress
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
          
          // Give the snackbar time to display before reloading
          console.log('Jobs: Reloading page in 1 seconds due to metadata-structure-complete event');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return;
        }
        
        enqueueSnackBar(data.message, { variant });
      }
    },
    []
  );

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

  const handleEngagement = () => {
    if (!candidateId) {
      alert('Please select a chat to upload JD');
      return;
    }
    setIsArxUploadJDModalOpen(true);
  };

  const handleImportCandidates = () => {
    if (!updatedMetadataStructureLoaded) {
      alert('System is still loading. Please try again in a moment.');
      return;
    }
    openObjectRecordsSpreasheetImportDialog();
  };

  // Check if there are jobs to display
  const hasJobs = jobsFromState.length > 0;
  
  // Show search only if there are jobs and metadata is loaded
  const showSearch = hasJobs && updatedMetadataStructureLoaded;
  
  // Sort jobs by creation date (most recent first)
  const sortedJobs = [...jobsFromState].sort((a, b) => {
    // First sort by active status (active jobs first)
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    // Then sort by cre ation date descending (newest first)
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });
  
  // If metadata isn't loaded yet, show a loading state
  if (!updatedMetadataStructureLoaded) {
    return (
      <SpreadsheetImportProvider>
        <StyledPageContainer>
          <RecordFieldValueSelectorContextProvider>
            <StyledPageHeader title="Jobs" Icon={IconDatabase}>
              <StyledButtonContainer>
                <Button title="Add Job" Icon={IconPlus} variant="primary" onClick={handleEngagement} />
              </StyledButtonContainer>
              <StyledAddButtonWrapper>
                <PageAddChatButton />
              </StyledAddButtonWrapper>
            </StyledPageHeader>
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
            <StyledPageHeader title="Jobs" Icon={IconDatabase}>
              <StyledButtonContainer>
                <Button title="Add Job" Icon={IconPlus} variant="primary" onClick={handleEngagement} />
              </StyledButtonContainer>
              <StyledAddButtonWrapper>
                <PageAddChatButton />
              </StyledAddButtonWrapper>
            </StyledPageHeader>
            <StyledPageBody>
              <RecordIndexContextProvider value={recordIndexContextValue}>
                <ViewComponentInstanceContext.Provider value={{ instanceId: recordIndexId }} >
                  <StyledTopBar
                    leftComponent={ <StyledTabListContainer> </StyledTabListContainer> }
                    handleVideoInterviewEdit={handleVideoInterviewEdit}
                    handleEnrichment={handleEnrichment}
                    handleEngagement={handleEngagement}
                    handleImportCandidates={handleImportCandidates}
                    showEnrichment={true}
                    showVideoInterviewEdit={true}
                    showEngagement={true}
                    showSearch={showSearch}
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
                  />

                  {hasJobs ? (
                    <StyledJobCardsGrid>
                      {sortedJobs.map((job) => (
                        <JobCard
                          key={job.id}
                          id={job.id}
                          name={job.name}
                          createdAt={job.createdAt || new Date().toISOString()}
                          isActive={job.isActive}
                          jobLocation={job.jobLocation}
                          candidateCount={job.candidates?.edges?.length || 0}
                        />
                      ))}
                    </StyledJobCardsGrid>
                  ) : (
                    <RecordTableEmptyStateDisplay
                      buttonTitle="Add Job"
                      subTitle="No jobs found"
                      title="Your workspace is ready"
                      ButtonIcon={IconPlus}
                      animatedPlaceholderType="noRecord"
                      onClick={handleEngagement}
                    />
                  )}
                </ViewComponentInstanceContext.Provider>
              </RecordIndexContextProvider>
              
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
              
              {isArxUploadJDModalOpen ? (
                <ArxJDUploadModal
                  objectNameSingular="job"
                  objectRecordId={candidateId}
                />
              ) : (
                <></>
              )}
            </StyledPageBody>
          </RecordFieldValueSelectorContextProvider>
        </StyledPageContainer>
      </RecordTableContextProvider>
    </SpreadsheetImportProvider>
  );
};
