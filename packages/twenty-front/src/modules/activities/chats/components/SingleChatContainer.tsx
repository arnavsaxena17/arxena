import React, { useState, ReactElement } from "react";
import styled from "@emotion/styled";
import * as frontChatTypes from "../types/front-chat-types";
import dayjs from "dayjs";
import axios from "axios";
import { set } from "date-fns";
import { IconCheck, IconChecks, IconAlertCircle } from "@tabler/icons-react";

const IconChecksBlue = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#007bff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon icon-tabler icons-tabler-outline icon-tabler-checks"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M7 12l5 5l10 -10" />
      <path d="M2 12l5 5m5 -5l5 -5" />
    </svg>
  );
};

interface MessageStatusType {
  [key: string]: ReactElement;
  sent: ReactElement;
  delivered: ReactElement;
  read: ReactElement;
  failed: ReactElement;
  readByRecruiter: ReactElement;
}

const MessageStatus: MessageStatusType = {
  sent: <IconCheck />,
  delivered: <IconChecks />,
  read: <IconChecksBlue />,
  failed: <IconAlertCircle />,
  readByRecruiter: <IconChecksBlue />,
};

const StyledContainer = styled.div`
  padding: 1rem;
`;

const StyledNameSpan = styled.span`
  font-weight: bold;
  margin-right: 0.5rem;
`;

const StyledTime = styled.span`
  color: #aaa;
  font-size: 0.9rem;
`;

const ChatMessageInfo = (props: {
  messageName: string | undefined;
  messageTime: string | undefined;
  messageReadStatus: string;
}) => {
  return (
    <div>
      <StyledNameSpan>{props.messageName}</StyledNameSpan>
      <StyledTime>{dayjs(props.messageTime).format("hh:mm A")}</StyledTime>
      {props.messageName === "You" ? (
        <span>{MessageStatus[props.messageReadStatus]}</span>
      ) : (
        <></>
      )}
    </div>
  );
};

export default function SingleChatContainer(props: {
  message: frontChatTypes.MessageNode;
  messageName: string | undefined;
  phoneNumber: string | undefined;
  // latestResponseGenerated: string;
  // setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>;
  // listOfToolCalls: string[];
  // setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>;
  // messageHistory: [];
  // setMessageHistory: React.Dispatch<React.SetStateAction<[]>>;
}) {
  return (
    <div>
      <StyledContainer>
        <ChatMessageInfo
          messageName={
            props.message?.name === "candidateMessage"
              ? props.messageName
              : "You"
          }
          messageTime={props.message?.createdAt}
          messageReadStatus={props.message?.whatsappDeliveryStatus}
        />
        <p>{props.message?.message}</p>
        {/* {props.message?.node?.name !== "candidateMessage" && (
          
        )} */}
      </StyledContainer>
    </div>
  );
}
