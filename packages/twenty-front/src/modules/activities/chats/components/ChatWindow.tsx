import React, { useEffect, useRef, useState } from 'react';
import * as frontChatTypes from '../types/front-chat-types';
import axios from 'axios';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import FileUpload from './FileUpload';
import styled from '@emotion/styled';
import SingleChatContainer from './SingleChatContainer';
import dayjs from 'dayjs';
// import {Check} from "@tabler/icons-react"

const StyledButton = styled.button`
  padding: 0.5em;
  background-color: #0e6874;
  color: white;
  border: none;
  margin-left: 1rem;
  cursor: pointer;
  border-radius: 4px;
`;

const StyledWindow = styled.div`
  display: flex;
  flex-direction: column;
  height: 90vh;
  margin: 0 auto;
`;

const StyledChatInput = styled.input`
  padding: 0.5em;
  width: 100%;
  display: block;
  flex: 1;
  border: 1px solid #ccc;
  outline: none;
`;

const StyledChatInputBox = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  background-color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0px -2px 4px rgba(0, 0, 0, 0.1));
  z-index: 1;
  backdrop-filter: saturate(180%) blur(10px);
  max-width: auto;
  padding: 1rem;
  flex: 1;
  flex-direction: column;

  & > * {
    margin: 0.5rem 0;
  }
`;

const ChatView = styled.div`
  position: relative;
  border: 1px solid #ccc;
  overflow-y: scroll;
  height: 70vh;
  width: auto;
`;

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
  /* border-bottom: 1px solid #ccc; */
  width: 66%;
  background-color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1));
  z-index: 1;
  backdrop-filter: saturate(180%) blur(10px);
`;

const StyledScrollingView = styled.div`
  padding-top: 5rem;
`;

const StyledButtonsBelowChatMessage = styled.div`
  display: flex;
  /* justify-content: space-between; */
`;

const StyledButton2 = styled.button`
  background-color: #4caf50;
  border: none;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  margin-right: 0.5rem;
`;

const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD');

export default function ChatWindow(props: { selectedIndividual: string; individuals: frontChatTypes.PersonEdge[] }) {
  const [messageHistory, setMessageHistory] = useState<[]>([]);
  const [latestResponseGenerated, setLatestResponseGenerated] = useState('');
  const [listOfToolCalls, setListOfToolCalls] = useState<string[]>([]);

  const botResponsePreviewRef = useRef(null);

  const inputRef = useRef(null);

  const [tokenPair] = useRecoilState(tokenPairState);

  console.log('tokenPair', tokenPair);

  let currentIndividual = props?.individuals?.filter(individual => {
    return individual?.node?.id === props.selectedIndividual;
  })[0];

  let listOfMessages = currentIndividual?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges;

  let currentMessageObject = currentIndividual?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges[currentIndividual?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges?.length - 1]?.node?.messageObj;

  let messageName = currentIndividual?.node?.name;
  listOfMessages?.sort((a, b) => new Date(a?.node?.createdAt).getTime() - new Date(b?.node?.createdAt).getTime());

  const sendMessage = async (messageText: string) => {
    console.log('send message');
    const response = await axios.post(
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-chat',
      {
        messageToSend: messageText,
        phoneNumberTo: currentIndividual?.node?.phone,
      },
      {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
        },
      },
    );
  };
  const handleSubmit = () => {
    console.log('submit');
    //@ts-ignore
    console.log(inputRef?.current?.value);
    //@ts-ignore
    sendMessage(inputRef?.current?.value);
    //@ts-ignore
    inputRef.current.value = ''; // Clear the input field
  };

  const handleShareJD = async () => {
    console.log('share JD');
    //@ts-ignore
    const response = await axios.post(
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-jd-from-frontend',
      {
        phoneNumberTo: currentIndividual?.node?.phone,
      },
      {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
        },
      },
    );
  };

  // const handleRetrieveBotMessage = async (
  //   phoneNumber: string,
  //   latestResponseGenerated: string,
  //   setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>,
  //   listOfToolCalls: string[],
  //   setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>,
  //   messageHistory: [],
  //   setMessageHistory: React.Dispatch<React.SetStateAction<[]>>
  // ) => {
  //   console.log("Retrieve Bot Message");
  //   const oldLength = messageHistory.length;
  //   debugger;
  //   const response = await axios.post(
  //     // ! Update host later to app.arxena.com/app
  //     process.env.REACT_APP_SERVER_BASE_URL + "/arx-chat/retrieve-chat-response",
  //     {
  //       phoneNumberFrom: phoneNumber,
  //     }
  //   );
  //   console.log("Got response after retrieving bot message", response.data);
  //   setMessageHistory(response.data);
  //   const newMessageHistory = response.data;

  //   // const latestObject = response.data[response.data.length - 1];
  //   // setLatestResponseGenerated(latestObject.content ?? "");
  //   // const newLatestResponseGenerated = latestObject.content ?? "";
  //   // botResponsePreviewRef.current.value = newLatestResponseGenerated;
  //   // listOfMessages.push(newLatestResponseGenerated);
  //   // console.log("latest:", newLatestResponseGenerated);
  //   const newLength = newMessageHistory.length;
  //   const diff = newLength - oldLength;
  //   const arrObjOfToolCalls = response.data.slice(
  //     newLength - diff,
  //     newLength + 1
  //   );

  //   const latestObjectText =
  //     arrObjOfToolCalls?.filter(
  //       (obj: any) =>
  //         obj?.role === "assistant" &&
  //         (obj?.content !== null || obj?.content !== "")
  //     )[0]?.content || "Failed to retrieve bot message";
  //   //@ts-ignore
  //   botResponsePreviewRef.current.value = latestObjectText;
  //   setLatestResponseGenerated(latestObjectText);
  //   console.log(arrObjOfToolCalls);
  //   setListOfToolCalls(
  //     arrObjOfToolCalls
  //       .filter((obj: any) => obj?.role === "tool")
  //       .map((obj: any) => obj?.name)
  //   );
  // };

  const handleRetrieveBotMessage = async (
    phoneNumber: string,
    latestResponseGenerated: string,
    setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>,
    listOfToolCalls: string[],
    setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>,
    messageHistory: [],
    setMessageHistory: React.Dispatch<React.SetStateAction<[]>>,
  ) => {
    console.log('Retrieve Bot Message');
    const oldLength = currentMessageObject.length;
    debugger;
    const response = await axios.post(
      // ! Update host later to app.arxena.com/app
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/retrieve-chat-response',
      {
        phoneNumberFrom: phoneNumber,
      },
    );
    console.log('Got response after retrieving bot message', response.data);
    setMessageHistory(response.data);
    const newMessageHistory = response.data;

    // const latestObject = response.data[response.data.length - 1];
    // setLatestResponseGenerated(latestObject.content ?? "");
    // const newLatestResponseGenerated = latestObject.content ?? "";
    // botResponsePreviewRef.current.value = newLatestResponseGenerated;
    // listOfMessages.push(newLatestResponseGenerated);
    // console.log("latest:", newLatestResponseGenerated);
    const newLength = newMessageHistory.length;
    const diff = newLength - oldLength;
    const arrObjOfToolCalls = response.data.slice(newLength - diff, newLength + 1);

    let latestObjectText = arrObjOfToolCalls?.filter((obj: any) => obj?.role === 'assistant' && (obj?.content !== null || obj?.content !== '')).pop()?.content || 'Failed to retrieve bot message';

    if (
      arrObjOfToolCalls
        // .filter((obj: any) => obj?.role === "tool")
        .filter((obj: any) => obj?.tool_calls?.length > 0)?.length > 0
    ) {
      latestObjectText = 'Tool Calls being called';
    }
    //@ts-ignore
    botResponsePreviewRef.current.value = latestObjectText;
    setLatestResponseGenerated(latestObjectText);
    console.log(arrObjOfToolCalls);
    setListOfToolCalls(
      arrObjOfToolCalls
        // .filter((obj: any) => obj?.role === "tool")
        .filter((obj: any) => obj?.tool_calls?.length > 0)
        .map((obj: any) => obj?.tool_calls?.map((tool: any) => tool?.function?.name)),
    );
  };

  const handleInvokeChatAndRunToolCalls = async (phoneNumber: string, latestResponseGenerated: string, setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>, setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>) => {
    console.log('Invoke Chat + Run tool calls');
    debugger;
    console.log('Retrieve Bot Message');
    //@ts-ignore
    botResponsePreviewRef.current.value = '';
    const response = await axios.post(
      // ! Update host later to app.arxena.com/app
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/invoke-chat',
      {
        phoneNumberFrom: phoneNumber,
      },
    );
    // clear textarea
    console.log('Got response after invoking the chat', response.data);
    setListOfToolCalls([]);
  };

  const handleSendMessage = async (phoneNumber: string, latestResponseGenerated: string) => {
    debugger;
    console.log('Send Message');
    const response = await axios.post(
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-chat',
      {
        messageToSend: latestResponseGenerated || 'Didnt work',
        phoneNumberTo: phoneNumber,
      },
      {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
        },
      },
    );
  };

  const handleToolCalls = () => {
    console.log('Tool Calls');
  };

  // useEffect(() => {
  //   console.log("useEffect::", listOfMessages);
  // }, [listOfMessages]);

  const fetchMessageHistory = async (phoneNumber: string) => {
    const response = await axios.post(
      // ! Update host later to app.arxena.com/app
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/retrieve-chat-response',
      {
        phoneNumberFrom: phoneNumber,
      },
    );
    console.log('Got response after retrieving bot message', response.data);
    setMessageHistory(response.data);
  };

  // useEffect(() => {
  //   fetchMessageHistory(currentIndividual?.node?.phone);
  //   console.log("useEffect::", messageHistory);
  // }, [currentIndividual?.node?.phone]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {(props.selectedIndividual && (
          <StyledWindow>
            <ChatView>
              <StyledTopBar>{`${messageName.firstName} ${messageName.lastName}`}</StyledTopBar>
              <StyledScrollingView>
                {listOfMessages?.map((message, index) => {
                  const showDateSeparator = index === 0 || formatDate(listOfMessages[index - 1]?.node?.createdAt) !== formatDate(message?.node?.createdAt);
                  return (
                    <>
                      {showDateSeparator && (
                        <p style={{ textAlign: 'center' }}>
                          <StyledDateComponent>{dayjs(message?.node?.createdAt).format("ddd DD MMM, 'YY")}</StyledDateComponent>
                        </p>
                      )}
                      <SingleChatContainer
                        phoneNumber={currentIndividual?.node?.phone}
                        message={message}
                        messageName={`${messageName.firstName} ${messageName.lastName}`}
                        // latestResponseGenerated={latestResponseGenerated}
                        // setLatestResponseGenerated={setLatestResponseGenerated}
                        // listOfToolCalls={listOfToolCalls}
                        // setListOfToolCalls={setListOfToolCalls}
                        // messageHistory={messageHistory}
                        // setMessageHistory={setMessageHistory}
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
            <StyledChatInputBox>
              <div>
                <textarea name="" id="" cols={100} disabled ref={botResponsePreviewRef} placeholder="Bot Response Preview will appear here..."></textarea>
              </div>
              <div>
                <StyledButtonsBelowChatMessage>
                  <StyledButton2 onClick={() => handleRetrieveBotMessage(currentIndividual?.node?.phone, latestResponseGenerated, setLatestResponseGenerated, listOfToolCalls, setListOfToolCalls, messageHistory, setMessageHistory)}>
                    Retrieve Bot Response
                  </StyledButton2>
                  <StyledButton2
                    onClick={() => {
                      // handleSendMessage(
                      //   currentIndividual?.node?.phone,
                      //   latestResponseGenerated
                      // );
                      handleInvokeChatAndRunToolCalls(currentIndividual?.node?.phone, latestResponseGenerated, setLatestResponseGenerated, setListOfToolCalls);
                    }}>
                    Invoke Chat + Run tool calls
                  </StyledButton2>
                  <span>Tools Called: {listOfToolCalls?.map(tool => tool + ', ')}</span>
                </StyledButtonsBelowChatMessage>
              </div>
              <div style={{ display: 'flex' }}>
                <StyledChatInput type="text" ref={inputRef} placeholder="Type your message" />
                <StyledButton onClick={handleSubmit}>Submit</StyledButton>
                <StyledButton onClick={handleShareJD}>Share JD</StyledButton>
              </div>
            </StyledChatInputBox>
          </StyledWindow>
        )) || (
          <div>
            <img src="/images/placeholders/moving-image/empty_inbox.png" alt="" />
            <p>Select a chat to start talking</p>
          </div>
        )}
      </div>
    </>
  );
}
