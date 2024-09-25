import React from "react";
import * as frontChatTypes from "../types/front-chat-types";
import styled from "@emotion/styled";
import dayjs from "dayjs";

const StyledChatTile = styled.div<{ $selected: boolean }>`
  padding: 1rem;
  border-bottom: 1px solid #ccc;
  background-color: ${(props) => (props.$selected ? "#f5f9fd" : "white")};
  color: ${(props) => (props.$selected ? "black" : "inherit")};
  border-left: 4px solid ${(props) => (props.$selected ? "black" : "transparent")};
  transition: all 0.3s;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: ${(props) => (props.$selected ? "#f5f9fd" : "#f0f0f0")};
  }
`;

const NameContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ChatCount = styled.span`
  background-color: #e0e0e0;
  color: #333;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.8rem;
`;

const StatusBadge = styled.span`
  background-color: #007bff;
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.8rem;
`;

const UnreadIndicator = styled.span`
  background-color: red;
  color: white;
  border-radius: 50%;
  padding: 0.5rem;
  font-size: 0.8rem;
  min-height: 1rem;
  min-width: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const InfoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
`;

const TimestampContainer = styled.div`
  font-size: 0.8rem;
  color: #666;
`;

interface ChatTileProps {
  individual: frontChatTypes.PersonNode;
  setSelectedIndividual: (id: string) => void;
  selectedIndividual: string;
  unreadMessagesCount: number;
  id: string;
}

export const statusesArray = ['SCREENING', 'CV_SENT', 'RECRUITER_INTERVIEW', 'CV_RECEIVED', "NOT_INTERESTED", 'CLIENT_RECEIVED', 'NEGOTIATION'] as const;
type Status = typeof statusesArray[number];

const statusMapping: Record<Status, string> = {
  "SCREENING": "Screening",
  'CV_RECEIVED': "CV Received",
  "CV_SENT": "CV Sent",
  "RECRUITER_INTERVIEW": "Recruiter Interview",
  "CLIENT_RECEIVED": "Client Received",
  "NEGOTIATION": "Negotiation",
  "NOT_INTERESTED": "Not Interested"
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
  const status = individual?.candidates?.edges[0]?.node?.status as Status | undefined;
  const statusText = status && status in statusMapping ? statusMapping[status] : "Unknown";

  const lastMessage = individual.candidates.edges[0]?.node?.whatsappMessages?.edges[0]?.node;
  const lastMessageTimestamp = lastMessage?.createdAt;
  const chatCount = individual.candidates.edges[0].node.whatsappMessages.edges.length;

  return (
    <StyledChatTile
      $selected={selectedIndividual === id}
      onClick={() => setSelectedIndividual(individual.id)}
    >
      <NameContainer>
        <span>{individual.name.firstName} {individual.name.lastName}</span>
        <ChatCount>{chatCount}</ChatCount>
      </NameContainer>
      <InfoContainer>
        <StatusBadge>{statusText}</StatusBadge>
        {unreadMessagesCount > 0 && (
          <UnreadIndicator>{unreadMessagesCount}</UnreadIndicator>
        )}
        {lastMessageTimestamp && (
          <TimestampContainer>
            {formatTimestamp(lastMessageTimestamp)}
          </TimestampContainer>
        )}
      </InfoContainer>
    </StyledChatTile>
  );
};

export default ChatTile;