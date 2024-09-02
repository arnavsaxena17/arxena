import React from "react";
import * as frontChatTypes from "../types/front-chat-types";
import styled from "@emotion/styled";

const StyledChatTile = styled.div<{ $selected: boolean }>`
  padding: 1rem;
  border-bottom: 1px solid #ccc;
  background-color: ${(props) => (props.$selected ? "#e6f7ff" : "white")};
  color: ${(props) => (props.$selected ? "#1890ff" : "inherit")};
  border-left: 4px solid ${(props) => (props.$selected ? "#1890ff" : "transparent")};
  transition: all 0.3s;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => (props.$selected ? "#e6f7ff" : "#f0f0f0")};
  }
`;

const UnreadIndicator = styled.span`
  background-color: red;
  color: white;
  border-radius: 50%;
  padding: 0.5rem;
  margin-left: 0.5rem;
  font-size: 0.8rem;
  min-height: 1rem;
  width: 1rem;
`;

interface ChatTileProps {
  individual: frontChatTypes.PersonNode;
  setSelectedIndividual: (id: string) => void;
  selectedIndividual: string;
  unreadMessagesCount: number;
  id: string;
}

const ChatTile: React.FC<ChatTileProps> = ({
  individual,
  setSelectedIndividual,
  selectedIndividual,
  unreadMessagesCount,
  id,
}) => {
  return (
    <StyledChatTile
      $selected={selectedIndividual === id}
      onClick={() => setSelectedIndividual(individual.id)}
    >
      <span>
        {individual.name.firstName} {individual.name.lastName} ({individual.candidates.edges[0].node.whatsappMessages.edges.length})
      </span>
      {unreadMessagesCount > 0 && (
        <UnreadIndicator>{unreadMessagesCount}</UnreadIndicator>
      )}
    </StyledChatTile>
  );
};

export default ChatTile;
