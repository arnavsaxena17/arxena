import { EmptyJobState } from '@/activities/chats/components/EmptyJobState';
import { chatSearchQueryState } from '@/activities/chats/states/chatSearchQueryState';
import { currentUnreadChatMessagesState } from '@/activities/chats/states/currentUnreadChatMessagesState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import axios from 'axios';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import {
  CandidateNode,
  JobNode,
  UnreadMessageListManyCandidates
} from 'twenty-shared';
import ChatTable from './chat-table/ChatTable';

import { isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { IconFileDescription } from '@tabler/icons-react';
import {
  OneUnreadMessage,
  UnreadMessagesPerOneCandidate,
  isDefined
} from 'twenty-shared';
import { Loader } from 'twenty-ui';
import { CACHE_KEYS, cacheUtils } from '../utils/cacheUtils';

interface ChatMainProps {
  initialCandidateId?: string;
  onCandidateSelect?: (candidateId: string) => void;
  jobId?: string;
}

export interface ChatMainRef {
  fetchData: (isInitial?: boolean, forceRefresh?: boolean) => Promise<void>;
}

const StyledChatContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100%;
  position: relative;
  margin-left: 8px;
  margin-right: 8px;
  overflow: hidden;

  @media (max-width: 768px) {
    flex-direction: column; 
    margin: 0;
    height: 100vh;
  }
`;

const StyledEmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
`;

const StyledLoaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
`;

const LoadingStates = {
  INITIAL: 'initial',
  LOADING_CACHE: 'loading_cache',
  LOADING_API: 'loading_api',
  READY: 'ready',
  ERROR: 'error',
};

export const ChatMain = forwardRef<ChatMainRef, ChatMainProps>(
  ({ initialCandidateId, onCandidateSelect, jobId }, ref) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const fetchInProgress = useRef(false);
  const lastFetchTime = useRef<number>(0);
  const FETCH_COOLDOWN = 1000; // 30 seconds cooldown between API calls

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [candidates, setCandidates] = useState<CandidateNode[]>([]);
  const [loadingState, setLoadingState] = useState(LoadingStates.INITIAL);
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobNode[]>([]);
  const setIsArxUploadJDModalOpen = useSetRecoilState(isArxUploadJDModalOpenState);

  const [unreadMessages, setUnreadMessages] =
    useState<UnreadMessageListManyCandidates>({
      listOfUnreadMessages: [],
    });

  // Recoil states
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentUnreadChatMessages, setCurrentUnreadChatMessages] =
    useRecoilState(currentUnreadChatMessagesState);
  const searchQuery = useRecoilValue(chatSearchQueryState);

  const [sidebarWidth, setSidebarWidth] = useState(900);
  const [isResizing, setIsResizing] = useState(false);

  const [filteredCandidates, setFilteredCandidates] = useState<CandidateNode[]>([]);

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    }
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  const loadFromCache = () => {
    setLoadingState(LoadingStates.LOADING_CACHE);
    
    if (!jobId) {
      return false;
    }
    
    // Try to load job-specific candidate cache
    const cacheKey = `${CACHE_KEYS.CHATS_DATA}_${jobId}`;
    const cachedCandidates = cacheUtils.getCache(cacheKey);
    const cachedJobs = cacheUtils.getCache(CACHE_KEYS.JOBS_DATA);

    if (isDefined(cachedCandidates) && isDefined(cachedJobs)) {
      setCandidates(cachedCandidates);
      setJobs(cachedJobs);
      // Calculate unread messages from cache
      const unreadMessagesList =
        getUnreadMessageListManyCandidates(cachedCandidates);
      setUnreadMessages(unreadMessagesList);
      setCurrentUnreadChatMessages( unreadMessagesList?.listOfUnreadMessages?.length, );
      setLoadingState(LoadingStates.READY);
      return true;
    }
    return false;
  };

  // Functions
  const getUnreadMessageListManyCandidates = (
    candidates: CandidateNode[],
  ): UnreadMessageListManyCandidates => {
    const listOfUnreadMessages: UnreadMessagesPerOneCandidate[] = [];
    candidates?.forEach((candidate: CandidateNode) => {
      const unreadMessages: OneUnreadMessage[] = 
        candidate?.whatsappMessages?.edges
          ?.filter( (edge) => edge?.node?.whatsappDeliveryStatus === 'receivedFromCandidate', )
          ?.map(
            (edge): OneUnreadMessage => ({
              message: edge?.node?.message,
              id: edge?.node?.id,
              whatsappDeliveryStatus: edge?.node?.whatsappDeliveryStatus,
            }),
          ) ?? [];

      if (unreadMessages.length > 0) {
        listOfUnreadMessages.push({
          candidateId: candidate.id,
          ManyUnreadMessages: unreadMessages,
        });
      }
    });

    return { listOfUnreadMessages };
  };

  const shouldFetchData = () => {
    const now = Date.now();
    // Only fetch if the last fetch was more than FETCH_COOLDOWN ago
    if (now - lastFetchTime.current < FETCH_COOLDOWN) {
      return false;
    }
    return true;
  };

  const handleOpenUploadJDModal = () => {
    setIsArxUploadJDModalOpen(true);
  };

  const fetchData = async (isInitialLoad = false, forceRefresh = false) => {
    if (!jobId) return;
    
    // Avoid concurrent fetches and respect cooldown period
    if (fetchInProgress.current || (!forceRefresh && !shouldFetchData())) {
      return;
    }
    
    try {
      fetchInProgress.current = true;
      
      if (isInitialLoad) {
        setLoadingState(LoadingStates.LOADING_API);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      // Store the current fetch time
      lastFetchTime.current = Date.now();
      
      // Use the jobId in the cache key for candidates
      const candidateCacheKey = `${CACHE_KEYS.CHATS_DATA}_${jobId}`;

      const [candidatesResponse, jobsResponse] = await Promise.all([
        axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-candidates-by-job-id`,
          {
            jobId,
          },
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
          },
        ),
        axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-jobs`,
          {},
          {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
          },
        ),
      ]);

      const availableCandidates:CandidateNode[] = candidatesResponse.data

      // Update cache with job-specific candidates
      cacheUtils.setCache(candidateCacheKey, availableCandidates);
      cacheUtils.setCache(CACHE_KEYS.JOBS_DATA, jobsResponse.data.jobs);

      setCandidates(availableCandidates);
      setJobs(jobsResponse.data.jobs);

      const unreadMessagesList =
        getUnreadMessageListManyCandidates(availableCandidates);
      setCurrentUnreadChatMessages(
        unreadMessagesList?.listOfUnreadMessages?.length,
      );
      setUnreadMessages(unreadMessagesList);

      if (isDefined(selectedCandidate)) {
        updateUnreadMessagesStatus(selectedCandidate);
      }

      setLoadingState(LoadingStates.READY);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load chats. Please try again.');
      setLoadingState(LoadingStates.ERROR);
    } finally {
      setIsRefreshing(false);
      fetchInProgress.current = false;
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      if (!jobId) return;
      
      const hasCachedData = loadFromCache();
      if (!hasCachedData) {
        await fetchData(true);
      } else {
        // Only fetch fresh data in the background if enough time has passed
        if (shouldFetchData()) {
          fetchData(false);
        }
      }
    };

    initializeData();
    
    // Use a longer interval for background refreshes
    const interval = setInterval(() => fetchData(false), 300000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [jobId]);

  const updateUnreadMessagesStatus = async (selectedIndividual: string) => {
    if (!selectedIndividual) return;
    
    const listOfMessagesIds = unreadMessages?.listOfUnreadMessages
      ?.find(
        (unreadMessage) =>
          unreadMessage?.candidateId ===
          (
            candidates?.find(
              (candidate: CandidateNode) => candidate?.id === selectedIndividual,
            ) as unknown as CandidateNode
          )?.id,
      )
      ?.ManyUnreadMessages?.map((message) => message.id);

    if (!listOfMessagesIds?.length) return;

    await axios.post(
      `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/update-whatsapp-delivery-status`,
      { listOfMessagesIds },
      { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } },
    );
  };

  useEffect(() => {
    if (isDefined(initialCandidateId) && candidates.length > 0) {
      const candidate = candidates.find(
        (ind: CandidateNode) =>
          ind.id === initialCandidateId,
      );
      if (isDefined(candidate)) {
        setSelectedCandidate((candidate as unknown as CandidateNode).id);
      }
    }
  }, [initialCandidateId, candidates]);

  useEffect(() => {
    if (selectedCandidate) {
      updateUnreadMessagesStatus(selectedCandidate);
    }
  }, [selectedCandidate]);

  // Filter candidates based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCandidates(candidates);
      return;
    }

    const lowerCaseQuery = searchQuery.toLowerCase();
    const filtered = candidates.filter((candidate) => {
      return Object.entries(candidate).some(([_, value]) => {
        if (value === null || value === undefined) return false;
        
        // Handle nested objects by converting to string
        const stringValue = typeof value === 'object' 
          ? JSON.stringify(value).toLowerCase()
          : String(value).toLowerCase();
          
        return stringValue.includes(lowerCaseQuery);
      });
    });

    setFilteredCandidates(filtered);
  }, [searchQuery, candidates]);

  // Update filteredCandidates when candidates change
  useEffect(() => {
    setFilteredCandidates(candidates);
  }, [candidates]);

  const handleRefresh = () => {
    fetchData(false, true);
  };

  // Expose the fetchData method to parent components
  useImperativeHandle(ref, () => ({
    fetchData
  }));

  if (jobs.length === 0) {
    return (
      <StyledEmptyStateContainer>
        <EmptyJobState
          animatedPlaceholderType="job"
          title="No jobs found"
          subTitle="Upload a job description to get started"
          ButtonIcon={IconFileDescription}
          buttonTitle="Upload Job Description"
          onClick={handleOpenUploadJDModal}
        />
      </StyledEmptyStateContainer>
    );
  }

  if (loadingState === LoadingStates.ERROR && candidates.length === 0) {
    return <div style={{ marginLeft: '10px' }}>No chats found.</div>;
  }

  return (
    <>
      <StyledChatContainer
        onMouseMove={(e) => isResizing ? resize(e as unknown as MouseEvent) : undefined}
        onMouseUp={stopResizing}
        onMouseLeave={stopResizing}
      >
        {loadingState === LoadingStates.LOADING_API && !isMobile && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, }} >
            <Loader />
          </div>
        )}

        <ChatTable
          candidates={filteredCandidates}
          selectedCandidate={selectedCandidate}
          unreadMessages={unreadMessages}
          onCandidateSelect={onCandidateSelect || (() => {})}
          refreshData={() => fetchData(false, true)}
        />
      </StyledChatContainer>
    </>
  );
});

// Add displayName for better debugging
ChatMain.displayName = 'ChatMain';
