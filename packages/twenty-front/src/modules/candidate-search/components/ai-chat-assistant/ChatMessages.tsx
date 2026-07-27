import { SearchParametersResponse } from '@/candidate-search/types/candidate-search.types';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiFiltersResponse, FiltersResponse, SortsResponse } from 'twenty-shared/types';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { JsonMessageViewer } from '~/utils/JsonMessageViewer';
import { AiFiltersMessage } from './AiFiltersMessage';
import { FiltersMessage } from './FiltersMessage';
import { SearchParametersMessage } from './SearchParametersMessage';
import { SortsMessage } from './SortsMessage';

const StyledChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  min-height: 0;
  max-height: 100%;
`;

const StyledThinkingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledThinkingContent = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledTerminationMessage = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.color.orange};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.color.orange};
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
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
  background-color: ${themeCssVariables.font.color.tertiary};
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
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  font-variant-numeric: tabular-nums;
  min-width: 28px;
  text-align: right;
`;

const StyledMessage = styled.div<{ isUser?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${themeCssVariables.spacing[2]};
  flex-direction: ${({ isUser }) => (isUser ? 'row-reverse' : 'row')};
`;

const StyledMessageContent = styled.div<{
  isUser?: boolean;
  isStreaming?: boolean;
}>`
  background-color: ${({ isUser }) =>
    isUser
      ? themeCssVariables.color.blue10
      : themeCssVariables.background.secondary};
  border: 1px solid
    ${({ isUser }) =>
      isUser
        ? themeCssVariables.color.blue2
        : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[2]};
  max-width: 80%;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  position: relative;

  &::after {
    content: ${({ isStreaming }) => (isStreaming ? "'▋'" : "''")};
    display: ${({ isStreaming }) => (isStreaming ? 'inline' : 'none')};
    animation: ${({ isStreaming }) =>
      isStreaming ? 'blink 1s infinite' : 'none'};
    margin-left: ${({ isStreaming }) => (isStreaming ? '2px' : '0')};
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0;
    }
  }
`;

const StyledMessageIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${themeCssVariables.background.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const StyledScrollToBottomButton = styled.button`
  position: absolute;
  bottom: ${themeCssVariables.spacing[3]};
  right: ${themeCssVariables.spacing[3]};
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: ${themeCssVariables.color.blue};
  color: ${themeCssVariables.font.color.inverted};
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 10;

  &:hover {
    transform: scale(1.1);
    background-color: ${themeCssVariables.color.blue2};
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
    aiFilters?: AiFiltersResponse;
    /** @deprecated use aiFilters */
    enrichments?: AiFiltersResponse;
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
  onGenerateAiFilters?: () => void;
  onExecuteAiFilters?: () => void;
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
  onGenerateAiFilters,
  onExecuteAiFilters,
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

  // Helper: Render fallback message when metadata is missing
  const renderFallbackMessage = useCallback((message: ChatMessage) => (
    <StyledMessage key={message.id}>
      <StyledMessageIcon>🤖</StyledMessageIcon>
      <StyledMessageContent>{message.content}</StyledMessageContent>
    </StyledMessage>
  ), []);

  // Helper: Count braces/brackets accounting for strings
  const countBracesAndBrackets = (text: string): { openBraces: number; closeBraces: number; openBrackets: number; closeBrackets: number } => {
    let openBraces = 0;
    let closeBraces = 0;
    let openBrackets = 0;
    let closeBrackets = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') openBraces++;
      if (char === '}') closeBraces++;
      if (char === '[') openBrackets++;
      if (char === ']') closeBrackets++;
    }

    return { openBraces, closeBraces, openBrackets, closeBrackets };
  };

  // Helper: Find JSON boundaries using balanced brace matching
  const findJsonBoundaries = (text: string): { start: number; end: number } | null => {
    let jsonStartIndex = -1;
    let jsonEndIndex = -1;
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        if (jsonStartIndex === -1) jsonStartIndex = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && jsonStartIndex !== -1) {
          jsonEndIndex = i + 1;
          break;
        }
      } else if (char === '[') {
        if (jsonStartIndex === -1) jsonStartIndex = i;
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
        if (bracketCount === 0 && jsonStartIndex !== -1 && braceCount === 0) {
          jsonEndIndex = i + 1;
          break;
        }
      }
    }

    return jsonStartIndex !== -1 && jsonEndIndex !== -1
      ? { start: jsonStartIndex, end: jsonEndIndex }
      : null;
  };

  // Helper: Fix incomplete JSON by adding missing braces/brackets
  const fixIncompleteJson = (json: string): string => {
    const { openBraces, closeBraces, openBrackets, closeBrackets } = countBracesAndBrackets(json);

    let fixed = json;

    // Add missing closing brackets before braces
    if (openBrackets > closeBrackets) {
      fixed = fixed.replace(/\}*$/, '') + ']'.repeat(openBrackets - closeBrackets);
    }

    // Add missing closing braces
    if (openBraces > closeBraces) {
      fixed = fixed + '}'.repeat(openBraces - closeBraces);
    }

    return fixed;
  };

  // Helper: Try to parse JSON with multiple strategies
  const tryParseJson = (candidate: string): { success: boolean; json?: string } => {
    // Strategy 1: Direct parse
    try {
      JSON.parse(candidate);
      return { success: true, json: candidate };
    } catch {
      // Continue to next strategy
    }

    // Strategy 2: Fix incomplete JSON
    try {
      const fixed = fixIncompleteJson(candidate);
      JSON.parse(fixed);
      return { success: true, json: fixed };
    } catch {
      // Continue to next strategy
    }

    // Strategy 3: Regex match and fix
    const jsonMatch = candidate.match(/(\{[\s\S]*?\})/) || candidate.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        const fixed = fixIncompleteJson(jsonMatch[0]);
        JSON.parse(fixed);
        return { success: true, json: fixed };
      } catch {
        // Not valid
      }
    }

    return { success: false };
  };

  // Helper: Extract JSON from reasoning section
  const extractJsonFromReasoning = (content: string): { json?: string; statusText?: string; hasReasoning: boolean } | null => {
    if (!content.includes('Reasoning:')) return null;

    const reasoningIndex = content.indexOf('Reasoning:');
    const beforeReasoning = content.substring(0, reasoningIndex).trim();
    let afterReasoning = content.substring(reasoningIndex + 'Reasoning:'.length).replace(/^\s+/, '');

    if (!afterReasoning.trim().startsWith('{')) return null;

    const trimmedAfter = afterReasoning.trim();

    // Quick check for relevance score JSON
    if (trimmedAfter.includes('relevanceScore')) {
      const result = tryParseJson(trimmedAfter);
      if (result.success) {
        return { json: result.json, statusText: beforeReasoning, hasReasoning: true };
      }
    }

    // Try balanced brace matching
    const boundaries = findJsonBoundaries(trimmedAfter);
    if (boundaries) {
      const jsonCandidate = trimmedAfter.substring(boundaries.start, boundaries.end);
      const result = tryParseJson(jsonCandidate);
      if (result.success) {
        return { json: result.json, statusText: beforeReasoning, hasReasoning: true };
      }
    }

    // Try fixing incomplete JSON
    const result = tryParseJson(trimmedAfter);
    if (result.success) {
      return { json: result.json, statusText: beforeReasoning, hasReasoning: true };
    }

    return null;
  };

  // Helper: Extract JSON from general content
  const extractJsonFromContent = (content: string): { json?: string; statusText?: string } | null => {
    const boundaries = findJsonBoundaries(content);
    if (!boundaries) return null;

    const jsonContent = content.substring(boundaries.start, boundaries.end);
    let statusText = content.substring(0, boundaries.start).trim();
    const textAfterJson = content.substring(boundaries.end).trim();

    statusText = statusText.replace(/:\s*$/, '').trim();
    if (textAfterJson && !textAfterJson.match(/^[,\s]*$/)) {
      statusText = statusText ? `${statusText} ${textAfterJson}` : textAfterJson;
    }

    try {
      JSON.parse(jsonContent);
      return { json: jsonContent, statusText };
    } catch {
      return null;
    }
  };

  // Helper: Infer JSON label from content
  const inferJsonLabel = (jsonContent: string, messageContent: string): string => {
    const lowerContent = messageContent.toLowerCase();

    if (jsonContent.includes('roleVariations')) return 'Role Patterns';
    if (jsonContent.includes('identifiedPatterns')) return 'Discovery Patterns';
    if (jsonContent.includes('falsePositives')) return 'Page Results Validation';
    if (jsonContent.includes('keywords')) return 'Keywords Parameter';
    if (jsonContent.includes('discoveryNeeds')) return 'Discovery Needs';
    if (jsonContent.includes('needsClarification')) return 'Clarification Needs';
    if (lowerContent.includes('location') || jsonContent.includes('location')) return 'Location Parameter';
    if (lowerContent.includes('company') || jsonContent.includes('company')) return 'Company Parameter';
    if (lowerContent.includes('industry') || jsonContent.includes('industry')) return 'Industry Parameter';
    if (lowerContent.includes('generating')) {
      const match = messageContent.match(/generating\s+(\w+)\s+parameter/i);
      if (match) {
        return `${match[1].charAt(0).toUpperCase() + match[1].slice(1)} Parameter`;
      }
    }
    if (jsonContent.includes('relevanceScore') || jsonContent.includes('relevanceLabel')) return 'Relevance Score';

    return 'JSON';
  };

  // Helper: Detect and parse JSON from message content
  const detectAndParseJson = (message: ChatMessage): { isValidJson: boolean; jsonContent?: string; jsonLabel?: string; statusText?: string; hasReasoningSection?: boolean } => {
    if (message.isStreaming || !message.content.trim()) {
      return { isValidJson: false };
    }

    const trimmedContent = message.content.trim();

    // Try extracting from reasoning section first
    const reasoningResult = extractJsonFromReasoning(trimmedContent);
    if (reasoningResult?.json) {
      return {
        isValidJson: true,
        jsonContent: reasoningResult.json,
        jsonLabel: 'Relevance Score',
        statusText: reasoningResult.statusText,
        hasReasoningSection: reasoningResult.hasReasoning,
      };
    }

    // Try general JSON extraction
    const generalResult = extractJsonFromContent(trimmedContent);
    if (generalResult?.json) {
      return {
        isValidJson: true,
        jsonContent: generalResult.json,
        jsonLabel: inferJsonLabel(generalResult.json, message.content),
        statusText: generalResult.statusText,
      };
    }

    return { isValidJson: false };
  };

  // Helper: Render special message type
  const renderSpecialMessage = useCallback((
    message: ChatMessage,
    Component: React.ComponentType<any>,
    props: Record<string, any>
  ) => {
    return <Component key={message.id} {...props} />;
  }, []);

  const renderMessage = (message: ChatMessage) => {
    switch (message.type) {
      case 'search_parameters':
        return message.metadata?.searchParameters
          ? renderSpecialMessage(
              message,
              SearchParametersMessage,
              {
                searchParameters: message.metadata.searchParameters,
                selectedVariationId: selectedSearchVariation || undefined,
                onVariationSelect: onSearchVariationSelect,
                onGenerateEnrichments: onGenerateAiFilters,
                onApplyParameters: onApplyParameters,
                onViewStrategyResults: onViewStrategyResults,
              }
            )
          : renderFallbackMessage(message);

      case 'enrichments':
        return (message.metadata?.aiFilters ?? message.metadata?.enrichments)
          ? renderSpecialMessage(
              message,
              AiFiltersMessage,
              {
                aiFiltersResponse: (message.metadata?.aiFilters ?? message.metadata?.enrichments) as AiFiltersResponse,
                onExecuteAiFilters: onExecuteAiFilters,
                onGenerateFilters: onGenerateFilters,
              }
            )
          : renderFallbackMessage(message);

      case 'filters':
        return message.metadata?.filters
          ? renderSpecialMessage(
              message,
              FiltersMessage,
              {
                filters: message.metadata.filters,
                onApplyFilters: onApplyFilters,
              }
            )
          : renderFallbackMessage(message);

      case 'sorts':
        return message.metadata?.sorts
          ? renderSpecialMessage(
              message,
              SortsMessage,
              {
                sorts: message.metadata.sorts,
                onApplySorts: onApplySorts,
              }
            )
          : renderFallbackMessage(message);

      default: {
        const jsonResult = detectAndParseJson(message);

        return (
          <StyledMessage key={message.id} isUser={message.type === 'user'}>
            <StyledMessageIcon>
              {message.type === 'user' ? '👤' : '🤖'}
            </StyledMessageIcon>
            {jsonResult.isValidJson && jsonResult.jsonContent ? (
              <StyledMessageContent isUser={message.type === 'user'} isStreaming={false}>
                {jsonResult.statusText && (
                  <div style={{ marginBottom: jsonResult.hasReasoningSection ? '12px' : '8px', color: 'inherit', fontSize: 'inherit' }}>
                    {jsonResult.statusText}
                    {jsonResult.hasReasoningSection && <div style={{ marginTop: '8px', fontWeight: '500' }}>Reasoning:</div>}
                  </div>
                )}
                <JsonMessageViewer content={jsonResult.jsonContent} label={jsonResult.jsonLabel || 'JSON'} />
              </StyledMessageContent>
            ) : (
              <StyledMessageContent isUser={message.type === 'user'} isStreaming={message.isStreaming}>
                {message.content}
              </StyledMessageContent>
            )}
          </StyledMessage>
        );
      }
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
