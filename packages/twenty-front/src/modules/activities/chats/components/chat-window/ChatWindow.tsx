import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import axios from 'axios';
import dayjs from 'dayjs';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';
import SingleChatContainer from '../SingleChatContainer';

import React, { useEffect, useRef, useState } from 'react';

// import { Server } from 'socket.io';
// import { io } from 'socket.io-client';
// import { p } from 'node_modules/msw/lib/core/GraphQLHandler-907fc607';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';

import AttachmentPanel from '../AttachmentPanel';

import { ChatContainer, ChatView, FieldsContainer, StyledButtonBottom, StyledChatInput, StyledChatInputBox, StyledDateComponent, StyledScrollingView, StyledTopBar, StyledWindow } from '@/activities/chats/components/chat-window/ChatWindowStyles';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { useNavigate } from 'react-router-dom';
import {
  graphQltoUpdateOneCandidate,
  MessageNode,
  mutationToUpdateOnePerson,
  PersonNode,
} from 'twenty-shared';
import { calculateCandidateStatistics, calculateMessageStatistics, calculateStatusStatistics } from './chatStatistics';
// import { templates, getTemplatePreview } from './chatTemplates';

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
const interimChats = [
  'remindCandidate',
  'firstInterviewReminder',
  'secondInterviewreminder',
];
const statusesArray = Object.keys(statusLabels);

import CopyableFieldComponent from '@/activities/chats/components/chat-window/CopyableFieldComponent';

const formatDate = (date: string) => dayjs(date).format('YYYY-MM-DD');

interface ChatWindowProps {
  selectedIndividual: string;
  individuals: PersonNode[];
  onMessageSent: () => void;
  sidebarWidth: number;
}

export default function ChatWindow({
  selectedIndividual,
  individuals,
  onMessageSent,
  sidebarWidth,
}: ChatWindowProps) {
  const allIndividuals = individuals;

  const currentIndividual = allIndividuals?.find(
    (individual) => individual?.id === selectedIndividual,
  );
  const currentCandidateId = currentIndividual?.candidates?.edges[0]?.node?.id;

  const navigate = useNavigate();

  const [messageHistory, setMessageHistory] = useState<MessageNode[]>([]);
  const [latestResponseGenerated, setLatestResponseGenerated] = useState('');
  const [listOfToolCalls, setListOfToolCalls] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);

  // const [qrCode, setQrCode] = useState('');
  const [isWhatsappLoggedIn, setIsWhatsappLoggedIn] = useState(false);

  const botResponsePreviewRef = useRef(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const chatViewRef = useRef<HTMLDivElement>(null);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [isEditingCandidateStatus, setIsEditingCandidateStatus] =
    useState(false);
  const [salary, setSalary] = useState(currentIndividual?.salary || '');
  const [city, setCity] = useState(currentIndividual?.city || '');
  const [candidateStatus, setCandidateStatus] = useState(
    currentIndividual?.candidates?.edges[0].node?.candConversationStatus || '',
  );
  const [isMessagePending, setIsMessagePending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<MessageNode | null>(
    null,
  );
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);

  const [templates, setTemplates] = useState<string[]>([]);
  const [templatePreviews, setTemplatePreviews] = useState<{
    [key: string]: string;
  }>({});
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  const { enqueueSnackBar } = useSnackBar();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showSnackbar = (message: string, type: 'success' | 'error') => {
    enqueueSnackBar(message, {
      variant:
        type === 'success' ? SnackBarVariant.Success : SnackBarVariant.Error,
      duration: 5000,
    });
  };

  const fetchAllTemplates = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_SERVER_BASE_URL}/whatsapp-test/get-templates`,
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }, },
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  };

  const getTemplatePreview = (templateName: string): string => {
    if (!templateName) return 'Select a template to see preview';
    return templatePreviews[templateName] || 'Template preview not available';
  };

  useEffect(() => {
    if (currentCandidateId) {
      getlistOfMessages(currentCandidateId).then(() => {
        if (messageHistory.length > previousMessageCount) {
          scrollToBottom();
          setPreviousMessageCount(messageHistory.length);
        }
      });
    }
  }, [individuals, selectedIndividual, messageHistory.length]);

  useEffect(() => {
    setSalary(currentIndividual?.salary || '');
    setCity(currentIndividual?.city || '');
  }, [currentIndividual]);

  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const fetchedTemplates = await fetchAllTemplates();
        console.log('REceived templates::', fetchedTemplates);
        const templateNames = fetchedTemplates.templates
          .filter( (template: { status: string }) => template.status === 'APPROVED', )
          .map((template: { name: any }) => template.name);
        console.log('Template Names::', templateNames);
        const previews: { [key: string]: string } = {};
        fetchedTemplates.templates.forEach(
          (template: { components: any[]; name: string | number }) => {
            const bodyComponent = template.components.find( (comp) => comp.type === 'BODY', );
            if (bodyComponent) {
              previews[template.name] = bodyComponent.text;
            }
          },
        );

        setTemplates(templateNames);
        setTemplatePreviews(previews);
      } catch (error) {
        console.error('Error loading templates:', error);
        showSnackbar('Failed to load templates', 'error');
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);


  const currentCandidateName =
    currentIndividual?.name.firstName + ' ' + currentIndividual?.name.lastName;

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
      console.log('Error updating salary:', error);
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
      console.log('Error updating city:', error);
    }
  };
  const handleCandidateStatusUpdate = async () => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/graphql',
        {
          query: mutationToUpdateOnePerson,
          variables: {
            idToUpdate: currentIndividual?.id,
            input: { candConversationStatus: candidateStatus },
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
      console.log('candidate status updated:', response.data);
      setIsEditingCandidateStatus(false);
    } catch (error) {
      console.log('Error updating candidate status:', error);
      setIsEditingCandidateStatus(false);
    }
  };

  const handleStopCandidate = async () => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/stop-chat',
        { candidateId: currentCandidateId },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        },
      );
      console.log('Response:', response);
    } catch (error) {
      console.log('Error stopping candidate:', error);
    }
  };

  const sendMessage = async (messageText: string) => {
    console.log('send message');
    const response = await axios.post(
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-chat',
      {
        messageToSend: messageText,
        phoneNumberTo: currentIndividual?.phones?.primaryPhoneNumber,
      },
      { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } },
    );
  };

  async function getlistOfMessages(currentCandidateId: string) {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL +
          '/arx-chat/get-all-messages-by-candidate-id',
        { candidateId: currentCandidateId },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        },
      );
      const sortedMessages = response.data.sort(
        (a: MessageNode, b: MessageNode) => {
          return dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf();
        },
      );

      if (
        pendingMessage &&
        !sortedMessages.some(
          (msg: MessageNode) =>
            msg.message === pendingMessage.message &&
            Math.abs(
              dayjs(msg.createdAt).diff(
                dayjs(pendingMessage.createdAt),
                'second',
              ),
            ) < 30,
        )
      ) {
        setMessageHistory([...sortedMessages, pendingMessage]);
      } else {
        setMessageHistory(sortedMessages);
        setPendingMessage(null);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessageHistory(pendingMessage ? [pendingMessage] : []);
    }
  }

  const handleShareJD = async () => {
    console.log('share JD');
    //@ts-ignore
    const response = await axios.post(
      process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/send-jd-from-frontend',
      { phoneNumberTo: currentIndividual?.phones?.primaryPhoneNumber },
      { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } },
    );
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/graphql',
        {
          query: graphQltoUpdateOneCandidate,
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


  const scrollToBottom = () => {
    if (chatViewRef.current) {
      chatViewRef.current.scrollTo({
        top: chatViewRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleSubmit = async () => {
    console.log('submit');
    //@ts-ignore
    const messageSent = inputRef?.current?.value || '';
    console.log(messageSent);

    if (inputRef.current) {
      inputRef.current.value = '';
    }

    const newMessage: MessageNode = {
      recruiterId: currentWorkspaceMember?.id || '',
      message: messageSent || '',
      candidateId: currentCandidateId || '',
      jobsId: currentIndividual?.candidates?.edges[0]?.node?.jobs?.id || '',
      position: messageHistory.length + 1,
      messageType: 'template',
      phoneTo: '91' + currentIndividual?.phones?.primaryPhoneNumber || '',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      id: Date.now().toString(),
      name: `${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`,
      phoneFrom: 'system',
      messageObj: { content: messageSent },
      whatsappDeliveryStatus: 'sent',
    };

    setMessageHistory((prev) => [...prev, newMessage]);
    await sendMessage(messageSent);

    scrollToBottom();
    onMessageSent();
  };

  const handleToggleAttachmentPanel = () => {
    setIsAttachmentPanelOpen(!isAttachmentPanelOpen);
  };



  const allIndividualsForCurrentJob = allIndividuals?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.jobs?.id ===
      currentIndividual?.candidates?.edges[0]?.node?.jobs?.id,
  );

  const totalCandidates = allIndividualsForCurrentJob?.length;
  const lastStatus = currentIndividual?.candidates?.edges[0]?.node?.status;

  const messageStatisticsArray = calculateMessageStatistics(allIndividualsForCurrentJob);
  const statisticsArray = calculateCandidateStatistics(allIndividualsForCurrentJob);
  const statusStatisticsArray = calculateStatusStatistics(allIndividualsForCurrentJob);

  const sortedStatistics = [...statisticsArray].sort(
    (a, b) => b.percent - a.percent,
  );

  const sortedStatusStatistics = [...statusStatisticsArray].sort(
    (a, b) => b.percent - a.percent,
  );

  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const handleTemplateSend = async (templateName: string) => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL +
          '/whatsapp-test/send-template-message',
        {
          templateName: templateName,
          phoneNumberTo: currentIndividual?.phones?.primaryPhoneNumber?.replace(
            '+',
            '',
          ),
        },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        },
      );
      console.log('This is reponse:', response);
      showSnackbar('Template sent successfully', 'success');
      setSelectedTemplate(''); // Reset selection after successful send
      onMessageSent();
      const newMessage: MessageNode = {
        recruiterId: currentWorkspaceMember?.id || '',
        message: templateName,
        candidateId: currentCandidateId || '',
        jobsId: currentIndividual?.candidates?.edges[0]?.node?.jobs?.id || '',
        position: messageHistory.length + 1,
        messageType: 'template',
        phoneTo: currentIndividual?.phones?.primaryPhoneNumber || '',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        id: Date.now().toString(),
        name: `${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`,
        phoneFrom: 'system',
        messageObj: { content: templateName },
        whatsappDeliveryStatus: 'sent',
      };

      setMessageHistory((prev) => [...prev, newMessage]);
      scrollToBottom();
    } catch (error) {
      showSnackbar('Failed to send template', 'error');
      console.error('Error sending template:', error);
    }
  };

  const [selectedInterimChat, setSelectedInterimChat] = useState('');
  const handleStartNewInterimChat = async (interimChat: string) => {
    if (!interimChat || interimChat === '') {
      showSnackbar('Please select an interim chat first', 'error');
      return;
    }

    try {
      await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL +
          '/arx-chat/start-interim-chat-prompt',
        {
          interimChat,
          phoneNumber: currentIndividual?.phones?.primaryPhoneNumber,
        },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        },
      );
      showSnackbar('Interim Chat started successfully', 'success');
      setSelectedInterimChat('');
    } catch (error) {
      showSnackbar('Failed to start interim chat', 'error');
      console.error('Error starting interim chat:', error);
    }
  };

  const handleScroll = () => {
    if (chatViewRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatViewRef.current;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;

      setUserHasScrolled(true);
      setShouldScrollToBottom(isAtBottom);
    }
  };

  const initializeRecord = useRecoilCallback(
    ({ set }) =>
      () => {
        if (currentCandidateId) {
          set(recordStoreFamilyState(currentCandidateId), {
            id: currentCandidateId,
            __typename: 'Candidate', // Add the required __typename

            // Add other required initial data
          });
        }
      },
    [],
  );

  useEffect(() => {
    if (currentCandidateId) {
      initializeRecord();
    }
  }, [currentCandidateId]);
  console.log('Candidate status is :', candidateStatus);

  console.log('Current Individual::', currentIndividual);
  console.log('Current currentWorkspaceMember::', currentWorkspaceMember);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {selectedIndividual ? (
          <StyledWindow>
            <StyledTopBar sidebarWidth={sidebarWidth}>
                  <FieldsContainer>
                    <CopyableFieldComponent
                      label="Name"
                      value={`${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`}
                      field="name"
                      alwaysShowFull={true}
                    />
                    {/* <CopyableFieldComponent
                      label="Phone"
                      value={
                        currentIndividual?.phones?.primaryPhoneNumber || ''
                      }
                      field="phone"
                    /> */}
                    {/* <CopyableFieldComponent
                      label="Person ID"
                      value={currentIndividual?.id || ''}
                      field="personId"
                    /> */}
                    {/* <CopyableFieldComponent
                      label="Candidate ID"
                      value={
                        currentIndividual?.candidates.edges[0].node.id || ''
                      }
                      field="candidateId"
                    /> */}
                  </FieldsContainer>
                  {/* <AdditionalInfoAndButtons>
                     <AdditionalInfo>
                      <AdditionalInfoContent
                        messageCount={messageHistory?.length || 0}
                        jobName={
                          currentIndividual?.candidates?.edges[0]?.node?.jobs
                            ?.name || ''
                        }
                        salary={salary}
                        city={city}
                        candidateStatus={candidateStatus}
                        isEditingSalary={isEditingSalary}
                        isEditingCity={isEditingCity}
                        isEditingCandidateStatus={isEditingCandidateStatus}
                        onSalaryEdit={() => setIsEditingSalary(true)}
                        onCityEdit={() => setIsEditingCity(true)}
                        onCandidateStatusEdit={() =>
                          setIsEditingCandidateStatus(true)
                        }
                        onSalaryUpdate={handleSalaryUpdate}
                        onCityUpdate={handleCityUpdate}
                        onCandidateStatusUpdate={handleCandidateStatusUpdate}
                        setSalary={setSalary}
                        setCity={setCity}
                        setCandidateStatus={setCandidateStatus}
                      />
                    </AdditionalInfo>
                     <ButtonGroup>
                      <StyledSelect
                        value={lastStatus || ''}
                        onChange={(e) => handleStatusUpdate(e.target.value)}
                      >
                        {' '}
                        <option value="" disabled>
                          Update Status
                        </option>{' '}
                        {statusesArray.map((status) => (
                          <option key={status} value={status}>
                            {' '}
                            {statusLabels[status]}{' '}
                          </option>
                        ))}{' '}
                      </StyledSelect>

                      <StyledSelect
                        value={selectedInterimChat}
                        onChange={(e) => setSelectedInterimChat(e.target.value)}
                      >
                        <option value="" disabled>
                          Select Interim Chat
                        </option>
                        {interimChats.map((layer) => (
                          <option key={layer} value={layer}>
                            {layer}
                          </option>
                        ))}
                      </StyledSelect>

                      <StyledButton
                        bgColor="black"
                        onClick={() =>
                          handleStartNewInterimChat(selectedInterimChat)
                        }
                        data-tooltip="Start Interim Chat"
                      >
                        Start Layer
                      </StyledButton>

                      <StyledButton
                        onClick={handleStopCandidate}
                        bgColor="black"
                        data-tooltip="Stop Chat"
                      >
                        {' '}
                        <StopIcon />{' '}
                      </StyledButton>
                      <StyledButton
                        onClick={handleNavigateToPersonPage}
                        bgColor="black"
                        data-tooltip="Person"
                      >
                        {' '}
                        <PersonIcon />{' '}
                      </StyledButton>
                      <StyledButton
                        onClick={handleNavigateToCandidatePage}
                        bgColor="black"
                        data-tooltip="Candidate"
                      >
                        {' '}
                        <CandidateIcon />{' '}
                      </StyledButton>

                      <UploadCV
                        candidateId={currentCandidateId || ''}
                        tokenPair={tokenPair}
                        onUploadSuccess={() => {
                          onMessageSent();
                        }}
                        currentIndividual={currentIndividual}
                      />

                      <AttachmentButton
                        onClick={handleToggleAttachmentPanel}
                        bgColor="black"
                        data-tooltip="View Attachments"
                      >
                        {' '}
                        <AttachmentIcon attachmentType={'TextDocument'}/>
                      </AttachmentButton>
                    </ButtonGroup> 
                  </AdditionalInfoAndButtons> */}
            </StyledTopBar>
            <ChatContainer>
              <ChatView ref={chatViewRef} onScroll={handleScroll}>
                <StyledScrollingView>
                  {messageHistory.map((message, index) => {
                    const showDateSeparator =
                      index === 0 ||
                      formatDate(messageHistory[index - 1]?.createdAt) !==
                        formatDate(message?.createdAt);
                    return (
                      <React.Fragment key={index}>
                        {' '}
                        {showDateSeparator && (
                          <p style={{ textAlign: 'center' }}>
                            {' '}
                            <StyledDateComponent>
                              {dayjs(message?.createdAt).format(
                                "ddd DD MMM, 'YY",
                              )}
                            </StyledDateComponent>{' '}
                          </p>
                        )}
                        <SingleChatContainer
                          phoneNumber={
                            currentIndividual?.phones?.primaryPhoneNumber
                          }
                          message={message}
                          messageName={`${currentIndividual?.name.firstName} ${currentIndividual?.name.lastName}`}
                        />
                      </React.Fragment>
                    );
                  })}
                </StyledScrollingView>
              </ChatView>

              {/* <NotesPanel>
                {currentCandidateId &&
                  currentWorkspaceMember &&
                  window.innerWidth > 768 && (
                    <Notes
                      targetableObject={{
                        id: currentCandidateId,
                        targetObjectNameSingular: 'candidate',
                      }}
                      key={currentCandidateId}
                    />
                  )}
              </NotesPanel> */}
            </ChatContainer>
            <StyledChatInputBox sidebarWidth={sidebarWidth}>
              {/* <Container>
                <PreviewSection>
                  <ControlsContainer>
                    <SectionHeader>
                      <HeaderIcon
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 5h16a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z"
                        />
                      </HeaderIcon>
                      <HeaderText>Templates & Chat Layers</HeaderText>
                    </SectionHeader>
                    <div>
                      <Select
                        value={selectedTemplate}
                        onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setSelectedTemplate(e.target.value)}
                      >
                        <option value="" disabled>
                          {' '}
                          Select a template{' '}
                        </option>
                        {templates.map((template) => (
                          <option key={template} value={template}>
                            {' '}
                            {template}{' '}
                          </option>
                        ))}
                      </Select>
                      <ActionButton
                        onClick={() => handleTemplateSend(selectedTemplate)}
                      >
                        Send Template
                      </ActionButton>
                    </div>
                  </ControlsContainer>

                  <TemplatePreview>
                    {getTemplatePreview(selectedTemplate)}
                  </TemplatePreview>
                </PreviewSection>
              </Container> */}

              {/* <InputWrapper> */}
                <div style={{ display: 'flex', width: '130%', gap: '8px' }}>
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
                  <StyledButtonBottom onClick={handleSubmit}>
                    Submit
                  </StyledButtonBottom>
                  <StyledButtonBottom onClick={handleShareJD}>
                    Share JD
                  </StyledButtonBottom>
                </div>
                {/* <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Last Status: {lastStatus} | Total: {totalCandidates} |{' '}
                  {sortedStatusStatistics.map((stat, index) => (
                    <React.Fragment key={stat.label}>
                      {stat.label}: {stat.count} ({stat.percent}%)
                      {index < sortedStatusStatistics.length - 1 ? ' | ' : ''}
                    </React.Fragment>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#666',
                    whiteSpace: 'nowrap',
                    overflow: 'auto',
                  }}
                >
                  Message Stats: |{' '}
                  {messageStatisticsArray.map((stat, index) => (
                    <React.Fragment key={stat.label}>
                      {stat.label}: {stat.count} ({stat.percent}%)
                      {index < messageStatisticsArray.length - 1 ? ' | ' : ''}
                    </React.Fragment>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#666',
                    whiteSpace: 'nowrap',
                    overflow: 'auto',
                  }}
                >
                  Total: {totalCandidates} |{' '}
                  {sortedStatistics.map((stat, index) => (
                    <React.Fragment key={stat.label}>
                      {stat.label}: {stat.count} ({stat.percent}%)
                      {index < sortedStatistics.length - 1 ? ' | ' : ''}
                    </React.Fragment>
                  ))}
                </div> */}
              {/* </InputWrapper> */}
            </StyledChatInputBox>
          </StyledWindow>
        ) : (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '2rem' }}>
              {/* <h1>WhatsApp QR Code</h1>
            {!isWhatsappLoggedIn ? (
              qrCode ? (
                <QRCode value={qrCode} />
              ) : (
                <p>Loading QR Code...</p>
              )
            ) : (
              <p>Your WhatsApp is logged in! Enjoy!</p>
            )} */}
            </div>
            <img
              src="/images/placeholders/moving-image/empty_inbox.png"
              alt=""
            />
            <p>Select a chat to start talking</p>
          </div>
        )}
      </div>
      <AttachmentPanel
        isOpen={isAttachmentPanelOpen}
        onClose={() => setIsAttachmentPanelOpen(false)}
        candidateId={currentCandidateId || ''}
        candidateName={currentCandidateName}
      />
    </>
  );
}
