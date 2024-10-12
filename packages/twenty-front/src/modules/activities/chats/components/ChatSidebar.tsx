import React, { useState, useEffect, useRef, useMemo } from "react";
import * as frontChatTypes from "../types/front-chat-types";
import ChatTile from "./ChatTile";
import styled from "@emotion/styled";
import { useNavigate } from 'react-router-dom';
import ChatTable from "./ChatTable";
import SearchBox from "./SearchBox";


import { Job } from "../types/front-chat-types";

const StyledSidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 20vw;
  height: 100%;
  background-color: #f5f5f5;
  border-right: 1px solid #e0e0e0;
`;

const StyledDropdownContainer = styled.div`
  display: flex;
  padding: 10px;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  overflow: hidden; // Hide overflow on the container

`;

const ScrollableContent = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: auto;

`;

const FixedHeader = styled.div`
  position: sticky;
  top: 0;
  background-color: #f5f5f5;
  z-index:2;
`;


const DropdownContainer = styled.div`
  // position: relative;
  margin-right: 10px;
`;

const DropdownButton = styled.button`
  padding: 8px 12px;
  background-color: #ffffff;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  min-width: 150px;
  text-align: left;
  z-index: 1;

  &:hover {
    background-color: #f0f0f0;
  }
`;

const DropdownContent = styled.div<{ isOpen: boolean }>`
  display: ${props => props.isOpen ? 'block' : 'none'};
  position: absolute;
  background-color: #f9f9f9;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
`;

const CheckboxLabel = styled.label`
  display: block;
  padding: 8px 12px;
  cursor: pointer;

  &:hover {
    background-color: #f0f0f0;
  }
`;

const Checkbox = styled.input`
  margin-right: 8px;
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
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);


  const sidebarRef = useRef<HTMLDivElement>(null);
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);


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

      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setIsJobDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const filteredIndividuals = individuals.filter((individual) => {
    const messagesList = individual.candidates?.edges[0]?.node?.whatsappMessages?.edges.map(x => x.node.message) || [];
    const matchesSearch = 
      individual?.name?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (individual?.name?.firstName?.toLowerCase() + " " + individual?.name?.lastName?.toLowerCase()).includes(searchQuery.toLowerCase()) ||
      individual?.name?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      individual?.phone?.toLowerCase()?.includes(searchQuery?.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.id?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      individual?.candidates?.edges[0]?.node?.status?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      individual?.id?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      messagesList.some(message => message.toLowerCase().includes(searchQuery.toLowerCase()))


    const matchesJob = 
      selectedJobs.length === 0 || 
      selectedJobs.includes(individual?.candidates?.edges[0]?.node?.jobs?.id || "");

    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(individual?.candidates?.edges[0]?.node?.status || "");


    return matchesSearch && matchesJob;
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



  const handleJobToggle = (jobId: string) => {
    setSelectedJobs(prev =>
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };


  const jobCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredIndividuals.forEach((individual) => {
      const jobId = individual?.candidates?.edges[0]?.node?.jobs?.id;
      if (jobId) {
        counts[jobId] = (counts[jobId] || 0) + 1;
      }
    });
    return counts;
  }, [filteredIndividuals]);

  const statusCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredIndividuals.forEach((individual) => {
      const status = individual?.candidates?.edges[0]?.node?.status;
      if (status) {
        counts[status] = (counts[status] || 0) + 1;
      }
    });
    return counts;
  }, [filteredIndividuals]);


  console.log("Sorted individuals:", sortedIndividuals);
  
  return (
    <StyledSidebarContainer ref={sidebarRef}>
    <FixedHeader>
      <StyledDropdownContainer>
      <DropdownContainer ref={jobDropdownRef}>
          <DropdownButton onClick={() => setIsJobDropdownOpen(!isJobDropdownOpen)}>
            {selectedJobs.length > 0 ? `${selectedJobs.length} Jobs Selected` : 'All Jobs'}
          </DropdownButton>
          <DropdownContent isOpen={isJobDropdownOpen}>
              {jobs.map((job) => (
                <CheckboxLabel key={job.node.id}>
                  <Checkbox 
                    type="checkbox" 
                    checked={selectedJobs.includes(job.node.id)} 
                    onChange={() => handleJobToggle(job.node.id)} 
                  /> 
                  {job.node.name} ({jobCounts[job.node.id] || 0})
                </CheckboxLabel>
              ))}
            </DropdownContent>
        </DropdownContainer>
        <DropdownContainer ref={statusDropdownRef}>
          <DropdownButton onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}>
            {selectedStatuses.length > 0 ? `${selectedStatuses.length} Statuses Selected` : 'All Statuses'}
          </DropdownButton>
          <DropdownContent isOpen={isStatusDropdownOpen}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <CheckboxLabel key={value}>
                  <Checkbox 
                    type="checkbox" 
                    checked={selectedStatuses.includes(value)} 
                    onChange={() => handleStatusToggle(value)} 
                  /> 
                  {label} ({statusCounts[value] || 0})
                </CheckboxLabel>
              ))}
          </DropdownContent>
        </DropdownContainer>
      </StyledDropdownContainer>
      <StyledSearchBox placeholder="Search chats" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </FixedHeader>
      <ScrollableContent>
      <ChatTable individuals={sortedIndividuals} selectedIndividual={selectedIndividual} onIndividualSelect={handleIndividualSelect} />
      </ScrollableContent>
    </StyledSidebarContainer>
  );
};

export default ChatSidebar;