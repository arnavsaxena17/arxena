import styled from '@emotion/styled';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { Button, IconCheckbox, IconFilter, IconPlus } from 'twenty-ui';

import { ChatMain } from '@/activities/chats/components/ChatMain';
import { ChatOptionsDropdownButton } from '@/activities/chats/components/ChatOptionsDropdownButton';
import { JobNotFoundState } from '@/activities/chats/components/JobNotFoundState';
import { PageAddChatButton } from '@/activities/chats/components/PageAddChatButton';
import { SingleJobViewSkeletonLoader } from '@/activities/chats/components/SingleJobViewSkeletonLoader';
import { CACHE_KEYS, cacheUtils } from '@/activities/chats/utils/cacheUtils';
import { ArxEnrichmentModal } from '@/arx-enrich/arxEnrichmentModal';
import { useSelectedRecordForEnrichment } from '@/arx-enrich/hooks/useSelectedRecordForEnrichment';
import { currentJobIdState, isArxEnrichModalOpenState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import { useArxUploadJDModal } from '@/arx-jd-upload/hooks/useArxUploadJDModal';
import { isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { ObjectFilterDropdownButton } from '@/object-record/object-filter-dropdown/components/ObjectFilterDropdownButton';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { FiltersHotkeyScope } from '@/object-record/object-filter-dropdown/types/FiltersHotkeyScope';
import { ObjectSortDropdownButton } from '@/object-record/object-sort-dropdown/components/ObjectSortDropdownButton';
import { ObjectSortDropdownComponentInstanceContext } from '@/object-record/object-sort-dropdown/states/context/ObjectSortDropdownComponentInstanceContext';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { RecordFieldValueSelectorContextProvider } from '@/object-record/record-store/contexts/RecordFieldValueSelectorContext';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { TopBar } from '@/ui/layout/top-bar/components/TopBar';
import { InterviewCreationModal } from '@/video-interview/interview-creation/InterviewCreationModal';
import { isVideoInterviewModalOpenState } from '@/video-interview/interview-creation/states/videoInterviewModalState';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';

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

type Job = {
  id: string;
  name: string;
  pathPosition?: string;
  isActive: boolean;
};

export const SingleJobView = () => {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>();
  const [tokenPair] = useRecoilState(tokenPairState);
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentCandidateId, setCurrentCandidateId] = useState<string | undefined>(candidateId);
  const navigate = useNavigate();
  const isMounted = useRef(false);
  const fetchInProgress = useRef(false);
  const setCurrentJobId = useSetRecoilState(currentJobIdState);
  
  // Component instance IDs
  const filterDropdownId = `job-filter-${jobId}`;
  const recordIndexId = `job-${jobId}`;

  const isArxEnrichModalOpen = useRecoilValue(isArxEnrichModalOpenState);
  const [, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  const { hasSelectedRecord, selectedRecordId } = useSelectedRecordForEnrichment();
  const isVideoInterviewModalOpen = useRecoilValue(isVideoInterviewModalOpenState);
  const [, setIsVideoInterviewModalOpen] = useRecoilState(isVideoInterviewModalOpenState);
  const { openUploadJDModal } = useArxUploadJDModal();
  const isArxUploadJDModalOpen = useRecoilValue(isArxUploadJDModalOpenState);
  const { enqueueSnackBar } = useSnackBar();

  // Handle candidateId changes from URL params
  useEffect(() => {
    if (candidateId !== currentCandidateId) {
      setCurrentCandidateId(candidateId);
    }
  }, [candidateId]);

  // Handle candidate selection from ChatMain
  const handleCandidateSelect = (id: string) => {
    console.log("handleCandidateSelect::id", id)
    setCurrentCandidateId(id);
    
    // Update URL without full page reload
    if (jobId) {
      navigate(`/job/${jobId}/${id}`, { replace: true });
    }
  };

  useEffect(() => {
    const fetchJob = async () => {
      // Prevent concurrent API calls
      if (fetchInProgress.current) return;
      
      try {
        fetchInProgress.current = true;
        setIsLoading(true);
        
        // Update the Recoil state with the current jobId
        if (jobId) {
          setCurrentJobId(jobId);
        }
        
        // Try to get data from cache first
        const cachedJobs = cacheUtils.getCache(CACHE_KEYS.JOBS_DATA);
        if (cachedJobs) {
          const foundJob = cachedJobs.find((job: any) => job.node.id === jobId);
          if (foundJob) {
            setJob({
              id: foundJob.node.id,
              name: foundJob.node.name,
              pathPosition: foundJob.node.pathPosition,
              isActive: foundJob.node.isActive,
            });
            setIsLoading(false);
            fetchInProgress.current = false;
            return;
          }
        }
        
        // If not in cache or not found, fetch from API
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-jobs`,
          {},
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
          },
        );
        
        if (response.data?.jobs) {
          // Cache the jobs for future use
          cacheUtils.setCache(CACHE_KEYS.JOBS_DATA, response.data.jobs);
          
          // Find the job by ID
          const foundJob = response.data.jobs.find(
            (job: any) => job.node.id === jobId
          );
          
          if (foundJob) {
            setJob({
              id: foundJob.node.id,
              name: foundJob.node.name,
              pathPosition: foundJob.node.pathPosition,
              isActive: foundJob.node.isActive,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching job details:', error);
      } finally {
        setIsLoading(false);
        fetchInProgress.current = false;
      }
    };

    if (jobId) {
      fetchJob();
    }

    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
    };
  }, [jobId, tokenPair, setCurrentJobId]);

  const recordIndexContextValue = {
    indexIdentifierUrl: (recordId: string) => `/job/${jobId}/${recordId}`,
    onIndexRecordsLoaded: () => {},
    objectNamePlural: 'candidates',
    objectNameSingular: 'candidate',
    objectMetadataItem: { nameSingular: 'job' } as any,
    recordIndexId,
  };

  const handleEnrichment = () => {
    if (!currentCandidateId) {
      enqueueSnackBar('Please select a candidate to enrich', {
        variant: SnackBarVariant.Warning,
        duration: 2000,
      });
      return;
    }
    setIsArxEnrichModalOpen(true);
  };

  const handleVideoInterviewEdit = () => {
    if (!currentCandidateId) {
      enqueueSnackBar('Please select a candidate to create video interview', {
        variant: SnackBarVariant.Warning,
        duration: 2000,
      });
      return;
    }
    setIsVideoInterviewModalOpen(true);
  };
  
  const handleEngagement = () => {
    openUploadJDModal();
  };

  if (isLoading) {
    return <SingleJobViewSkeletonLoader />;
  }

  if (!job) {
    return <JobNotFoundState />;
  }

  return (
    <StyledPageContainer>
      <RecordFieldValueSelectorContextProvider>
        <StyledPageHeader title={job.name} Icon={IconCheckbox}>
          <Button title="Filter" Icon={IconFilter} variant="secondary" />
          <Button title="Add Candidate" Icon={IconPlus} variant="primary" />
          <PageAddChatButton />
        </StyledPageHeader>
        <StyledPageBody>
          <RecordIndexContextProvider value={recordIndexContextValue}>
            <ViewComponentInstanceContext.Provider value={{ instanceId: recordIndexId }}>
              <StyledTopBar
                leftComponent={<StyledTabListContainer />}
                handleEnrichment={handleEnrichment}
                handleVideoInterviewEdit={handleVideoInterviewEdit}
                handleEngagement={handleEngagement}
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
          <ChatMain 
            jobId={jobId}
            initialCandidateId={currentCandidateId} 
            onCandidateSelect={handleCandidateSelect}
          />
          
          {isArxEnrichModalOpen ? (
            <ArxEnrichmentModal
              objectNameSingular="candidate"
              objectRecordId={currentCandidateId || '0'}
            />
          ) : (
            <></>
          )}
          
          {isVideoInterviewModalOpen ? (
            <InterviewCreationModal
              objectNameSingular="candidate"
              objectRecordId={currentCandidateId || '0'}
            />
          ) : (
            <></>
          )}
          
          {isArxUploadJDModalOpen ? (
            <ArxJDUploadModal
              objectNameSingular="candidate"
              objectRecordId={currentCandidateId || '0'}
            />
          ) : (
            <></>
          )}
        </StyledPageBody>
      </RecordFieldValueSelectorContextProvider>
    </StyledPageContainer>
  );
}; 