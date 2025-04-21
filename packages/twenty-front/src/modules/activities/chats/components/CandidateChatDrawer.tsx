import { tokenPairState } from '@/auth/states/tokenPairState';
import { TabList } from '@/ui/layout/tab/components/TabList';
import { useTabList } from '@/ui/layout/tab/hooks/useTabList';
import styled from '@emotion/styled';
import { IconFileText, IconMessages, IconVideo } from '@tabler/icons-react';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { MessageNode } from 'twenty-shared';
import AttachmentPanel from '../components/AttachmentPanel';
import { selectedCandidateIdState } from '../states/selectedCandidateIdState';
import VideoInterviewTab from './VideoInterviewTab';

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
  height: calc(100% - 40px);
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

  ${props => props.isSent ? `
    border-bottom-right-radius: 4px;
  ` : `
    border-bottom-left-radius: 4px;
  `}
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

export const CandidateChatDrawer = () => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const candidateId = useRecoilValue(selectedCandidateIdState);
  const [messageHistory, setMessageHistory] = useState<MessageNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string>('Candidate');
  const prevCandidateIdRef = useRef<string | null>(null);
  const [candidateData, setCandidateData] = useState<any>(null);
  
  // Tab handling
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


  useEffect(() => {
    
    // Set default active tab
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
    
    // Skip if the candidateId is the same as the previous one to prevent duplicate requests
    if (candidateId === prevCandidateIdRef.current) {
      console.log('Same candidateId as before, skipping fetch:', candidateId);
      return;
    }
    
    prevCandidateIdRef.current = candidateId;
    
    const fetchMessages = async () => {
      if (!candidateId || !tokenPair?.accessToken?.token) {
        console.log('Missing candidateId or token, skipping fetch');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
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

        // Fetch candidate name if available in the messages
        if (sortedMessages.length > 0 && sortedMessages[0].candidateName) {
          setCandidateName(sortedMessages[0].candidateName);
        }

        setMessageHistory(sortedMessages);
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
            query: `
              query FindCandidate($filter: CandidateFilterInput) {
                candidates(filter: $filter) {
                  edges {
                    node {
                      id
                      name
                      videoInterview {
                        edges {
                          node {
                            id
                            interviewCompleted
                            interviewStarted
                            videoInterviewTemplate {
                              id
                              name
                              videoInterviewQuestions {
                                edges {
                                  node {
                                    id
                                    questionValue
                                    timeLimit
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                      videoInterviewResponse {
                        edges {
                          node {
                            id
                            transcript
                            videoInterviewQuestionId
                            attachments {
                              edges {
                                node {
                                  id
                                  type
                                  fullPath
                                  name
                                }
                              }
                            }
                          }
                        }
                      }
                      jobs {
                        id
                        name
                        company {
                          name
                        }
                      }
                    }
                  }
                }
              }
            `,
            variables: {
              filter: {
                id: { eq: candidateId }
              }
            },
          }),
        });
        
        const responseData = await response.json();
        if (responseData?.data?.candidates?.edges?.[0]?.node) {
          setCandidateData(responseData.data.candidates.edges[0].node);
          if (responseData.data.candidates.edges[0].node.name) {
            setCandidateName(responseData.data.candidates.edges[0].node.name);
          }
        }
      } catch (error) {
        console.error('Error fetching candidate data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
    fetchCandidateData();
  }, [candidateId, tokenPair, activeTabId, setActiveTabId]);

  const renderChatTab = () => (
    <ChatView>
      {isLoading ? (
        <div>Loading chat history... for {candidateId}</div>
      ) : error ? (
        <div>{error}</div>
      ) : messageHistory.length === 0 ? (
        <div>No chat messages found for {candidateId}</div>
      ) : (
        <MessageContainer>
          {Object.entries(groupMessagesByDate(messageHistory)).map(([date, messages]) => (
            <React.Fragment key={date}>
              <DateSeparator>
                <DateLabel>{date}</DateLabel>
              </DateSeparator>
              {messages.map((message) => (
                <MessageGroup key={message.id}>
                  <MessageBubble isSent={message.name === 'botMessage' || message.name === 'botMessage'}>
                    {message.message}
                  </MessageBubble>
                  <MessageTime isSent={message.name === 'botMessage' || message.name === 'botMessage'}>
                    {formatTime(message.createdAt)}
                  </MessageTime>
                </MessageGroup>
              ))}
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

  return (
    <StyledContainer>
      <TabContainer>
        <TabList
          tabListInstanceId={tabListId}
          tabs={tabs}
          loading={isLoading}
          behaveAsLinks={false}
        />
      </TabContainer>
      <TabContent>
        {activeTabId === 'chat' && renderChatTab()}
        {activeTabId === 'cv' && renderCVTab()}
        {activeTabId === 'video-interview' && renderVideoInterviewTab()}
      </TabContent>
    </StyledContainer>
  );
}; 