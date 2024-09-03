import React, { useEffect, useRef, useState } from 'react';
import * as frontChatTypes from '../types/front-chat-types';
import axios from 'axios';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import FileUpload from './FileUpload';
import styled from '@emotion/styled';
import SingleChatContainer from './SingleChatContainer';
import dayjs from 'dayjs';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import QRCode from 'react-qr-code';
import { p } from 'node_modules/msw/lib/core/GraphQLHandler-907fc607';
import { useHotkeys } from 'react-hotkeys-hook';

import { useNavigate } from 'react-router-dom';


const PersonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);
const CandidateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);


const StyledButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;



const StyledButton = styled.button<{ bgColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${props => props.bgColor};
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  position: relative;

  &:hover {
    filter: brightness(90%);
  }

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    white-space: nowrap;
  }

  &:hover::after {
    opacity: 1;
  }
`;

const StyledButtonBottom = styled.button`
  padding: 0.5em;
  background-color: #0e6874;
  color: white;
  border: none;
  margin-left: 1rem;
  cursor: pointer;
  border-radius: 4px;
`;

const StyledWindow = styled.div`
  position: fixed;
  display: block;
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


const StyledScrollingView = styled.div`
  padding-top: 5rem;
`;

const StyledButtonsBelowChatMessage = styled.div`
  display: flex;
`;

const StyledButton2 = styled.button`
  background-color: #4caf50;
  border: none;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  margin-right: 0.5rem;
`;

const StyledTopBar = styled.div`
  padding: 1.5rem;
  position: fixed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 66%;
  background-color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1));
  z-index: 1;
  backdrop-filter: saturate(180%) blur(10px);
`;

const StyledInternalLink = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0e6874;
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  position: relative;

  &:hover {
    background-color: #0a4f59;
  }

  &::after {
    content: 'Person';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    white-space: nowrap;
  }

  &:hover::after {
    opacity: 1;
  }
`;
const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD');

export default function ChatWindow(props: { selectedIndividual: string; individuals: frontChatTypes.PersonNode[] }) {
  const navigate = useNavigate();

  const [messageHistory, setMessageHistory] = useState<frontChatTypes.MessageNode[]>([]);
  const [latestResponseGenerated, setLatestResponseGenerated] = useState('');
  const [listOfToolCalls, setListOfToolCalls] = useState<string[]>([]);

  const botResponsePreviewRef = useRef(null);
  const inputRef = useRef(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [qrCode, setQrCode] = useState('');
  const chatViewRef = useRef<HTMLDivElement>(null);

  const currentIndividual = props?.individuals?.find(individual => individual?.id === props.selectedIndividual);
  const currentCandidateId = currentIndividual?.candidates?.edges[0]?.node?.id;

  useEffect(() => {
    if (currentCandidateId) {
      getlistOfMessages(currentCandidateId).then(() => {
        scrollToBottom();
      });
    }
    }, [props.selectedIndividual, currentCandidateId, messageHistory.length]);


  const handleNavigateToPersonPage = () => {
    navigate(`/object/person/${currentIndividual?.id}`);
  };
  const handleNavigateToCandidatePage = () => {
    navigate(`/object/candidate/${currentCandidateId}`);
  };

  
  async function getlistOfMessages(currentCandidateId: string) {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/get-all-messages-by-candidate-id',
        { candidateId: currentCandidateId },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
      );
      setMessageHistory(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessageHistory([]);
    }
  }
  console.log("Current Individual::", currentIndividual)
  let currentMessageObject = currentIndividual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[currentIndividual?.candidates?.edges[0]?.node?.whatsappMessages?.edges?.length - 1]?.node?.messageObj;

  const handleInvokeChatAndRunToolCalls = async (phoneNumber: string | undefined, latestResponseGenerated: string, setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>, setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>) => {
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

  const scrollToBottom = () => {
    if (chatViewRef.current) {
      chatViewRef.current.scrollTop = chatViewRef.current.scrollHeight;
    }
  };

  const sendMessage = async (messageText: string) => {
    console.log('send message');
    const response = await axios.post(
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-chat',
      { messageToSend: messageText, phoneNumberTo: currentIndividual?.phone },
      { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
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
      { phoneNumberTo: currentIndividual?.phone },
      { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
    );
  };

    const handleRetrieveBotMessage = async (
    phoneNumber: string | undefined,
    latestResponseGenerated: string,
    setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>,
    listOfToolCalls: string[],
    setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>,
    messageHistory: frontChatTypes.MessageNode[],
    setMessageHistory: React.Dispatch<React.SetStateAction<frontChatTypes.MessageNode[]>>,
  ) => {
    console.log('Retrieve Bot Message');
    const oldLength = currentMessageObject.length;
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
      arrObjOfToolCalls.filter((obj: any) => obj?.tool_calls?.length > 0)?.length > 0
    ) {
      latestObjectText = 'Tool Calls being called';
    }
    //@ts-ignore
    botResponsePreviewRef.current.value = latestObjectText;
    setLatestResponseGenerated(latestObjectText);
    // console.log(arrObjOfToolCalls);
    setListOfToolCalls(
      arrObjOfToolCalls
        // .filter((obj: any) => obj?.role === "tool")
        .filter((obj: any) => obj?.tool_calls?.length > 0)
        .map((obj: any) => obj?.tool_calls?.map((tool: any) => tool?.function?.name)),
    );
  };

  

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {props.selectedIndividual && (
          <StyledWindow>
            <ChatView ref={chatViewRef}>
            <StyledTopBar>
            <div>{`${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName} || ${currentIndividual?.phone} || ${currentIndividual?.id} || Messages: ${messageHistory.length} || Last Status: ${currentIndividual?.candidates?.edges[0]?.node?.status}`}</div>
                <StyledButtonGroup>
                  <StyledButton onClick={handleNavigateToPersonPage} bgColor="#0e6874" data-tooltip="Person">
                    <PersonIcon />
                  </StyledButton>
                  <StyledButton onClick={handleNavigateToCandidatePage} bgColor="#6b4e71" data-tooltip="Candidate">
                    <CandidateIcon />
                  </StyledButton>
                </StyledButtonGroup>
              </StyledTopBar>
              <StyledScrollingView>
                {messageHistory.map((message, index) => {
                  const showDateSeparator = index === 0 || formatDate(messageHistory[index - 1]?.createdAt) !== formatDate(message?.createdAt);
                  return (
                    <React.Fragment key={index}>
                      {showDateSeparator && (
                        <p style={{ textAlign: 'center' }}>
                          <StyledDateComponent>{dayjs(message?.createdAt).format("ddd DD MMM, 'YY")}</StyledDateComponent>
                        </p>
                      )}
                      <SingleChatContainer phoneNumber={currentIndividual?.phone} message={message} messageName={`${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`} />
                    </React.Fragment>
                  );
                })}
              </StyledScrollingView>
            </ChatView>
            <StyledChatInputBox>
              <div>
                <textarea name="" id="" cols={100} disabled ref={botResponsePreviewRef} placeholder="Bot Response Preview will appear here..."></textarea>
              </div>
              <div>
                <StyledButtonsBelowChatMessage>
                  <StyledButton2 onClick={() => handleRetrieveBotMessage(currentIndividual?.phone, latestResponseGenerated, setLatestResponseGenerated, listOfToolCalls, setListOfToolCalls, messageHistory, setMessageHistory)}>
                    Retrieve Bot Response
                  </StyledButton2>
                  <StyledButton2
                    onClick={() => {
                      handleInvokeChatAndRunToolCalls(currentIndividual?.phone, latestResponseGenerated, setLatestResponseGenerated, setListOfToolCalls);
                    }}>
                    Invoke Chat + Run tool calls
                  </StyledButton2>
                  <span>Tools Called: {listOfToolCalls?.map(tool => tool + ', ')}</span>
                </StyledButtonsBelowChatMessage>
              </div>
              <div style={{ display: 'flex' }}>
                <StyledChatInput type="text" ref={inputRef} placeholder="Type your message" />
                <StyledButtonBottom onClick={handleSubmit}>Submit</StyledButtonBottom>
                <StyledButtonBottom onClick={handleShareJD}>Share JD</StyledButtonBottom>
              </div>
              <div style={{ display: 'flex' }}>
                Last Status: {currentIndividual?.candidates?.edges[0]?.node?.status}
              </div>
            </StyledChatInputBox>
          </StyledWindow>
        ) || (
          <div>
            <div></div>
            <img src="/images/placeholders/moving-image/empty_inbox.png" alt="" />
            <p>Select a chat to start talking</p>
          </div>
        )}
      </div>
    </>
  );
}
