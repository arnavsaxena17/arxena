import styled from '@emotion/styled';
import { useState } from 'react';
import { ChatSection } from './ChatSection';
import { ConversationListItem } from './ConversationListItem';
import { FilterSection } from './FilterSection';

const StyledMainContainer = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledHeaderTitle = styled.h1`
  ${({ theme }) => theme.font.size.xl};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 500;
  cursor: pointer;
  transition: all 0.1s ease-in-out;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledShortcut = styled.span`
  border-left: 1px solid ${({ theme }) => theme.border.color.light};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding-left: ${({ theme }) => theme.spacing(1)};
`;

const StyledPrimaryButton = styled(StyledButton)`
  background-color: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.background.primary};
  border: none;

  &:hover {
    background-color: ${({ theme }) => theme.color.blue80};
  }
`;

const StyledContentContainer = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const StyledConversationList = styled.div`
  border-right: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  flex-direction: column;
  width: 350px;
`;

const StyledConversationHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(3)};
`;

const StyledConversationCount = styled.span`
  ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledFilterContainer = styled.div`
  border-left: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(4)};
  width: 275px;
`;

// Mock data
const mockConversations = [
  {
    id: '1',
    name: 'John Doe',
    time: '10:30 AM',
    position: 'Frontend Developer',
    company: 'Google',
    message: "Thanks for the opportunity. I'm looking forward to t...",
    status: 'interview_scheduled' as const,
  },
  {
    id: '2',
    name: 'Jane Smith',
    time: 'Yesterday',
    position: 'UX Designer',
    company: 'Apple',
    message: "I've reviewed the offer and have a few questions ab...",
    status: 'offer_pending' as const,
  },
  {
    id: '3',
    name: 'Michael Johnson',
    time: 'Monday',
    position: 'Backend Developer',
    company: 'Amazon',
    message: 'When would be a good time to discuss the role in ...',
    status: 'screening' as const,
  },
];

const mockMessages = [
  {
    id: '1',
    sender: 'Recruiter',
    time: '10:30 AM',
    content:
      "Hi John, I hope this message finds you well. We've reviewed your application for the Frontend Developer position and we're impressed with your qualifications.",
  },
  {
    id: '2',
    sender: 'John Doe',
    time: '10:45 AM',
    content:
      "Thank you for reaching out! I'm very interested in the position and would love to learn more about the opportunity.",
    isOwn: true,
  },
  {
    id: '3',
    sender: 'John Doe',
    time: '10:45 AM',
    content:
      'Could you share more details about the team and the projects I would be working on?',
    isOwn: true,
  },
  {
    id: '4',
    sender: 'Recruiter',
    time: '11:02 AM',
    content:
      'Of course! The team is focused on building our core user-facing applications. You would be working on modernizing our frontend architecture and implementing new features.',
  },
  {
    id: '5',
    sender: 'Recruiter',
    time: '11:02 AM',
    content: 'Are you available for a technical interview next week?',
  },
  {
    id: '6',
    sender: 'John Doe',
    time: '11:15 AM',
    content:
      "That sounds exciting! Yes, I'm available for an interview next week. My preference would be Tuesday or Thursday morning if possible.",
    isOwn: true,
  },
];

const mockFilterGroups = [
  {
    id: 'designation',
    title: 'Designation',
    options: [
      { id: 'frontend', label: 'Frontend Developer', checked: true },
      { id: 'backend', label: 'Backend Developer', checked: false },
      { id: 'ux', label: 'UX Designer', checked: false },
      { id: 'pm', label: 'Project Manager', checked: false },
      { id: 'devops', label: 'DevOps Engineer', checked: false },
      { id: 'fullstack', label: 'Full Stack Developer', checked: false },
    ],
  },
  {
    id: 'status',
    title: 'Status',
    options: [
      { id: 'screening', label: 'Screening', checked: false },
      { id: 'interview', label: 'Interview Scheduled', checked: true },
      { id: 'offer', label: 'Offer Pending', checked: false },
      { id: 'hired', label: 'Hired', checked: false },
      { id: 'rejected', label: 'Rejected', checked: false },
    ],
  },
];

export const CandidateConversations = () => {
  const [selectedConversation, setSelectedConversation] = useState(
    mockConversations[0],
  );
  const [filterGroups, setFilterGroups] = useState(mockFilterGroups);
  const [isMultiSelect, setIsMultiSelect] = useState(false);

  const handleFilterChange = (
    groupId: string,
    optionId: string,
    checked: boolean,
  ) => {
    setFilterGroups((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId ? { ...option, checked } : option,
              ),
            }
          : group,
      ),
    );
  };

  const handleClearFilters = () => {
    setFilterGroups((groups) =>
      groups.map((group) => ({
        ...group,
        options: group.options.map((option) => ({ ...option, checked: false })),
      })),
    );
  };

  return (
    <StyledMainContainer>
      <StyledHeader>
        <StyledHeaderTitle>Candidate Conversations</StyledHeaderTitle>
        <StyledHeaderActions>
          <StyledButton onClick={() => setIsMultiSelect(!isMultiSelect)}>
            Multi Select
            <StyledShortcut>⌘O</StyledShortcut>
          </StyledButton>
          <StyledButton>Send Video Interview</StyledButton>
          <StyledButton>Send Assessment</StyledButton>
          <StyledButton>Fetch Naukri Profiles</StyledButton>
          <StyledButton>Download Resumes</StyledButton>
          <StyledPrimaryButton>Schedule Interviews</StyledPrimaryButton>
        </StyledHeaderActions>
      </StyledHeader>
      <StyledContentContainer>
        <StyledConversationList>
          <StyledConversationHeader>
            <span>Selected</span>
            <StyledConversationCount>3 of 5</StyledConversationCount>
          </StyledConversationHeader>
          {mockConversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              name={conversation.name}
              time={conversation.time}
              position={conversation.position}
              company={conversation.company}
              message={conversation.message}
              status={conversation.status}
              isSelected={selectedConversation.id === conversation.id}
              onClick={() => setSelectedConversation(conversation)}
            />
          ))}
        </StyledConversationList>
        <ChatSection
          candidateName={selectedConversation.name}
          position={`${selectedConversation.position} at ${selectedConversation.company}`}
          candidateId="P1002"
          messages={mockMessages}
        />
        <StyledFilterContainer>
          <FilterSection
            filterGroups={filterGroups}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearFilters}
            onApplyFilters={() =>
              console.log('Applying filters:', filterGroups)
            }
          />
        </StyledFilterContainer>
      </StyledContentContainer>
    </StyledMainContainer>
  );
};

export default CandidateConversations;
