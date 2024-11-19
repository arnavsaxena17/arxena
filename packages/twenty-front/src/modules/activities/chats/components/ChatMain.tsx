import React, { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import axios from 'axios';
import styled from '@emotion/styled';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { currentUnreadChatMessagesState } from '@/activities/chats/states/currentUnreadChatMessagesState';
import ChatWindow from './ChatWindow';
import ChatSidebar from './ChatSidebar';
import * as frontChatTypes from '../types/front-chat-types';
import { Job } from '../types/front-chat-types';
import { cacheUtils, CACHE_KEYS } from '../utils/cacheUtils';

interface ChatMainProps {
  initialCandidateId?: string;
}

const ChatContainer = styled.div`
  display: flex;
  height: 100vh;
`;

const SidebarContainer = styled.div`
  overflow-x: auto;
  display: flex;
  height: 100vh;
`;

const ChatWindowContainer = styled.div`
  z-index: 1;
`;

const SpinnerContainer = styled.div`
  width: 48px;
  height: 48px;
  position: relative;
`;

const Spinner = styled.div`
  width: 100%;
  height: 100%;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingStates = {
  INITIAL: 'initial',
  LOADING_CACHE: 'loading_cache',
  LOADING_API: 'loading_api',
  READY: 'ready',
  ERROR: 'error'
};


export default function ChatMain({ initialCandidateId }: ChatMainProps) {
  // States
  // const [individuals, setIndividuals] = useState<frontChatTypes.PersonNode[]>(() => 
  //   cacheUtils.getCache(CACHE_KEYS.CHATS_DATA) || []
  // );
  const [individuals, setIndividuals] = useState([]);

  const [loadingState, setLoadingState] = useState(LoadingStates.INITIAL);

  const [selectedIndividual, setSelectedIndividual] = useState<string>('');
  const [isLoading, setIsLoading] = useState(individuals.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState([]);

  const [unreadMessages, setUnreadMessages] = useState<frontChatTypes.UnreadMessageListManyCandidates>({
    listOfUnreadMessages: [],
  });

  // Recoil states
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentUnreadMessages, setCurrentUnreadMessages] = useRecoilState(currentUnreadChatMessagesState);



  const loadFromCache = () => {
    setLoadingState(LoadingStates.LOADING_CACHE);
    const cachedIndividuals = cacheUtils.getCache(CACHE_KEYS.CHATS_DATA);
    const cachedJobs = cacheUtils.getCache(CACHE_KEYS.JOBS_DATA);
    
    if (cachedIndividuals && cachedJobs) {
      setIndividuals(cachedIndividuals);
      setJobs(cachedJobs);
      // Calculate unread messages from cache
      const unreadMessagesList = getUnreadMessageListManyCandidates(cachedIndividuals);
      setUnreadMessages(unreadMessagesList);
      setCurrentUnreadMessages(unreadMessagesList?.listOfUnreadMessages?.length);
      setLoadingState(LoadingStates.READY);
      return true;
    }
    return false;
  };



  // Functions
  const getUnreadMessageListManyCandidates = (personNodes: frontChatTypes.PersonNode[]): frontChatTypes.UnreadMessageListManyCandidates => {
    const listOfUnreadMessages: frontChatTypes.UnreadMessagesPerOneCandidate[] = [];
    personNodes?.forEach((personNode: frontChatTypes.PersonNode) => {
      personNode?.candidates?.edges?.forEach((candidateEdge: frontChatTypes.CandidatesEdge) => {
        const candidateNode: frontChatTypes.CandidateNode = candidateEdge?.node;
        const ManyUnreadMessages: frontChatTypes.OneUnreadMessage[] = candidateNode?.whatsappMessages?.edges
          ?.filter((edge) => edge?.node?.whatsappDeliveryStatus === 'receivedFromCandidate')
          ?.map((edge): frontChatTypes.OneUnreadMessage => ({
            message: edge?.node?.message,
            id: edge?.node?.id,
            whatsappDeliveryStatus: edge?.node?.whatsappDeliveryStatus,
          }));
        if (ManyUnreadMessages?.length > 0) {
          listOfUnreadMessages?.push({
            candidateId: candidateNode.id,
            ManyUnreadMessages,
          });
        }
      });
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
        axios.get(`${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-candidates-and-chats`, {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        }),
        axios.post(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-jobs`, {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        }),
      ]);

      const availablePeople = peopleResponse.data.filter(
        (person:frontChatTypes.PersonNode) => person?.candidates?.edges?.length > 0 && person?.candidates?.edges[0].node.startChat
      );

      // Update cache before state to ensure smooth loading
      cacheUtils.setCache(CACHE_KEYS.CHATS_DATA, availablePeople);
      cacheUtils.setCache(CACHE_KEYS.JOBS_DATA, jobsResponse.data.jobs);

      setIndividuals(availablePeople);
      setJobs(jobsResponse.data.jobs);

      const unreadMessagesList = getUnreadMessageListManyCandidates(availablePeople);
      setCurrentUnreadMessages(unreadMessagesList?.listOfUnreadMessages?.length);
      setUnreadMessages(unreadMessagesList);

      if (selectedIndividual) {
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
      ?.find(unreadMessage => 
        unreadMessage?.candidateId === (individuals
          ?.find((individual: frontChatTypes.PersonNode) => individual?.id === selectedIndividual) as unknown as frontChatTypes.PersonNode)
          ?.candidates?.edges?.[0]?.node?.id
      )
      ?.ManyUnreadMessages?.map(message => message.id);

    if (!listOfMessagesIds?.length) return;

    await axios.post(
      `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/update-whatsapp-delivery-status`,
      { listOfMessagesIds },
      { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
    );
  };

  // Effects
  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialCandidateId && individuals.length > 0) {
      const individual = individuals.find((ind: frontChatTypes.PersonNode) => 
        ind.candidates?.edges[0]?.node?.id === initialCandidateId
      );
      if (individual) {
        setSelectedIndividual((individual as frontChatTypes.PersonNode).id);
      }
    }
  }, [initialCandidateId, individuals]);

  useEffect(() => {
    updateUnreadMessagesStatus(selectedIndividual);
  }, [selectedIndividual]);

  if (isLoading && individuals.length === 0) {
    return (
      // <SpinnerContainer>
        <Spinner />
      // </SpinnerContainer>
    );
  }


    if (loadingState === LoadingStates.INITIAL || loadingState === LoadingStates.LOADING_CACHE) {
      return <Spinner />;
    }

    if (loadingState === LoadingStates.LOADING_API && individuals.length === 0) {
      return <Spinner />;
    }

    if (loadingState === LoadingStates.ERROR && individuals.length === 0) {
      return <div>Error loading chats. Please try again.</div>;
    }



  return (
    <ChatContainer>
      <SidebarContainer>
        <ChatSidebar 
          individuals={individuals} 
          selectedIndividual={selectedIndividual} 
          setSelectedIndividual={setSelectedIndividual} 
          unreadMessages={unreadMessages} 
          jobs={jobs}
          isRefreshing={isRefreshing} 
        />
      </SidebarContainer>
      <ChatWindowContainer>
        <ChatWindow 
          selectedIndividual={selectedIndividual} 
          individuals={individuals} 
          onMessageSent={fetchData}
        />
      </ChatWindowContainer>
    </ChatContainer>
  );
}