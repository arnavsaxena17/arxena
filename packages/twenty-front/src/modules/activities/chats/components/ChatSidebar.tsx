import React, { useState, useEffect, useRef } from "react";
import * as frontChatTypes from "../types/front-chat-types";
import ChatTile from "./ChatTile";
import styled from "@emotion/styled";
import { useNavigate } from 'react-router-dom';

import SearchBox from "./SearchBox";
import JobDropdown from "./JobDropdown";

import { Job } from "../types/front-chat-types";

const StyledSidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 20vw;
  height: 100%;
  overflow-y: auto;
`;


interface ChatSidebarProps {
  individuals: frontChatTypes.PersonNode[];
  selectedIndividual: string;
  setSelectedIndividual: (id: string) => void;
  unreadMessages: frontChatTypes.UnreadMessageListManyCandidates;
  jobs: Job[];
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  individuals,
  selectedIndividual,
  setSelectedIndividual,
  unreadMessages,
  jobs,
}) => {

  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState("");

  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleIndividualSelect = (id: string) => {
    setSelectedIndividual(id);
    const individual = individuals.find(ind => ind.id === id);
    const candidateId = individual?.candidates?.edges[0]?.node?.id;
    if (candidateId) {
      navigate(`/chats/${candidateId}`);
    }
  };


  useEffect(() => {
    console.log("Jobs received in ChatSidebar:", jobs); // Debug log
  }, [jobs]);

  useEffect(() => {
    // Function to handle clicks outside the sidebar
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        // If the click is outside the sidebar, clear the search query
        setSearchQuery("");
      }
    };

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Remove event listener on cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const filteredIndividuals = individuals.filter((individual) => {
    const matchesSearch = 
      individual?.name?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (individual?.name?.firstName?.toLowerCase() + " " + individual?.name?.lastName?.toLowerCase()).includes(searchQuery.toLowerCase()) ||
      individual?.name?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesJob = 
      selectedJob === "" || 
      individual?.candidates?.edges[0]?.node?.jobs?.id === selectedJob;
    return matchesSearch && matchesJob;
  });
  

  // const sortedIndividuals = filteredIndividuals.sort((a, b) => {
  //   const aLastMessageTimestamp = a.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt || '';
  //   const bLastMessageTimestamp = b.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt || '';
    
  //   // Convert timestamps to Date objects for comparison
  //   const aDate = new Date(aLastMessageTimestamp);
  //   const bDate = new Date(bLastMessageTimestamp);
    
  //   // Sort in descending order (most recent first)
  //   return bDate.getTime() - aDate.getTime();
  // });



    const sortedIndividuals = filteredIndividuals.sort((a, b) => {
      // Function to get the latest message timestamp from an individual's whatsappMessages edges
      const getLastMessageTimestamp = (individual: frontChatTypes.PersonNode) => {
        const messagesEdges = individual.candidates?.edges[0]?.node?.whatsappMessages?.edges || [];
        
        // Find the most recent message
        const latestMessage = messagesEdges.reduce((latest, edge) => {
          const messageTimestamp = edge.node?.createdAt || '';
          const messageDate = new Date(messageTimestamp);
    
          // Check if this message is more recent than the current latest
          return messageDate > latest ? messageDate : latest;
        }, new Date(0)); // Initialize with the oldest possible date
    
        return latestMessage;
      };
    
      // Get the latest message timestamps for both individuals
      const aDate = getLastMessageTimestamp(a);
      const bDate = getLastMessageTimestamp(b);
    
      // Sort in descending order (most recent first)
      return bDate.getTime() - aDate.getTime();
    });
  

  console.log("Sorted individuals:", sortedIndividuals); // Debug log
  
  return (
    <StyledSidebarContainer ref={sidebarRef}>
      <JobDropdown 
        jobs={jobs} 
        selectedJob={selectedJob} 
        onJobChange={setSelectedJob} 
      />
      <SearchBox
        placeholder="Search chats"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {sortedIndividuals.map((individual) => (
        <ChatTile
          key={individual.id}
          id={individual.id}
          individual={individual}
          setSelectedIndividual={handleIndividualSelect}
          selectedIndividual={selectedIndividual}
          unreadMessagesCount={
            unreadMessages.listOfUnreadMessages
              ?.filter((unread) => unread.candidateId === individual.candidates?.edges[0]?.node?.id)
              [0]?.ManyUnreadMessages.length || 0
          }
        />
      ))}
    </StyledSidebarContainer>
  );
};

export default ChatSidebar;