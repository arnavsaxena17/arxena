import React, { useState, useEffect } from "react";
import * as frontChatTypes from "../types/front-chat-types";
import ChatTile from "./ChatTile";
import styled from "@emotion/styled";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState("");


  useEffect(() => {
    console.log("Jobs received in ChatSidebar:", jobs); // Debug log
  }, [jobs]);


  const filteredIndividuals = individuals.filter((individual) => {
    const matchesSearch = 
      individual?.name?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.name?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesJob = 
      selectedJob === "" || 
      individual?.candidates?.edges[0]?.node?.jobs?.id === selectedJob;

    return matchesSearch && matchesJob;
  });

  return (
    <StyledSidebarContainer>
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
      {filteredIndividuals.map((individual) => (
        <ChatTile
          key={individual.id}
          id={individual.id}
          individual={individual}
          setSelectedIndividual={setSelectedIndividual}
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