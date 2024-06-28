import React from "react";
import styled from "@emotion/styled";
import * as frontChatTypes from "../types/front-chat-types";
import dayjs from "dayjs";

const StyledContainer = styled.div`
  padding: 1rem;
`;

const StyledNameSpan = styled.span`
  font-weight: bold;
  margin-right: 0.5rem;
`;

const ChatMessageInfo = (props: {
  messageName: string;
  messageTime: string;
}) => {
  return (
    <div>
      <StyledNameSpan>{props.messageName}</StyledNameSpan>
      <span>{dayjs(props.messageTime).format("hh:mm A")}</span>
    </div>
  );
};

export default function SingleChatContainer(props: {
  message: frontChatTypes.WhatsAppMessagesEdge;
  messageName: string;
}) {
  return (
    <div>
      <StyledContainer>
        <ChatMessageInfo
          messageName={
            props.message?.node?.name === "candidateMessage"
              ? props.messageName
              : "You"
          }
          messageTime={props.message?.node?.createdAt}
        />
        <p>{props.message?.node?.message}</p>
      </StyledContainer>
    </div>
  );
}
