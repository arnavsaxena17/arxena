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
  CandidatesEdge,
  JobNode,
  OneUnreadMessage,
  PersonNode,
  UnreadMessageListManyCandidates,
  UnreadMessagesPerOneCandidate,
  isDefined
} from 'twenty-shared';
import { CACHE_KEYS, cacheUtils } from '../utils/cacheUtils';
import ChatSidebar from './ChatSidebar';

interface ChatMainProps {
  initialCandidateId?: string;
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

const StyledSpinner = styled.div`
  width: 100%;
  height: 100%;
  border: 4px solid ${({ theme }) => theme.border.color.light};
  border-top: 4px solid ${({ theme }) => theme.border.color.light};
  border-radius: 50%;
  animation: spin 1s linear infinite;
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

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

export const ChatMain = ({ initialCandidateId }: ChatMainProps) => {
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const currentUser = useRecoilValue(currentUserState);
  // const userEmail = currentUser?.email;

  console.log('This is the currentWorkspaceMember:', currentWorkspaceMember);
  console.log('This is the currentWorkspace:', currentWorkspace);
  console.log('This is the currentUser:', currentUser);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const [individuals, setIndividuals] = useState<PersonNode[]>([]);

  const [loadingState, setLoadingState] = useState(LoadingStates.INITIAL);

  const [selectedIndividual, setSelectedIndividual] = useState<string>('');
  const [isLoading, setIsLoading] = useState(individuals.length === 0);
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
    const cachedIndividuals = cacheUtils.getCache(CACHE_KEYS.CHATS_DATA);
    const cachedJobs = cacheUtils.getCache(CACHE_KEYS.JOBS_DATA);

    if (isDefined(cachedIndividuals) && isDefined(cachedJobs)) {
      setIndividuals(cachedIndividuals);
      setJobs(cachedJobs);
      // Calculate unread messages from cache
      const unreadMessagesList =
        getUnreadMessageListManyCandidates(cachedIndividuals);
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
    personNodes: PersonNode[],
  ): UnreadMessageListManyCandidates => {
    const listOfUnreadMessages: UnreadMessagesPerOneCandidate[] = [];
    personNodes?.forEach((personNode: PersonNode) => {
      personNode?.candidates?.edges?.forEach(
        (candidateEdge: CandidatesEdge) => {
          const candidateNode: CandidateNode = candidateEdge?.node;
          const ManyUnreadMessages: OneUnreadMessage[] =
            candidateNode?.whatsappMessages?.edges
              ?.filter(
                (edge) =>
                  edge?.node?.whatsappDeliveryStatus ===
                  'receivedFromCandidate',
              )
              ?.map(
                (edge): OneUnreadMessage => ({
                  message: edge?.node?.message,
                  id: edge?.node?.id,
                  whatsappDeliveryStatus: edge?.node?.whatsappDeliveryStatus,
                }),
              );
          if (ManyUnreadMessages?.length > 0) {
            listOfUnreadMessages?.push({
              candidateId: candidateNode.id,
              ManyUnreadMessages,
            });
          }
        },
      );
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

      const [peopleResponse, jobsResponse] = await Promise.all([
        axios.get(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-candidates-and-chats`,
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

      const availablePeople = peopleResponse.data.filter(
        (person: PersonNode) =>
          person?.candidates?.edges?.length > 0 &&
          person?.candidates?.edges[0].node.startChat,
      );

      // Update cache before state to ensure smooth loading
      cacheUtils.setCache(CACHE_KEYS.CHATS_DATA, availablePeople);
      cacheUtils.setCache(CACHE_KEYS.JOBS_DATA, jobsResponse.data.jobs);

      setIndividuals(availablePeople);
      setJobs(jobsResponse.data.jobs);

      const unreadMessagesList =
        getUnreadMessageListManyCandidates(availablePeople);
      setCurrentUnreadChatMessages(
        unreadMessagesList?.listOfUnreadMessages?.length,
      );
      setUnreadMessages(unreadMessagesList);

      if (isDefined(selectedIndividual)) {
        updateUnreadMessagesStatus(selectedIndividual);
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

  useEffect(() => {
    console.log('Current unreadMessages state:', unreadMessages);
  }, [unreadMessages]);

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
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const updateUnreadMessagesStatus = async (selectedIndividual: string) => {
    const listOfMessagesIds = unreadMessages?.listOfUnreadMessages
      ?.find(
        (unreadMessage) =>
          unreadMessage?.candidateId ===
          (
            individuals?.find(
              (individual: PersonNode) => individual?.id === selectedIndividual,
            ) as unknown as PersonNode
          )?.candidates?.edges?.[0]?.node?.id,
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
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isDefined(initialCandidateId) && individuals.length > 0) {
      const individual = individuals.find(
        (ind: PersonNode) =>
          ind.candidates?.edges[0]?.node?.id === initialCandidateId,
      );
      if (isDefined(individual)) {
        setSelectedIndividual((individual as unknown as PersonNode).id);
      }
    }
  }, [initialCandidateId, individuals]);

  useEffect(() => {
    if (selectedIndividual) {
      updateUnreadMessagesStatus(selectedIndividual);
    }
  }, [selectedIndividual]);

  const handleIndividualSelect = (id: string) => {
    setSelectedIndividual(id);
  };


  if (
    loadingState === LoadingStates.INITIAL ||
    loadingState === LoadingStates.LOADING_CACHE
  ) {
    return <StyledSpinner />;
  }

  if (loadingState === LoadingStates.LOADING_API && individuals.length === 0) {
    return <StyledSpinner />;
  }

  if (loadingState === LoadingStates.ERROR && individuals.length === 0) {
    return <div style={{ marginLeft: '10px' }}>No chats found.</div>;
  }

  return (
    <ChatSidebar
      individuals={individuals}
      selectedIndividual={selectedIndividual}
      setSelectedIndividual={handleIndividualSelect}
      unreadMessages={unreadMessages}
      jobs={jobs}
      isRefreshing={isRefreshing}
      width={sidebarWidth}
    />
  );
};
