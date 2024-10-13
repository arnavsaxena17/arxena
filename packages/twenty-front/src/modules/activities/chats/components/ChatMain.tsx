import React, { useEffect, useRef, useState } from 'react';
import { useChats } from '../hooks/useChats';
import axios from 'axios';
import { useFindManyPeople } from '../hooks/useFindManyPeople';
import * as frontChatTypes from '../types/front-chat-types';
import ChatWindow from './ChatWindow';
import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import ChatSidebar from './ChatSidebar';
import { currentUnreadChatMessagesState } from '@/activities/chats/states/currentUnreadChatMessagesState';
import { Job } from "../types/front-chat-types";



interface ChatMainProps {
  initialCandidateId?: string;
}
const ChatContainer = styled.div`
display: flex;
height: 100vh;
`;

const SidebarContainer = styled.div`
// width: 50%;
overflow-x: auto;
display: flex;
height: 100vh;

`;

const ChatWindowContainer = styled.div`
// width: 120%;
z-index: 1;
`;


export default function ChatMain({ initialCandidateId }: ChatMainProps) {

  const [inputMessage, setInputMessage] = useState('');
  const [selectedIndividual, setSelectedIndividual] = useState<string>('');
  const [individuals, setIndividuals] = useState<frontChatTypes.PersonNode[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<frontChatTypes.UnreadMessageListManyCandidates>({
    listOfUnreadMessages: [],
  });

  useEffect(() => {
    if (initialCandidateId && individuals.length > 0) {
      const individual = individuals.find(ind => ind.candidates?.edges[0]?.node?.id === initialCandidateId);
      if (individual) {
        setSelectedIndividual(individual.id);
      }
    }
  }, [initialCandidateId, individuals]);


  const inputRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);


  const [tokenPair] = useRecoilState(tokenPairState);

  const [currentUnreadMessages, setCurrentUnreadMessages] = useRecoilState(currentUnreadChatMessagesState);

  const handleSubmit = () => {
    console.log('submit');
  };

  const variable = useChats();
  const variable2 = useFindManyPeople();

  function getUnreadMessageListManyCandidates(personNodes: frontChatTypes.PersonNode[]): frontChatTypes.UnreadMessageListManyCandidates {
    const listOfUnreadMessages: frontChatTypes.UnreadMessagesPerOneCandidate[] = [];
    personNodes?.forEach((personNode: frontChatTypes.PersonNode) => {
      personNode?.candidates?.edges?.forEach((candidateEdge: frontChatTypes.CandidatesEdge) => {
        const candidateNode: frontChatTypes.CandidateNode = candidateEdge?.node;
        const ManyUnreadMessages: frontChatTypes.OneUnreadMessage[] = candidateNode?.whatsappMessages?.edges
          ?.map((whatsappMessagesEdge: frontChatTypes.WhatsAppMessagesEdge) => whatsappMessagesEdge?.node)
          ?.filter((messageNode: frontChatTypes.MessageNode) => messageNode?.whatsappDeliveryStatus === 'receivedFromCandidate')
          ?.map(
            (messageNode: frontChatTypes.MessageNode): frontChatTypes.OneUnreadMessage => ({
              message: messageNode?.message,
              id: messageNode?.id,
              whatsappDeliveryStatus: messageNode?.whatsappDeliveryStatus,
            }),
          );
        if (ManyUnreadMessages.length > 0) {
          listOfUnreadMessages?.push({
            candidateId: candidateNode.id,
            ManyUnreadMessages,
          });
        }
      });
    });
    return { listOfUnreadMessages };
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [peopleResponse, jobsResponse] = await Promise.all([
          axios.get(process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/get-candidates-and-chats', {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
          }),
          axios.post(process.env.REACT_APP_SERVER_BASE_URL + '/candidate-sourcing/get-all-jobs', {
            headers: {
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
          })
      ]);
      const availablePeople: frontChatTypes.PersonNode[] = peopleResponse.data.filter((person: frontChatTypes.PersonNode) => person?.candidates?.edges?.length > 0 &&  person?.candidates?.edges[0].node.startChat);
      console.log("All people:", peopleResponse?.data);
      console.log("Available people:", availablePeople);
      setPeople(peopleResponse.data);
      setIndividuals(availablePeople);
      setJobs(jobsResponse.data.jobs);
      console.log(peopleResponse?.data.filter((person: frontChatTypes.PersonNode) => person?.candidates?.edges?.length > 0));
      const unreadMessagesList = getUnreadMessageListManyCandidates(availablePeople);
      console.log(unreadMessagesList);
      setCurrentUnreadMessages(unreadMessagesList?.listOfUnreadMessages?.length);
      console.log('count::::', currentUnreadMessages);
      setUnreadMessages(unreadMessagesList);
      updateUnreadMessagesStatus(selectedIndividual);
    }
    
    catch (error) {
      console.error(error);
    }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);
  console.log("Current jobs in state:", jobs); // Debug log outside useEffect
  const updateUnreadMessagesStatus = async (selectedIndividual: string) => {
    const listOfMessagesIds = unreadMessages?.listOfUnreadMessages
      ?.filter(unreadMessage => unreadMessage?.candidateId === individuals?.filter(individual => individual?.id === selectedIndividual)[0]?.candidates?.edges[0]?.node?.id)[0]
      ?.ManyUnreadMessages?.map(message => message.id);
    if (listOfMessagesIds === undefined) return;
    const response = await axios.post(
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/update-whatsapp-delivery-status',
      { listOfMessagesIds: listOfMessagesIds, },
      { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, }, },
    );
  };
  
  useEffect(() => {
    console.log('selectedindividuals', selectedIndividual);
    updateUnreadMessagesStatus(selectedIndividual);
  }, [selectedIndividual, individuals]);
  
  
  // const { createdActivityInCache } = createActivityInCache({
  //   type:'Note',
  //   targetObject: {"id":"79c22a03-8c19-4fd2-a24b-d63dd8ef3d53", "targetObjectNameSingular": "candidate"},
  // });

  return (
    <ChatContainer>
      <SidebarContainer>
        <ChatSidebar
          individuals={individuals}
          selectedIndividual={selectedIndividual}
          setSelectedIndividual={setSelectedIndividual}
          unreadMessages={unreadMessages}
          jobs={jobs}
        />
      </SidebarContainer>
      <ChatWindowContainer>
        <ChatWindow selectedIndividual={selectedIndividual} individuals={individuals} />
      </ChatWindowContainer>
    </ChatContainer>
  );
}
