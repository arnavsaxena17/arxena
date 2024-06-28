import React from "react";
import * as frontChatTypes from "../types/front-chat-types";
import styled from "@emotion/styled";

const StyledChatTile = styled.div`
  padding: 0 1rem;
  border-bottom: 1px solid #ccc; // Divider between tiles
`;

export default function ChatTile(props: {
  individual: frontChatTypes.PersonEdge;
  setSelectedIndividual: (value: React.SetStateAction<string>) => void;
  selectedIndividual: string;
  unreadMessagesCount: number;
}) {
  return (
    <StyledChatTile>
      <div
        onClick={() => {
          props.setSelectedIndividual(props.individual?.node?.id);
        }}
        style={{ cursor: "pointer" }}
      >
        <p>
          {props.individual?.node?.name?.firstName}{" "}
          {props.individual?.node?.name?.lastName} ({props.unreadMessagesCount}{" "}
          unread messages)
        </p>
      </div>
    </StyledChatTile>
  );
}
