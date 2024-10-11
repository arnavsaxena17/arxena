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

const StyledTable = styled.table`
  width: max-content;
  border-collapse: collapse;
`;

const StyledTableCell = styled.td`
  padding: 10px;
  border-bottom: 1px solid #e0e0e0;
  white-space: nowrap;
`;


const StyledTableHeaderCell = styled.th`
  padding: 10px;
  text-align: left;
  white-space: nowrap;`
  ;

const StyledTableBody = styled.div`
  display: table-row-group;
    background-color: #ffffff;
`;

const StyledTableHeader = styled.thead`
  position: sticky;
  top: 0;
  background-color: #f0f0f0;
  z-index: 1;
`;

const StyledTableRow = styled.tr<{ $selected: boolean }>`
  background-color: ${(props) => (props.$selected ? "#f5f9fd" : "white")};
  cursor: pointer;
  &:hover {
    background-color: ${(props) => (props.$selected ? "#f5f9fd" : "#f0f0f0")};
  }
`;



const StyledMultiSelect = styled.select`
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
  height: auto;
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

const StyledTopBarSideBar = styled.div`
  position: fixed;
  display: flex;
`

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


    // const matchesJob = 
    //   selectedJob === "" || 
    //   individual?.candidates?.edges[0]?.node?.jobs?.id === selectedJob;

    // const matchesStatus =
    //   selectedStatus === "" ||
    //   individual?.candidates?.edges[0]?.node?.status === selectedStatus;


    const matchesJob = 
      selectedJobs.length === 0 || 
      selectedJobs.includes(individual?.candidates?.edges[0]?.node?.jobs?.id || "");

    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(individual?.candidates?.edges[0]?.node?.status || "");
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


  const handleJobChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
    setSelectedJobs(selectedOptions);
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
    setSelectedStatuses(selectedOptions);
  };

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
                <Checkbox type="checkbox" checked={selectedJobs.includes(job.node.id)} onChange={() => handleJobToggle(job.node.id)} /> {job.node.name}
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
                <Checkbox type="checkbox" checked={selectedStatuses.includes(value)} onChange={() => handleStatusToggle(value)} /> {label}
              </CheckboxLabel>
            ))}
          </DropdownContent>
        </DropdownContainer>
      </StyledDropdownContainer>
      <StyledSearchBox placeholder="Search chats" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </FixedHeader>
      <ScrollableContent>
        <StyledTable>
        <StyledTableHeader>
              <StyledTableHeaderCell>Name</StyledTableHeaderCell>
              <StyledTableHeaderCell>Salary</StyledTableHeaderCell>
              <StyledTableHeaderCell>City</StyledTableHeaderCell>
              <StyledTableHeaderCell>Status</StyledTableHeaderCell>
              <StyledTableHeaderCell>Job Title</StyledTableHeaderCell>
              <StyledTableHeaderCell>Job Title</StyledTableHeaderCell>
              <StyledTableHeaderCell>Job Title</StyledTableHeaderCell>
              <StyledTableHeaderCell>Job Title</StyledTableHeaderCell>
              <StyledTableHeaderCell>Job Title</StyledTableHeaderCell>
            </StyledTableHeader>
        </StyledTable>
        <StyledTable>
          <StyledTableBody>
            {sortedIndividuals.map((individual) => (
              <StyledTableRow key={individual.id} $selected={selectedIndividual === individual.id} onClick={() => handleIndividualSelect(individual.id)} >
                <StyledTableCell>{`${individual.name.firstName} ${individual.name.lastName}`}</StyledTableCell>
                <StyledTableCell>{individual.salary || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.city || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.candidates?.edges[0]?.node?.status || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
              </StyledTableRow>
            ))}
          </StyledTableBody>
        </StyledTable>
      </ScrollableContent>
    </StyledSidebarContainer>
  );
};

export default ChatSidebar;