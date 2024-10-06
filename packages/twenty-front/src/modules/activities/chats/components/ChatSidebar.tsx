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
  background-color: #f5f5f5;
  border-right: 1px solid #e0e0e0;
`;

const StyledDropdownContainer = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
`;

const StyledSelect = styled.select`
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: white;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  outline: none;
  transition: border-color 0.3s;

  &:hover, &:focus {
    border-color: #007bff;
  }
`;

const StyledSearchBox = styled(SearchBox)`
  margin: 10px;
`;

interface ChatSidebarProps {
  individuals: frontChatTypes.PersonNode[];
  selectedIndividual: string;
  setSelectedIndividual: (id: string) => void;
  unreadMessages: frontChatTypes.UnreadMessageListManyCandidates;
  jobs: Job[];
}

const statusLabels: { [key: string]: string } = {
  "NOT_INTERESTED": "Not Interested",
  "INTERESTED": "Interested",
  "CV_RECEIVED": "CV Received",
  "NOT_FIT": "Not Fit",
  "SCREENING": "Screening",
  "RECRUITER_INTERVIEW": "Recruiter Interview",
  "CV_SENT": "CV Sent",
  "CLIENT_INTERVIEW": "Client Interview",
  "NEGOTIATION": "Negotiation"
};

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
  const [selectedStatus, setSelectedStatus] = useState("");

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
    console.log("Jobs received in ChatSidebar:", jobs);
  }, [jobs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

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
      individual?.phone?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.id?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.status?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      individual?.id?.toLowerCase()?.includes(searchQuery.toLowerCase());

    const matchesJob = 
      selectedJob === "" || 
      individual?.candidates?.edges[0]?.node?.jobs?.id === selectedJob;

    const matchesStatus =
      selectedStatus === "" ||
      individual?.candidates?.edges[0]?.node?.status === selectedStatus;

    return matchesSearch && matchesJob && matchesStatus;
  });

  const sortedIndividuals = filteredIndividuals.sort((a, b) => {
    const getLastMessageTimestamp = (individual: frontChatTypes.PersonNode) => {
      const messagesEdges = individual.candidates?.edges[0]?.node?.whatsappMessages?.edges || [];
      
      const latestMessage = messagesEdges.reduce((latest, edge) => {
        const messageTimestamp = edge.node?.createdAt || '';
        const messageDate = new Date(messageTimestamp);
  
        return messageDate > latest ? messageDate : latest;
      }, new Date(0));
  
      return latestMessage;
    };
  
    const aDate = getLastMessageTimestamp(a);
    const bDate = getLastMessageTimestamp(b);
  
    return bDate.getTime() - aDate.getTime();
  });

  console.log("Sorted individuals:", sortedIndividuals);
  
  return (
    <StyledSidebarContainer ref={sidebarRef}>
      <StyledDropdownContainer>
        <StyledSelect
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
        >
          <option value="">All Jobs</option>
          {jobs.map((job) => (
            <option key={job.node.id} value={job.node.id}>
              {job.node.name}
            </option>
          ))}
        </StyledSelect>
        <StyledSelect
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </StyledSelect>
      </StyledDropdownContainer>
      <StyledSearchBox
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