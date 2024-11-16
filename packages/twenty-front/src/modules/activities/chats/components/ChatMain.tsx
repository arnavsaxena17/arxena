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

export default function ChatMain({ initialCandidateId }: ChatMainProps) {
  // States
  const [individuals, setIndividuals] = useState<frontChatTypes.PersonNode[]>(() => 
    cacheUtils.getCache(CACHE_KEYS.CHATS_DATA) || []
  );
  const [selectedIndividual, setSelectedIndividual] = useState<string>('');
  const [isLoading, setIsLoading] = useState(individuals.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>(() => 
    cacheUtils.getCache(CACHE_KEYS.JOBS_DATA) || []
  );
  const [unreadMessages, setUnreadMessages] = useState<frontChatTypes.UnreadMessageListManyCandidates>({
    listOfUnreadMessages: [],
  });

  // Recoil states
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentUnreadMessages, setCurrentUnreadMessages] = useRecoilState(currentUnreadChatMessagesState);

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
        setIsLoading(true);
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
        (person: frontChatTypes.PersonNode) => 
          person?.candidates?.edges?.length > 0 && 
          person?.candidates?.edges[0].node.startChat
      );

      setIndividuals(availablePeople);
      setJobs(jobsResponse.data.jobs);

      cacheUtils.setCache(CACHE_KEYS.CHATS_DATA, availablePeople);
      cacheUtils.setCache(CACHE_KEYS.JOBS_DATA, jobsResponse.data.jobs);

      const unreadMessagesList = getUnreadMessageListManyCandidates(availablePeople);
      setCurrentUnreadMessages(unreadMessagesList?.listOfUnreadMessages?.length);
      setUnreadMessages(unreadMessagesList);

      if (selectedIndividual) {
        updateUnreadMessagesStatus(selectedIndividual);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load chats. Please try again.');
      if (isInitialLoad && individuals.length > 0) {
        setError(null);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const updateUnreadMessagesStatus = async (selectedIndividual: string) => {
    const listOfMessagesIds = unreadMessages?.listOfUnreadMessages
      ?.find(unreadMessage => 
        unreadMessage?.candidateId === individuals
          ?.find(individual => individual?.id === selectedIndividual)
          ?.candidates?.edges[0]?.node?.id
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
      const individual = individuals.find(ind => 
        ind.candidates?.edges[0]?.node?.id === initialCandidateId
      );
      if (individual) {
        setSelectedIndividual(individual.id);
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