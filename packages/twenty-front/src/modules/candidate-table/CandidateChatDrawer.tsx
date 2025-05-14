import { tokenPairState } from '@/auth/states/tokenPairState';
import { processedDataSelector, tableStateAtom } from '@/candidate-table/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TabList } from '@/ui/layout/tab/components/TabList';
import { useTabList } from '@/ui/layout/tab/hooks/useTabList';
import styled from '@emotion/styled';
import { IconFileText, IconMessages, IconVideo } from '@tabler/icons-react';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { graphqlToFetchAllCandidateData, MessageNode } from 'twenty-shared';
import AttachmentPanel from './AttachmentPanel';
import { CandidateInfoHeader } from './CandidateInfoHeader';
import VideoInterviewTab from './VideoInterviewTab';
import { useTemplates } from './hooks/useTemplates';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

const TabContainer = styled.div`
  padding: 0 ${({ theme }) => theme.spacing(2)};
`;

const TabContent = styled.div`
  flex: 1;
  height: calc(100% - 120px); /* Adjusted to make room for message input */
  overflow-y: auto;
`;

const ChatView = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column-reverse;
`;

const DateSeparator = styled.div`
  text-align: center;
  margin: 16px 0;
  color: ${props => props.theme.font.color.secondary};
  font-size: ${props => props.theme.font.size.sm};
`;

const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const MessageBubble = styled.div<{ isSent: boolean }>`
  max-width: 70%;
  margin: ${props => props.isSent ? '8px 8px 8px auto' : '8px'};
  padding: 12px 16px;
  border-radius: 16px;
  background-color: ${props => props.isSent ? '#2563eb' : '#f3f4f6'};
  color: ${props => props.isSent ? 'white' : 'inherit'};
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  position: relative;

  ${props => props.isSent ? `
    border-bottom-right-radius: 4px;
  ` : `
    border-bottom-left-radius: 4px;
  `}
`;

const MessageStatus = styled.div<{ isSent: boolean }>`
  font-size: 11px;
  color: ${props => props.theme.font.color.light};
  margin-top: 4px;
  text-align: ${props => props.isSent ? 'right' : 'left'};
  display: flex;
  align-items: center;
  justify-content: ${props => props.isSent ? 'flex-end' : 'flex-start'};
  gap: 4px;
`;

const StatusIcon = styled.span<{ status: string }>`
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${props => {
      switch (props.status) {
        case 'sent':
          return '#9CA3AF';
        case 'delivered':
          return '#10B981';
        case 'read':
          return '#3B82F6';
        case 'failed':
          return '#EF4444';
        default:
          return '#9CA3AF';
      }
    }};
  }
`;

const MessageTime = styled.div<{ isSent: boolean }>`
  font-size: 11px;
  color: ${props => props.theme.font.color.light};
  margin-top: 4px;
  text-align: ${props => props.isSent ? 'right' : 'left'};
`;

const MessageGroup = styled.div`
  margin: 8px 0;
`;

const DateLabel = styled.span`
  background-color: ${props => props.theme.background.primary};
  padding: 0 12px;
  color: ${props => props.theme.font.color.light};
  font-size: 12px;
  position: relative;
  z-index: 1;
`;

// Message input styles
const MessageInputContainer = styled.div`
  border-top: 1px solid ${props => props.theme.border.color.light};
  padding: ${props => props.theme.spacing(2)};
  background-color: ${props => props.theme.background.primary};
`;

const MessageInputTabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.border.color.light};
  margin-bottom: ${props => props.theme.spacing(2)};
`;

const MessageInputTab = styled.div<{ isActive: boolean }>`
  padding: ${props => props.theme.spacing(1)} ${props => props.theme.spacing(2)};
  cursor: pointer;
  color: ${props => props.isActive ? props.theme.font.color.primary : props.theme.font.color.tertiary};
  font-weight: ${props => props.isActive ? 'bold' : 'normal'};
  border-bottom: 2px solid ${props => props.isActive ? props.theme.font.color.primary : 'transparent'};
`;

const StyledChatInput = styled.input`
  width: 100%;
  padding: ${props => props.theme.spacing(2)};
  border-radius: ${props => props.theme.border.radius.md};
  border: 1px solid ${props => props.theme.border.color.medium};
  font-size: ${props => props.theme.font.size.md};
  outline: none;
  &:focus {
    border-color: ${props => props.theme.font.color.primary};
  }
`;

const StyledButton = styled.button`
  padding: ${props => props.theme.spacing(2)} ${props => props.theme.spacing(3)};
  background-color: ${props => props.theme.color.blue80};
  color: white;
  border: none;
  border-radius: ${props => props.theme.border.radius.md};
  font-weight: 500;
  cursor: pointer;
  margin-left: ${props => props.theme.spacing(2)};
  &:hover {
    background-color: ${props => props.theme.color.gray};
    color: black;

  }
`;

const TemplateContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing(2)};
`;

const TemplateSelect = styled.select`
  padding: ${props => props.theme.spacing(2)};
  border-radius: ${props => props.theme.border.radius.md};
  border: 1px solid ${props => props.theme.border.color.medium};
  font-size: ${props => props.theme.font.size.md};
  outline: none;
  &:focus {
    border-color: ${props => props.theme.font.color.primary};
  }
`;

const TemplatePreview = styled.div`
  padding: ${props => props.theme.spacing(2)};
  border: 1px solid ${props => props.theme.border.color.light};
  border-radius: ${props => props.theme.border.radius.md};
  background-color: ${props => props.theme.background.secondary};
  min-height: 80px;
  font-size: ${props => props.theme.font.size.sm};
  color: ${props => props.theme.font.color.secondary};
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
`;

const formatDate = (date: string) => {
  const messageDate = dayjs(date);
  const today = dayjs();
  
  if (messageDate.isSame(today, 'day')) {
    return 'Today';
  } else if (messageDate.isSame(today.subtract(1, 'day'), 'day')) {
    return 'Yesterday';
  } else {
    return messageDate.format('DD MMM YYYY');
  }
};

const formatTime = (date: string) => {
  return dayjs(date).format('HH:mm');
};

const groupMessagesByDate = (messages: MessageNode[]) => {
  const groups: { [key: string]: MessageNode[] } = {};
  
  messages.forEach(message => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });

  return groups;
};

// Add type definitions at the top of the file after imports
type WhatsAppMessage = {
  node: {
    id: string;
    whatsappDeliveryStatus: string;
  };
};

type CandidateData = {
  id: string;
  personId: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  checkbox: boolean;
  startChat: boolean;
  startChatCompleted: boolean;
  engagementStatus: string | true;
  messagingChannel: string;
  whatsappMessages?: {
    edges: WhatsAppMessage[];
  };
};

export const CandidateChatDrawer = () => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const tableState = useRecoilValue(tableStateAtom);
  const processedData = useRecoilValue(processedDataSelector);
  const candidateId = tableState.selectedRowIds[0];
  const [messageHistory, setMessageHistory] = useState<MessageNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string>('Candidate');
  const prevCandidateIdRef = useRef<string | null>(null);
  const [candidateData, setCandidateData] = useState<any>(null);
  const { enqueueSnackBar } = useSnackBar();
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Use the templates hook
  const { templates, templatePreviews, isLoading: isLoadingTemplates } = useTemplates();
  
  // Tab handling for main tabs
  const tabListId = 'candidate-chat-drawer-tabs';
  const { activeTabId, setActiveTabId } = useTabList(tabListId);
  const tabs = [
    {
      id: 'chat',
      title: 'Chat',
      Icon: IconMessages,
    },
    {
      id: 'cv',
      title: 'CV',
      Icon: IconFileText,
    },
    {
      id: 'video-interview',
      title: 'Video Interview',
      Icon: IconVideo,
    },
  ];

  // Message input tabs
  const [activeMessageTab, setActiveMessageTab] = useState<'direct' | 'template'>('direct');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!isLoading) {
      scrollToBottom();
    }
  }, [messageHistory, isLoading]);

  const showSnackbar = (message: string, type: 'success' | 'error') => {
    enqueueSnackBar(message, {
      variant:
        type === 'success' ? SnackBarVariant.Success : SnackBarVariant.Error,
      duration: 5000,
    });
  };

  const getTemplatePreview = (templateName: string): string => {
    if (!templateName) return 'Select a template to see preview';
    return templatePreviews[templateName] || 'Template preview not available';
  };

  const fetchMessages = async () => {
    if (!candidateId || !tokenPair?.accessToken?.token) {
      console.log('Missing candidateId or token, skipping fetch');
      setIsLoading(false);
      return;
    }
    
    try {
      
      console.log('Fetching messages for candidateId:', candidateId);
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
        { candidateId },
        { headers: { Authorization: `Bearer ${tokenPair.accessToken.token}` } }
      );
      console.log('Received message data:', response.data);
      
      const sortedMessages = response.data.sort(
        (a: any, b: any) => b.position - a.position
      );

      // Check if messages have actually changed
      const hasMessagesChanged = JSON.stringify(sortedMessages) !== JSON.stringify(messageHistory);
      
      if (hasMessagesChanged) {
        setIsLoading(true);
        setError(null);
        
        // Fetch candidate name if available in the messages
        if (sortedMessages.length > 0 && sortedMessages[0].candidateName) {
          setCandidateName(sortedMessages[0].candidateName);
        }

        setMessageHistory(sortedMessages);
      } else {
        console.log('No changes in messages, skipping update');
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      setError('Failed to load chat messages');
      setMessageHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCandidateData = async () => {
    if (!candidateId || !tokenPair?.accessToken?.token) {
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPair.accessToken.token}`,
        },
        body: JSON.stringify({
          query: graphqlToFetchAllCandidateData,
          variables: {
            filter: {
              id: { eq: candidateId }
            }
          },
        }),
      });
      
      const responseData = await response.json();
      console.log('Response data:', responseData);
      if (responseData?.data?.candidates?.edges?.[0]?.node) {
        const candidate = responseData.data.candidates.edges[0].node;
        setCandidateData(candidate);
        if (candidate.name) {
          setCandidateName(candidate.name);
        }
        if (candidate?.people?.phones?.primaryPhoneNumber) {
          setPhoneNumber(candidate?.people?.phones?.primaryPhoneNumber);
        }
      }
    } catch (error) {
      console.error('Error fetching candidate data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start polling when component mounts and candidateId is available
  useEffect(() => {
    if (candidateId) {
      // Initial fetch
      fetchMessages();
      fetchCandidateData();

      // Set up polling interval
      pollingIntervalRef.current = setInterval(() => {
        fetchMessages();
      }, 10000); // Poll every 10 seconds

      // Cleanup interval on unmount or when candidateId changes
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [candidateId]);

  // Set default active tab
  useEffect(() => {
    if (!activeTabId) {
      // Check if we have a default tab in localStorage
      const defaultTab = localStorage.getItem('candidate-chat-default-tab');
      if (defaultTab && (defaultTab === 'chat' || defaultTab === 'cv' || defaultTab === 'video-interview')) {
        setActiveTabId(defaultTab);
        // Clear the stored value after using it
        localStorage.removeItem('candidate-chat-default-tab');
      } else {
        setActiveTabId('chat');
      }
    }
  }, [activeTabId, setActiveTabId]);

  // Add effect to mark messages as read when drawer opens
  useEffect(() => {
    if (candidateId && tokenPair?.accessToken?.token) {
      // Get unread messages from the message history
      const unreadMessageIds = messageHistory
        ?.filter(msg => msg.whatsappDeliveryStatus === 'receivedFromCandidate')
        ?.map(msg => msg.id) || [];

      console.log("Unread message IDs from history:", unreadMessageIds);
      
      if (unreadMessageIds.length > 0) {
        // Update messages in the database
        axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/update-whatsapp-delivery-status`,
          { listOfMessagesIds: unreadMessageIds },
          { headers: { Authorization: `Bearer ${tokenPair.accessToken.token}` } },
        ).then(() => {
          // Update local message history to mark messages as read
          setMessageHistory(prev => 
            prev.map(msg => 
              unreadMessageIds.includes(msg.id) 
                ? { ...msg, whatsappDeliveryStatus: 'read' }
                : msg
            )
          );
        }).catch(error => {
          console.error('Error updating message status:', error);
        });
      }
    }
  }, [candidateId, tokenPair, messageHistory]);

  const sendMessage = async (messageText: string) => {
    if (!phoneNumber) {
      showSnackbar('Phone number not available', 'error');
      return;
    }
    
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/send-chat`,
        { 
          messageToSend: messageText, 
          phoneNumberTo: phoneNumber 
        },
        { 
          headers: { 
            Authorization: `Bearer ${tokenPair?.accessToken?.token}` 
          } 
        },
      );
      
      // Add message to the UI immediately
      const newMessage: MessageNode = {
        recruiterId: '',
        message: messageText,
        candidateId: candidateId || '',
        jobsId: '',
        position: messageHistory.length + 1,
        messageType: 'direct',
        phoneTo: phoneNumber || '',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        id: Date.now().toString(),
        name: 'botMessage',
        phoneFrom: 'system',
        messageObj: { content: messageText },
        whatsappDeliveryStatus: 'sent',
      };
      
      setMessageHistory(prev => [newMessage, ...prev]);
      
      // Clear input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      
      showSnackbar('Message sent successfully', 'success');
    } catch (error) {
      console.error('Error sending message:', error);
      showSnackbar('Failed to send message', 'error');
    }
  };

  const handleTemplateSend = async (templateName: string) => {
    if (!templateName) {
      showSnackbar('Please select a template first', 'error');
      return;
    }
    
    if (!phoneNumber) {
      showSnackbar('Phone number not available', 'error');
      return;
    }
    
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/whatsapp-test/send-template-message`,
        {
          templateName: templateName,
          phoneNumberTo: phoneNumber.replace('+', ''),
        },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        },
      );
      
      showSnackbar('Template sent successfully', 'success');
      setSelectedTemplate('');
      
      // Add template message to the UI
      const newMessage: MessageNode = {
        recruiterId: '',
        message: `Template: ${templateName}\n${getTemplatePreview(templateName)}`,
        candidateId: candidateId || '',
        jobsId: '',
        position: messageHistory.length + 1,
        messageType: 'template',
        phoneTo: phoneNumber || '',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        id: Date.now().toString(),
        name: 'botMessage',
        phoneFrom: 'system',
        messageObj: { content: templateName },
        whatsappDeliveryStatus: 'sent',
      };
      
      setMessageHistory(prev => [newMessage, ...prev]);
    } catch (error) {
      showSnackbar('Failed to send template', 'error');
      console.error('Error sending template:', error);
    }
  };

  const handleSubmit = () => {
    const messageText = inputRef.current?.value.trim();
    if (!messageText) return;
    
    sendMessage(messageText);
  };

  const renderChatTab = () => (
    <ChatView ref={chatContainerRef}>
      {isLoading ? (
        <div>Loading chat history... for {candidateId}</div>
      ) : error ? (
        <div>{error}</div>
      ) : messageHistory.length === 0 ? (
        <div>No chat messages found for {candidateName} with id {candidateId}</div>
      ) : (
        <MessageContainer>
          {Object.entries(groupMessagesByDate(messageHistory)).map(([date, messages]) => (
            <React.Fragment key={date}>
              <DateSeparator>
                <DateLabel>{date}</DateLabel>
              </DateSeparator>
              {messages.map((message) => {
                const isSent = message.name === 'botMessage';
                const status = message.whatsappDeliveryStatus || 'sent';
                
                return (
                  <MessageGroup key={message.id}>
                    <MessageBubble isSent={isSent}>
                      {message.message}
                    </MessageBubble>
                    <MessageStatus isSent={isSent}>
                      <StatusIcon status={status} />
                      {formatTime(message.createdAt)}
                      {isSent && (
                        <span>
                          {status === 'sent' && 'Sent'}
                          {status === 'delivered' && 'Delivered'}
                          {status === 'read' && 'Read'}
                          {status === 'failed' && 'Failed'}
                        </span>
                      )}
                    </MessageStatus>
                  </MessageGroup>
                );
              })}
            </React.Fragment>
          ))}
        </MessageContainer>
      )}
    </ChatView>
  );

  const renderCVTab = () => (
    <AttachmentPanel 
      isOpen={true}
      onClose={() => setActiveTabId('chat')}
      candidateId={candidateId || ''}
      candidateName={candidateName}
      PanelContainer={StyledInlineContainer}
    />
  );

  const renderVideoInterviewTab = () => (
    <VideoInterviewTab 
      candidateData={candidateData}
      isLoading={isLoading}
    />
  );

  // Custom styled container for inline usage inside the drawer
  const StyledInlineContainer = styled.div<{ isOpen: boolean }>`
    position: relative;
    width: 100%;
    height: 100%;
    background-color: #f5f5f5;
    overflow-y: auto;
  `;

  const renderMessageInput = () => (
    <MessageInputContainer>
      <MessageInputTabContainer>
        <MessageInputTab 
          isActive={activeMessageTab === 'direct'} 
          onClick={() => setActiveMessageTab('direct')}
        >
          Direct Message
        </MessageInputTab>
        <MessageInputTab 
          isActive={activeMessageTab === 'template'} 
          onClick={() => setActiveMessageTab('template')}
        >
          Template Message
        </MessageInputTab>
      </MessageInputTabContainer>

      {activeMessageTab === 'direct' ? (
        <InputWrapper>
          <StyledChatInput
            ref={inputRef}
            type="text"
            placeholder="Type your message"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <StyledButton onClick={handleSubmit}>Send</StyledButton>
        </InputWrapper>
      ) : (
        <TemplateContainer>
          <TemplateSelect 
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            <option value="" disabled>Select a template</option>
            {templates.map((template) => (
              <option key={template} value={template}>{template}</option>
            ))}
          </TemplateSelect>
          <TemplatePreview>
            {isLoadingTemplates 
              ? "Loading templates..." 
              : getTemplatePreview(selectedTemplate)}
          </TemplatePreview>
          <StyledButton 
            onClick={() => handleTemplateSend(selectedTemplate)}
            disabled={!selectedTemplate}
          >
            Send Template
          </StyledButton>
        </TemplateContainer>
      )}
    </MessageInputContainer>
  );

  return (
    <StyledContainer>
      <CandidateInfoHeader />
      <TabContainer>
        <TabList
          tabListInstanceId={tabListId}
          tabs={tabs}
          loading={isLoading}
        />
      </TabContainer>
      <TabContent>
        {!candidateId ? (
          <div style={{padding: '20px'}}>No candidate selected</div>
        ) : isLoading ? (
          <div style={{padding: '20px'}}>Loading chat...</div>
        ) : error ? (
          <div style={{padding: '20px'}}>Error: {error}</div>
        ) : (
          <>
            {activeTabId === 'chat' && renderChatTab()}
            {activeTabId === 'cv' && renderCVTab()}
            {activeTabId === 'video-interview' && renderVideoInterviewTab()}
          </>
        )}
      </TabContent>
      {candidateId && activeTabId === 'chat' && renderMessageInput()}
    </StyledContainer>
  );
}; 