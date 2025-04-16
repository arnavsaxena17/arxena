import React, { useEffect, useMemo, useRef, useState } from 'react';

import styled from '@emotion/styled';
import { useNavigate } from 'react-router-dom';
// import * as frontChatTypes from "../types/front-chat-types";
import {
    CandidateNode,
    JobNode,
    UnreadMessageListManyCandidates
} from 'twenty-shared';
import ChatTable from './chat-table/ChatTable';
import SearchBox from './SearchBox';

// import { Job } from "../types/front-chat-types";

const StyledSidebarContainer = styled.div<{ width: number }>`
  background-color: #f5f5f5;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: ${(props) => props.width}px;

  @media (max-width: 768px) {
    width: 30vw;
  }
`;

const StyledDropdownContainer = styled.div`
  display: flex;
  padding: 10px;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  overflow: hidden; // Hide overflow on the container
  overflow-x: auto;
`;

const ScrollableContent = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: auto;
`;

const RefreshIndicator = styled.div<{ isRefreshing: boolean }>`
  height: 2px;
  background-color: black;
  position: absolute;
  top: 30;
  left: 30;
  right: 0;
  transform: scaleX(${(props) => (props.isRefreshing ? 1 : 0)});
  transform-origin: left;
  transition: transform 0.3s ease;
`;

const FixedHeader = styled.div`
  position: sticky;
  top: 0;
  background-color: #f5f5f5;
  z-index: 2;
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
  display: ${(props) => (props.isOpen ? 'block' : 'none')};
  position: absolute;
  background-color: #f9f9f9;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
  left: 0; // Align with the DropdownButton
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
  candidates: CandidateNode[];
  selectedCandidate: string;
  setSelectedCandidate: (id: string) => void;
  unreadMessages: UnreadMessageListManyCandidates;
  jobs: JobNode[];
  isRefreshing?: boolean;
  width: number;
  onCandidateSelect: (id: string) => void;
  refreshData?: () => Promise<void>;
}

const statusLabels: { [key: string]: string } = {
  NOT_INTERESTED: 'Not Interested',
  INTERESTED: 'Interested',
  CV_RECEIVED: 'CV Received',
  NOT_FIT: 'Not Fit',
  SCREENING: 'Screening',
  RECRUITER_INTERVIEW: 'Recruiter Interview',
  CV_SENT: 'CV Sent',
  CLIENT_INTERVIEW: 'Client Interview',
  NEGOTIATION: 'Negotiation',
};

export const chatStatusLabels: { [key: string]: string } = {
  ONLY_ADDED_NO_CONVERSATION: 'Only Added No Conversation',
  CONVERSATION_STARTED_HAS_NOT_RESPONDED:
    'Conversation Started Has Not Responded',
  SHARED_JD_HAS_NOT_RESPONDED: 'Shared JD Has Not Responded',
  CANDIDATE_REFUSES_TO_RELOCATE: 'Candidate Refuses To Relocate',
  CANDIDATE_IS_KEEN_TO_CHAT: 'Candidate Is Keen To Chat',
  CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT:
    'Candidate Has Followed Up To Setup Chat',
  CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION:
    'Candidate Is Reluctant To Discuss Compensation',
  CONVERSATION_CLOSED_TO_BE_CONTACTED: 'Conversation Closed To Be Contacted',
  CANDIDATE_SALARY_OUT_OF_RANGE: 'Candidate Salary Out Of Range',
  CANDIDATE_DECLINED_OPPORTUNITY: 'Candidate Declined Opportunity',
};

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  candidates,
  selectedCandidate,
  setSelectedCandidate,
  unreadMessages,
  jobs,
  isRefreshing = false,
  width,
  onCandidateSelect,
  refreshData,
}) => {
  const navigate = useNavigate();
  // const openCreateActivity = useOpenCreateActivityDrawer();
  // const { openRightDrawer } = useRightDrawer();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedChatStatuses, setSelectedChatStatuses] = useState<string[]>(
    [],
  );
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isChatStatusDropdownOpen, setIsChatStatusDropdownOpen] =
    useState(false);
  // const setViewableRecordId = useSetRecoilState(viewableRecordIdState);
  // const setViewableRecordNameSingular = useSetRecoilState(
  //   viewableRecordNameSingularState,
  // );

  const sidebarRef = useRef<HTMLDivElement>(null);
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const chatStatusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
      //   setSearchQuery("");
      // }

      if (
        jobDropdownRef.current &&
        !jobDropdownRef.current.contains(event.target as Node)
      ) {
        setIsJobDropdownOpen(false);
      }
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStatusDropdownOpen(false);
      }
      if (
        chatStatusDropdownRef.current &&
        !chatStatusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsChatStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredCandidates = candidates.filter((candidate) => {
    const messagesList =
      candidate.whatsappMessages?.edges?.map(
        (x) => x.node.message,
      ) || [];
    const matchesSearch =
      candidate?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (
        candidate?.name?.toLowerCase()
      ).includes(searchQuery.toLowerCase()) ||
      candidate?.name?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      candidate?.email
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      candidate?.phoneNumber
        ?.toLowerCase()
        ?.includes(searchQuery?.toLowerCase()) ||
      candidate?.id
        ?.toLowerCase()
        ?.includes(searchQuery.toLowerCase()) ||
      candidate?.status
        ?.toLowerCase()
        ?.includes(searchQuery.toLowerCase()) ||
      candidate?.id?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
      messagesList.some((message) =>
        message.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesJob =
      selectedJobs.length === 0 ||
      selectedJobs.includes(
        candidate?.jobs?.id || '',
      );

    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(
        candidate?.status || '',
      );

    const matchesChatStatus =
      selectedChatStatuses.length === 0 ||
      selectedChatStatuses.includes(
        candidate?.candConversationStatus || '',
      );

    return matchesSearch && matchesJob && matchesStatus && matchesChatStatus;
  });
  const [manualOrder, setManualOrder] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('chatTableOrder');
    return saved ? JSON.parse(saved) : {};
  });

  // Modified sortedIndividuals to consider manual ordering
  const sortedCandidates = useMemo(() => {
    return filteredCandidates.sort((a, b) => {
      // First check manual ordering
      const orderA = manualOrder[a.id] ?? Number.MAX_SAFE_INTEGER;
      const orderB = manualOrder[b.id] ?? Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // If no manual order or same order, fall back to timestamp sorting
      const getLastMessageTimestamp = (candidate: CandidateNode) => {
        const messagesEdges =
          candidate.whatsappMessages?.edges || [];

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
  }, [filteredCandidates, manualOrder]);

  const handleJobToggle = (jobId: string) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId],
    );
  };

  const handleReorder = (reorderedCandidates: CandidateNode[]) => {
    console.log('Reordered Candidates:', reorderedCandidates);
    // Create new order map
    const newOrder = reorderedCandidates.reduce(
      (acc, candidate, index) => {
        acc[candidate.id] = index;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Save to state and localStorage
    setManualOrder(newOrder);
    localStorage.setItem('chatTableOrder', JSON.stringify(newOrder));
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };
  const handleChatStatusToggle = (status: string) => {
    console.log('Chat Status:', status);
    setSelectedChatStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  const jobCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredCandidates.forEach((candidate) => {
      const jobId = candidate?.jobs?.id;
      if (jobId) {
        counts[jobId] = (counts[jobId] || 0) + 1;
      }
    });
    return counts;
  }, [filteredCandidates]);

  const statusCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredCandidates.forEach((candidate) => {
      const status = candidate?.status;
      if (status) {
        counts[status] = (counts[status] || 0) + 1;
      }
    });
    return counts;
  }, [filteredCandidates]);

  const chatStatusCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredCandidates.forEach((candidate) => {
      const status =
        candidate?.candConversationStatus;
      if (status) {
        counts[status] = (counts[status] || 0) + 1;
      }
    });
    return counts;
  }, [filteredCandidates]);



  return (
    <ChatTable
      candidates={sortedCandidates}
      selectedCandidate={selectedCandidate}
      unreadMessages={unreadMessages}
      // onSelectionChange={handleSelectionChange}
      onCandidateSelect={onCandidateSelect}
      onReorder={handleReorder}
      refreshData={refreshData}
    />
  );
};

export default ChatSidebar;
