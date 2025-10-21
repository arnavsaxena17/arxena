import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse, SortsResponse } from '@/candidate-search/types/candidate-search.types';
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
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters' | 'sorts';
  content: string;
  timestamp: Date;
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
  selectedSearchVariation?: string | null;
};

export const ChatMessages = ({ 
  messages, 
  onSearchVariationSelect,
  onGenerateEnrichments,
  onExecuteEnrichments,
  onGenerateFilters,
  onApplyFilters,
  onApplySorts,
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

      case 'sorts':
        return message.metadata?.sorts ? (
          <StyledMessage key={message.id}>
            <StyledMessageIcon>📊</StyledMessageIcon>
            <StyledMessageContent>
              <div>
                <strong>{message.metadata.sorts.sortStrategy.name}</strong>
                <p>{message.metadata.sorts.sortStrategy.description}</p>
                <div>
                  <h4>Sorting Order:</h4>
                  <ol>
                    {message.metadata.sorts.sortStrategy.sortColumns.map((sortCol, index) => (
                      <li key={index}>
                        {index + 1}. {sortCol.column} ({sortCol.sortOrder})
                        <br />
                        <small>{sortCol.reasoning}</small>
                      </li>
                    ))}
                  </ol>
                </div>
                {message.metadata.actionButtons?.map(button => (
                  <button
                    key={button.id}
                    onClick={button.action === 'apply_sorts' ? onApplySorts : undefined}
                    disabled={button.disabled}
                    style={{
                      marginTop: '8px',
                      padding: '8px 16px',
                      backgroundColor: button.disabled ? '#ccc' : '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: button.disabled ? 'not-allowed' : 'pointer',
                      opacity: button.disabled ? 0.6 : 1
                    }}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </StyledMessageContent>
          </StyledMessage>
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
