import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import axios from 'axios';
import dayjs from 'dayjs';
import { useRecoilState } from 'recoil';
import { tokenPairState } from '@/auth/states/tokenPairState';
import * as frontChatTypes from '@/activities/chats/types/front-chat-types';
import { chatPanelState } from '../states/chatPanelState';

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
  display: flex;
  flex-direction: column;
  will-change: transform;
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
// In your SlidingChatPanel component:
const SlidingChatPanel: React.FC<SlidingChatPanelProps> = ({
  isOpen,
  onClose,
  selectedRecordIds,
}) => {
  console.log("SlidingChatPanel props:", { isOpen, selectedRecordIds });
  const [chatPanel] = useRecoilState(chatPanelState);
  const [isVisible, setIsVisible] = useState(isOpen);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [messageHistory, setMessageHistory] = useState<frontChatTypes.MessageNode[]>([]);
  const [pendingMessage, setPendingMessage] = useState<frontChatTypes.MessageNode | null>(null);


  console.log("🔍 SlidingChatPanel Render", {
    isOpen,
    selectedRecordIds,
    messageCount: messageHistory.length,
  });

  // Remove duplicate useEffects and consolidate them
  useEffect(() => {
    console.log("🔄 Effect triggered", { isOpen, selectedRecordId: selectedRecordIds[0] });

    const fetchMessages = async () => {
      if (!isOpen || selectedRecordIds.length !== 1 || !tokenPair?.accessToken?.token) {
        console.log("⛔ Skipping fetch - conditions not met");
        return;
      }

      try {
        console.log("📡 Fetching messages for:", selectedRecordIds[0]);
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
          { candidateId: selectedRecordIds[0] },
          { headers: { Authorization: `Bearer ${tokenPair.accessToken.token}` } }
        );

        const sortedMessages = response.data.sort(
          (a: frontChatTypes.MessageNode, b: frontChatTypes.MessageNode) => 
            dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf()
        );

        console.log("✅ Messages fetched:", sortedMessages.length);
        setMessageHistory(sortedMessages);
      } catch (error) {
        console.error('❌ Error fetching messages:', error);
        setMessageHistory([]);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [isOpen, selectedRecordIds, tokenPair]);

  console.log("🎨 Rendering panel UI");


  // Early return BEFORE any conditional rendering logic
  if (!isOpen || selectedRecordIds.length !== 1) {
    console.log("Panel not rendering:", { isOpen, recordCount: selectedRecordIds.length });
    return null;
  }

  const formatDate = (date: string) => dayjs(date).format("ddd DD MMM, 'YY");

  console.log("Rendering panel with messages:", messageHistory.length);

  return (
    <div style={{ display: 'contents' }}>

    <StyledPanelContainer isOpen={isOpen}
    style={{
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease-in-out'
    }}
    >
      <StyledHeader>
        <StyledTitle>Chat History</StyledTitle>
        <StyledCloseButton onClick={onClose} aria-label="Close chat panel">
          <CloseIcon />
        </StyledCloseButton>
      </StyledHeader>
      <StyledContent>
        <ChatView>
        <div>Chat panel is {isOpen ? 'open' : 'closed'}</div>

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
    </div>

  );
};


export default SlidingChatPanel;