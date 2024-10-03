import React, { useEffect, useRef, useState } from 'react';
import { useChats } from '../hooks/useChats';
import axios from 'axios';
import { useFindManyPeople } from '../hooks/useFindManyPeople';

import * as frontChatTypes from '../types/front-chat-types';
import ChatWindow from './ChatWindow';
import { useRecoilState, useRecoilValue } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import ChatSidebar from './ChatSidebar';
import { currentUnreadMessagesState } from '@/activities/chats/states/currentUnreadMessagesState';

import { Job } from "../types/front-chat-types";



export default function ChatMain() {

  const [inputMessage, setInputMessage] = useState('');
  const [selectedIndividual, setSelectedIndividual] = useState<string>('');
  const [individuals, setIndividuals] = useState<frontChatTypes.PersonNode[]>([]);

  const [unreadMessages, setUnreadMessages] = useState<frontChatTypes.UnreadMessageListManyCandidates>({
    listOfUnreadMessages: [],
  });



  const inputRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);


  const [tokenPair] = useRecoilState(tokenPairState);

  const [currentUnreadMessages, setCurrentUnreadMessages] = useRecoilState(currentUnreadMessagesState);

  const handleSubmit = () => {
    console.log('submit');
    // console.log(inputRef?.current?.value);
  };
  const variable = useChats();
  const variable2 = useFindManyPeople();


  function getUnreadMessageListManyCandidates(personNodes: frontChatTypes.PersonNode[]): frontChatTypes.UnreadMessageListManyCandidates {
    const listOfUnreadMessages: frontChatTypes.UnreadMessagesPerOneCandidate[] = [];
    personNodes?.forEach((personNode: frontChatTypes.PersonNode) => {
      // const personNode: frontChatTypes.PersonNode = personNode;
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
    //! Change later: Fetch data every 5 seconds
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
      {
        listOfMessagesIds: listOfMessagesIds,
      },
      {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
        },
      },
    );
  };

  useEffect(() => {
    console.log('selectedindividuals', selectedIndividual);
    updateUnreadMessagesStatus(selectedIndividual);
  }, [selectedIndividual, individuals]);

  return (
    <>
      <div>
        <div>
          <div style={{ display: 'flex' }}>
            <ChatSidebar individuals={individuals} selectedIndividual={selectedIndividual} setSelectedIndividual={setSelectedIndividual} unreadMessages={unreadMessages} jobs={jobs}
            />
            <div>
              <ChatWindow selectedIndividual={selectedIndividual} individuals={individuals} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
