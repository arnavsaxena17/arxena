import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse, SortsResponse } from '@/candidate-search/types/candidate-search.types';
import styled from '@emotion/styled';
import { useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { activeSearchFilterIdState } from '../../states/searchConfigState';
import { EnrichmentsMessage } from './EnrichmentsMessage';
import { FiltersMessage } from './FiltersMessage';
import { SearchParametersMessage } from './SearchParametersMessage';
import { SortsMessage } from './SortsMessage';

const StyledChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
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
  selectedSearchVariation?: string | null;
  isProcessing?: boolean;
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
  selectedSearchVariation,
  isProcessing = false,
}: ChatMessagesProps) => {
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const searchFilterId = useRecoilValue(activeSearchFilterIdState);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for tracking elapsed processing time
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

  // Auto-scroll to bottom when new messages are added or when processing state changes
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const renderMessage = (message: ChatMessage) => {
    console.log('ChatMessages - rendering message:', message, "with search Filter ID:", searchFilterId);
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
    <StyledChatMessages ref={chatMessagesRef}>
      {messages.map(renderMessage)}
      {isProcessing && (
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
  );
};
