import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { CandidateArrProcessing } from '@/activities/chats/components/CandidateArrProcessing';
import { TableContainer } from '@/activities/chats/components/chat-table/styled';
import { ChatActionMenu } from '@/activities/chats/components/ChatActionMenu';
import { ChatOptionsDropdownButton } from '@/activities/chats/components/ChatOptionsDropdownButton';
import { PageAddChatButton } from '@/activities/chats/components/PageAddChatButton';
import { CACHE_KEYS, cacheUtils } from '@/activities/chats/utils/cacheUtils';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { ObjectFilterDropdownButton } from '@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { FiltersHotkeyScope } from '@/object-record/object-filter-dropdown/types/FiltersHotkeyScope';
import { ObjectSortDropdownButton } from '@/object-record/object-sort-dropdown/components/ObjectSortDropdownButton';
import { ObjectSortDropdownComponentInstanceContext } from '@/object-record/object-sort-dropdown/states/context/ObjectSortDropdownComponentInstanceContext';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { RecordFieldValueSelectorContextProvider } from '@/object-record/record-store/contexts/RecordFieldValueSelectorContext';
import { NotificationsButton } from '@/ui/layout/page/components/NotificationsButton';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { TopBar } from '@/ui/layout/top-bar/components/TopBar';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import HotTable, { HotTableRef } from '@handsontable/react-wrapper';
import axios from 'axios';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { CandidateNode, JobNode } from 'twenty-shared';
import { Button, IconCheckbox, IconFilter, IconPlus } from 'twenty-ui';
import { TableData } from './chat-table/types';

registerAllModules();

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
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

type Job = {
  id: string;
  name: string;
  pathPosition?: string;
  isActive: boolean;
};

const LoadingStates = {
  INITIAL: 'initial',
  LOADING_CACHE: 'loading_cache',
  LOADING_API: 'loading_api',
  READY: 'ready',
  ERROR: 'error',
};


const StyledTopBar = styled(TopBar)`
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
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


// Add CSS styles at the top level
export const truncatedCellStyle = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
  display: 'block',
};

// Define fields that should be excluded from automatic column generation
const excludedFields = [
  'id', 'checkbox', 'name', 'candidateFieldValues','token', 'jobTitle', 'firstName','phone', 'searchId','phoneNumbers','filterQueryHash','mayAlsoKnow','languages','englishLevel','baseQueryHash','creationDate','apnaSearchToken','lastName', 'uniqueKeyString', 'emailAddress', 'industries', 'profiles', 'jobProcess', 'locations','experience', 'experienceStats', 'lastUpdated','education','interests','skills','dataSources','allNumbers','jobName','uploadId','allMails','socialprofiles','tables','created','middleName','middleInitial','creationSource','contactDetails','queryId','socialProfiles','updatedAt'
];

const urlFields = [
  'profileUrl', 'linkedinUrl', 'linkedInUrl', 'githubUrl', 'portfolioUrl','profilePhotoUrl','englishAudioIntroUrl',
  'resdexNaukriUrl', 'hiringNaukriUrl', 'website', 'websiteUrl',
];

/**
 * Unselect all selected candidates from the table
 * @param setSelectedIds Function to update the selected IDs state
 */
export const unselect = (setSelectedIds: (ids: string[]) => void) => {
  setSelectedIds([]);
};


export type TableState = {
  data: TableData[];
  jobs: JobNode[];
  candidates: CandidateNode[];
  columns: Handsontable.ColumnSettings[];
  isLoading: boolean;
  error: string | null;
  selectedIds: string[];
};

export const SingleJobView = () => {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const [tokenPair] = useRecoilState(tokenPairState);
  const [job, setJob] = useState<Job | null>(null);
  const lastFetchTime = useRef<number>(0);

  const hotRef = useRef<HotTableRef>(null);



  const fetchInProgress = useRef(false);
  const theme = useTheme();
  const tableId = useMemo(() => `chat-table-${crypto.randomUUID()}`, []);

  // Component instance IDs
  const filterDropdownId = `job-filter-${jobId}`;
  const recordIndexId = `job-${jobId}`;

  const [loadingState, setLoadingState] = useState(LoadingStates.INITIAL);
  const [jobs, setJobs] = useState<JobNode[]>([]);


  const [tableState, setTableState] = useState<TableState>({
    data: [] as TableData[],
    jobs : [] as JobNode[],
    candidates: [] as CandidateNode[],
    columns: [] as Handsontable.ColumnSettings[],
    selectedIds: [] as string[],
    isLoading: true,
    error: null
  });
  
  

  const prepareTableData = (candidates: CandidateNode[]): TableData[] => {
    return candidates.map(candidate => {
      const baseData = {
        id: candidate.id,
        // Set the phone field from people object for the phone column
        phone: candidate?.people?.phones?.primaryPhoneNumber || candidate.phoneNumber || 'N/A',
        // Set the email field from people object for the email column
        email: candidate?.people?.emails?.primaryEmail || candidate.email || 'N/A',
        phoneNumber: candidate.phoneNumber || 'N/A',
        status: candidate.status || 'N/A',
        candidateFieldValues: candidate.candidateFieldValues || 'N/A',
        chatCount: candidate?.chatCount || 'N/A',
        clientInterview: candidate?.clientInterview || 'N/A',    
        hiringNaukriUrl: candidate?.hiringNaukriUrl || 'N/A',
        lastEngagementChatControl: candidate?.lastEngagementChatControl || 'N/A',
        name: candidate?.name || 'N/A',
        resdexNaukriUrl: candidate?.resdexNaukriUrl || 'N/A',
        source: candidate?.source || 'N/A',
        startChat: candidate?.startChat || 'N/A',
        startChatCompleted: candidate?.startChatCompleted || 'N/A',
        startMeetingSchedulingChat: candidate?.startMeetingSchedulingChat || 'N/A',
        startMeetingSchedulingChatCompleted: candidate?.startMeetingSchedulingChatCompleted || 'N/A',
        startVideoInterviewChat: candidate?.startVideoInterviewChat || 'N/A',
        startVideoInterviewChatCompleted: candidate?.startVideoInterviewChatCompleted || 'N/A',
        stopChat: candidate?.stopChat || 'N/A',
        stopChatCompleted: candidate?.stopChatCompleted || 'N/A',
        stopMeetingSchedulingChat: candidate?.stopMeetingSchedulingChat || 'N/A',
        stopMeetingSchedulingChatCompleted: candidate?.stopMeetingSchedulingChatCompleted || 'N/A',
        stopVideoInterviewChat: candidate?.stopVideoInterviewChat || 'N/A',
        stopVideoInterviewChatCompleted: candidate?.stopVideoInterviewChatCompleted || 'N/A',
        checkbox: tableState.selectedIds.includes(candidate?.id),
      };
      
      const fieldValues: Record<string, string> = {};
      if (candidate.candidateFieldValues?.edges) {
        candidate.candidateFieldValues.edges.forEach(edge => {
          if (edge.node) {
            const fieldName = edge.node.candidateFields?.name;
            const camelCaseFieldName = fieldName.replace(/_([a-z])/g, (match: string, letter: string) => letter.toUpperCase());
            let fieldValue = edge.node?.name;
            if (fieldName && fieldValue !== undefined) {
              fieldValues[camelCaseFieldName] = fieldValue;
            }
            if (typeof fieldValue === 'object') {
              fieldValue = JSON.stringify(fieldValue);
              fieldValues[camelCaseFieldName] = fieldValue;
            }
          }
        });
      }
      const updatedBaseData = {
        ...baseData,
        ...fieldValues
      };
      return updatedBaseData;
    });
  }



  console.log("SingleJobView rendering");
  


  const fetchData = useCallback(async (isInitialLoad = false, forceRefresh = false) => {
    if (!jobId) return;
    
    if (fetchInProgress.current) {
      return;
    }
    
    try {
      fetchInProgress.current = true;
      
      if (isInitialLoad) {
        setLoadingState(LoadingStates.LOADING_API);
      }
      // setError(null);

      lastFetchTime.current = Date.now();
      
      // Use the jobId in the cache key for candidates
      const candidateCacheKey = `${CACHE_KEYS.CHATS_DATA}_${jobId}`;

      const [candidatesResponse, jobsResponse] = await Promise.all([
        axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-candidates-by-job-id`,
          { jobId, },
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, }, },
        ),
        axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-jobs`,
          {},
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, }, },
        ),
      ]);

      const availableCandidates:CandidateNode[] = candidatesResponse.data
      cacheUtils.setCache(candidateCacheKey, availableCandidates);
      cacheUtils.setCache(CACHE_KEYS.JOBS_DATA, jobsResponse.data.jobs);

      // First set candidates in tableState to make them available for column generation
      setTableState(prevState => ({
        ...prevState,
        candidates: availableCandidates,
        jobs: jobsResponse.data.jobs,
      }));

      const { dynamicColumns, baseDataColumns, generatedColumnsList } = CandidateArrProcessing({ candidates: availableCandidates, excludedFields, urlFields, tableState });

      console.log("dynamicColumns:", dynamicColumns);
      console.log("generatedColumnsList:", generatedColumnsList);

      const initialData = prepareTableData(availableCandidates);
      console.log("initialData", initialData);
      
      if (initialData.length > 0) {
        setTableState(prevState => ({
          ...prevState, 
          data: initialData,
          columns: generatedColumnsList
        }));
      }
      setLoadingState(LoadingStates.READY);


    } catch (error) {
      console.error('Error fetching data:', error);
      // setError('Failed to load chats. Please try again.');
      setLoadingState(LoadingStates.ERROR);
    } finally {
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchData(true);
      // After data is loaded, create columns
      //  setColumns(columnsList);
    };
    
    loadData();
  }, [jobId, fetchData]);
  

  // useEffect(() => {
  //   const columns = createTableColumns(candidates, selectedIds);
  //   console.log("columns:", columns)
  //    setColumns(columns);
  // }, [candidates, selectedIds]);

  const recordIndexContextValue = {
    indexIdentifierUrl: (recordId: string) => `/job/${jobId}/${recordId}`,
    onIndexRecordsLoaded: () => {},
    objectNamePlural: 'candidates',
    objectNameSingular: 'candidate',
    objectMetadataItem: { nameSingular: 'job' } as any,
    recordIndexId,
  };

  // const handleEnrichment = () => {
  //   if (!currentCandidateId) {
  //     enqueueSnackBar('Please select a candidate to enrich', {
  //       variant: SnackBarVariant.Warning,
  //       duration: 2000,
  //     });
  //     return;
  //   }
  //   setIsArxEnrichModalOpen(true);
  // };

  // const handleVideoInterviewEdit = () => {
  //   if (!currentCandidateId) {
  //     enqueueSnackBar('Please select a candidate to create video interview', {
  //       variant: SnackBarVariant.Warning,
  //       duration: 2000,
  //     });
  //     return;
  //   }
  //   setIsVideoInterviewModalOpen(true);
  // };
  
  // const handleEngagement = () => {
  //   openUploadJDModal();
  // };

  // const handleRefresh = () => {
  //   return fetchData(false, true);
  // };

  // Create a console log to verify columns before return
  console.log("Rendering with columns:", tableState.columns?.length || 0);
  console.log("recordIndexId:", recordIndexId);

  return (
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
            <ViewComponentInstanceContext.Provider value={{ instanceId: recordIndexId }}>
              <StyledTopBar
                leftComponent={<StyledTabListContainer />}
                // handleRefresh={handleRefresh}
                // handleEnrichment={handleEnrichment}
                // handleVideoInterviewEdit={handleVideoInterviewEdit}
                // handleEngagement={handleEngagement}
                showRefetch={true}
                showEnrichment={true}
                showVideoInterviewEdit={true}
                showEngagement={true}
                rightComponent={
                  <StyledRightSection>
                    <ObjectFilterDropdownComponentInstanceContext.Provider value={{ instanceId: filterDropdownId }}>
                      <ObjectFilterDropdownButton 
                        filterDropdownId={filterDropdownId} 
                        hotkeyScope={{ scope: FiltersHotkeyScope.ObjectFilterDropdownButton }}
                      />
                    </ObjectFilterDropdownComponentInstanceContext.Provider>
                    <ObjectSortDropdownComponentInstanceContext.Provider value={{ instanceId: recordIndexId }}>
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
          <ContextStoreComponentInstanceContext.Provider value={{ instanceId: tableId }} >
            <ActionMenuComponentInstanceContext.Provider
              value={{
                instanceId: tableId,
              }}
            >
              <TableContainer>
                <HotTable
                  ref={hotRef}
                  themeName="ht-theme-main"
                  data={tableState.data}
                  columns={tableState.columns}
                  colHeaders={true}
                  rowHeaders={true}
                  height="auto"
                  licenseKey="non-commercial-and-evaluation"
                  stretchH="all"
                  className="htCenter"
                  columnSorting={true}
                  readOnly={false}
                  selectionMode="range"
                  autoWrapRow={false}
                  autoWrapCol={false}
                  autoRowSize={false}
                  rowHeights={30}
                  manualRowResize={true}
                  manualColumnResize={true}
                  filters={true}
                  dropdownMenu={true}
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
                <ChatActionMenu tableId={tableId} />
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