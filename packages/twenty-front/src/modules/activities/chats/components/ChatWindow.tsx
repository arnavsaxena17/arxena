import React, { useRef } from "react";
import * as frontChatTypes from "../types/front-chat-types";
import axios from "axios";
import { useRecoilState } from "recoil";
import { tokenPairState } from "@/auth/states/tokenPairState";
import FileUpload from "./FileUpload";
import styled from "@emotion/styled";
import SingleChatContainer from "./SingleChatContainer";
import dayjs from "dayjs";

const StyledChatInput = styled.input`
  padding: 0.5em;
  width: auto;
  display: block;
  border: 1px solid #ccc;
  outline: none;
  
`;

const ChatView = styled.div`
  position: relative;
  border: 1px solid #ccc;
  overflow-y: scroll;
  height: 85vh;
  width: auto;
`;

const formatDate = (date: string) => dayjs(date).format("YYYY-MM-DD");
const StyledDateComponent = styled.span`
  padding: 0.5em;
  background-color: #ccf9ff;
  margin: 1rem 0;
  align-items: center;
  color: #0e6874;
  border-radius: 4px;
`;

const StyledTopBar = styled.div`
  padding: 1.5rem;
  position: fixed;
  display: block;
  border-bottom: 1px solid #ccc;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1));
  z-index: 1;
  backdrop-filter: saturate(180%) blur(10px);
`;

const StyledScrollingView = styled.div`
  padding-top: 5rem;
`;

export default function ChatWindow(props: {
  selectedIndividual: string;
  individuals: frontChatTypes.PersonEdge[];
}) {
  const inputRef = useRef(null);

  const [tokenPair] = useRecoilState(tokenPairState);

  console.log("tokenPair", tokenPair);

  let currentIndividual = props?.individuals?.filter((individual) => {
    return individual?.node?.id === props.selectedIndividual;
  })[0];

  let listOfMessages =
    currentIndividual?.node?.candidates?.edges[0]?.node?.whatsappMessages
      ?.edges;

  let messageName = currentIndividual?.node?.name;
  listOfMessages?.sort(
    (a, b) =>
      new Date(a?.node?.createdAt).getTime() -
      new Date(b?.node?.createdAt).getTime()
  );

  const sendMessage = async (messageText: string) => {
    console.log("send message");
    const response = await axios.post(
      "http://localhost:3000/arx-chat/send-chat",
      {
        messageToSend: messageText,
        phoneNumberTo: currentIndividual?.node?.phone,
      },
      {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
        },
      }
    );
  };
  const handleSubmit = () => {
    console.log("submit");
    //@ts-ignore
    console.log(inputRef?.current?.value);
    //@ts-ignore
    sendMessage(inputRef?.current?.value);
    //@ts-ignore
    inputRef.current.value = ""; // Clear the input field
  };

  const handleShareJD = async () => {
    console.log("share JD");
    //@ts-ignore
    const response = await axios.post(
      "http://localhost:3000/arx-chat/send-jd-from-frontend",
      {
        phoneNumberTo: currentIndividual?.node?.phone,
      },
      {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
        },
      }
    );
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {(props.selectedIndividual && (
          <div>
            <ChatView>
              <StyledTopBar>{`${messageName.firstName} ${messageName.lastName}`}</StyledTopBar>
              <StyledScrollingView>
                {listOfMessages?.map((message, index) => {
                  const showDateSeparator =
                    index === 0 ||
                    formatDate(listOfMessages[index - 1]?.node?.createdAt) !==
                      formatDate(message?.node?.createdAt);
                  return (
                    <>
                      {showDateSeparator && (
                        <p style={{ textAlign: "center" }}>
                          <StyledDateComponent>
                            {dayjs(message?.node?.createdAt).format(
                              "ddd DD MMM, 'YY"
                            )}
                          </StyledDateComponent>
                        </p>
                      )}
                      <SingleChatContainer
                        message={message}
                        messageName={`${messageName.firstName} ${messageName.lastName}`}
                      />
                    </>
                  );
                })
                // ?.node?.whatsappMessages?.edges?.map((message) => {
                //   return <p>{message}</p>;
                // })
                }
              </StyledScrollingView>
            </ChatView>

            <div>
              <StyledChatInput
                type="text"
                ref={inputRef}
                placeholder="Type your message"
              />
              <button onClick={handleSubmit}>Submit</button>
              <button onClick={handleShareJD}>Share JD</button>
            </div>
          </div>
        )) ||
          "Select a chat to start chatting"}
      </div>
    </>
  );
}
