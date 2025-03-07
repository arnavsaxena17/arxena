import styled from '@emotion/styled';
import dayjs from 'dayjs';
import React from 'react';
import { PersonNode } from 'twenty-shared';

const StyledChatTile = styled.div<{ $selected: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.accent.quaternary : theme.background.primary};
  color: ${({ theme, $selected }) =>
    $selected ? theme.font.color.primary : 'inherit'};
  border-left: 4px solid
    ${({ theme, $selected }) =>
      $selected ? theme.font.color.primary : 'transparent'};
  transition: all 0.3s;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: ${({ theme, $selected }) =>
      $selected ? theme.accent.quaternary : theme.background.tertiary};
  }
`;

const StyledDescriptionContainer = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-top: ${({ theme }) => theme.spacing(1)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const StyledNameContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledChatCount = styled.span`
  background-color: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(2)}`};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledStatusBadge = styled.span`
  background-color: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(2)}`};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledUnreadIndicator = styled.span`
  background-color: ${({ theme }) => theme.color.red};
  color: ${({ theme }) => theme.background.primary};
  border-radius: 50%;
  padding: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-height: ${({ theme }) => theme.spacing(4)};
  min-width: ${({ theme }) => theme.spacing(4)};
  display: flex;
  justify-content: center;
  align-items: center;
`;

const StyledInfoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTimestampContainer = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

interface ChatTileProps {
  individual: PersonNode;
  setSelectedIndividual: (id: string) => void;
  selectedIndividual: string;
  unreadMessagesCount: number;
  id: string;
}

export const statusesArray = [
  'SCREENING',
  'CV_SENT',
  'RECRUITER_INTERVIEW',
  'CV_RECEIVED',
  'INTERESTED',
  'NOT_INTERESTED',
  'CLIENT_RECEIVED',
  'NEGOTIATION',
] as const;
type Status = (typeof statusesArray)[number];

const statusMapping: Record<Status, string> = {
  SCREENING: 'Screening',
  CV_RECEIVED: 'CV Received',
  CV_SENT: 'CV Sent',
  RECRUITER_INTERVIEW: 'Recruiter Interview',
  CLIENT_RECEIVED: 'Client Received',
  NEGOTIATION: 'Negotiation',
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not Interested',
};

const formatTimestamp = (timestamp: string) => {
  const now = dayjs();
  const messageTime = dayjs(timestamp);

  if (now.diff(messageTime, 'hour') < 24) {
    return messageTime.format('HH:mm');
  } else {
    return messageTime.format('DD/MM');
  }
};

const ChatTile: React.FC<ChatTileProps> = ({
  individual,
  setSelectedIndividual,
  selectedIndividual,
  unreadMessagesCount,
  id,
}) => {
  const status = individual?.candidates?.edges[0]?.node?.status as
    | Status
    | undefined;
  const statusText =
    status && status in statusMapping ? statusMapping[status] : 'Unknown';

  // const lastMessage = individual.candidates.edges[0]?.node?.whatsappMessages?.edges[0]?.node;
  // const lastMessageTimestamp = lastMessage?.createdAt;

  const getLastMessageTimestamp = (individual: PersonNode): string => {
    const messages =
      individual.candidates?.edges[0]?.node?.whatsappMessages?.edges || [];
    let lastMessageTimestamp = '';

    for (const messageEdge of messages) {
      const currentTimestamp = messageEdge.node.createdAt;
      if (
        !lastMessageTimestamp ||
        new Date(currentTimestamp) > new Date(lastMessageTimestamp)
      ) {
        lastMessageTimestamp = currentTimestamp;
      }
    }

    return lastMessageTimestamp;
  };
  // Usage:
  const lastMessageTimestamp = getLastMessageTimestamp(individual);
  const chatCount =
    individual.candidates.edges[0].node.whatsappMessages.edges.length;
  const getCandidateDescription = (individual: PersonNode): string => {
    // This is a placeholder. Replace with actual logic to get the description from your data.
    const descriptions = [
      'Strong fit for the role, 5 years relevant experience',
      'Potential candidate, needs further screening',
      'Excellent communication skills, lacks technical background',
      'Perfect technical skills, limited industry experience',
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  };

  const candidateDescription = individual.jobTitle;

  return (
    <StyledChatTile
      $selected={selectedIndividual === id}
      onClick={() => setSelectedIndividual(individual.id)}
    >
      <StyledNameContainer>
        <span>
          {individual.name.firstName} {individual.name.lastName}
        </span>
        <StyledChatCount>{chatCount}</StyledChatCount>
      </StyledNameContainer>
      <StyledDescriptionContainer>
        {candidateDescription}
      </StyledDescriptionContainer>

      <StyledInfoContainer>
        <StyledStatusBadge>{statusText}</StyledStatusBadge>
        {unreadMessagesCount > 0 && (
          <StyledUnreadIndicator>{unreadMessagesCount}</StyledUnreadIndicator>
        )}
        {lastMessageTimestamp && (
          <StyledTimestampContainer>
            {formatTimestamp(lastMessageTimestamp)}
          </StyledTimestampContainer>
        )}
      </StyledInfoContainer>
    </StyledChatTile>
  );
};

export default ChatTile;
