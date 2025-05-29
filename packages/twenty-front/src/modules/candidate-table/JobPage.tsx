import { ActionMenuComponentInstanceContext } from "@/action-menu/states/contexts/ActionMenuComponentInstanceContext";
import { TableContainer } from "@/candidate-table/components/styled";
// import { StyledTopBar } from "@/activities/chats/components/chat-window/ChatWindowStyles";
import { ArxEnrichmentModal } from '@/arx-enrich/arxEnrichmentModal';
import { useSelectedRecordForEnrichment } from "@/arx-enrich/hooks/useSelectedRecordForEnrichment";
import { currentJobIdState, isArxEnrichModalOpenState } from "@/arx-enrich/states/arxEnrichModalOpenState";
import { processedDataSelector } from "@/candidate-table/states";

import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import { isArxUploadJDModalOpenState } from "@/arx-jd-upload/states/arxUploadJDModalOpenState";
import { ChatOptionsDropdownButton } from "@/candidate-table/ChatOptionsDropdownButton";
import { ArxDownloadModal } from "@/candidate-table/components/ArxDownloadModal";
import { DataTable } from "@/candidate-table/DataTable";
import { HotTableActionMenu } from "@/candidate-table/HotTableActionMenu";
import { jobIdAtom, jobsState } from "@/candidate-table/states";
import { ContextStoreComponentInstanceContext } from "@/context-store/states/contexts/ContextStoreComponentInstanceContext";
import { ObjectFilterDropdownButton } from "@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton";
import { ObjectFilterDropdownComponentInstanceContext } from "@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext";
import { FiltersHotkeyScope } from "@/object-record/object-filter-dropdown/types/FiltersHotkeyScope";
import { ObjectSortDropdownButton } from "@/object-record/object-sort-dropdown/components/ObjectSortDropdownButton";
import { ObjectSortDropdownComponentInstanceContext } from "@/object-record/object-sort-dropdown/states/context/ObjectSortDropdownComponentInstanceContext";
import { RecordIndexContextProvider } from "@/object-record/record-index/contexts/RecordIndexContext";
import { RecordFieldValueSelectorContextProvider } from "@/object-record/record-store/contexts/RecordFieldValueSelectorContext";
import { useOpenObjectRecordsSpreadsheetImportDialog } from "@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog";
import { SpreadsheetImportProvider } from "@/spreadsheet-import/provider/components/SpreadsheetImportProvider";
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
import { Button, IconCheckbox, IconDownload, IconFileImport } from 'twenty-ui';

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100vh;
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

export const JobPage: React.FC = () => {
  const [jobId, setJobId] = useRecoilState(jobIdAtom);
  const [, setCurrentJobId] = useRecoilState(currentJobIdState);
  const jobs = useRecoilValue(jobsState);
  const processedData = useRecoilValue(processedDataSelector);
  const theme = useTheme();
  const location = useLocation();
  const dataTableRef = useRef<{ refreshData: () => Promise<void> }>(null);
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  const { hasSelectedRecord, selectedRecordId } = useSelectedRecordForEnrichment();

  const { enqueueSnackBar } = useSnackBar();

  const isVideoInterviewModalOpen = useRecoilValue(isVideoInterviewModalOpenState);
  const [, setIsVideoInterviewModalOpen] = useRecoilState(isVideoInterviewModalOpenState);

  const isArxUploadJDModalOpen = useRecoilValue(isArxUploadJDModalOpenState);
  const [, setIsArxUploadJDModalOpen] = useRecoilState(isArxUploadJDModalOpenState);

  // Initialize the spreadsheet import hook for candidates
  const { openObjectRecordsSpreasheetImportDialog } = useOpenObjectRecordsSpreadsheetImportDialog('candidate');

  // Find the current job based on jobId
  const currentJob = useMemo(() => {
    return jobs.find((job) => job.id === jobId);
  }, [jobs, jobId]);

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

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

  const handleEngagement = () => {
    if (!selectedRecordId) {
      alert('Please select a candidate to upload JD');
      return;
    }
    setIsArxUploadJDModalOpen(true);
  };

  const handleImportCandidates = () => {
    openObjectRecordsSpreasheetImportDialog();
  };

  const handleDownloadClick = () => {
    console.log("Downloading app");
    setIsDownloadModalOpen(true);
  };

  useEffect(() => {
    const path = location.pathname;
    const pathParts = path.split('/job/');
    if (pathParts.length > 1) {
      const remainingPath = pathParts[1];
      const extractedJobId = remainingPath.split('/')[0];
      
      console.log('URL changed, extracted jobId:', extractedJobId);
      setJobId(extractedJobId);
      
      setTimeout(() => {
        dataTableRef.current?.refreshData();
      }, 100);
    }
  }, [location.pathname, setJobId]);
  
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

  return (
    <SpreadsheetImportProvider>
      <StyledPageContainer>
        <RecordFieldValueSelectorContextProvider>
          <StyledPageHeader title={`${currentJob?.name || 'Job'} (${processedData.length})`} Icon={IconCheckbox}>
            <StyledButtonContainer>
              <Button title="Import Candidates" Icon={IconFileImport} variant="secondary" onClick={handleImportCandidates} />
              <Button title="Download App" Icon={IconDownload} variant="secondary" onClick={handleDownloadClick} />

              {/* <Button title="Filter" Icon={IconFilter} variant="secondary" /> */}
              {/* <Button title="Add Candidate" Icon={IconPlus} variant="primary" /> */}
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
                  handleEngagement={handleEngagement}
                  handleImportCandidates={handleImportCandidates}
                  showRefetch={true}
                  showEnrichment={true}
                  showVideoInterviewEdit={true}
                  showEngagement={true}
                  showSearch={true}
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
              <ArxJDUploadModal
                objectNameSingular="job"
                objectRecordId={jobId || '0'}
              />
            ) : (
              <></>
            )}

               <ArxDownloadModal 
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
              />
          </StyledPageBody>
        </RecordFieldValueSelectorContextProvider>
      </StyledPageContainer>
    </SpreadsheetImportProvider>
  );
};