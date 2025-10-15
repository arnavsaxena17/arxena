import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse } from '@/search-plan/types/search-plan.types';
import styled from '@emotion/styled';
import { useEffect, useRef } from 'react';
import { EnrichmentsMessage } from './EnrichmentsMessage';
import { FiltersMessage } from './FiltersMessage';
import { SearchParametersMessage } from './SearchParametersMessage';

const StyledChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledMessage = styled.div<{ isUser?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
  ${({ isUser }) => isUser && 'flex-direction: row-reverse;'}
`;

const StyledMessageContent = styled.div<{ isUser?: boolean }>`
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
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters';
  content: string;
  timestamp: Date;
  metadata?: {
    searchParameters?: SearchParametersResponse;
    enrichments?: EnrichmentsResponse;
    filters?: FiltersResponse;
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
  selectedSearchVariation?: string | null;
};

export const ChatMessages = ({ 
  messages, 
  onSearchVariationSelect,
  onGenerateEnrichments,
  onExecuteEnrichments,
  onGenerateFilters,
  onApplyFilters,
  selectedSearchVariation
}: ChatMessagesProps) => {
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const renderMessage = (message: ChatMessage) => {
    switch (message.type) {
      case 'search_parameters':
        return message.metadata?.searchParameters ? (
          <SearchParametersMessage
            key={message.id}
            searchParameters={message.metadata.searchParameters}
            selectedVariationId={selectedSearchVariation || undefined}
            onVariationSelect={onSearchVariationSelect}
            onGenerateEnrichments={onGenerateEnrichments}
          />
        ) : (
          <StyledMessage key={message.id}>
            <StyledMessageIcon>🤖</StyledMessageIcon>
            <StyledMessageContent>{message.content}</StyledMessageContent>
          </StyledMessage>
        );

      case 'enrichments':
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

      default:
        return (
          <StyledMessage key={message.id} isUser={message.type === 'user'}>
            <StyledMessageIcon>
              {message.type === 'user' ? '👤' : '🤖'}
            </StyledMessageIcon>
            <StyledMessageContent isUser={message.type === 'user'}>
              {message.content}
            </StyledMessageContent>
          </StyledMessage>
        );
    }
  };

  return (
    <StyledChatMessages ref={chatMessagesRef}>
      {messages.map(renderMessage)}
    </StyledChatMessages>
  );
};
