import React, { useEffect, useRef, useState } from 'react';
import * as frontChatTypes from '../types/front-chat-types';
import axios from 'axios';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import FileUpload from './FileUpload';
import SingleChatContainer from './SingleChatContainer';
import dayjs from 'dayjs';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import QRCode from 'react-qr-code';
import { p } from 'node_modules/msw/lib/core/GraphQLHandler-907fc607';
import { useHotkeys } from 'react-hotkeys-hook';
import styled from '@emotion/styled';
import { css } from '@emotion/react';

import AttachmentPanel from './AttachmentPanel';
import { mutationToUpdateOneCandidate } from '../graphql-queries-chat/chat-queries';

import { useNavigate } from 'react-router-dom';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const statusLabels: { [key: string]: string } = {
  "NOT_INTERESTED": "Not Interested",
  "INTERESTED": "Interested",
  "CV_RECEIVED": "CV Received",
  "NOT_FIT": "Not Fit",
  "SCREENING": "Screening",
  "RECRUITER_INTERVIEW": "Recruiter Interview",
  "CV_SENT": "CV Sent",
  "CLIENT_INTERVIEW": "Client Interview",
  "NEGOTIATION": "Negotiation"
};

const statusesArray = Object.keys(statusLabels);



const StyledSelect = styled.select`
  padding: 0.5em;
  margin-right: 1em;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
`;

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

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
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

const AttachmentButton = styled(StyledButton)`
  background-color: black;
`;

const StyledButtonBottom = styled.button`
  padding: 0.5em;
  background-color: black;
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
  margin-bottom:5rem;
`;

const StyledButtonsBelowChatMessage = styled.div`
  display: flex;
`;

const StyledButton2 = styled.button`
  background-color: #666666;
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
  width: 62vw;
  background-color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1));
  z-index: 1;
  backdrop-filter: saturate(180%) blur(10px);
`;


const TopbarContainer = styled.div`
  background-color: #f3f4f6;
  padding: 8px;
  border-radius: 4px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
`;

const FieldsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 14px;
`;

const AdditionalInfo = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: #4b5563;
`;

const CopyableField = styled.span`
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
  display: flex;
  align-items: center;
  gap: 4px;
`;

const iconStyles = css`
  width: 16px;
  height: 16px;
`;

const CopyIcon = () => (
  <svg css={iconStyles} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2z" />
    <path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2" />
  </svg>
);

const CheckIcon = () => (
  <svg css={iconStyles} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);


const AttachmentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);


const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD');

export default function ChatWindow(props: { selectedIndividual: string; individuals: frontChatTypes.PersonNode[] }) {
  const navigate = useNavigate();

  const [messageHistory, setMessageHistory] = useState<frontChatTypes.MessageNode[]>([]);
  const [latestResponseGenerated, setLatestResponseGenerated] = useState('');
  const [listOfToolCalls, setListOfToolCalls] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);

  const botResponsePreviewRef = useRef(null);
  const inputRef = useRef(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [qrCode, setQrCode] = useState('');
  const chatViewRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState(null);


  const allIndividuals = props?.individuals

  const currentIndividual = allIndividuals?.find(individual => individual?.id === props?.selectedIndividual);
  const currentCandidateId = currentIndividual?.candidates?.edges[0]?.node?.id;
  const currentCandidateName = currentIndividual?.name.firstName + " " + currentIndividual?.name.lastName

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


  const handleStopCandidate = async () => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/candidate-sourcing/stop-chat',
        { candidateId: currentCandidateId },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
      );
      console.log('Response:', response);
    } catch (error) {
      console.error('Error stopping candidate:', error);
    }
  }
  
  async function getlistOfMessages(currentCandidateId: string) {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/get-all-messages-by-candidate-id',
        { candidateId: currentCandidateId },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
      );

      const sortedMessages = response.data.sort((a: frontChatTypes.MessageNode, b: frontChatTypes.MessageNode) => {
        return dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf();
      });

      setMessageHistory(sortedMessages);
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

    const handleStatusUpdate = async (newStatus: string) => {
      try {
        const response = await axios.post(
          process.env.REACT_APP_SERVER_BASE_URL+'/graphql',
          {
            query: mutationToUpdateOneCandidate,
            variables: {
              idToUpdate: currentCandidateId,
              input: { status: newStatus }
            }
          },
          {
            headers: {
              'authorization': `Bearer ${tokenPair?.accessToken?.token}`,
              'content-type': 'application/json',
              'x-schema-version': '66',
            }
          }
        );
        console.log('Status updated:', response.data);
        // You might want to refresh the candidate data here
      } catch (error) {
        console.error('Error updating status:', error);
      }
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
  const handleToggleAttachmentPanel = () => {
    setIsAttachmentPanelOpen(!isAttachmentPanelOpen);
  };

  
    const copyToClipboard = (text, field) => {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    };
  
    const CopyableFieldComponent = ({ label, value, field, alwaysShowFull = false }) => (
      <CopyableField onClick={() => copyToClipboard(value, field)} title={copiedField === field ? 'Copied!' : 'Click to copy'} >
      {label}: {alwaysShowFull ? value : ``}
      {copiedField === field ? <CheckIcon /> : <CopyIcon />}
      </CopyableField>
    );


  const allIndividualsForCurrentJob = allIndividuals?.filter(individual => individual?.candidates?.edges[0]?.node?.jobs.id === currentIndividual?.candidates?.edges[0]?.node?.jobs.id);

  const lastStatus = currentIndividual?.candidates?.edges[0]?.node?.status
  const totalCandidates = allIndividualsForCurrentJob?.length
  const screeningState = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === "SCREENING").length
  const screeningPercent = (allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === "SCREENING").length/allIndividualsForCurrentJob.length*100).toFixed(1)
  const unresponsive = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === null).length;
  const unresponsivePercent = (allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === null).length/allIndividualsForCurrentJob.length*100).toFixed(1);
  const notInterested = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === "NOT_INTERESTED").length;
  const notInterestedPercent = (allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === "NOT_INTERESTED").length/allIndividualsForCurrentJob.length*100).toFixed(1);
  const notFit = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === "NOT_FIT").length;
  const notFitPercent = (allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === "NOT_FIT").length/allIndividualsForCurrentJob.length*100).toFixed(1);
  const recruiterInterviews = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === "RECRUITER_INTERVIEW").length;
  const recruiterInterviewsPercent = (allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === "RECRUITER_INTERVIEW").length/allIndividualsForCurrentJob.length*100).toFixed(1);
  const candidateEngagementStatus = currentIndividual?.candidates?.edges[0]?.node?.engagementStatus;  
  const candidateStopChatStatus = currentIndividual?.candidates?.edges[0]?.node?.stopChat;  

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {props.selectedIndividual && (
          <StyledWindow>
            <ChatView ref={chatViewRef}>
            <StyledTopBar>

            <TopbarContainer>
              <FieldsContainer>
                <CopyableFieldComponent 
                  label="Name"
                  value={`${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`}
                  field="name"
                  alwaysShowFull = {true}
                />
                <CopyableFieldComponent 
                  label="Phone"
                  value={currentIndividual?.phone}
                  field="phone"
                />
                <CopyableFieldComponent 
                  label="Person ID"
                  value={currentIndividual?.id}
                  field="personId"
                />
                <CopyableFieldComponent 
                  label="Candidate ID"
                  value={currentIndividual?.candidates.edges[0].node.id}
                  field="candidateId"
                />
              </FieldsContainer>
              <AdditionalInfo>
                Messages: {messageHistory?.length || 0} | 
                Current Job: {currentIndividual?.candidates?.edges[0]?.node?.jobs?.name || 'N/A'}
              </AdditionalInfo>
            </TopbarContainer>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <StyledSelect value={lastStatus || ''} onChange={(e) => handleStatusUpdate(e.target.value)} >
                  <option value="" disabled>Update Status</option>
                  {statusesArray.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </StyledSelect>
                <StyledButtonGroup>
                  <StyledButton onClick={handleStopCandidate} bgColor="black" data-tooltip="Stop Chat">
                    <StopIcon />
                  </StyledButton>
                  <StyledButton onClick={handleNavigateToPersonPage} bgColor="black" data-tooltip="Person">
                    <PersonIcon />
                  </StyledButton>
                  <StyledButton onClick={handleNavigateToCandidatePage} bgColor="black" data-tooltip="Candidate">
                    <CandidateIcon />
                  </StyledButton>
                  <AttachmentButton onClick={handleToggleAttachmentPanel} bgColor="black" data-tooltip="View Attachments">
                    <AttachmentIcon />
                  </AttachmentButton>
                </StyledButtonGroup>
              </div>
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
                Last Status: {lastStatus} | 
                Total: {totalCandidates} | 
                Screening: {screeningState} ({screeningPercent}%) | 
                Unresponsive: {unresponsive} ({unresponsivePercent}%) | 
                Not Interested: {notInterested} ({notInterestedPercent}%) | 
                Not Fit: {notFit} ({notFitPercent}%) | 
                Recruiter Interviews: {recruiterInterviews} ({recruiterInterviewsPercent}%)
              </div>
            </StyledChatInputBox>
          </StyledWindow>
        ) || (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <img src="/images/placeholders/moving-image/empty_inbox.png" alt="" />
            <p>Select a chat to start talking</p>
          </div>
        )}
      </div>
      <AttachmentPanel isOpen={isAttachmentPanelOpen} onClose={() => setIsAttachmentPanelOpen(false)} candidateId={currentCandidateId || ''} candidateName={currentCandidateName} />

    </>
  );
}
