import React, { useState, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import axios from 'axios';
import dayjs from 'dayjs';
import styled from '@emotion/styled';
import { tokenPairState } from '@/auth/states/tokenPairState';
import * as frontChatTypes from '@/activities/chats/types/front-chat-types';
import {chatPanelState} from '@/activities/chats/states/chatPanelState';


const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: ${props => props.theme.background.primary};
`;

const ChatView = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
`;

const MessageBubble = styled.div<{ isSent: boolean }>`
  max-width: 70%;
  margin: ${props => props.isSent ? '8px 8px 8px auto' : '8px'};
  padding: 12px;
  border-radius: 12px;
  background-color: ${props => props.isSent ? props.theme.color.blue : props.theme.background.tertiary};
  color: ${props => props.isSent ? 'white' : props.theme.font.color.primary};
`;

const DateSeparator = styled.div`
  text-align: center;
  margin: 16px 0;
  color: ${props => props.theme.font.color.secondary};
  font-size: ${props => props.theme.font.size.sm};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${props => props.theme.font.color.light};
  text-align: center;
  padding: ${props => props.theme.spacing(4)};
`;

export const RightDrawerChatThread = () => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [chatPanel] = useRecoilState(chatPanelState);
  const [messageHistory, setMessageHistory] = useState<frontChatTypes.MessageNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const candidateId = chatPanel.selectedRecordIds[0];

  useEffect(() => {
    const fetchMessages = async () => {
      if (!candidateId || !tokenPair?.accessToken?.token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
          { candidateId },
          { 
            headers: { 
              Authorization: `Bearer ${tokenPair.accessToken.token}` 
            }
          }
        );

        const sortedMessages = response.data.sort(
          (a: frontChatTypes.MessageNode, b: frontChatTypes.MessageNode) => 
            dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf()
        );

        setMessageHistory(sortedMessages);
      } catch (error) {
        console.error('Error fetching chat messages:', error);
        setError('Failed to load chat messages');
        setMessageHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
    // const interval = setInterval(fetchMessages, 5000);
    // return () => clearInterval(interval);
  }, [candidateId, tokenPair]);

  const formatDate = (date: string) => dayjs(date).format("ddd DD MMM, 'YY");

  if (isLoading) {
    return (
      <EmptyState>
        Loading chat history...
      </EmptyState>
    );
  }

  if (error) {
    return (
      <EmptyState>
        <p>{error}</p>
        <p>Please try again later</p>
      </EmptyState>
    );
  }

  if (!candidateId) {
    return (
      <EmptyState>
        <p>Please select a candidate to view chat history</p>
      </EmptyState>
    );
  }

  if (messageHistory.length === 0) {
    return (
      <EmptyState>
        <p>No chat messages found</p>
      </EmptyState>
    );
  }

  return (
    <StyledContainer>
      <ChatView>
        {messageHistory.map((message, index) => {
          const showDateSeparator = 
            index === 0 || 
            formatDate(messageHistory[index - 1]?.createdAt) !== formatDate(message?.createdAt);

          return (
            <React.Fragment key={message.id}>
              {showDateSeparator && (
                <DateSeparator>
                  {formatDate(message.createdAt)}
                </DateSeparator>
              )}
              <MessageBubble 
                isSent={message.name === 'botMessage'}
              >
                {message.message}
              </MessageBubble>
            </React.Fragment>
          );
        })}
      </ChatView>
    </StyledContainer>
  );
};

export default RightDrawerChatThread;