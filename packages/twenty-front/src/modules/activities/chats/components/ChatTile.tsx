import React from "react";
import * as frontChatTypes from "../types/front-chat-types";
import styled from "@emotion/styled";
import dayjs from "dayjs";

const StyledChatTile = styled.div<{ $selected: boolean }>`
  padding: 8px 12px;
  border-bottom: 1px solid #e0e0e0;
  background-color: ${(props) => (props.$selected ? "#e8f0fe" : "white")};
  cursor: pointer;
  display: flex;
  align-items: center;
  height: 48px;

  &:hover {
    background-color: ${(props) => (props.$selected ? "#e8f0fe" : "#f5f5f5")};
  }
`;

const NameContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
`;

const ChatCount = styled.span`
  background-color: #e0e0e0;
  color: #333;
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 12px;
  min-width: 20px;
  text-align: center;
`;

const StatusBadge = styled.span<{ status: string }>`
  background-color: ${(props) => {
    switch (props.status) {
      case "RECRUITER_INTERVIEW": return "#4285f4";
      case "CV_RECEIVED": return "#34a853";
      default: return "#9aa0a6";
    }
  }};
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  white-space: nowrap;
`;

const TimestampContainer = styled.div`
  font-size: 12px;
  color: #5f6368;
  margin-left: 8px;
  white-space: nowrap;
`;

interface ChatTileProps {
  individual: frontChatTypes.PersonNode;
  setSelectedIndividual: (id: string) => void;
  selectedIndividual: string;
  id: string;
}

const statusMapping: { [key: string]: string } = {
  "RECRUITER_INTERVIEW": "Recruiter Interview",
  "CV_RECEIVED": "CV Received",
  "UNKNOWN": "Unknown"
};

const formatTimestamp = (timestamp: string) => {
  const now = dayjs();
  const messageTime = dayjs(timestamp);

  if (now.diff(messageTime, 'day') === 0) {
    return messageTime.format('HH:mm');
  } else {
    return messageTime.format('DD/MM');
  }
};

const ChatTile: React.FC<ChatTileProps> = ({
  individual,
  setSelectedIndividual,
  selectedIndividual,
  id,
}) => {
  const status = individual?.candidates?.edges[0]?.node?.status || "UNKNOWN";
  const statusText = statusMapping[status] || "Unknown";

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
      <StatusBadge status={status}>{statusText}</StatusBadge>
      {lastMessageTimestamp && (
        <TimestampContainer>
          {formatTimestamp(lastMessageTimestamp)}
        </TimestampContainer>
      )}
    </StyledChatTile>
  );
};

export default ChatTile;