import React from "react";
import * as frontChatTypes from "../types/front-chat-types";
import styled from "@emotion/styled";

const StyledChatTile = styled.div<{ $selected: boolean }>`
  padding: 1rem;
  border-bottom: 1px solid #ccc;
  background-color: ${(props) => (props.$selected ? "#f5f9fd" : "white")};
  color: ${(props) => (props.$selected ? "black" : "inherit")};
  border-left: 4px solid ${(props) => (props.$selected ? "black" : "transparent")};
  transition: all 0.3s;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => (props.$selected ? "#f5f9fd" : "#f0f0f0")};
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

export const statusesArray = ['SCREENING', 'CV_SENT', 'RECRUITER_INTERVIEW','CV_RECEIVED', "NOT_INTERESTED",'CLIENT_RECEIVED', 'NEGOTIATION'] as const;
type Status = typeof statusesArray[number];

const statusMapping: Record<Status, string> = {
  "SCREENING": "S",
  'CV_RECEIVED':"CVR",
  "CV_SENT": "CVS",
  "RECRUITER_INTERVIEW": "RI",
  "CLIENT_RECEIVED": "CI",
  "NEGOTIATION": "OFF",
  "NOT_INTERESTED":"NI"
};

const ChatTile: React.FC<ChatTileProps> = ({
  individual,
  setSelectedIndividual,
  selectedIndividual,
  unreadMessagesCount,
  id,
}) => {
  const status = individual?.candidates?.edges[0]?.node?.status as Status | undefined;
  const statusCode = status && status in statusMapping ? statusMapping[status] : "NI";

  return (
    <StyledChatTile
      $selected={selectedIndividual === id}
      onClick={() => setSelectedIndividual(individual.id)}
    >
      <span>
        {individual.name.firstName} {individual.name.lastName} ({individual.candidates.edges[0].node.whatsappMessages.edges.length})
        {` (${statusCode})`}
      </span>
      {unreadMessagesCount > 0 && (
        <UnreadIndicator>{unreadMessagesCount}</UnreadIndicator>
      )}
    </StyledChatTile>
  );
};

export default ChatTile;