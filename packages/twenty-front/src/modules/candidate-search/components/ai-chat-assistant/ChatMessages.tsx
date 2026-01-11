import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse, SortsResponse } from '@/candidate-search/types/candidate-search.types';
import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EnrichmentsMessage } from './EnrichmentsMessage';
import { FiltersMessage } from './FiltersMessage';
import { SearchParametersMessage } from './SearchParametersMessage';
import { SortsMessage } from './SortsMessage';
import { JsonMessageViewer } from './components/JsonMessageViewer';

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
        // Check if content contains JSON (could be embedded in status messages like "Generating X...: {...}")
        // or in candidate scoring messages like "Reasoning: {...}"
        // Only process when streaming is complete to avoid parsing incomplete JSON
        const trimmedContent = message.content.trim();
        let isValidJson = false;
        let jsonLabel = 'JSON';
        let statusText = '';
        let jsonContent = '';
        let hasReasoningSection = false;
        
        // Only try to detect JSON when streaming is complete
        if (!message.isStreaming && trimmedContent) {
          // Special handling for candidate scoring messages with "Reasoning:" section
          if (trimmedContent.includes('Reasoning:')) {
            const reasoningIndex = trimmedContent.indexOf('Reasoning:');
            const beforeReasoning = trimmedContent.substring(0, reasoningIndex).trim();
            let afterReasoning = trimmedContent.substring(reasoningIndex + 'Reasoning:'.length);
            
            // Remove leading whitespace but preserve structure (don't trim trailing as JSON might continue)
            afterReasoning = afterReasoning.replace(/^\s+/, '');
            
            // Debug: Log the afterReasoning content for troubleshooting
            if (afterReasoning.trim().startsWith('{')) {
              console.log('ChatMessages: Detected JSON in Reasoning section', {
                messageId: message.id,
                afterReasoningLength: afterReasoning.length,
                afterReasoningPreview: afterReasoning.substring(0, 100),
                endsWithBrace: afterReasoning.trim().endsWith('}'),
              });
            }
            
            // Try to extract JSON from the reasoning section
            if (afterReasoning) {
              // Pre-process: If content looks like JSON but might have issues, try to fix common problems first
              const trimmedAfter = afterReasoning.trim();
              
              // Quick check: If it starts with { and contains relevanceScore, it's likely a relevance score JSON
              if (trimmedAfter.startsWith('{') && trimmedAfter.includes('relevanceScore')) {
                // Try direct parse first (fastest path for valid JSON)
                try {
                  const parsed = JSON.parse(trimmedAfter);
                  if (typeof parsed === 'object' && parsed !== null && parsed.relevanceScore !== undefined) {
                    jsonContent = trimmedAfter;
                    statusText = beforeReasoning;
                    hasReasoningSection = true;
                    isValidJson = true;
                    jsonLabel = 'Relevance Score';
                    console.log('ChatMessages: Successfully detected JSON via direct parse', { messageId: message.id });
                  }
                } catch {
                  // Not directly parseable, continue to other strategies
                }
              }
              
              // Strategy 1: If it starts with {, try parsing the whole thing (most common case)
              // First, try to find the complete JSON by matching braces
              if (!isValidJson && trimmedAfter.startsWith('{')) {
                // Use balanced brace matching to find the complete JSON object
                let braceCount = 0;
                let inString = false;
                let escapeNext = false;
                let jsonEndIndex = -1;
                
                for (let i = 0; i < trimmedAfter.length; i++) {
                  const char = trimmedAfter[i];
                  
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
                    braceCount++;
                  } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                      jsonEndIndex = i + 1;
                      break;
                    }
                  }
                }
                
                // If we found a complete JSON object, try to parse it
                if (jsonEndIndex !== -1) {
                  const jsonCandidate = trimmedAfter.substring(0, jsonEndIndex);
                  try {
                    const parsed = JSON.parse(jsonCandidate);
                    if (typeof parsed === 'object' && parsed !== null) {
                      // Check if it looks like a relevance score object
                      if (parsed.relevanceScore !== undefined || parsed.relevanceLabel !== undefined || parsed.matchReasons !== undefined) {
                        jsonContent = jsonCandidate;
                        statusText = beforeReasoning;
                        hasReasoningSection = true;
                        isValidJson = true;
                        jsonLabel = 'Relevance Score';
                        console.log('ChatMessages: Successfully detected JSON via Strategy 1', { messageId: message.id });
                      }
                    }
                  } catch (parseError) {
                    console.log('ChatMessages: Strategy 1 parse failed', { messageId: message.id, error: parseError });
                    // Not valid JSON, continue to other strategies
                  }
                } else {
                  console.log('ChatMessages: Strategy 1 - No complete JSON found, trying incomplete JSON fix', { 
                    messageId: message.id,
                    trimmedAfterLength: trimmedAfter.length,
                    lastChars: trimmedAfter.substring(Math.max(0, trimmedAfter.length - 50))
                  });
                  // Incomplete JSON - try to fix it by adding missing closing braces
                  // This handles cases where JSON is cut off during streaming
                  try {
                    let jsonCandidate = trimmedAfter;
                    
                    // Count braces properly (accounting for strings)
                    let openBraces = 0;
                    let closeBraces = 0;
                    let inString = false;
                    let escapeNext = false;
                    
                    for (let i = 0; i < jsonCandidate.length; i++) {
                      const char = jsonCandidate[i];
                      
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
                    }
                    
                    // Add missing closing braces
                    if (openBraces > closeBraces) {
                      jsonCandidate = jsonCandidate + '}'.repeat(openBraces - closeBraces);
                    }
                    
                    // Also check for unclosed brackets
                    let openBrackets = 0;
                    let closeBrackets = 0;
                    inString = false;
                    escapeNext = false;
                    
                    for (let i = 0; i < jsonCandidate.length; i++) {
                      const char = jsonCandidate[i];
                      
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
                      
                      if (char === '[') openBrackets++;
                      if (char === ']') closeBrackets++;
                    }
                    
                    // Add missing closing brackets before closing braces
                    if (openBrackets > closeBrackets) {
                      jsonCandidate = jsonCandidate.replace(/\}*$/, '') + ']'.repeat(openBrackets - closeBrackets) + '}'.repeat(openBraces - closeBraces);
                    }
                    
                    // Try to parse the fixed JSON
                    const parsed = JSON.parse(jsonCandidate);
                    if (typeof parsed === 'object' && parsed !== null && (parsed.relevanceScore !== undefined || parsed.relevanceLabel !== undefined || parsed.matchReasons !== undefined)) {
                      jsonContent = jsonCandidate;
                      statusText = beforeReasoning;
                      hasReasoningSection = true;
                      isValidJson = true;
                      jsonLabel = 'Relevance Score';
                    }
                  } catch (parseError) {
                    // If parsing still fails, try one more approach: find the last complete field and close the JSON
                    try {
                      // Look for the last complete key-value pair and try to close the JSON
                      const lastCompleteField = trimmedAfter.match(/"[^"]+":\s*([^,}]+)(?=,|$)/g);
                      if (lastCompleteField && lastCompleteField.length > 0) {
                        // Find where the last field ends
                        const lastField = lastCompleteField[lastCompleteField.length - 1];
                        const lastFieldIndex = trimmedAfter.lastIndexOf(lastField);
                        if (lastFieldIndex !== -1) {
                          // Try to close the JSON after the last complete field
                          let jsonCandidate = trimmedAfter.substring(0, lastFieldIndex + lastField.length);
                          // Remove trailing comma if present
                          jsonCandidate = jsonCandidate.replace(/,\s*$/, '');
                          // Add closing brace
                          jsonCandidate = jsonCandidate + '}';
                          
                          const parsed = JSON.parse(jsonCandidate);
                          if (typeof parsed === 'object' && parsed !== null && (parsed.relevanceScore !== undefined || parsed.relevanceLabel !== undefined)) {
                            jsonContent = jsonCandidate;
                            statusText = beforeReasoning;
                            hasReasoningSection = true;
                            isValidJson = true;
                            jsonLabel = 'Relevance Score';
                          }
                        }
                      }
                    } catch {
                      // Still not valid, continue to other strategies
                    }
                  }
                }
              }
              
              // Strategy 2: Use balanced brace matching on the full afterReasoning (handles multi-line)
              if (!isValidJson) {
                let jsonStartIndex = -1;
                let jsonEndIndex = -1;
                let braceCount = 0;
                let bracketCount = 0;
                let inString = false;
                let escapeNext = false;
                
                // Find the first { or [ which indicates start of JSON
                for (let i = 0; i < afterReasoning.length; i++) {
                  const char = afterReasoning[i];
                  
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
                
                if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                  jsonContent = afterReasoning.substring(jsonStartIndex, jsonEndIndex);
                  
                  // Validate the extracted JSON
                  try {
                    const parsed = JSON.parse(jsonContent);
                    if (typeof parsed === 'object' && parsed !== null) {
                      statusText = beforeReasoning;
                      hasReasoningSection = true;
                      isValidJson = true;
                      jsonLabel = 'Relevance Score';
                    }
                  } catch {
                    // Not valid JSON
                  }
                }
              }
              
              // Strategy 3: Use greedy regex to find JSON (fallback - handles multi-line)
              if (!isValidJson) {
                // Use non-greedy first, then greedy if that fails
                let jsonMatch = afterReasoning.match(/(\{[\s\S]*?\})/);
                if (!jsonMatch) {
                  jsonMatch = afterReasoning.match(/(\{[\s\S]*\})/);
                }
                if (jsonMatch) {
                  try {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (typeof parsed === 'object' && parsed !== null) {
                      jsonContent = jsonMatch[0];
                      statusText = beforeReasoning;
                      hasReasoningSection = true;
                      isValidJson = true;
                      jsonLabel = 'Relevance Score';
                    }
                  } catch {
                    // Not valid JSON - try to fix incomplete JSON from regex match
                    try {
                      let fixedJson = jsonMatch[0];
                      // Count braces
                      const openBraces = (fixedJson.match(/\{/g) || []).length;
                      const closeBraces = (fixedJson.match(/\}/g) || []).length;
                      if (openBraces > closeBraces) {
                        fixedJson = fixedJson + '}'.repeat(openBraces - closeBraces);
                        const parsed = JSON.parse(fixedJson);
                        if (typeof parsed === 'object' && parsed !== null && (parsed.relevanceScore !== undefined || parsed.relevanceLabel !== undefined)) {
                          jsonContent = fixedJson;
                          statusText = beforeReasoning;
                          hasReasoningSection = true;
                          isValidJson = true;
                          jsonLabel = 'Relevance Score';
                        }
                      }
                    } catch {
                      // Still not valid
                    }
                  }
                }
              }
              
              // Strategy 4: Try to extract and fix incomplete JSON by finding the end of the reasoning field
              // This handles cases where the reasoning string is not properly closed
              if (!isValidJson && afterReasoning.trim().startsWith('{')) {
                try {
                  // Look for the reasoning field - it might be the last field and improperly closed
                  // Pattern to find "reasoning":"... (might not have closing quote)
                  const reasoningFieldStartPattern = /"reasoning"\s*:\s*"/;
                  const reasoningFieldMatch = afterReasoning.match(reasoningFieldStartPattern);
                  
                  if (reasoningFieldMatch) {
                    // Found the reasoning field - find where the string value starts
                    const reasoningFieldStartIndex = reasoningFieldMatch.index!;
                    const reasoningValueStartIndex = reasoningFieldStartIndex + reasoningFieldMatch[0].length;
                    
                    // Now find where the reasoning string should end
                    // Look for an unescaped quote, or if we reach the end, the string is unclosed
                    let reasoningStringEndIndex = -1;
                    let inString = true; // We're inside the reasoning string
                    let escapeNext = false;
                    
                    for (let i = reasoningValueStartIndex; i < afterReasoning.length; i++) {
                      const char = afterReasoning[i];
                      
                      if (escapeNext) {
                        escapeNext = false;
                        continue;
                      }
                      
                      if (char === '\\') {
                        escapeNext = true;
                        continue;
                      }
                      
                      if (char === '"' && !escapeNext) {
                        reasoningStringEndIndex = i + 1;
                        break;
                      }
                    }
                    
                    // Build JSON candidate
                    let jsonCandidate: string;
                    if (reasoningStringEndIndex !== -1) {
                      // Found closing quote - extract up to there
                      jsonCandidate = afterReasoning.substring(0, reasoningStringEndIndex);
                    } else {
                      // No closing quote found - the string is unclosed
                      // Extract up to the end of content and add closing quote
                      jsonCandidate = afterReasoning.trim();
                      // Remove any trailing incomplete content (like a closing brace without quote)
                      if (jsonCandidate.endsWith('}')) {
                        jsonCandidate = jsonCandidate.slice(0, -1).trim();
                      }
                      // Add closing quote for the reasoning string
                      jsonCandidate = jsonCandidate + '"';
                    }
                    
                    // Add closing brace if missing
                    if (!jsonCandidate.endsWith('}')) {
                      jsonCandidate = jsonCandidate + '}';
                    }
                    
                    // Try to parse
                    const parsed = JSON.parse(jsonCandidate);
                    if (typeof parsed === 'object' && parsed !== null && (parsed.relevanceScore !== undefined || parsed.relevanceLabel !== undefined || parsed.matchReasons !== undefined)) {
                      jsonContent = jsonCandidate;
                      statusText = beforeReasoning;
                      hasReasoningSection = true;
                      isValidJson = true;
                      jsonLabel = 'Relevance Score';
                      console.log('ChatMessages: Successfully detected JSON via Strategy 4 (reasoning field fix)', { messageId: message.id });
                    }
                  } else {
                    // No reasoning field found, but JSON starts with { - try simpler fix
                    // Just add closing brace and try to parse
                    let jsonCandidate = afterReasoning.trim();
                    if (!jsonCandidate.endsWith('}')) {
                      // Count braces properly
                      let openBraces = 0;
                      let closeBraces = 0;
                      let inString = false;
                      let escapeNext = false;
                      
                      for (let i = 0; i < jsonCandidate.length; i++) {
                        const char = jsonCandidate[i];
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
                      }
                      
                      if (openBraces > closeBraces) {
                        jsonCandidate = jsonCandidate + '}'.repeat(openBraces - closeBraces);
                      }
                    }
                    
                    const parsed = JSON.parse(jsonCandidate);
                    if (typeof parsed === 'object' && parsed !== null && (parsed.relevanceScore !== undefined || parsed.relevanceLabel !== undefined)) {
                      jsonContent = jsonCandidate;
                      statusText = beforeReasoning;
                      hasReasoningSection = true;
                      isValidJson = true;
                      jsonLabel = 'Relevance Score';
                      console.log('ChatMessages: Successfully detected JSON via Strategy 4 (simple fix)', { messageId: message.id });
                    }
                  }
                } catch (parseError) {
                  console.log('ChatMessages: Strategy 4 parse failed', { messageId: message.id, error: parseError });
                  // Not valid
                }
              }
              
              // Strategy 5: Check if the entire afterReasoning is a JSON string (double-encoded)
              if (!isValidJson && afterReasoning.trim().startsWith('"') && afterReasoning.trim().endsWith('"')) {
                try {
                  const unquoted = JSON.parse(afterReasoning.trim());
                  if (typeof unquoted === 'string' && unquoted.startsWith('{')) {
                    const innerParsed = JSON.parse(unquoted);
                    if (typeof innerParsed === 'object' && innerParsed !== null) {
                      jsonContent = unquoted;
                      statusText = beforeReasoning;
                      hasReasoningSection = true;
                      isValidJson = true;
                      jsonLabel = 'Relevance Score';
                    }
                  }
                } catch {
                  // Not double-encoded JSON
                }
              }
              
              // Strategy 6: Final fallback - aggressively fix incomplete JSON
              // This specifically handles the case where the reasoning string is unclosed
              if (!isValidJson && afterReasoning.trim().startsWith('{')) {
                try {
                  let jsonCandidate = afterReasoning.trim();
                  
                  // Special handling for reasoning field that's not properly closed
                  // Pattern: "reasoning":"...text'}" should be "reasoning":"...text"}"
                  if (jsonCandidate.includes('"reasoning"')) {
                    // Find where the reasoning value starts
                    const reasoningValuePattern = /"reasoning"\s*:\s*"/;
                    const reasoningMatch = jsonCandidate.match(reasoningValuePattern);
                    
                    if (reasoningMatch) {
                      const valueStartIndex = reasoningMatch.index! + reasoningMatch[0].length;
                      
                      // Check if the reasoning string value is properly closed
                      // Look for an unescaped closing quote after the value starts
                      let foundClosingQuote = false;
                      let escapeNext = false;
                      let inString = true; // We're inside the string value
                      
                      for (let i = valueStartIndex; i < jsonCandidate.length; i++) {
                        const char = jsonCandidate[i];
                        if (escapeNext) {
                          escapeNext = false;
                          continue;
                        }
                        if (char === '\\') {
                          escapeNext = true;
                          continue;
                        }
                        if (char === '"' && !escapeNext) {
                          // Found closing quote
                          foundClosingQuote = true;
                          break;
                        }
                        // If we hit } before finding a quote, the string is definitely unclosed
                        if (char === '}' && !foundClosingQuote) {
                          break;
                        }
                      }
                      
                      // If no closing quote found, add one before the final }
                      if (!foundClosingQuote) {
                        if (jsonCandidate.endsWith('}')) {
                          // Remove the }, add closing quote, then add } back
                          jsonCandidate = jsonCandidate.slice(0, -1).trim() + '"' + '}';
                        } else {
                          // Add closing quote and brace
                          jsonCandidate = jsonCandidate.trim() + '"' + '}';
                        }
                      } else if (!jsonCandidate.endsWith('}')) {
                        // Has closing quote but missing closing brace
                        jsonCandidate = jsonCandidate + '}';
                      }
                    }
                  } else if (!jsonCandidate.endsWith('}')) {
                    // No reasoning field, just add closing brace
                    jsonCandidate = jsonCandidate + '}';
                  }
                  
                  // Try to parse the fixed JSON
                  const parsed = JSON.parse(jsonCandidate);
                  if (typeof parsed === 'object' && parsed !== null && (parsed.relevanceScore !== undefined || parsed.relevanceLabel !== undefined || parsed.matchReasons !== undefined)) {
                    jsonContent = jsonCandidate;
                    statusText = beforeReasoning;
                    hasReasoningSection = true;
                    isValidJson = true;
                    jsonLabel = 'Relevance Score';
                    console.log('ChatMessages: Successfully detected JSON via Strategy 6 (final fallback)', { messageId: message.id });
                  }
                } catch (finalError) {
                  console.log('ChatMessages: All strategies failed for Reasoning JSON', { 
                    messageId: message.id,
                    afterReasoningPreview: afterReasoning.substring(0, 200),
                    afterReasoningEnd: afterReasoning.substring(Math.max(0, afterReasoning.length - 50)),
                    error: finalError
                  });
                }
              }
            }
          }
          
          // If we didn't find JSON in Reasoning section, try general detection
          if (!isValidJson) {
            // Try to find JSON in the content using balanced brace/bracket matching
            let jsonStartIndex = -1;
            let jsonEndIndex = -1;
            let braceCount = 0;
            let bracketCount = 0;
            let inString = false;
            let escapeNext = false;
            
            // Find the start of JSON (first { or [)
            for (let i = 0; i < trimmedContent.length; i++) {
              const char = trimmedContent[i];
              
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
            
            // If we found a complete JSON structure, extract it
            if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
              jsonContent = trimmedContent.substring(jsonStartIndex, jsonEndIndex);
              statusText = trimmedContent.substring(0, jsonStartIndex).trim();
              const textAfterJson = trimmedContent.substring(jsonEndIndex).trim();
              
              // Remove trailing colon and whitespace from status text
              statusText = statusText.replace(/:\s*$/, '').trim();
              
              // If there's meaningful text after JSON, include it
              if (textAfterJson && !textAfterJson.match(/^[,\s]*$/)) {
                statusText = statusText ? `${statusText} ${textAfterJson}` : textAfterJson;
              }
              
              // Validate the extracted JSON
              try {
                JSON.parse(jsonContent);
                isValidJson = true;
                
                console.log('ChatMessages: isValidJson', isValidJson, jsonContent);
                // Try to infer a label from the content
                const lowerContent = message.content.toLowerCase();
                if ( jsonContent.includes('identifiedPatterns')) {
                  jsonLabel = 'Discovery Patterns';
                } else if ( jsonContent.includes('roleVariations')) {
                  jsonLabel = 'Role Variations';
                } else if ( jsonContent.includes('falsePositives')) {
                  jsonLabel = 'Page Results Validation';
                } else if ( jsonContent.includes('keywords')) {
                  jsonLabel = 'Keywords Parameter';
                } else if ( jsonContent.includes('roleVariations')) {
                  jsonLabel = 'Query Understanding';
                } else if ( jsonContent.includes('discoveryNeeds') || jsonContent.includes('identifiedPatterns') || jsonContent.includes('discoveryNeeds')) {
                  jsonLabel = 'Discovery Needs';
                } else if ( jsonContent.includes('needsClarification') || jsonContent.includes('needsClarification')) {
                  jsonLabel = 'Clarification Needs';
                } else if (lowerContent.includes('location') || jsonContent.includes('location')) {
                  jsonLabel = 'Location Parameter';
                } else if (lowerContent.includes('company') || jsonContent.includes('company')) {
                  jsonLabel = 'Company Parameter';
                } else if (lowerContent.includes('industry') || jsonContent.includes('industry')) {
                  jsonLabel = 'Industry Parameter';
                } else if (lowerContent.includes('generating')) {
                  // Extract parameter name from "Generating X parameter..."
                  const generatingMatch = message.content.match(/generating\s+(\w+)\s+parameter/i);
                  if (generatingMatch) {
                    jsonLabel = `${generatingMatch[1].charAt(0).toUpperCase() + generatingMatch[1].slice(1)} Parameter`;
                  }
                }
              } catch {
                // Not valid JSON, will show as regular text
                isValidJson = false;
              }
            }
          }
        }
        
        return (
          <StyledMessage key={message.id} isUser={message.type === 'user'}>
            <StyledMessageIcon>
              {message.type === 'user' ? '👤' : '🤖'}
            </StyledMessageIcon>
            {isValidJson ? (
              <StyledMessageContent isUser={message.type === 'user'} isStreaming={false}>
                {statusText && (
                  <div style={{ marginBottom: hasReasoningSection ? '12px' : '8px', color: 'inherit', fontSize: 'inherit' }}>
                    {statusText}
                    {hasReasoningSection && <div style={{ marginTop: '8px', fontWeight: '500' }}>Reasoning:</div>}
                  </div>
                )}
                <JsonMessageViewer content={jsonContent} label={jsonLabel} />
              </StyledMessageContent>
            ) : (
              <StyledMessageContent isUser={message.type === 'user'} isStreaming={message.isStreaming}>
                {message.content}
              </StyledMessageContent>
            )}
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
