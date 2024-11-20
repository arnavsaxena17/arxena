import React, { useState, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import axios from 'axios';
import dayjs from 'dayjs';
import styled from '@emotion/styled';
import { tokenPairState } from '@/auth/states/tokenPairState';
import * as frontChatTypes from '@/activities/chats/types/front-chat-types';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';



const CandidateNavigation = styled.div`
  position: fixed;
  top: 50%;
  right: 41%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 1001;
`;
const ChatView = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column-reverse; // Changed to reverse
`;


const NavIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  border-radius: 50%;
  background-color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #f3f4f6;
    transform: scale(1.05);
  }
  
  &:disabled {
    background-color: #e5e7eb;
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
  }

  color: #374151;
  
  &:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

const NavigationCounter = styled.div`
  position: fixed;
  right: 41%;
  top: 100px;
  background-color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-size: 0.875rem;
  color: #374151;
  z-index: 1001;
`;


const Header = styled.div`
  padding: 16px;
  border-bottom: 1px solid ${props => props.theme.border.color};
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: ${props => props.theme.background.secondary};
`;

const Navigation = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const NavButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: ${props => props.theme.background.tertiary};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: ${props => props.theme.font.color.secondary};
  
  &:hover {
    color: ${props => props.theme.font.color.primary};
  }
`;



const DateSeparator = styled.div`
  text-align: center;
  margin: 16px 0;
  color: ${props => props.theme.font.color.secondary};
  font-size: ${props => props.theme.font.size.sm};
`;

const CandidateInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const CandidateName = styled.div`
  font-weight: 500;
  color: ${props => props.theme.font.color.primary};
`;

const CandidateCount = styled.div`
  font-size: ${props => props.theme.font.size.sm};
  color: ${props => props.theme.font.color.secondary};
`;

const DrawerContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 80px;
  right: ${props => (props.isOpen ? '0' : '-40%')};
  width: 40%;
  height: calc(100vh - 80px);
  background-color: ${props => props.theme.background.primary};
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease-in-out;
  z-index: 1000;
  display: flex;
  flex-direction: column;
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

const groupMessagesByDate = (messages: frontChatTypes.MessageNode[]) => {
  const groups: { [key: string]: frontChatTypes.MessageNode[] } = {};
  
  messages.forEach(message => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });

  return groups;
};


interface MultiCandidateChatProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeople: frontChatTypes.PersonNode[];
}

export const MultiCandidateChat: React.FC<MultiCandidateChatProps> = ({
  isOpen,
  onClose,
  selectedPeople,
}) => {

  console.log("selectedPeople::", selectedPeople);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messageHistory, setMessageHistory] = useState<frontChatTypes.MessageNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const handlePrevCandidate = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextCandidate = () => {
    setCurrentIndex(prev => Math.min(selectedPeople.length - 1, prev + 1));
  };

  const currentPerson = selectedPeople[currentIndex];

  useEffect(() => {

    const fetchMessages = async () => {
      if (!currentPerson?.id || !tokenPair?.accessToken?.token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        console.log("Goignt to try and get fetech messages laest see if ti works")
        
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
          { candidateId: currentPerson.candidates.edges[0].node.id },
          { 
            headers: { 
              Authorization: `Bearer ${tokenPair.accessToken.token}` 
            }
          }
        );
        console.log("response data::", response.data.data);
        const sortedMessages = response.data.sort(
          (a: any, b: any) => b.position - a.position
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
  }, [currentPerson?.id, tokenPair]);

  const handlePrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(selectedPeople.length - 1, prev + 1));
  };

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



  return (
    <>
      <DrawerContainer isOpen={isOpen}>
        <Header>
          <CandidateInfo>
            <CandidateName>
              {currentPerson ? `${currentPerson.name.firstName} ${currentPerson.name.lastName}` : ''}
            </CandidateName>
          </CandidateInfo>
          <CloseButton onClick={onClose}>
            <IconX size={20} />
          </CloseButton>
        </Header>
        
        <ChatView>
          {isLoading ? (
            <div>Loading chat history...</div>
          ) : error ? (
            <div>{error}</div>
          ) : messageHistory.length === 0 ? (
            <div>No chat messages found</div>
          ) : (
            <MessageContainer>
              {Object.entries(groupMessagesByDate(messageHistory)).map(([date, messages]) => (
                <React.Fragment key={date}>
                  <DateSeparator>
                    <DateLabel>{date}</DateLabel>
                  </DateSeparator>
                  {messages.map((message) => (
                    <MessageGroup key={message.id}>
                      <MessageBubble isSent={message.name === 'botMessage'}>
                        {message.message}
                      </MessageBubble>
                      <MessageTime isSent={message.name === 'botMessage'}>
                        {formatTime(message.createdAt)}
                      </MessageTime>
                    </MessageGroup>
                  ))}
                </React.Fragment>
              ))}
            </MessageContainer>
          )}
        </ChatView>
      </DrawerContainer>

      {selectedPeople.length > 1 && isOpen &&(
        <>
          <NavigationCounter>
            {currentIndex + 1} of {selectedPeople.length}
          </NavigationCounter>
          
          <CandidateNavigation>
            <NavIconButton
              onClick={handlePrevCandidate}
              disabled={currentIndex === 0}
              title="Previous Candidate"
            >
              <IconChevronLeft size={24} />
            </NavIconButton>
            
            <NavIconButton
              onClick={handleNextCandidate}
              disabled={currentIndex === selectedPeople.length - 1}
              title="Next Candidate"
            >
              <IconChevronRight size={24} />
            </NavIconButton>
          </CandidateNavigation>
        </>
      )}
    </>
  );
};


export default MultiCandidateChat;