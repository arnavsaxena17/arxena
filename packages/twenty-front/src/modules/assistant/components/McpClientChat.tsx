import {
  AssistantDetailsTable,
  AssistantTableData,
} from '@/assistant/components/AssistantDetailsTable';
import type {
  AssistantAgentEvent,
  AssistantChatMessage,
} from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { Button, IconChevronDown, Loader } from 'twenty-ui';

import { useControlledMessages } from '@/assistant/hooks/useControlledMessages';
import { useMcpStreamingChat } from '@/assistant/hooks/useMcpStreamingChat';
import {
  parseMessageContentWithJson,
  parseRichText,
} from '@/assistant/utils/richText';

export type { AssistantChatMessage };

export type McpClientChatProps = {
  messages?: AssistantChatMessage[];
  onMessagesChange?: (messages: AssistantChatMessage[]) => void;
  onTableData?: (data: AssistantTableData) => void;
  threadId?: string;
  onThreadNameChange?: (name: string) => void;
  onMessageComplete?: () => void;
  /** Called when backend sends a message event (e.g. parsed_requirement, master_lists, query_set) */
  onStreamMessage?: (type: string, data: unknown) => void;
  /** Called when backend sends an assistant agent event over SSE (event: agent_event) */
  onAgentEvent?: (event: AssistantAgentEvent) => void;
  /** Candidate IDs selected in the results DataTable, sent along with each chat message */
  selectedCandidateIds?: string[];
  /** Called when the MCP backend creates a job and emits job_attached with its ID */
  onJobAttached?: (jobId: string) => void;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 720px;
  width: 90%;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(4)};
  min-height: 0;
  position: relative;
`;

const StyledMessagesWrapper = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
`;

const StyledMessages = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  scrollbar-width: thin;
`;

const StyledScrollToBottomButton = styled.button`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing(4)};
  right: ${({ theme }) => theme.spacing(3)};
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 10;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
  }
`;

const StyledMessageLabel = styled.div<{ isUser: boolean }>`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
  text-align: ${({ isUser }) => (isUser ? 'right' : 'left')};
`;

const StyledMessage = styled.div<{ isUser: boolean }>`
  align-self: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
  max-width: 85%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background-color: ${({ theme, isUser }) =>
    isUser ? theme.background.transparent.light : theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.md};
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
`;



const StyledToolCalls = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledOrgChartPreview = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledOrgChartImage = styled.img`
  max-width: 200px;
  max-height: 150px;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  transition: opacity 0.2s;
  &:hover {
    opacity: 0.8;
  }
`;

const StyledOrgChartLink = styled.a`
  display: inline-block;
  text-decoration: none;
  color: ${({ theme }) => theme.font.color.primary};
  &:hover {
    text-decoration: underline;
  }
`;

const StyledOrgChartInfo = styled.div`
  margin-top: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-shrink: 0;
  width: 100%;
`;

const StyledInputWrapper = styled.div`
  flex: 1;
  width: 100%;
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  min-height: ${({ theme }) => theme.spacing(5)};
  max-height: ${({ theme }) => theme.spacing(20)};
  resize: none;
  box-sizing: border-box;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  padding: ${({ theme }) => theme.spacing(2)};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.4;
  color: ${({ theme }) => theme.font.color.primary};
  background-color: ${({ theme }) => theme.background.transparent.lighter};

  &:disabled {
    color: ${({ theme }) => theme.font.color.tertiary};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.light};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;


const StyledTableSnapshot = styled.div`
  margin-top: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  background: ${({ theme }) => theme.background.primary};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.border.color.medium};
    background: ${({ theme }) => theme.background.secondary};
  }
`;

const StyledTableSnapshotHint = styled.div`
  margin-top: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledErrorBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.danger};
  color: ${({ theme }) => theme.font.color.danger};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledErrorText = styled.span`
  flex: 1;
  min-width: 0;
`;

const StyledRetryButton = styled.button`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.spacing(1, 2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.danger};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.border.color.danger};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  &:hover {
    opacity: 0.9;
  }
`;

const StyledExecutionTimerBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1.5, 2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledExecutionTimerLeft = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
`;

const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

export const McpClientChat = ({
  messages: controlledMessages,
  onMessagesChange,
  onTableData,
  threadId,
  onThreadNameChange,
  onMessageComplete,
  onStreamMessage,
  onAgentEvent,
  selectedCandidateIds,
  onJobAttached,
}: McpClientChatProps) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const navigate = useNavigate();
  const [messages, setMessages] = useControlledMessages(
    controlledMessages,
    onMessagesChange,
  );
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [requestElapsedSeconds, setRequestElapsedSeconds] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrolledUpRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const {
    sendMessage,
    stopMessage,
    loading,
    error,
    setError,
  } = useMcpStreamingChat({
    messages,
    setMessages,
    threadId,
    onTableData,
    onThreadNameChange,
    onMessageComplete,
    onStreamMessage,
    onAgentEvent,
    onJobAttached,
    token: tokenPair?.accessToken?.token,
    baseUrl,
    selectedCandidateIds,
  });

  const sendCurrentMessage = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  }, [input, sendMessage]);

  useEffect(() => {
    if (!loading) {
      setRequestElapsedSeconds(0);
      return;
    }

    const start = Date.now();
    setRequestElapsedSeconds(0);

    const intervalId = window.setInterval(() => {
      setRequestElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loading]);

  const checkIsNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback((instant = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (instant) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
    isUserScrolledUpRef.current = false;
    setShowScrollButton(false);
  }, []);

  // Track user scroll position to decide whether to auto-scroll
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = checkIsNearBottom();
      if (nearBottom) {
        isUserScrolledUpRef.current = false;
        setShowScrollButton(false);
      } else {
        isUserScrolledUpRef.current = true;
        setShowScrollButton(true);
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [checkIsNearBottom]);

  useEffect(() => {
    // Only auto-scroll when user hasn't manually scrolled up
    if (isUserScrolledUpRef.current) return;
    const isStreaming =
      loading &&
      messages.length > 0 &&
      messages[messages.length - 1]?.role === 'assistant';
    requestAnimationFrame(() => {
      scrollToBottom(isStreaming);
    });
  }, [messages, loading, scrollToBottom]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendCurrentMessage();
    },
    [sendCurrentMessage],
  );

  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = 'auto';
    const maxHeight = element.scrollHeight;
    element.style.height = `${maxHeight}px`;
  }, [input]);

  return (
    <StyledContainer>
      <StyledMessagesWrapper>
        <StyledMessages ref={messagesContainerRef}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <div key={i}>
                <StyledMessageLabel isUser={isUser}>
                  {isUser ? 'You' : 'Assistant'}
                </StyledMessageLabel>
                <StyledMessage isUser={isUser}>
                  {isUser
                    ? parseRichText(msg.content || '')
                    : parseMessageContentWithJson(msg.content || '')}
                </StyledMessage>
                {msg.tableDataList?.map((tableData, tableIndex) => {
                  const previewData = {
                    ...tableData,
                    rows: tableData.rows.slice(0, 5),
                  };
                  return (
                    <StyledTableSnapshot
                      key={tableIndex}
                      onClick={() => {
                        onTableData?.(tableData);
                      }}
                    >
                      <div style={{ pointerEvents: 'none' }}>
                        <AssistantDetailsTable
                          data={previewData}
                          maxHeight={180}
                        />
                      </div>
                      <StyledTableSnapshotHint>
                        {tableData.rows.length > 5
                          ? `Showing 5 of ${tableData.rows.length} candidates. Click to view all in the panel.`
                          : 'Click to view in the panel.'}
                      </StyledTableSnapshotHint>
                    </StyledTableSnapshot>
                  );
                })}
                {msg.orgCharts?.map((orgChart, orgChartIndex) => {
                  const logoUrl = `${baseUrl}/org-chart/company-logo?website=${encodeURIComponent(orgChart.companyName)}`;
                  return (
                    <StyledOrgChartPreview key={orgChartIndex}>
                      <StyledOrgChartLink
                        href={orgChart.viewUrl}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(orgChart.viewUrl);
                        }}
                      >
                        <StyledOrgChartImage
                          src={logoUrl}
                          alt={`${orgChart.companyName} org chart`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </StyledOrgChartLink>
                      <StyledOrgChartInfo>
                        <div>
                          <strong>{orgChart.companyName}</strong>
                        </div>
                        {orgChart.country && orgChart.country !== 'global' && (
                          <div>Country: {orgChart.country}</div>
                        )}
                        {orgChart.functionRoot &&
                          orgChart.functionRoot !== 'fullcompany' && (
                            <div>Function: {orgChart.functionRoot}</div>
                          )}
                        <div>
                          <StyledOrgChartLink
                            href={orgChart.viewUrl}
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(orgChart.viewUrl);
                            }}
                          >
                            View full org chart →
                          </StyledOrgChartLink>
                        </div>
                      </StyledOrgChartInfo>
                    </StyledOrgChartPreview>
                  );
                })}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <StyledToolCalls>
                    Used: {msg.toolCalls.map((t) => t.name).join(', ')}
                  </StyledToolCalls>
                )}
              </div>
            );
          })}
          {loading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === 'user' && (
              <StyledMessage isUser={false}>Thinking…</StyledMessage>
            )}
          <div ref={messagesEndRef} />
        </StyledMessages>
        {showScrollButton && (
          <StyledScrollToBottomButton
            type="button"
            onClick={() => scrollToBottom(false)}
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <IconChevronDown size={16} />
          </StyledScrollToBottomButton>
        )}
      </StyledMessagesWrapper>
      {error && (
        <StyledErrorBanner role="alert">
          <StyledErrorText>{error}</StyledErrorText>
          <StyledRetryButton
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss and try again"
          >
            Dismiss
          </StyledRetryButton>
        </StyledErrorBanner>
      )}
      {loading && (
        <StyledExecutionTimerBanner role="status" aria-live="polite">
          <StyledExecutionTimerLeft>
            <Loader color="gray" />
            <span>Waiting for server response...</span>
          </StyledExecutionTimerLeft>
          <span>{requestElapsedSeconds}s</span>
        </StyledExecutionTimerBanner>
      )}
      <StyledForm onSubmit={handleSubmit} aria-label="Chat input">
        <StyledInputWrapper>
          <StyledTextArea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your message…"
            disabled={loading}
            aria-label="Message"
            rows={1}
            onKeyDown={(event) => {
              // Prevent global hotkeys/shortcuts from triggering while typing in the chat input
              event.stopPropagation();
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendCurrentMessage();
              }
            }}
          />
        </StyledInputWrapper>
        <Button
          title={loading ? 'Stop' : 'Send'}
          type={loading ? 'button' : 'submit'}
          onClick={loading ? stopMessage : undefined}
          aria-label={loading ? 'Stop message' : 'Send message'}
        />
      </StyledForm>
    </StyledContainer>
  );
};
