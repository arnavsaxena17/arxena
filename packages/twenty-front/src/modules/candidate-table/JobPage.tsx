import { ActionMenuComponentInstanceContext } from "@/action-menu/states/contexts/ActionMenuComponentInstanceContext";
import { TableContainer } from "@/activities/chats/components/chat-table/styled";
// import { StyledTopBar } from "@/activities/chats/components/chat-window/ChatWindowStyles";
import { ChatOptionsDropdownButton } from "@/activities/chats/components/ChatOptionsDropdownButton";
import { PageAddChatButton } from "@/activities/chats/components/PageAddChatButton";
import { DataTable } from "@/candidate-table/DataTable";
import { HotTableActionMenu } from "@/candidate-table/HotTableActionMenu";
import { jobIdAtom } from "@/candidate-table/states";
import { ContextStoreComponentInstanceContext } from "@/context-store/states/contexts/ContextStoreComponentInstanceContext";
import { ObjectFilterDropdownButton } from "@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton";
import { ObjectFilterDropdownComponentInstanceContext } from "@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext";
import { FiltersHotkeyScope } from "@/object-record/object-filter-dropdown/types/FiltersHotkeyScope";
import { ObjectSortDropdownButton } from "@/object-record/object-sort-dropdown/components/ObjectSortDropdownButton";
import { ObjectSortDropdownComponentInstanceContext } from "@/object-record/object-sort-dropdown/states/context/ObjectSortDropdownComponentInstanceContext";
import { RecordIndexContextProvider } from "@/object-record/record-index/contexts/RecordIndexContext";
import { RecordFieldValueSelectorContextProvider } from "@/object-record/record-store/contexts/RecordFieldValueSelectorContext";
import { NotificationsButton } from '@/ui/layout/page/components/NotificationsButton';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { TopBar } from "@/ui/layout/top-bar/components/TopBar";
import { ViewComponentInstanceContext } from "@/views/states/contexts/ViewComponentInstanceContext";
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useEffect, useRef, useState } from "react";
import { useSetRecoilState } from "recoil";
import { Button, IconCheckbox, IconFilter, IconPlus } from 'twenty-ui';

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

export const JobPage: React.FC = () => {
  const setJobId = useSetRecoilState(jobIdAtom);
  const [jobId, setLocalJobId] = useState<string>('job-id');
  const theme = useTheme();
  const dataTableRef = useRef<{ refreshData: () => Promise<void> }>(null);
  
  // Extract jobId from URL on mount
  useEffect(() => {
    const path = window.location.pathname;
    const extractedJobId = path.split('/job/')[1];
    setJobId(extractedJobId);
    setLocalJobId(extractedJobId);
  }, [setJobId]);
  
  const handleRefresh = () => {
    dataTableRef.current?.refreshData();
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

  return (
    // <StyledPageContainer>
    //   <StyledPageHeader title={'Job Candidates'} Icon={IconCheckbox}>
    //     <Button title="Filter" Icon={IconFilter} variant="secondary" />
    //     <Button title="Add Candidate" Icon={IconPlus} variant="primary" />
    //     <NotificationsButton />
    //   </StyledPageHeader>
    //   <StyledPageBody>
        
    //     <DataTable jobId={jobId} />
    //   </StyledPageBody>
    // </StyledPageContainer>


    <StyledPageContainer>
      <RecordFieldValueSelectorContextProvider>
        <StyledPageHeader title={''} Icon={IconCheckbox}>
          <Button title="Filter" Icon={IconFilter} variant="secondary" />
          <Button title="Add Candidate" Icon={IconPlus} variant="primary" />
          <PageAddChatButton />
          <NotificationsButton />
        </StyledPageHeader>
        <StyledPageBody>
          <RecordIndexContextProvider value={recordIndexContextValue}>
            <ViewComponentInstanceContext.Provider value={{ instanceId: jobId }}>
              <StyledTopBar
                leftComponent={<StyledTabListContainer />}
                handleRefresh={handleRefresh}
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
          {/*           
          {isArxEnrichModalOpen ? (
            <ArxEnrichmentModal
              objectNameSingular="candidate"
              objectRecordId={currentCandidateId || '0'}
            />
          ) : (
            <></>
          )}
           */}
          {/* {isVideoInterviewModalOpen ? (
            <InterviewCreationModal
              objectNameSingular="candidate"
              objectRecordId={currentCandidateId || '0'}
            />
          ) : (
            <></>
          )}
           */}
          {/* {isArxUploadJDModalOpen ? (
            <ArxJDUploadModal
              objectNameSingular="candidate"
              objectRecordId={currentCandidateId || '0'}
            />
          ) : (
            <></>
          )} */}
        </StyledPageBody>
      </RecordFieldValueSelectorContextProvider>
    </StyledPageContainer>


  );
};