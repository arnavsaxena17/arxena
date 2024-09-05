import React, { useState } from "react";
import * as frontChatTypes from "../types/front-chat-types";
import ChatTile from "./ChatTile";
import styled from "@emotion/styled";
import SearchBox from "./SearchBox";

const StyledSidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 15vw;
  height: 100%;
  overflow-y: auto;
`;

interface ChatSidebarProps {
  individuals: frontChatTypes.PersonNode[];
  selectedIndividual: string;
  setSelectedIndividual: (id: string) => void;
  unreadMessages: frontChatTypes.UnreadMessageListManyCandidates;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  individuals,
  selectedIndividual,
  setSelectedIndividual,
  unreadMessages,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIndividuals = individuals.filter((individual) =>
    individual?.name?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    individual?.name?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    individual?.candidates?.edges[0]?.node?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    individual?.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    individual?.candidates?.edges[0]?.node?.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    individual?.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <StyledSidebarContainer>
      <SearchBox
        placeholder="Search chats"
        value={searchQuery}
        onChange={(e:any) => setSearchQuery(e.target.value)}
      />
      {filteredIndividuals.map((individual) => (
        <ChatTile
          key={individual.id}
          id={individual.id}
          individual={individual}
          setSelectedIndividual={setSelectedIndividual}
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
