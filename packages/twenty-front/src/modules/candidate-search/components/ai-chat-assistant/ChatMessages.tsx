import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse, SortsResponse } from '@/candidate-search/types/candidate-search.types';
import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EnrichmentsMessage } from './EnrichmentsMessage';
import { FiltersMessage } from './FiltersMessage';
import { SearchParametersMessage } from './SearchParametersMessage';
import { SortsMessage } from './SortsMessage';

const StyledChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  min-height: 0;
  max-height: 100%;
`;

const StyledThinkingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledThinkingContent = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledTerminationMessage = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.color.orange};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.orange};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledDotsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StyledDot = styled.span<{ delay: number }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.font.color.tertiary};
  animation: bounce 1.4s infinite ease-in-out both;
  animation-delay: ${({ delay }) => delay}s;

  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
`;

const StyledElapsedTime = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-variant-numeric: tabular-nums;
  min-width: 28px;
  text-align: right;
`;

const StyledMessage = styled.div<{ isUser?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
  ${({ isUser }) => isUser && 'flex-direction: row-reverse;'}
`;

const StyledMessageContent = styled.div<{ isUser?: boolean; isStreaming?: boolean }>`
  background-color: ${({ isUser, theme }) => 
    isUser ? theme.color.blue10 : theme.background.secondary};
  border: 1px solid ${({ isUser, theme }) => 
    isUser ? theme.color.blue20 : theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  max-width: 80%;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  position: relative;
  ${({ isStreaming }) => isStreaming && `
    &::after {
      content: '▋';
      animation: blink 1s infinite;
      margin-left: 2px;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `}
`;

const StyledMessageIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.background.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const StyledScrollToBottomButton = styled.button`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing(3)};
  right: ${({ theme }) => theme.spacing(3)};
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 10;
  
  &:hover {
    transform: scale(1.1);
    background-color: ${({ theme }) => theme.color.blue20};
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const StyledChatMessagesContainer = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

// Use the ChatMessage type from the state
type ChatMessage = {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters' | 'sorts';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    searchParameters?: SearchParametersResponse;
    enrichments?: EnrichmentsResponse;
    filters?: FiltersResponse;
    sorts?: SortsResponse;
    actionButtons?: Array<{
      id: string;
      label: string;
      action: string;
      disabled?: boolean;
    }>;
    clarification?: {
      questions: string[];
      ambiguityReasons?: string[];
    };
  };
};

type ChatMessagesProps = {
  messages: ChatMessage[];
  onSearchVariationSelect?: (variationId: string) => void;
  onGenerateEnrichments?: () => void;
  onExecuteEnrichments?: () => void;
  onGenerateFilters?: () => void;
  onApplyFilters?: () => void;
  onApplySorts?: () => void;
  onApplyParameters?: (parameters: any) => void;
  onViewStrategyResults?: (strategy: any, preview: any, parameterKey: string) => void;
  selectedSearchVariation?: string | null;
  isProcessing?: boolean;
  isTerminated?: boolean;
};

export const ChatMessages = ({ 
  messages, 
  onSearchVariationSelect,
  onGenerateEnrichments,
  onExecuteEnrichments,
  onGenerateFilters,
  onApplyFilters,
  onApplySorts,
  onApplyParameters,
  onViewStrategyResults,
  selectedSearchVariation,
  isProcessing = false,
  isTerminated = false,
}: ChatMessagesProps) => {
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isProcessing) {
      setElapsedSeconds(0);
      intervalId = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isProcessing]);

  // Check if user is near bottom of scroll container
  const checkIfNearBottom = useCallback(() => {
    if (!chatMessagesRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
    // Consider "near bottom" if within 100px of the bottom
    const threshold = 100;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Initial scroll to bottom on mount
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
      setIsNearBottom(true);
      userScrolledRef.current = false;
    }
  }, []);

  // Handle scroll events to track user position
  useEffect(() => {
    const container = chatMessagesRef.current;
    if (!container) return;

    const handleScroll = () => {
      const nearBottom = checkIfNearBottom();
      setIsNearBottom(nearBottom);
      setShowScrollButton(!nearBottom);
      // If user scrolls up, mark that they've manually scrolled
      if (!nearBottom) {
        userScrolledRef.current = true;
      } else {
        // If user scrolls back to bottom, reset the flag
        userScrolledRef.current = false;
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [checkIfNearBottom]);

  // Auto-scroll to bottom only if user is near bottom (or hasn't manually scrolled)
  useEffect(() => {
    if (chatMessagesRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (chatMessagesRef.current && (isNearBottom || !userScrolledRef.current)) {
          chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
          // Update state after scrolling
          const nearBottom = checkIfNearBottom();
          setIsNearBottom(nearBottom);
          setShowScrollButton(!nearBottom);
        }
      });
    }
  }, [messages, isProcessing, isNearBottom, checkIfNearBottom]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setIsNearBottom(true);
      setShowScrollButton(false);
      userScrolledRef.current = false;
    }
  }, []);

  const renderMessage = (message: ChatMessage) => {
    // console.log('ChatMessages - rendering message:', message, "with search Filter ID:", searchFilterId);
    switch (message.type) {
      case 'search_parameters':
        console.log('ChatMessages - search parameters message:', message.metadata?.searchParameters);
        return message.metadata?.searchParameters ? (
          <SearchParametersMessage
            key={message.id}
            searchParameters={message.metadata.searchParameters}
            selectedVariationId={selectedSearchVariation || undefined}
            onVariationSelect={onSearchVariationSelect}
            onGenerateEnrichments={onGenerateEnrichments}
            onApplyParameters={onApplyParameters}
            onViewStrategyResults={onViewStrategyResults}
          />
        ) : (
          <StyledMessage key={message.id}>
            <StyledMessageIcon>🤖</StyledMessageIcon>
            <StyledMessageContent>{message.content}</StyledMessageContent>
          </StyledMessage>
        );

      case 'enrichments':
        console.log('ChatMessages - enrichments message:', message.metadata?.enrichments);
        return message.metadata?.enrichments ? (
          <EnrichmentsMessage
            key={message.id}
            enrichments={message.metadata.enrichments}
            onExecuteEnrichments={onExecuteEnrichments}
            onGenerateFilters={onGenerateFilters}
          />
        ) : (
          <StyledMessage key={message.id}>
            <StyledMessageIcon>🤖</StyledMessageIcon>
            <StyledMessageContent>{message.content}</StyledMessageContent>
          </StyledMessage>
        );

      case 'filters':
        console.log('ChatMessages - filters message:', message.metadata?.filters);
        return message.metadata?.filters ? (
          <FiltersMessage
            key={message.id}
            filters={message.metadata.filters}
            onApplyFilters={onApplyFilters}
          />
        ) : (
          <StyledMessage key={message.id}>
            <StyledMessageIcon>🤖</StyledMessageIcon>
            <StyledMessageContent>{message.content}</StyledMessageContent>
          </StyledMessage>
        );

      case 'sorts':
        console.log('ChatMessages - sorts message:', message.metadata?.sorts);
        return message.metadata?.sorts ? (
          <SortsMessage
            key={message.id}
            sorts={message.metadata.sorts}
            onApplySorts={onApplySorts}
          />
        ) : (
          <StyledMessage key={message.id}>
            <StyledMessageIcon>🤖</StyledMessageIcon>
            <StyledMessageContent>{message.content}</StyledMessageContent>
          </StyledMessage>
        );

      default:
        return (
          <StyledMessage key={message.id} isUser={message.type === 'user'}>
            <StyledMessageIcon>
              {message.type === 'user' ? '👤' : '🤖'}
            </StyledMessageIcon>
            <StyledMessageContent isUser={message.type === 'user'} isStreaming={message.isStreaming}>
              {message.content}
            </StyledMessageContent>
          </StyledMessage>
        );
    }
  };

  return (
    <StyledChatMessagesContainer>
      <StyledChatMessages ref={chatMessagesRef}>
        {messages.map(renderMessage)}
        {isTerminated && (
          <StyledMessage>
            <StyledMessageIcon>⚠️</StyledMessageIcon>
            <StyledTerminationMessage>
              Request terminated. No more data will be streamed.
            </StyledTerminationMessage>
          </StyledMessage>
        )}
        {isProcessing && !isTerminated && (
          <StyledThinkingIndicator>
            <StyledMessageIcon>🤖</StyledMessageIcon>
            <StyledThinkingContent>
              <span>Generating search parameters</span>
              <StyledDotsContainer>
                <StyledDot delay={0} />
                <StyledDot delay={0.2} />
                <StyledDot delay={0.4} />
              </StyledDotsContainer>
              <StyledElapsedTime>{elapsedSeconds}s</StyledElapsedTime>
            </StyledThinkingContent>
          </StyledThinkingIndicator>
        )}
      </StyledChatMessages>
      {showScrollButton && (
        <StyledScrollToBottomButton
          onClick={scrollToBottom}
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          ↓
        </StyledScrollToBottomButton>
      )}
    </StyledChatMessagesContainer>
  );
};
