import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import axios from 'axios';
import dayjs from 'dayjs';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import * as frontChatTypes from '@/activities/chats/types/front-chat-types';

// Animations
const slideIn = keyframes`
  from {
    transform: translateX(800px);
  }
  to {
    transform: translateX(0);
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(800px);
  }
`;

const StyledPanelContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 800px;
  height: 100vh;
  background-color: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  animation: ${props => props.isOpen ? slideIn : slideOut} 0.3s ease-in-out forwards;
  display: flex;
  flex-direction: column;
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: ${props => props.theme.background.secondary};
  border-bottom: 1px solid ${props => props.theme.border.color.medium};
`;

const StyledTitle = styled.h2`
  margin: 0;
  font-size: ${props => props.theme.font.size.md};
  font-weight: ${props => props.theme.font.weight.medium};
  color: ${props => props.theme.font.color.primary};
`;

const StyledCloseButton = styled.button`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  color: ${props => props.theme.font.color.primary};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.theme.background.tertiary};
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const StyledContent = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;
  background-color: ${props => props.theme.background.primary};
`;

const ChatView = styled.div`
  position: relative;
  overflow-y: scroll;
  width: 100%;
  height: 100%;
  padding: 20px;
`;

const MessageBubble = styled.div<{ isSent: boolean }>`
  max-width: 70%;
  margin: ${props => props.isSent ? '8px 8px 8px auto' : '8px'};
  padding: 12px;
  border-radius: 12px;
  background-color: ${props => props.isSent ? '#007AFF' : '#E9E9EB'};
  color: ${props => props.isSent ? 'white' : 'black'};
`;

const DateSeparator = styled.div`
  text-align: center;
  margin: 16px 0;
  color: ${props => props.theme.font.color.secondary};
  font-size: 14px;
`;

const CloseIcon = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

interface SlidingChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecordIds: string[];
}

const SlidingChatPanel: React.FC<SlidingChatPanelProps> = ({
  isOpen,
  onClose,
  selectedRecordIds,
}) => {
    console.log("SlidingChatPanel props:", { isOpen, selectedRecordIds });

  const [isVisible, setIsVisible] = useState(isOpen);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [messageHistory, setMessageHistory] = useState<frontChatTypes.MessageNode[]>([]);
  const [pendingMessage, setPendingMessage] = useState<frontChatTypes.MessageNode | null>(null);

  console.log("SlidingChatPanel rendering:", { 
    isOpen, 
    isVisible, 
    selectedRecordIds, 
    willRender: isVisible && selectedRecordIds.length === 1 
  });

  console.log("Panel rendering with style animation:", isOpen ? 'slideIn' : 'slideOut');


  // Only return null if we're definitely not showing the panel
  if (!isVisible || selectedRecordIds.length !== 1) {
    console.log("Panel not rendering, conditions not met:", { isVisible, recordCount: selectedRecordIds.length });
    return null;
  }


  const getlistOfMessages = async (candidateId: string) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
        { candidateId },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
      );

      const sortedMessages = response.data.sort(
        (a: frontChatTypes.MessageNode, b: frontChatTypes.MessageNode) => 
          dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf()
      );

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
      setMessageHistory(pendingMessage ? [pendingMessage] : []);
    }
  };

  useEffect(() => {
    console.log("SlidingChatPanel useEffect triggered:", { isOpen });
    if (isOpen && selectedRecordIds.length === 1) {
      setIsVisible(true);
      getlistOfMessages(selectedRecordIds[0]);
      
      // Set up polling for new messages
      const interval = setInterval(() => {
        getlistOfMessages(selectedRecordIds[0]);
      }, 5000);

      return () => clearInterval(interval);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedRecordIds]);


  if (!isVisible || selectedRecordIds.length !== 1) {
    console.log("SlidingChatPanel not rendering due to:", {
      isVisible,
      selectedRecordsLength: selectedRecordIds.length
    });
    return null;
  }

  const formatDate = (date: string) => dayjs(date).format("ddd DD MMM, 'YY");

  return (
    <StyledPanelContainer isOpen={isOpen}>
      <StyledHeader>
        <StyledTitle>Chat History</StyledTitle>
        <StyledCloseButton onClick={onClose} aria-label="Close chat panel">
          <CloseIcon />
        </StyledCloseButton>
      </StyledHeader>
      <StyledContent>
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
                  isSent={message.whatsappDeliveryStatus === 'sent'}
                >
                  {message.message}
                </MessageBubble>
              </React.Fragment>
            );
          })}
        </ChatView>
      </StyledContent>
    </StyledPanelContainer>
  );
};

export default SlidingChatPanel;