import React, { useEffect, useRef, useState } from 'react';
import * as frontChatTypes from '../types/front-chat-types';
import axios from 'axios';
import { useRecoilState, useRecoilValue } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import FileUpload from './FileUpload';
import SingleChatContainer from './SingleChatContainer';
import dayjs from 'dayjs';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import QRCode from 'react-qr-code';
// import { p } from 'node_modules/msw/lib/core/GraphQLHandler-907fc607';
import { useHotkeys } from 'react-hotkeys-hook';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Notes } from '@/activities/notes/components/Notes';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';

import AttachmentPanel from './AttachmentPanel';
import { mutationToUpdateOneCandidate, mutationToUpdateOnePerson } from '../graphql-queries-chat/chat-queries';

import { useNavigate } from 'react-router-dom';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TopbarContainer, FieldsContainer, AdditionalInfo, CopyableField, StyledTopBar, EditableField, ButtonGroup, MainInfo, StyledSelect, AdditionalInfoAndButtons, AdditionalInfoContent } from './TopbarComponents';

const statusLabels: { [key: string]: string } = {
  NOT_INTERESTED: 'Not Interested',
  INTERESTED: 'Interested',
  CV_RECEIVED: 'CV Received',
  NOT_FIT: 'Not Fit',
  SCREENING: 'Screening',
  RECRUITER_INTERVIEW: 'Recruiter Interview',
  CV_SENT: 'CV Sent',
  CLIENT_INTERVIEW: 'Client Interview',
  NEGOTIATION: 'Negotiation',
};

// const templatesList = [ ];
const templates = ['recruitment', 'application', 'application02','share_video_interview_link_direct','rejection_template','follow_up'];
const chatLayers = ['startChat','videoInterview','meetingScheduling']

const statusesArray = Object.keys(statusLabels);
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

// const StyledButtonGroup = styled.div`
//   display: flex;
//   gap: 8px;
// `;

const Container = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  padding: 1.5rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const PreviewSection = styled.div`
  // display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const HeaderIcon = styled.svg`
  width: 1.25rem;
  height: 1.25rem;
  color: #2563eb;
`;

const HeaderText = styled.h3`
  font-weight: 500;
  color: #111827;
  margin: 0;
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  height: 8rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  resize: none;
  background-color: ${props => (props.disabled ? '#f3f4f6' : 'white')};

  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: black;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: grey;
  }

  &:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }
`;

const ToolCallsText = styled.span`
  color: #6b7280;
  font-size: 0.875rem;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background-color: white;
  margin-bottom: 0.5rem;

  &:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  }
`;

const ChatContainer = styled.div`
  display: flex;
  height: 70vh;
  z-index: 3;
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

const NotesPanel = styled.div`
  margin-top: 100px;
  display: flex;
  position: relative;
  overflow-y: scroll;
  width: 800px;
  border-left: 1px solid #ccc;
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
  z-index: 2;
`;

const StyledChatInput = styled.input`
  padding: 0.5em;
  // width: 100%;
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
  // z-index: 1;
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
  width: 100%;
  height: 60vh;
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
  margin-bottom: 5rem;
  z-index: 1;
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

const BotResponseContainer = styled.div`
  display: flex;
  gap: 1rem;
  width: 100%;
  align-items: flex-start;

  textarea {
    flex: 1;
    min-height: 100px;
    resize: vertical;
  }

  .buttons-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
`;

// const StyledTopBar = styled.div`
//   padding: 1.5rem;
//   position: fixed;
//   display: flex;
//   justify-content: space-between;
//   align-items: center;
//   width: 62vw;
//   background-color: rgba(255, 255, 255, 0.8);
//   filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1));
//   z-index: 1;
//   backdrop-filter: saturate(180%) blur(10px);
// `;

// const TopbarContainer = styled.div`
//   background-color: #f3f4f6;
//   padding: 8px;
//   border-radius: 4px;
//   box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
// `;

// const FieldsContainer = styled.div`
//   display: flex;
//   flex-wrap: wrap;
//   gap: 16px;
//   font-size: 14px;
// `;

// const AdditionalInfo = styled.div`
//   margin-top: 8px;
//   font-size: 12px;
//   color: #4b5563;
// `;

// const CopyableField = styled.span`
//   cursor: pointer;
//   &:hover {
//     text-decoration: underline;
//   }
//   display: flex;
//   align-items: center;
//   gap: 4px;
// `;
const ChatInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: saturate(180%) blur(10px);
`;

const ResponsePreviewContainer = styled.div`
  display: flex;
  gap: 1rem;
  width: 100%;
`;

// const PreviewSection = styled.div`
//   flex: 1;
//   display: flex;
//   flex-direction: column;
//   gap: 0.5rem;
//   margin: 1rem;
//   textarea {
//     width: 100%;
//     min-height: 100px;
//     resize: vertical;
//     padding: 0.5rem;
//     border: 1px solid #ccc;
//     border-radius: 4px;
//   }
// `;

const ButtonsRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const iconStyles = css`
  width: 16px;
  height: 16px;
`;

const StyledSvg = styled.svg`
  ${iconStyles}
`;

const NotificationContainer = styled.div`
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Notification = styled.div<{ type: 'success' | 'error' }>`
  padding: 1rem;
  border-radius: 0.375rem;
  background-color: ${props => (props.type === 'success' ? '#34d399' : '#f87171')};
  color: white;
  min-width: 300px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  animation: slideIn 0.3s ease-out;

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.8;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`;

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const CopyIcon = () => (
  <StyledSvg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2z" />
    <path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2" />
  </StyledSvg>
);

const CheckIcon = () => (
  <StyledSvg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" />
  </StyledSvg>
);

const AttachmentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD');

export default function ChatWindow(props: { selectedIndividual: string; individuals: frontChatTypes.PersonNode[],onMessageSent: () => void;}) {
  const allIndividuals = props?.individuals;

  const currentIndividual = allIndividuals?.find(individual => individual?.id === props?.selectedIndividual);
  const currentCandidateId = currentIndividual?.candidates?.edges[0]?.node?.id;

  const navigate = useNavigate();

  const [messageHistory, setMessageHistory] = useState<frontChatTypes.MessageNode[]>([]);
  const [latestResponseGenerated, setLatestResponseGenerated] = useState('');
  const [listOfToolCalls, setListOfToolCalls] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);

  const botResponsePreviewRef = useRef(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [qrCode, setQrCode] = useState('');
  const chatViewRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [salary, setSalary] = useState(currentIndividual?.salary || '');
  const [city, setCity] = useState(currentIndividual?.city || '');
  const [isMessagePending, setIsMessagePending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<frontChatTypes.MessageNode | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);


  useEffect(() => {
    if (currentCandidateId) {
      getlistOfMessages(currentCandidateId).then(() => {
        scrollToBottom();
      });
    }
  }, [props.selectedIndividual, currentCandidateId]);


  useEffect(() => {
    setSalary(currentIndividual?.salary || '');
    setCity(currentIndividual?.city || '');
  }, [currentIndividual]);

  const currentCandidateName = currentIndividual?.name.firstName + ' ' + currentIndividual?.name.lastName;

  // useEffect(() => {
  //   if (currentCandidateId) {
  //     getlistOfMessages(currentCandidateId).then(() => {
  //       scrollToBottom();
  //     });
  //   }
  // }, [props.selectedIndividual, currentCandidateId, messageHistory.length]);

  const handleNavigateToPersonPage = () => {
    navigate(`/object/person/${currentIndividual?.id}`);
  };
  const handleNavigateToCandidatePage = () => {
    navigate(`/object/candidate/${currentCandidateId}`);
  };

  const handleSalaryUpdate = async () => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/graphql',
        {
          query: mutationToUpdateOnePerson,
          variables: {
            idToUpdate: currentIndividual?.id,
            input: { salary: salary },
          },
        },
        {
          headers: {
            authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            'content-type': 'application/json',
            'x-schema-version': '136',
          },
        },
      );
      console.log('Salary updated:', response.data);
      setIsEditingSalary(false);
    } catch (error) {
      console.error('Error updating salary:', error);
    }
  };

  const handleCityUpdate = async () => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/graphql',
        {
          query: mutationToUpdateOnePerson,
          variables: {
            idToUpdate: currentIndividual?.id,
            input: { city: city },
          },
        },
        {
          headers: {
            authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            'content-type': 'application/json',
            'x-schema-version': '136',
          },
        },
      );
      console.log('City updated:', response.data);
      setIsEditingCity(false);
    } catch (error) {
      console.error('Error updating city:', error);
    }
  };

  const handleStopCandidate = async () => {
    try {
      const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL + '/candidate-sourcing/stop-chat', { candidateId: currentCandidateId }, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } });
      console.log('Response:', response);
    } catch (error) {
      console.error('Error stopping candidate:', error);
    }
  };

  const addToast = (message: string, type: 'success' | 'error') => {
    const newToast = {
      id: Date.now(),
      message,
      type,
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      removeToast(newToast.id);
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

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

      // Merge with pending message if it exists and hasn't appeared in the response
      if (pendingMessage && !sortedMessages.some((msg: frontChatTypes.MessageNode) => 
          msg.message === pendingMessage.message && 
          Math.abs(dayjs(msg.createdAt).diff(dayjs(pendingMessage.createdAt), 'second')) < 30
      )) {
        setMessageHistory([...sortedMessages, pendingMessage]);
      } else {
        setMessageHistory(sortedMessages);
        setPendingMessage(null);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Keep pending message in history if fetch fails
      setMessageHistory(pendingMessage ? [pendingMessage] : []);
    }
  }




  console.log('Current Individual::', currentIndividual);
  let currentMessageObject = currentIndividual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[currentIndividual?.candidates?.edges[0]?.node?.whatsappMessages?.edges?.length - 1]?.node?.messageObj;

  const handleInvokeChatAndRunToolCalls = async (
    phoneNumber: string | undefined,
    latestResponseGenerated: string,
    setLatestResponseGenerated: React.Dispatch<React.SetStateAction<string>>,
    setListOfToolCalls: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
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
    const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-chat', { messageToSend: messageText, phoneNumberTo: currentIndividual?.phone }, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } });
  };

  const handleSubmit = async () => {
    console.log('submit');
    //@ts-ignore
    const messageSent = inputRef?.current?.value || ""; 
    console.log(messageSent);

    if (inputRef.current) {
      inputRef.current.value = '';
    }

    const newMessage: frontChatTypes.MessageNode = {
      recruiterId: currentWorkspaceMember?.id || '',
      message: messageSent || "",
      candidateId: currentCandidateId || "",
      jobsId: currentIndividual?.candidates?.edges[0]?.node?.jobs?.id || "",
      position: messageHistory.length + 1,
      messageType: 'template',
      phoneTo: currentIndividual?.phone || "",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      id: Date.now().toString(),
      name: `${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`,
      phoneFrom: 'system',
      messageObj: { content: messageSent },
      whatsappDeliveryStatus: 'sent',
    };

    setMessageHistory(prev => [...prev, newMessage]);
    await sendMessage(messageSent);
    
    props.onMessageSent();
    scrollToBottom();


  };

  useEffect(() => {
    if (currentCandidateId) {
      getlistOfMessages(currentCandidateId).then(() => {
        scrollToBottom();
      });
      scrollToBottom();
    }
  }, [props.individuals, props.selectedIndividual]);



  const handleShareJD = async () => {
    console.log('share JD');
    //@ts-ignore
    const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-jd-from-frontend', { phoneNumberTo: currentIndividual?.phone }, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } });
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/graphql',
        {
          query: mutationToUpdateOneCandidate,
          variables: {
            idToUpdate: currentCandidateId,
            input: { status: newStatus },
          },
        },
        {
          headers: {
            authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            'content-type': 'application/json',
            'x-schema-version': '66',
          },
        },
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


    const newLength = newMessageHistory.length;
    const diff = newLength - oldLength;
    const arrObjOfToolCalls = response.data.slice(newLength - diff, newLength + 1);

    let latestObjectText = arrObjOfToolCalls?.filter((obj: any) => obj?.role === 'assistant' && (obj?.content !== null || obj?.content !== '')).pop()?.content || 'Failed to retrieve bot message';

    if (arrObjOfToolCalls.filter((obj: any) => obj?.tool_calls?.length > 0)?.length > 0) {
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

  const copyToClipboard = (text: any, field: any) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyableFieldComponent: React.FC<{ label: string; value: string; field: string; alwaysShowFull?: boolean }> = ({ label, value, field, alwaysShowFull = false }) => (
    <CopyableField onClick={() => copyToClipboard(value, field)} title={copiedField === field ? 'Copied!' : 'Click to copy'}>
      {label}: {alwaysShowFull ? value : ``}
      {copiedField === field ? <CheckIcon /> : <CopyIcon />}
    </CopyableField>
  );

  const allIndividualsForCurrentJob = allIndividuals?.filter(individual => individual?.candidates?.edges[0]?.node?.jobs.id === currentIndividual?.candidates?.edges[0]?.node?.jobs.id);

  const lastStatus = currentIndividual?.candidates?.edges[0]?.node?.status;
  const totalCandidates = allIndividualsForCurrentJob?.length;
  const screeningState = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === 'SCREENING').length;
  const screeningPercent = ((allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === 'SCREENING').length / allIndividualsForCurrentJob.length) * 100).toFixed(1);
  const unresponsive = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === null).length;
  const unresponsivePercent = ((allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === null).length / allIndividualsForCurrentJob.length) * 100).toFixed(1);
  const notInterested = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === 'NOT_INTERESTED').length;
  const notInterestedPercent = ((allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === 'NOT_INTERESTED').length / allIndividualsForCurrentJob.length) * 100).toFixed(1);
  const notFit = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === 'NOT_FIT').length;
  const notFitPercent = ((allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === 'NOT_FIT').length / allIndividualsForCurrentJob.length) * 100).toFixed(1);
  const recruiterInterviews = allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === 'RECRUITER_INTERVIEW').length;
  const recruiterInterviewsPercent = ((allIndividualsForCurrentJob?.filter(individual => individual?.candidates?.edges[0]?.node?.status === 'RECRUITER_INTERVIEW').length / allIndividualsForCurrentJob.length) * 100).toFixed(1);
  const candidateEngagementStatus = currentIndividual?.candidates?.edges[0]?.node?.engagementStatus;
  const candidateStopChatStatus = currentIndividual?.candidates?.edges[0]?.node?.stopChat;

  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedChatLayer, setSelectedChatLayer] = useState('');

  const handleTemplateSend = async (templateName: string) => {
    try {
      console.log("templateName:", templateName);
      console.log("process.env.REACT_APP_SERVER_BASE_URL:", process.env.REACT_APP_SERVER_BASE_URL);
      console.log("currentIndividual?.phone:",currentIndividual?.phone);
      const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL + '/whatsapp-test/send-template-message', { templateName:templateName, phoneNumberTo: currentIndividual?.phone.replace("+","") }, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } });
      console.log("This is reponse:", response)
      addToast('Template sent successfully', 'success');
      setSelectedTemplate(''); // Reset selection after successful send

      props.onMessageSent();

    const newMessage: frontChatTypes.MessageNode = {
      recruiterId: currentWorkspaceMember?.id || '',
      message: templateName,
      candidateId: currentCandidateId || "",
      jobsId: currentIndividual?.candidates?.edges[0]?.node?.jobs?.id || "",
      position: messageHistory.length + 1,
      messageType: 'template',
      phoneTo: currentIndividual?.phone || "",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      id: Date.now().toString(),
      name: `${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`,
      phoneFrom: 'system',
      messageObj: { content: templateName },
      whatsappDeliveryStatus: 'sent',
    };

    setMessageHistory(prev => [...prev, newMessage]);
            scrollToBottom();

    } catch (error) {
      addToast('Failed to send template', 'error');
      console.error('Error sending template:', error);
    }
  };

  const handleStartNewChatLayer = async (chatLayer: string) => {
    try {
      await axios.post(process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-chatLayer-start', { chatLayer, phoneNumberTo: currentIndividual?.phone }, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } });
      addToast('Chat layer started successfully', 'success');
      setSelectedChatLayer(''); // Reset selection after successful start
    } catch (error) {
      addToast('Failed to start chat layer', 'error');
      console.error('Error starting chat layer:', error);
    }
  };

  console.log('Current Individual::', currentIndividual);
  console.log('Current currentWorkspaceMember::', currentWorkspaceMember);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {(props.selectedIndividual && (
          <StyledWindow>
            <ChatContainer>
              <ChatView ref={chatViewRef}>
                <StyledTopBar>
                  <TopbarContainer>
                    <MainInfo>
                      <FieldsContainer>
                        <CopyableFieldComponent label="Name" value={`${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`} field="name" alwaysShowFull={true} />
                        <CopyableFieldComponent label="Phone" value={currentIndividual?.phone || ''} field="phone" />
                        <CopyableFieldComponent label="Person ID" value={currentIndividual?.id || ''} field="personId" />
                        <CopyableFieldComponent label="Candidate ID" value={currentIndividual?.candidates.edges[0].node.id || ''} field="candidateId" />
                      </FieldsContainer>
                      <AdditionalInfoAndButtons>
                        <AdditionalInfo>
                          <AdditionalInfoContent
                            messageCount={messageHistory?.length || 0}
                            jobName={currentIndividual?.candidates?.edges[0]?.node?.jobs?.name || ''}
                            salary={salary}
                            city={city}
                            isEditingSalary={isEditingSalary}
                            isEditingCity={isEditingCity}
                            onSalaryEdit={() => setIsEditingSalary(true)}
                            onCityEdit={() => setIsEditingCity(true)}
                            onSalaryUpdate={handleSalaryUpdate}
                            onCityUpdate={handleCityUpdate}
                            setSalary={setSalary}
                            setCity={setCity}
                          />
                        </AdditionalInfo>
                        <ButtonGroup>
                          <StyledSelect value={lastStatus || ''} onChange={e => handleStatusUpdate(e.target.value)}>
                            {' '}
                            <option value="" disabled>
                              Update Status
                            </option>{' '}
                            {statusesArray.map(status => (
                              <option key={status} value={status}>
                                {' '}
                                {statusLabels[status]}{' '}
                              </option>
                            ))}{' '}
                          </StyledSelect>
                          <StyledButton onClick={handleStopCandidate} bgColor="black" data-tooltip="Stop Chat">
                            {' '}
                            <StopIcon />{' '}
                          </StyledButton>
                          <StyledButton onClick={handleNavigateToPersonPage} bgColor="black" data-tooltip="Person">
                            {' '}
                            <PersonIcon />{' '}
                          </StyledButton>
                          <StyledButton onClick={handleNavigateToCandidatePage} bgColor="black" data-tooltip="Candidate">
                            {' '}
                            <CandidateIcon />{' '}
                          </StyledButton>

                          <AttachmentButton onClick={handleToggleAttachmentPanel} bgColor="black" data-tooltip="View Attachments">
                            {' '}
                            <AttachmentIcon />
                          </AttachmentButton>
                        </ButtonGroup>
                      </AdditionalInfoAndButtons>
                    </MainInfo>
                  </TopbarContainer>
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
              <NotesPanel>
                {currentCandidateId && (
                  <Notes
                    targetableObject={{
                      targetObjectNameSingular: 'candidate',
                      id: currentCandidateId,
                    }}
                  />
                )}
              </NotesPanel>
            </ChatContainer>
            <StyledChatInputBox>
              <Container>
                {/* <PreviewSection>
                  <SectionHeader>
                    <HeaderIcon viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </HeaderIcon>
                    <HeaderText>Bot Response Preview</HeaderText>
                  </SectionHeader>
                  <StyledTextArea ref={botResponsePreviewRef} placeholder="Bot Response Preview will appear here..." disabled />
                  <ButtonContainer>
                    <ActionButton onClick={() => handleRetrieveBotMessage(currentIndividual?.phone, latestResponseGenerated, setLatestResponseGenerated, listOfToolCalls, setListOfToolCalls, messageHistory, setMessageHistory)}>
                      Retrieve Bot Response
                    </ActionButton>
                    <ActionButton onClick={() => handleInvokeChatAndRunToolCalls(currentIndividual?.phone, latestResponseGenerated, setLatestResponseGenerated, setListOfToolCalls)}>Invoke Chat + Run tool calls</ActionButton>
                    <ToolCallsText>Tools Called: {listOfToolCalls?.map(tool => tool + ', ')}</ToolCallsText>
                  </ButtonContainer>
                </PreviewSection> */}

                <PreviewSection>
                  <SectionHeader>
                    <HeaderIcon viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5h16a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z" />
                    </HeaderIcon>
                    <HeaderText>Templates & Chat Layers</HeaderText>
                  </SectionHeader>
                    <div>
                    <Select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                        <option value="" disabled> Select a template </option>
                        {templates.map(template => (
                        <option key={template} value={template}>{template}</option>
                        ))}
                    </Select>
                    <ActionButton onClick={() => handleTemplateSend(selectedTemplate)}>Send Template</ActionButton>
                    </div>
                    {/* <br />
                    <div>
                    <Select value={selectedChatLayer} onChange={e => setSelectedChatLayer(e.target.value)}>
                        <option value="" disabled> Select a ChatLayer </option>
                        {chatLayers.map(layer => (
                        <option key={layer} value={layer}>{layer}</option>
                        ))}
                    </Select>
                    <ActionButton onClick={() => handleStartNewChatLayer(selectedTemplate)}>Start New Chat Layer</ActionButton>
                    </div> */}
                </PreviewSection>
              </Container>

              <NotificationContainer>
                {toasts.map(toast => (
                  <Notification key={toast.id} type={toast.type}>
                    <span>{toast.message}</span>
                    <CloseButton onClick={() => removeToast(toast.id)}>✕</CloseButton>
                  </Notification>
                ))}
              </NotificationContainer>

                <div style={{ display: 'flex' }}>
                <StyledChatInput
                  type="text"
                  ref={inputRef}
                  placeholder="Type your message"
                  onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                  }}
                />
                <StyledButtonBottom onClick={handleSubmit}>Submit</StyledButtonBottom>
                <StyledButtonBottom onClick={handleShareJD}>Share JD</StyledButtonBottom>
                </div>
              <div style={{ display: 'flex' }}>
                Last Status: {lastStatus} | Total: {totalCandidates} | Screening: {screeningState} ({screeningPercent}%) | Unresponsive: {unresponsive} ({unresponsivePercent}%) | Not Interested: {notInterested} ({notInterestedPercent}%) | Not Fit:{' '}
                {notFit} ({notFitPercent}%) | Recruiter Interviews: {recruiterInterviews} ({recruiterInterviewsPercent}%)
              </div>
            </StyledChatInputBox>
          </StyledWindow>
        )) || (
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
