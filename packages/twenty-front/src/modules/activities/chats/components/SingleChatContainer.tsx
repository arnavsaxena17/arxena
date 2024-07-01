import React, { useState } from "react";
import styled from "@emotion/styled";
import * as frontChatTypes from "../types/front-chat-types";
import dayjs from "dayjs";
import axios from "axios";
import { set } from "date-fns";

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

const StyledButtonsBelowChatMessage = styled.div`
  display: flex;
  /* justify-content: space-between; */
`;

const StyledButton = styled.button`
  background-color: #4caf50;
  border: none;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  margin-right: 0.5rem;
`;

const ChatMessageInfo = (props: {
  messageName: string;
  messageTime: string;
}) => {
  return (
    <div>
      <StyledNameSpan>{props.messageName}</StyledNameSpan>
      <StyledTime>{dayjs(props.messageTime).format("hh:mm A")}</StyledTime>
    </div>
  );
};

const handleRetrieveBotMessage = async (
  phoneNumber: string,
  latestResponseGenerated: string,
  setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>,
  listOfToolCalls: string[],
  setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>,
  messageHistory: [],
  setMessageHistory: React.Dispatch<React.SetStateAction<[]>>
) => {
  console.log("Retrieve Bot Message");
  const oldLength = messageHistory.length;
  debugger;
  const response = await axios.post(
    // ! Update host later to app.arxena.com/app
    "http://localhost:3000/arx-chat/retrieve-chat-response",
    {
      phoneNumberFrom: phoneNumber,
    }
  );
  console.log("Got response after retrieving bot message", response.data);
  // setMessageHistory(response.data);
  const newMessageHistory = response.data;
  const latestObject = response.data[response.data.length - 1];
  // setLatestResponseGenerated(latestObject.content ?? "");
  const newLatestResponseGenerated = latestObject.content ?? "";
  console.log("latest:", newLatestResponseGenerated);
  const newLength = newMessageHistory.length;
  const diff = newLength - oldLength;
  const arrObjOfToolCalls = response.data.slice(
    response.data.length - diff,
    response.data.length - 1
  );
  console.log(arrObjOfToolCalls);
  setListOfToolCalls(
    arrObjOfToolCalls
      .filter((obj: any) => obj?.role === "tool")
      .map((obj: any) => obj?.name)
  );
};

const handleInvokeChatAndRunToolCalls = async (
  phoneNumber: string,
  latestResponseGenerated: string,
  setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>
) => {
  console.log("Invoke Chat + Run tool calls");
  debugger;
  console.log("Retrieve Bot Message");
  const response = await axios.post(
    // ! Update host later to app.arxena.com/app
    "http://localhost:3000/arx-chat/invoke-chat",
    {
      phoneNumberFrom: phoneNumber,
    }
  );
  console.log("Got response after invoking the chat", response.data);
};

const handleSendMessage = async (
  phoneNumber: string,
  latestResponseGenerated: string
) => {
  debugger;
  console.log("Send Message");
  const response = await axios.post(
    "http://localhost:3000/arx-chat/send-chat",
    {
      messageToSend: latestResponseGenerated || "Didnt work",
      phoneNumberTo: phoneNumber,
    }
  );
};

const handleToolCalls = () => {
  console.log("Tool Calls");
};

export default function SingleChatContainer(props: {
  message: frontChatTypes.WhatsAppMessagesEdge;
  messageName: string;
  phoneNumber: string;
  latestResponseGenerated: string;
  setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>;
  listOfToolCalls: string[];
  setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>;
  messageHistory: [];
  setMessageHistory: React.Dispatch<React.SetStateAction<[]>>;
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
        {props.message?.node?.name !== "candidateMessage" && (
          <StyledButtonsBelowChatMessage>
            <StyledButton
              onClick={() =>
                handleRetrieveBotMessage(
                  props.phoneNumber,
                  props.latestResponseGenerated,
                  props.setLatestResponseGenerated,
                  props.listOfToolCalls,
                  props.setListOfToolCalls,
                  props.messageHistory,
                  props.setMessageHistory
                )
              }
            >
              Retrieve Bot Response
            </StyledButton>
            <StyledButton
              onClick={() => {
                handleSendMessage(
                  props.phoneNumber,
                  props.latestResponseGenerated
                );
                handleInvokeChatAndRunToolCalls(
                  props.phoneNumber,
                  props.latestResponseGenerated,
                  props.setLatestResponseGenerated
                );
              }}
            >
              Invoke Chat + Run tool calls
            </StyledButton>
            <span>
              Tools Called: {props.listOfToolCalls?.map((tool) => tool + ", ")}
            </span>
          </StyledButtonsBelowChatMessage>
        )}
      </StyledContainer>
    </div>
  );
}
