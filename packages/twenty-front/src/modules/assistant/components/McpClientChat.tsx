import { Button } from 'twenty-ui/input';
import { Loader } from 'twenty-ui/feedback';
import { IconChevronDown, IconHierarchy2 } from 'twenty-ui/icon';
import {
    AssistantDetailsTable,
    AssistantTableData,
} from '@/assistant/components/AssistantDetailsTable';
import type {
    AssistantAgentEvent,
    AssistantChatMessage,
    AssistantIterativeQueryResult,
    AssistantIterativeQueryState,
    AssistantStatusMessagePolicy,
    OrgChartPreview,
} from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { useControlledMessages } from '@/assistant/hooks/useControlledMessages';
import { useMcpStreamingChat } from '@/assistant/hooks/useMcpStreamingChat';
import {
    parseMessageContentWithJson,
    parseRichText,
} from '@/assistant/utils/richText';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type { AssistantChatMessage };

export type McpClientChatProps = {
  messages?: AssistantChatMessage[];
  onMessagesChange?: (messages: AssistantChatMessage[]) => void;
  onTableData?: (data: AssistantTableData) => void;
  /** Opens the org chart in the assistant results panel (right column). */
  onOrgChartSelect?: (org: OrgChartPreview) => void;
  threadId?: string;
  onThreadNameChange?: (name: string) => void;
  onMessageComplete?: () => void;
  /** Called when backend sends a message event (e.g. parsed_requirement, master_lists, query_set) */
  onStreamMessage?: (type: string, data: unknown) => void;
  /** Called when backend sends an assistant agent event over SSE (event: agent_event) */
  onAgentEvent?: (event: AssistantAgentEvent) => void;
  /** Candidate IDs selected in the results DataTable, sent along with each chat message */
  selectedCandidateIds?: string[];
  /** Called when the MCP backend attaches a job to the thread (create_project, get_project_by_id, or unambiguous find_project_by_name) */
  onJobAttached?: (projectId: string) => void;
  assistantParameters?: Record<string, unknown> & {
    iterativeQueryState?: AssistantIterativeQueryState;
    statusMessagePolicy?: Partial<AssistantStatusMessagePolicy>;
  };
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 720px;
  width: 90%;
  margin: 0 auto;
  padding: ${themeCssVariables.spacing[4]};
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
  gap: ${themeCssVariables.spacing[3]};
  margin-bottom: ${themeCssVariables.spacing[3]};
  scrollbar-width: thin;
`;

const StyledScrollToBottomButton = styled.button`
  position: absolute;
  bottom: ${themeCssVariables.spacing[4]};
  right: ${themeCssVariables.spacing[3]};
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 10;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: ${themeCssVariables.background.secondary};
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledMessageLabel = styled.div<{ isUser: boolean }>`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  margin-bottom: ${themeCssVariables.spacing[1]};
  text-align: ${({ isUser }) => (isUser ? 'right' : 'left')};
`;

const StyledMessage = styled.div<{ isUser: boolean }>`
  align-self: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
  max-width: 85%;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.md};
  background-color: ${({ isUser }) =>
    isUser ? themeCssVariables.background.transparent.light : themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  font-size: ${themeCssVariables.font.size.md};
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
`;

const StyledToolCalls = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledOrgChartSnippetRow = styled.div`
  margin-top: ${themeCssVariables.spacing[2]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledOrgChartSnippetButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  width: 100%;
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};

  &:hover {
    background: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledOrgChartSnippetLabel = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: ${themeCssVariables.spacing['1']};
`;

const StyledOrgChartSnippetName = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledOrgChartSnippetHint = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledOrgChartFullPageLink = styled.a`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.color.blue};
  text-decoration: none;
  padding-left: ${themeCssVariables.spacing['1']};

  &:hover {
    text-decoration: underline;
  }
`;

const StyledForm = styled.form`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  flex-shrink: 0;
  width: 100%;
`;

const StyledInputWrapper = styled.div`
  flex: 1;
  width: 100%;
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  min-height: ${themeCssVariables.spacing[5]};
  max-height: ${themeCssVariables.spacing[20]};
  resize: none;
  box-sizing: border-box;
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  padding: ${themeCssVariables.spacing[2]};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.4;
  color: ${themeCssVariables.font.color.primary};
  background-color: ${themeCssVariables.background.transparent.lighter};

  &:disabled {
    color: ${themeCssVariables.font.color.tertiary};
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }

  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledTableSnapshot = styled.div`
  margin-top: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.light};
  background: ${themeCssVariables.background.primary};
  cursor: pointer;

  &:hover {
    border-color: ${themeCssVariables.border.color.medium};
    background: ${themeCssVariables.background.secondary};
  }
`;

const StyledTableSnapshotHint = styled.div`
  margin-top: ${themeCssVariables.spacing[1]};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledErrorBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.danger};
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledErrorText = styled.span`
  flex: 1;
  min-width: 0;
`;

const StyledRetryButton = styled.button`
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.danger};
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.danger};
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  &:hover {
    opacity: 0.9;
  }
`;

const StyledExecutionTimerBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledStatusLog = styled.div`
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledStatusLogHeader = styled.div`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledStatusLogList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing['1']};
  max-height: 140px;
  overflow-y: auto;
  white-space: pre-wrap;
`;

const StyledExecutionTimerLeft = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${themeCssVariables.spacing['1.5']};
`;

const StyledMiniButton = styled.button`
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing['3']};
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const StyledComposerActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing['1.5']};
`;

const StyledComposerMeta = styled.div`
  margin-top: ${themeCssVariables.spacing['1.5']};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
  white-space: pre-wrap;
`;

const baseUrl = REACT_APP_SERVER_BASE_URL ?? '';

const formatIterativeAssistantMessage = (
  result: AssistantIterativeQueryResult,
  steeringMessage?: string,
) => {
  const header = steeringMessage
    ? `Applied steering: ${steeringMessage}\n\n`
    : '';
  const summary = `Final query set (${result.final_query_set.search_query_set.length} queries, score ${result.verification_summary.final_score.toFixed(2)}).`;
  const queries = result.final_query_set.search_query_set
    .map((query, index) => {
      const parts = [
        query.job_title ? `job_title=${query.job_title}` : null,
        query.keywords ? `keywords=${query.keywords}` : null,
        query.location?.length ? `location=${query.location.join(', ')}` : null,
        query.company?.length ? `company=${query.company.join(', ')}` : null,
      ].filter((value): value is string => Boolean(value));
      return `${index + 1}. ${parts.join(' | ')}`;
    })
    .join('\n');

  return `${header}${summary}\n${queries}`;
};

export const McpClientChat = ({
  messages: controlledMessages,
  onMessagesChange,
  onTableData,
  onOrgChartSelect,
  threadId,
  onThreadNameChange,
  onMessageComplete,
  onStreamMessage,
  onAgentEvent,
  selectedCandidateIds,
  onJobAttached,
  assistantParameters,
}: McpClientChatProps) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const navigate = useNavigate();
  const [messages, setMessages] = useControlledMessages(
    controlledMessages,
    onMessagesChange,
  );
  const [input, setInput] = useState('');
  const [iterativeLoading, setIterativeLoading] = useState(false);
  const [iterativeError, setIterativeError] = useState<string | null>(null);
  const [iterativeState, setIterativeState] = useState<AssistantIterativeQueryState | null>(
    () => assistantParameters?.iterativeQueryState ?? null,
  );
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
    streamLog,
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
    token: tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    baseUrl,
    selectedCandidateIds,
    statusMessagePolicy: assistantParameters?.statusMessagePolicy,
  });

  const sendCurrentMessage = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  }, [input, sendMessage]);

  useEffect(() => {
    const savedState = assistantParameters?.iterativeQueryState ?? null;
    setIterativeState(savedState);
  }, [assistantParameters]);

  const runIterativeQuery = useCallback(
    async () => {
      if (!threadId || !tokenPair?.accessOrWorkspaceAgnosticToken?.token || !baseUrl) {
        setIterativeError('Thread, token, or server base URL is missing.');
        return;
      }

      const trimmedInput = input.trim();
      if (!trimmedInput) {
        setIterativeError('Enter a steering instruction before refining the query set.');
        return;
      }

      const baseRequirement =
        iterativeState?.baseRequirement ??
        messages.find(
          (message) =>
            message.role === 'user' &&
            !message.content.startsWith('Steer query set:'),
        )?.content ??
        trimmedInput;

      setIterativeLoading(true);
      setIterativeError(null);

      try {
        const res = await fetch(`${baseUrl}/assistant/threads/${threadId}/iterative-query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
          body: JSON.stringify({
            rawRequirement: baseRequirement,
            steeringMessage: trimmedInput,
            maxIterations: 4,
          }),
        });

        const data = (await res.json()) as {
          error?: string;
          assistantMessage?: string;
          iterativeQueryState?: AssistantIterativeQueryState;
          result?: AssistantIterativeQueryResult;
        };

        if (!res.ok || data.error) {
          throw new Error(data.error ?? 'Failed to generate iterative query set');
        }

        const nextState = data.iterativeQueryState ?? null;
        setIterativeState(nextState);
        setInput('');

        const assistantMessage =
          data.assistantMessage ??
          (data.result ? formatIterativeAssistantMessage(data.result, trimmedInput) : '');

        if (assistantMessage) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'user',
              content: `Steer query set: ${trimmedInput}`,
            },
            { role: 'assistant', content: assistantMessage },
          ]);
        }
      } catch (err) {
        setIterativeError(err instanceof Error ? err.message : String(err));
      } finally {
        setIterativeLoading(false);
      }
    },
    [
      baseUrl,
      input,
      iterativeState?.baseRequirement,
      messages,
      setMessages,
      threadId,
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    ],
  );

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
      if (loading || iterativeLoading) {
        return;
      }
      sendCurrentMessage();
    },
    [iterativeLoading, loading, sendCurrentMessage],
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
          {messages
            .filter(
              (msg) =>
                !msg.isStatus ||
                assistantParameters?.statusMessagePolicy?.showInUi !== false,
            )
            .map((msg, i) => {
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
                  const previewKind =
                    tableData.tableType === 'candidates'
                      ? 'candidates'
                      : tableData.tableType ?? 'rows';
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
                          ? `Showing 5 of ${tableData.rows.length} ${previewKind}. Click to view all in the panel.`
                          : 'Click to view in the panel.'}
                      </StyledTableSnapshotHint>
                    </StyledTableSnapshot>
                  );
                })}
                {msg.orgCharts?.map((orgChart, orgChartIndex) => (
                  <StyledOrgChartSnippetRow key={orgChartIndex}>
                    <StyledOrgChartSnippetButton
                      type="button"
                      onClick={() => onOrgChartSelect?.(orgChart)}
                    >
                      <IconHierarchy2 size={22} />
                      <StyledOrgChartSnippetLabel>
                        <StyledOrgChartSnippetName>
                          {orgChart.companyName}
                        </StyledOrgChartSnippetName>
                        <StyledOrgChartSnippetHint>
                          Show org chart in results panel
                        </StyledOrgChartSnippetHint>
                      </StyledOrgChartSnippetLabel>
                    </StyledOrgChartSnippetButton>
                    <StyledOrgChartFullPageLink
                      href={orgChart.viewUrl}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(orgChart.viewUrl);
                      }}
                    >
                      Open full org chart page →
                    </StyledOrgChartFullPageLink>
                  </StyledOrgChartSnippetRow>
                ))}
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
      {loading && streamLog.length > 0 && (
        <StyledStatusLog role="status" aria-live="polite">
          <StyledStatusLogHeader>Live Progress</StyledStatusLogHeader>
          <StyledStatusLogList>
            {streamLog.slice(-6).map((entry, index) => (
              <div key={`${index}-${entry}`}>{entry}</div>
            ))}
          </StyledStatusLogList>
        </StyledStatusLog>
      )}
      <StyledForm onSubmit={handleSubmit} aria-label="Chat input">
        <StyledInputWrapper>
          <StyledTextArea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your message…"
            disabled={iterativeLoading}
            aria-label="Message"
            rows={1}
            onKeyDown={(event) => {
              // Prevent global hotkeys/shortcuts from triggering while typing in the chat input
              event.stopPropagation();
              if (event.key === 'Enter' && !event.shiftKey && !loading && !iterativeLoading) {
                event.preventDefault();
                sendCurrentMessage();
              }
            }}
          />
        </StyledInputWrapper>
        <StyledComposerActions>
          {loading && (
            <StyledMiniButton
              type="button"
              onClick={() => void runIterativeQuery()}
              disabled={!threadId || iterativeLoading || !input.trim()}
              title={
                iterativeState?.baseRequirement
                  ? 'Steer the saved iterative query set'
                  : 'Create or steer the iterative query set using the current conversation'
              }
            >
              {iterativeLoading ? 'Steering…' : 'Steer'}
            </StyledMiniButton>
          )}
          <Button
            title={loading ? 'Stop' : 'Send'}
            type={loading ? 'button' : 'submit'}
            onClick={loading ? stopMessage : undefined}
            aria-label={loading ? 'Stop message' : 'Send message'}
          />
        </StyledComposerActions>
      </StyledForm>
      {(iterativeError || iterativeState) && (
        <StyledComposerMeta>
          {iterativeError
            ? `Error: ${iterativeError}`
            : `Saved requirement: ${iterativeState?.baseRequirement ?? 'Not set yet'}\nSteering turns: ${
                iterativeState?.steeringHistory?.length ?? 0
              }${
                iterativeState?.progressLog?.length
                  ? `\nLatest milestone: ${
                      iterativeState.progressLog[
                        iterativeState.progressLog.length - 1
                      ]?.message ?? ''
                    }`
                  : ''
              }${
                iterativeState?.lastResult
                  ? `\nLatest query-set score: ${iterativeState.lastResult.verification_summary.final_score.toFixed(
                      2,
                    )}`
                  : ''
              }`}
        </StyledComposerMeta>
      )}
    </StyledContainer>
  );
};
