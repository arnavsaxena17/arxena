import React from "react";
import * as frontChatTypes from "../types/front-chat-types";
import styled from "@emotion/styled";

const StyledChatTile = styled.div<{ $selected?: boolean }>`
  padding: 1rem;
  border-bottom: 1px solid #ccc; // Divider between tiles
  //if selected, change background color
  background-color: ${(props) => (props.$selected ? "#8c8c8c" : "white")};
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

export default function ChatTile(props: {
  individual: frontChatTypes.PersonEdge;
  setSelectedIndividual: (value: React.SetStateAction<string>) => void;
  selectedIndividual: string;
  unreadMessagesCount: number;
  id: string;
}) {
  return (
    <StyledChatTile $selected={props.selectedIndividual === props.id}>
      <div
        onClick={() => {
          props.setSelectedIndividual(props.individual?.node?.id);
        }}
        style={{ cursor: "pointer" }}
      >
        <span>
          {props.individual?.node?.name?.firstName}{" "}
          {props.individual?.node?.name?.lastName}
        </span>

        {props.unreadMessagesCount && props.unreadMessagesCount > 0 ? (
          <UnreadIndicator>{props.unreadMessagesCount}</UnreadIndicator>
        ) : null}
      </div>
    </StyledChatTile>
  );
}
