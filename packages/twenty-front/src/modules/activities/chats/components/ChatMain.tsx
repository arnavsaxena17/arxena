import ChatSidebar from '@/activities/chats/components/ChatSidebar';
import { currentUnreadChatMessagesState } from '@/activities/chats/states/currentUnreadChatMessagesState';
import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  CandidateNode,
  JobNode,
  OneUnreadMessage,
  UnreadMessageListManyCandidates,
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

const StyledSidebarContainer = styled.div<{ width: number }>`
  overflow-x: auto;
  display: flex;
  height: 100vh;
  width: ${(props) => props.width}px;
  min-width: 200px;
  max-width: 800px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    width: 100%;
    height: 40vh;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 10;
  }
`;

const StyledChatWindowContainer = styled.div<{ sidebarWidth: number }>`
  position: relative;
  flex-grow: 1;
  min-width: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 1;

  /* Fix for Handsontable header appearing above drawer */
  .handsontable .ht_clone_top,
  .handsontable .ht_clone_left,
  .handsontable .ht_clone_corner {
    z-index: 29; // Just below the drawer's z-index of 30
  }

  @media (max-width: 768px) {
    height: 60vh;
    width: 100%;
    margin-top: 0vh; // Adjust based on sidebar height
  }
`;

// const StyledSpinner = styled.div`
//   width: 100%;
//   height: 100%;
//   border: 4px solid ${({ theme }) => theme.border.color.light};
//   border-top: 4px solid ${({ theme }) => theme.border.color.light};
//   border-radius: 50%;
//   animation: spin 1s linear infinite;
//   @keyframes spin {
//     0% {
//       transform: rotate(0deg);
//     }
//     100% {
//       transform: rotate(360deg);
//     }
//   }
// `;

const StyledResizer = styled.div`
  width: 4px;
  cursor: col-resize;
  background-color: ${({ theme }) => theme.border.color.light};
  height: 100vh;
  position: relative;
  transition: background-color 0.2s;
  z-index: 10;

  &:hover {
    background-color: ${({ theme }) => theme.border.color.light};
  }

  &:active {
    background-color: ${({ theme }) => theme.border.color.light};
  }
`;

const LoadingStates = {
  INITIAL: 'initial',
  LOADING_CACHE: 'loading_cache',
  LOADING_API: 'loading_api',
  READY: 'ready',
  ERROR: 'error',
};

// export interface recruiterProfileType {
//   job_title: any;
//   job_company_name: any;
//   company_description_oneliner: any;
//   first_name: any;
//   last_name: any;
//   status: string;
//   name: string;
//   email: string;
//   phone: string;
//   input: string; // Add the 'input' property
// }

export const ChatMain = ({ initialCandidateId, onCandidateSelect, jobId }: ChatMainProps) => {
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const currentUser = useRecoilValue(currentUserState);
  // const userEmail = currentUser?.email;

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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

  const [unreadMessages, setUnreadMessages] =
    useState<UnreadMessageListManyCandidates>({
      listOfUnreadMessages: [],
    });

  // Recoil states
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentUnreadChatMessages, setCurrentUnreadChatMessages] =
    useRecoilState(currentUnreadChatMessagesState);

  const [sidebarWidth, setSidebarWidth] = useState(900);
  const [isResizing, setIsResizing] = useState(false);

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
    const cachedCandidates = cacheUtils.getCache(CACHE_KEYS.CHATS_DATA);
    const cachedJobs = cacheUtils.getCache(CACHE_KEYS.JOBS_DATA);

    if (isDefined(cachedCandidates) && isDefined(cachedJobs)) {
      setCandidates(cachedCandidates);
      setJobs(cachedJobs);
      // Calculate unread messages from cache
      const unreadMessagesList =
        getUnreadMessageListManyCandidates(cachedCandidates);
      setUnreadMessages(unreadMessagesList);
      setCurrentUnreadChatMessages(
        unreadMessagesList?.listOfUnreadMessages?.length,
      );
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
          ?.filter(
            (edge) =>
              edge?.node?.whatsappDeliveryStatus === 'receivedFromCandidate',
          )
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

  const fetchData = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoadingState(LoadingStates.LOADING_API);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

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

      // Update cache before state to ensure smooth loading
      cacheUtils.setCache(CACHE_KEYS.CHATS_DATA, availableCandidates);
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
    }
  };

  // useEffect(() => {
  //   console.log('Current unreadMessages state:', unreadMessages);
  // }, [unreadMessages]);

  useEffect(() => {
    const initializeData = async () => {
      const hasCachedData = loadFromCache();
      if (!hasCachedData) {
        await fetchData(true);
      } else {
        // Even if we have cache, fetch fresh data in the background
        fetchData(false);
      }
    };

    initializeData();
    const interval = setInterval(() => fetchData(false), 100000);
    return () => clearInterval(interval);
  }, []);

  const updateUnreadMessagesStatus = async (selectedIndividual: string) => {
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

  if (
    loadingState === LoadingStates.INITIAL ||
    loadingState === LoadingStates.LOADING_CACHE
  ) {
    return <Loader />;
  }

  if (loadingState === LoadingStates.LOADING_API && candidates.length === 0) {
    return <Loader />;
  }

  if (loadingState === LoadingStates.ERROR && candidates.length === 0) {
    return <div style={{ marginLeft: '10px' }}>No chats found.</div>;
  }

  return (
    <StyledChatContainer
      onMouseMove={(e) => isResizing ? resize(e as unknown as MouseEvent) : undefined}
      onMouseUp={stopResizing}
      onMouseLeave={stopResizing}
    >
      {loadingState === LoadingStates.LOADING_API && !isMobile && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
          }}
        >
          <Loader />
        </div>
      )}

      <ChatSidebar
        candidates={candidates}
        selectedCandidate={selectedCandidate}
        setSelectedCandidate={setSelectedCandidate}
        unreadMessages={unreadMessages}
        jobs={jobs}
        isRefreshing={isRefreshing}
        width={sidebarWidth}
        onCandidateSelect={onCandidateSelect || (() => {})}
      />
    </StyledChatContainer>
  );
};
