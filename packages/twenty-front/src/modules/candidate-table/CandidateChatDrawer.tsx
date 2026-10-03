import { currentProjectIdState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { CandidateDrawerActivityTab } from '@/candidate-table/components/candidate-drawer/CandidateDrawerActivityTab';
import { CandidateDrawerContextTab } from '@/candidate-table/components/candidate-drawer/CandidateDrawerContextTab';
import { CandidateDrawerConversationTab } from '@/candidate-table/components/candidate-drawer/CandidateDrawerConversationTab';
import { CandidateDrawerHeader } from '@/candidate-table/components/candidate-drawer/CandidateDrawerHeader';
import { CandidateDrawerNeedsYouCard } from '@/candidate-table/components/candidate-drawer/CandidateDrawerNeedsYouCard';
import { useCandidateDrawerRecord } from '@/candidate-table/hooks/useCandidateDrawerRecord';
import {
  buildCandidateDrawerStatusLine,
  resolveCandidateDrawerNextStep,
  resolveCandidateDrawerStageLabel,
} from '@/candidate-table/utils/candidateDrawerStatus';
import { useOpenAskAiPageWithPreprompt } from '@/ai/hooks/useOpenAskAiPageWithPreprompt';
import { AppPath } from 'twenty-shared/types';
import {
  findSelectedTableRow,
  isUUID,
  resolveChatLookupIds,
} from '@/candidate-table/HotHooks';
import {
  candidateDataState,
  processedDataSelector,
  selectedCandidateIdState,
  tableStateAtom,
  unreadMessagesCountsState,
} from '@/candidate-table/states/states';
import { useCandidateOutreachJourney } from '@/outreach-home/hooks/useCandidateOutreachJourney';
import { useStartOutreachSequencerOnCandidates } from '@/outreach-home/hooks/useStartOutreachSequencerOnCandidates';
import { OUTREACH_PROJECT_ID_QUERY_PARAM } from '@/outreach-home/constants/outreach-command.constants';
import { useOutreachDecisions } from '@/outreach-today/hooks/useOutreachDecisions';
import { preferredOpenDecision } from '@/outreach-today/utils/group-outreach-decisions.util';
import { useStopOutreach } from '@/outreach-home/hooks/useStopOutreach';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import axios from 'axios';
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChatMessages, MessageNode } from 'twenty-shared/arx';
import { graphqlToFetchAllCandidateDataWithFieldValues } from 'twenty-shared/graphql';
import {
  IconAlertTriangle,
  IconMessage,
  IconSend,
  IconSettingsAutomation,
  IconSparkles,
  IconUser,
} from 'twenty-ui/icon';
import { Button, LightButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { Select } from '@/ui/input/components/Select';

import { CANDIDATE_CONVERSATION_STATUS_LABELS } from '@/candidate-table/constants/candidate-status-labels';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { useTemplates } from './hooks/useTemplates';

const AttachmentPanel = lazy(() => import('./AttachmentPanel'));

// Twenty record side panel layout: summary, fields and sticky tabs scroll
// together; only the chat composer stays pinned to the bottom.
const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

const StyledScrollArea = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
`;

const StyledHeaderSlot = styled.div`
  flex-shrink: 0;
`;

const StyledTabContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  flex-shrink: 0;
  padding: 0 ${themeCssVariables.spacing[2]};
  position: sticky;
  top: 0;
  z-index: 2;
`;

const StyledTabContent = styled.div`
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
`;

const StyledTabPlaceholder = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[4]};
`;

// Module scope: defining styled() inside render remounts AttachmentPanel children
// every drawer re-render and leaves the PDF viewer blank.
const StyledInlineAttachmentContainer = styled.div<{ isOpen: boolean }>`
  background-color: ${themeCssVariables.background.secondary};
  height: calc(100vh - 140px);
  overflow-y: auto;
  position: relative;
  width: 100%;
`;

const StyledChatNotice = styled.div<{ tone: 'info' | 'warning' }>`
  align-items: center;
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin: ${themeCssVariables.spacing[2]} 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};

  & > svg {
    color: ${({ tone }) =>
      tone === 'warning'
        ? themeCssVariables.color.orange
        : themeCssVariables.color.blue};
    flex-shrink: 0;
  }
`;

const StyledMessageInputContainer = styled.div`
  background-color: ${themeCssVariables.background.primary};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]}
    ${themeCssVariables.spacing[3]};
  width: 100%;
`;

const StyledMessageInputTabContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledComposerSpacer = styled.div`
  flex: 1;
`;

const StyledInputWrapper = styled.div`
  align-items: center;
  box-sizing: border-box;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  width: 100%;
`;

const StyledChatInput = styled.input`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  height: 32px;
  min-width: 0;
  outline: none;
  padding: 0 ${themeCssVariables.spacing[2]};

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }

  &:focus:not(:disabled) {
    border-color: ${themeCssVariables.color.blue};
    box-shadow: 0 0 0 3px ${themeCssVariables.accent.tertiary};
  }

  &:disabled {
    background-color: ${themeCssVariables.background.secondary};
    color: ${themeCssVariables.font.color.tertiary};
    cursor: not-allowed;
  }
`;

const StyledTemplateContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  width: 100%;
`;

const StyledTemplatePreview = styled.div`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.secondary};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  min-height: 64px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  white-space: pre-wrap;
  width: 100%;
`;

const StyledTemplateActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

function isDoNotRespondMessage(content: string | undefined): boolean {
  if (!content || typeof content !== 'string') return false;
  return content.includes('#DONTRESPOND#') || content.includes('DONTRESPOND');
}

type CandidateData = {
  id: string;
  personId: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  checkbox: boolean;
  startChat: boolean;
  startChatCompleted: boolean;
  engagementStatus: string | true;
  messagingChannel: string;
  chatMessages?: ChatMessages;
};

export const CandidateChatDrawer = React.memo(() => {
  const [tokenPair] = useAtomState(tokenPairState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const [candidateData, setCandidateData] = useAtomState(candidateDataState);
  const tableState = useAtomStateValue(tableStateAtom);
  const processedData = useAtomStateValue(processedDataSelector);
  const searchResults = useAtomStateValue(searchResultsState);
  const setUnreadMessagesCounts = useSetAtomState(unreadMessagesCountsState);

  // Memoize selectedCandidateId to prevent unnecessary re-renders
  const selectedCandidateId = useAtomStateValue(selectedCandidateIdState);

  const [messageHistory, setMessageHistory] = useState<MessageNode[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [isCandidateDataLoading, setIsCandidateDataLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string>('Candidate');
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const fetchMessagesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMarkedAsReadRef = useRef<string | null>(null);

  // Use the templates hook
  const {
    templates,
    templatePreviews,
    isLoading: isLoadingTemplates,
  } = useTemplates();

  // Tab handling for main tabs
  const tabListId = 'candidate-chat-drawer-tabs';
  const [activeTabId, setActiveTabId] = useAtomComponentState(
    activeTabIdComponentState,
    tabListId,
  );

  const tabs = useMemo(
    () => [
      { id: 'conversation', title: 'Conversation', Icon: IconMessage },
      { id: 'context', title: 'Context', Icon: IconUser },
      { id: 'activity', title: 'Activity', Icon: IconSettingsAutomation },
    ],
    [],
  );

  const selectedTableRow = useMemo(() => {
    return findSelectedTableRow(selectedCandidateId, [
      ...searchResults,
      ...processedData,
      ...((tableState.rawData || []) as unknown as Record<string, unknown>[]),
    ]);
  }, [processedData, searchResults, selectedCandidateId, tableState.rawData]);

  const chatLookupIds = useMemo(
    () => resolveChatLookupIds(selectedCandidateId, selectedTableRow),
    [selectedCandidateId, selectedTableRow],
  );

  const outreachContext = useAtomStateValue(outreachContextState);
  const currentProjectId = useAtomStateValue(currentProjectIdState);

  const outreachProjectId = useMemo(() => {
    return (
      outreachContext.projectId ??
      currentProjectId ??
      (typeof candidateData?.projectId === 'string'
        ? candidateData.projectId
        : null)
    );
  }, [candidateData?.projectId, currentProjectId, outreachContext.projectId]);

  const enrolledCandidateId = useMemo(() => {
    return chatLookupIds.candidateId && isUUID(chatLookupIds.candidateId)
      ? chatLookupIds.candidateId
      : typeof selectedTableRow?.otherFields === 'object' &&
          selectedTableRow.otherFields !== null &&
          typeof (selectedTableRow.otherFields as { candidateId?: unknown })
            .candidateId === 'string'
        ? (selectedTableRow.otherFields as { candidateId: string }).candidateId
        : typeof selectedTableRow?.candidateId === 'string'
          ? selectedTableRow.candidateId
          : null;
  }, [chatLookupIds.candidateId, selectedTableRow]);

  const {
    journey: outreachJourney,
    isLoading: isOutreachJourneyLoading,
    isActionLoading: isOutreachActionLoading,
    refetch: refetchOutreachJourney,
    pauseJourney,
    resumeJourney,
    snoozeJourney,
    skipDelayStep,
    approveFormStep,
    updateOperatorControls,
  } = useCandidateOutreachJourney({
    projectId: outreachProjectId,
    candidateId: enrolledCandidateId,
    enabled: Boolean(outreachProjectId && enrolledCandidateId),
  });

  const { stopOutreachForCandidates } = useStopOutreach();

  const { isStarting: isRetryingRun, startSequencerOnCandidateIds } =
    useStartOutreachSequencerOnCandidates();
  const { openAskAiPageWithPreprompt } = useOpenAskAiPageWithPreprompt();

  const {
    decisions: openDecisions,
    resolvingId: resolvingDecisionId,
    resolve: resolveDecision,
  } = useOutreachDecisions({
    candidateId: enrolledCandidateId,
    enabled: isUUID(enrolledCandidateId ?? ''),
  });
  const openDecision = preferredOpenDecision(openDecisions);
  const [wasDecisionJustResolved, setWasDecisionJustResolved] = useState(false);

  const record = useCandidateDrawerRecord(candidateData);

  const primaryRun = outreachJourney?.activeRuns[0] ?? null;
  const pendingFormDraft =
    primaryRun?.currentStepKind === 'FORM' &&
    primaryRun.pendingFormStepId !== null
      ? {
          title: primaryRun.currentStepName ?? 'Draft waiting for approval',
          body: primaryRun.draftPreview ?? '',
        }
      : null;
  const hasOpenDecision = openDecision !== null || pendingFormDraft !== null;

  const statusLine = buildCandidateDrawerStatusLine({
    journey: outreachJourney,
    hasOpenDecision,
  });

  const policy =
    outreachJourney !== null && isNonEmptyString(outreachContext.projectId)
      ? {
          isDraftApprovalOn: outreachContext.outreachSendMode === 'APPROVAL',
          settingsPath: `/${AppPath.OutreachHome}?${OUTREACH_PROJECT_ID_QUERY_PARAM}=${outreachContext.projectId}&tab=setup`,
        }
      : null;

  const handleStopOutreach = () => {
    if (enrolledCandidateId !== null) {
      void stopOutreachForCandidates([enrolledCandidateId], outreachProjectId);
    }
  };

  const handleApproveNeedsYou = async (editedBody: string | null) => {
    if (openDecision !== null) {
      const didResolve = await resolveDecision({
        decisionId: openDecision.id,
        resolution: editedBody !== null ? 'EDITED' : 'APPROVED',
        ...(editedBody !== null ? { editedBody } : {}),
      });

      if (didResolve) {
        setWasDecisionJustResolved(true);
        void refetchOutreachJourney();
      }

      return;
    }

    if (primaryRun?.pendingFormStepId) {
      await approveFormStep({
        workflowRunId: primaryRun.workflowRunId,
        stepId: primaryRun.pendingFormStepId,
        editedBody: editedBody ?? primaryRun.draftPreview ?? '',
      });
      setWasDecisionJustResolved(true);
    }
  };

  const handleRejectNeedsYou = async () => {
    if (openDecision !== null) {
      const didResolve = await resolveDecision({
        decisionId: openDecision.id,
        resolution: 'REJECTED',
      });

      if (didResolve) {
        setWasDecisionJustResolved(true);
        void refetchOutreachJourney();
      }

      return;
    }

    if (primaryRun?.pendingFormStepId) {
      await approveFormStep({
        workflowRunId: primaryRun.workflowRunId,
        stepId: primaryRun.pendingFormStepId,
        editedBody: primaryRun.draftPreview ?? '',
        approve: false,
      });
      setWasDecisionJustResolved(true);
    }
  };

  const handleRetryRun = async () => {
    if (enrolledCandidateId === null) {
      return;
    }

    await startSequencerOnCandidateIds([enrolledCandidateId]);
    await refetchOutreachJourney();
  };

  // Message input tabs
  const [activeMessageTab, setActiveMessageTab] = useState<
    'direct' | 'template'
  >('direct');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Scroll to bottom when messages change or when loading completes
  useEffect(() => {
    if (!isChatLoading && activeTabId === 'conversation') {
      scrollToBottom();
    }
  }, [messageHistory, isChatLoading, activeTabId, scrollToBottom]);

  // Also scroll to bottom when switching to chat tab
  useEffect(() => {
    if (activeTabId === 'conversation' && !isChatLoading) {
      scrollToBottom();
    }
  }, [activeTabId, isChatLoading, scrollToBottom]);

  const showSnackbar = useCallback(
    (message: string, type: 'success' | 'error') => {
      if (type === 'success') {
        enqueueSuccessSnackBar({ message, options: { duration: 5000 } });
        return;
      }
      enqueueErrorSnackBar({ message, options: { duration: 5000 } });
    },
    [enqueueSuccessSnackBar, enqueueErrorSnackBar],
  );

  const getTemplatePreview = useCallback(
    (templateName: string): string => {
      if (!templateName) return 'Select a template to see preview';
      return templatePreviews[templateName] || 'Template preview not available';
    },
    [templatePreviews],
  );

  const fetchMessages = React.useCallback(
    async (options?: { background?: boolean }) => {
      const isBackgroundRefresh = options?.background === true;

      if (
        !selectedCandidateId ||
        !tokenPair?.accessOrWorkspaceAgnosticToken?.token
      ) {
        console.log('Missing selectedCandidateId or token, skipping fetch');
        if (!isBackgroundRefresh) {
          setIsChatLoading(false);
        }
        return;
      }

      const { candidateId, personId: lookupPersonId } = chatLookupIds;
      if (
        (!candidateId || !isUUID(candidateId)) &&
        (!lookupPersonId || !isUUID(lookupPersonId))
      ) {
        console.log(
          `Skipping fetch messages for candidate ${selectedCandidateId} - no valid UUID found (candidateId: ${candidateId}, personId: ${lookupPersonId})`,
        );
        if (!isBackgroundRefresh) {
          setIsChatLoading(false);
        }
        return;
      }

      if (!isBackgroundRefresh) {
        setIsChatLoading(true);
      }

      try {
        const response = await axios.post(
          `${REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
          { candidateId, personId: lookupPersonId },
          {
            headers: {
              Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
            },
          },
        );

        // Oldest first so chat renders chronologically (top → bottom)
        const sortedMessages = response.data.sort(
          (a: any, b: any) => a.position - b.position,
        );

        // Check if messages have actually changed by comparing with current state
        setMessageHistory((prevMessageHistory) => {
          const hasMessagesChanged =
            JSON.stringify(sortedMessages) !==
            JSON.stringify(prevMessageHistory);

          if (hasMessagesChanged) {
            const messageWithCandidateName = sortedMessages.find(
              (message: MessageNode) =>
                typeof message.candidateName === 'string' &&
                message.candidateName.length > 0,
            );
            if (messageWithCandidateName?.candidateName) {
              setCandidateName(messageWithCandidateName.candidateName);
            }
            return sortedMessages;
          } else {
            return prevMessageHistory;
          }
        });
      } catch (error) {
        console.error('Error fetching chat messages:', error);
        if (!isBackgroundRefresh) {
          setChatError('Failed to load chat messages');
          setMessageHistory([]);
        }
      } finally {
        if (!isBackgroundRefresh) {
          setIsChatLoading(false);
        }
      }
    },
    [
      chatLookupIds,
      selectedCandidateId,
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    ],
  );

  // Debounced version of fetchMessages to prevent excessive API calls
  const debouncedFetchMessages = useCallback(() => {
    if (fetchMessagesTimeoutRef.current) {
      clearTimeout(fetchMessagesTimeoutRef.current);
    }
    fetchMessagesTimeoutRef.current = setTimeout(() => {
      void fetchMessages({ background: true });
    }, 1000); // Debounce by 1 second
  }, [fetchMessages]);

  const applyTableRowAsCandidateData = useCallback(
    (row?: Record<string, unknown>) => {
      if (!row) {
        return;
      }

      setCandidateData(row as never);
      if (typeof row.name === 'string' && row.name) {
        setCandidateName(row.name);
      }
      const phoneFromObject =
        row.phoneNumber &&
        typeof row.phoneNumber === 'object' &&
        typeof (row.phoneNumber as { primaryPhoneNumber?: unknown })
          .primaryPhoneNumber === 'string'
          ? (row.phoneNumber as { primaryPhoneNumber: string })
              .primaryPhoneNumber
          : '';
      const phone =
        typeof row.phone === 'string' && row.phone
          ? row.phone
          : phoneFromObject;
      if (phone) {
        setPhoneNumber(phone);
      }
    },
    [setCandidateData],
  );

  const fetchCandidateData = React.useCallback(
    async (options?: { background?: boolean }) => {
      const isBackgroundRefresh = options?.background === true;

      if (
        !selectedCandidateId ||
        !tokenPair?.accessOrWorkspaceAgnosticToken?.token
      ) {
        return;
      }

      const candidateIdToFetch = chatLookupIds.candidateId;
      const shouldFetchCandidate =
        !!candidateIdToFetch && isUUID(candidateIdToFetch);

      if (!shouldFetchCandidate) {
        applyTableRowAsCandidateData(selectedTableRow);
        if (!isBackgroundRefresh) {
          setIsCandidateDataLoading(false);
        }
        return;
      }

      if (!isBackgroundRefresh) {
        setIsCandidateDataLoading(true);
      }

      try {
        const response = await fetch(`${REACT_APP_SERVER_BASE_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
          body: JSON.stringify({
            query: graphqlToFetchAllCandidateDataWithFieldValues,
            variables: {
              filter: {
                id: { eq: candidateIdToFetch },
              },
            },
          }),
        });

        const responseData = await response.json();
        if (responseData?.data?.candidates?.edges?.[0]?.node) {
          const candidate = responseData.data.candidates.edges[0].node;
          setCandidateData((prev: any) => {
            if (prev?.id === candidate.id) {
              if (
                prev.name === candidate.name &&
                prev.status === candidate.status &&
                prev.candConversationStatus ===
                  candidate.candConversationStatus &&
                prev.updatedAt === candidate.updatedAt
              ) {
                return prev;
              }
            }
            return candidate;
          });
          if (candidate.name) {
            setCandidateName(candidate.name);
          }
          if (candidate?.people?.phones?.primaryPhoneNumber) {
            setPhoneNumber(candidate.people.phones.primaryPhoneNumber);
          }
        } else {
          applyTableRowAsCandidateData(selectedTableRow);
        }
      } catch (error) {
        console.error('Error fetching candidate data:', error);
        applyTableRowAsCandidateData(selectedTableRow);
      } finally {
        if (!isBackgroundRefresh) {
          setIsCandidateDataLoading(false);
        }
      }
    },
    [
      applyTableRowAsCandidateData,
      chatLookupIds.candidateId,
      chatLookupIds.personId,
      selectedCandidateId,
      selectedTableRow,
      setCandidateData,
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    ],
  );

  // Start polling when component mounts and selectedCandidateId is available
  useEffect(() => {
    if (!selectedCandidateId) return;

    setIsChatLoading(true);
    setIsCandidateDataLoading(true);
    setChatError(null);

    // Initial fetch
    void fetchMessages();
    void fetchCandidateData();

    // Set up polling interval with longer interval to reduce load
    pollingIntervalRef.current = setInterval(() => {
      debouncedFetchMessages();
      void fetchCandidateData({ background: true });
    }, 30000); // Poll every 30 seconds instead of 10

    // Cleanup interval on unmount or when selectedCandidateId changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (fetchMessagesTimeoutRef.current) {
        clearTimeout(fetchMessagesTimeoutRef.current);
        fetchMessagesTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCandidateId, chatLookupIds.candidateId, chatLookupIds.personId]); // Only depend on selectedCandidateId - callbacks are stable via useCallback

  // Older sessions stored the previous six tab ids; fold them into the
  // Conversation / Context / Activity tabs.
  useEffect(() => {
    const legacyTabMap: Record<string, string> = {
      journey: 'conversation',
      chat: 'conversation',
      conversation: 'conversation',
      profile: 'context',
      'warm-path': 'context',
      cv: 'context',
      context: 'context',
      'workflow-runs': 'activity',
      activity: 'activity',
    };

    if (isNonEmptyString(activeTabId) && activeTabId in legacyTabMap) {
      if (legacyTabMap[activeTabId] !== activeTabId) {
        setActiveTabId(legacyTabMap[activeTabId]);
      }

      return;
    }

    const storedTab = localStorage.getItem('candidate-chat-default-tab');
    localStorage.removeItem('candidate-chat-default-tab');
    setActiveTabId(legacyTabMap[storedTab ?? ''] ?? 'conversation');
  }, [activeTabId, setActiveTabId]);

  // Reset the "decision recorded" note when switching person
  useEffect(() => {
    setWasDecisionJustResolved(false);
  }, [selectedCandidateId]);

  // Add effect to mark messages as read when drawer opens
  useEffect(() => {
    if (
      selectedCandidateId &&
      tokenPair?.accessOrWorkspaceAgnosticToken?.token &&
      messageHistory.length > 0
    ) {
      // Get permanent ID (UUID) - ensure we only use UUIDs, not LinkedIn IDs or tempIds
      const permanentId =
        chatLookupIds.candidateId && isUUID(chatLookupIds.candidateId)
          ? chatLookupIds.candidateId
          : chatLookupIds.personId && isUUID(chatLookupIds.personId)
            ? chatLookupIds.personId
            : null;
      if (!permanentId) {
        console.log(
          `Skipping mark as read for candidate ${selectedCandidateId} - no valid UUID found`,
        );
        return;
      }

      // Only mark as read once per candidate - reset when selectedCandidateId changes
      if (hasMarkedAsReadRef.current === selectedCandidateId) {
        return;
      }

      // Get unread messages from the message history
      const unreadMessageIds =
        messageHistory
          ?.filter(
            (msg) => msg.whatsappDeliveryStatus === 'receivedFromCandidate',
          )
          ?.map((msg) => msg.id) || [];

      if (unreadMessageIds.length > 0) {
        // Update messages in the database
        axios
          .post(
            `${REACT_APP_SERVER_BASE_URL}/arx-chat/update-whatsapp-delivery-status`,
            { listOfMessagesIds: unreadMessageIds },
            {
              headers: {
                Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
              },
            },
          )
          .then(() => {
            // Update local message history to mark messages as read
            setMessageHistory((prev) =>
              prev.map((msg) =>
                unreadMessageIds.includes(msg.id)
                  ? { ...msg, whatsappDeliveryStatus: 'read' }
                  : msg,
              ),
            );

            // Immediately update unread messages count in state to 0 for this candidate
            // Update for both permanentId (UUID) and selectedCandidateId (in case it's different, e.g., LinkedIn ID)
            setUnreadMessagesCounts((prev) => {
              const updated = { ...prev };
              updated[permanentId] = 0;
              // Also update selectedCandidateId if it's different from permanentId (for search result candidates)
              if (selectedCandidateId !== permanentId) {
                updated[selectedCandidateId] = 0;
              }
              return updated;
            });

            // Mark that we've processed this candidate
            hasMarkedAsReadRef.current = selectedCandidateId;
          })
          .catch((error) => {
            console.error('Error updating message status:', error);
          });
      } else {
        // No unread messages, but still mark as processed and update count to 0
        setUnreadMessagesCounts((prev) => {
          const updated = { ...prev };
          updated[permanentId] = 0;
          if (selectedCandidateId !== permanentId) {
            updated[selectedCandidateId] = 0;
          }
          return updated;
        });
        hasMarkedAsReadRef.current = selectedCandidateId;
      }
    }

    // Reset the ref when selectedCandidateId changes
    if (hasMarkedAsReadRef.current !== selectedCandidateId) {
      hasMarkedAsReadRef.current = null;
    }
  }, [
    selectedCandidateId,
    tokenPair,
    messageHistory,
    chatLookupIds.candidateId,
    chatLookupIds.personId,
    setUnreadMessagesCounts,
  ]);

  const sendMessage = async (messageText: string) => {
    if (!phoneNumber) {
      showSnackbar('Phone number not available', 'error');
      return;
    }

    setIsSendingMessage(true);

    try {
      const response = await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/arx-chat/send-chat`,
        {
          messageToSend: messageText,
          phoneNumberTo: phoneNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
        },
      );

      if (response.data.status === 'failed') {
        const detail =
          typeof response.data.message === 'string'
            ? response.data.message
            : 'Unknown error';
        showSnackbar(`Failed to send message: ${detail}`, 'error');
        await fetchMessages();
        return;
      }

      const newMessage: MessageNode = {
        recruiterId: '',
        message: messageText,
        candidateId: selectedCandidateId || '',
        projectId: '',
        position: messageHistory.length + 1,
        messageType: 'direct',
        phoneTo: phoneNumber || '',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        id: Date.now().toString(),
        name: 'botMessage',
        phoneFrom: 'system',
        messageObj: { content: messageText },
        whatsappDeliveryStatus: 'sent',
      };

      setMessageHistory((prev) => [...prev, newMessage]);

      // Clear input
      if (inputRef.current) {
        inputRef.current.value = '';
      }

      showSnackbar('Message sent successfully', 'success');
    } catch (error) {
      console.error('Error sending message:', error);
      const ax = axios.isAxiosError(error) ? error : null;
      const body = ax?.response?.data as
        | { message?: string; status?: string }
        | undefined;
      const serverMsg =
        typeof body?.message === 'string' ? body.message : undefined;
      showSnackbar(
        serverMsg ||
          (error instanceof Error ? error.message : 'Failed to send message'),
        'error',
      );
      await fetchMessages();
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleTemplateSend = async (templateName: string) => {
    if (!templateName) {
      showSnackbar('Please select a template first', 'error');
      return;
    }

    if (!phoneNumber) {
      showSnackbar('Phone number not available', 'error');
      return;
    }

    setIsSendingMessage(true);

    try {
      await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/meta-whatsapp-controller/send-template-message`,
        {
          templateName: templateName,
          phoneNumberTo: phoneNumber.replace('+', ''),
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
        },
      );
      console.log('Template sent successfully');
      showSnackbar('Template sent successfully', 'success');
      setSelectedTemplate('');

      const newMessage: MessageNode = {
        recruiterId: '',
        message: `Template: ${templateName}\n${getTemplatePreview(templateName)}`,
        candidateId: selectedCandidateId || '',
        projectId: '',
        position: messageHistory.length + 1,
        messageType: 'template',
        phoneTo: phoneNumber || '',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        id: Date.now().toString(),
        name: 'botMessage',
        phoneFrom: 'system',
        messageObj: { content: templateName },
        whatsappDeliveryStatus: 'sent',
      };
      setMessageHistory((prev) => [...prev, newMessage]);
    } catch (error) {
      showSnackbar('Failed to send template', 'error');
      console.error('Error sending template:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSubmit = () => {
    const messageText = inputRef.current?.value.trim();
    if (!messageText) return;

    sendMessage(messageText);
  };

  const conversationStatusLabel = candidateData?.candConversationStatus
    ? CANDIDATE_CONVERSATION_STATUS_LABELS[
        candidateData.candConversationStatus
      ] || candidateData.candConversationStatus
    : null;

  const hasLatestDoNotRespond = useMemo(() => {
    if (!messageHistory.length) return false;
    const sorted = [...messageHistory].sort(
      (a, b) => (b.position ?? 0) - (a.position ?? 0),
    );
    const latestBot = sorted.find((m) => m.name === 'botMessage');
    return latestBot ? isDoNotRespondMessage(latestBot.message) : false;
  }, [messageHistory]);

  const senderDisplayName =
    [
      currentWorkspaceMember?.name?.firstName,
      currentWorkspaceMember?.name?.lastName,
    ]
      .filter(Boolean)
      .join(' ') || 'You';

  const renderCv = () => (
    <Suspense
      fallback={<StyledTabPlaceholder>Loading CV…</StyledTabPlaceholder>}
    >
      <AttachmentPanel
        isOpen={true}
        onClose={() => setActiveTabId('context')}
        candidateId={selectedCandidateId || ''}
        candidateName={candidateName}
        PanelContainer={StyledInlineAttachmentContainer}
      />
    </Suspense>
  );

  const handleDraftWithAgent = () => {
    openAskAiPageWithPreprompt({
      text: `Draft a reply to ${candidateName}${record.fields?.companyName ? ` at ${record.fields.companyName}` : ''}, based on our conversation so far.`,
    });
  };

  const renderMessageInput = () => (
    <StyledMessageInputContainer>
      {hasLatestDoNotRespond && (
        <StyledChatNotice tone="warning">
          <IconAlertTriangle size={16} />
          Last response: AI chose not to respond to this message.
        </StyledChatNotice>
      )}
      <StyledMessageInputTabContainer>
        <LightButton
          title="Direct message"
          active={activeMessageTab === 'direct'}
          onClick={() => setActiveMessageTab('direct')}
        />
        <LightButton
          title="Template"
          active={activeMessageTab === 'template'}
          onClick={() => setActiveMessageTab('template')}
        />
        <StyledComposerSpacer />
        <LightButton
          Icon={IconSparkles}
          title="Draft with agent"
          onClick={handleDraftWithAgent}
        />
      </StyledMessageInputTabContainer>

      {activeMessageTab === 'direct' ? (
        <StyledInputWrapper>
          <StyledChatInput
            ref={inputRef}
            type="text"
            placeholder={
              isSendingMessage ? 'Sending message…' : 'Write a message'
            }
            disabled={isSendingMessage}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSendingMessage) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            Icon={IconSend}
            title={isSendingMessage ? 'Sending…' : 'Send'}
            variant="primary"
            accent="blue"
            size="small"
            onClick={handleSubmit}
            disabled={isSendingMessage}
          />
        </StyledInputWrapper>
      ) : (
        <StyledTemplateContainer>
          <Select<string>
            dropdownId="candidate-chat-template-select"
            value={selectedTemplate}
            emptyOption={{ label: 'Select a template', value: '' }}
            options={templates.map((template) => ({
              label: template,
              value: template,
            }))}
            onChange={setSelectedTemplate}
            disabled={isSendingMessage}
            selectSizeVariant="small"
            fullWidth
            withSearchInput
            needIconCheck={false}
          />
          <StyledTemplatePreview>
            {isLoadingTemplates
              ? 'Loading templates…'
              : getTemplatePreview(selectedTemplate)}
          </StyledTemplatePreview>
          <StyledTemplateActions>
            <Button
              Icon={IconSend}
              title={isSendingMessage ? 'Sending…' : 'Send template'}
              variant="primary"
              accent="blue"
              size="small"
              onClick={() => handleTemplateSend(selectedTemplate)}
              disabled={!selectedTemplate || isSendingMessage}
            />
          </StyledTemplateActions>
        </StyledTemplateContainer>
      )}
    </StyledMessageInputContainer>
  );

  return (
    <StyledContainer>
      <StyledScrollArea ref={chatContainerRef}>
        <StyledHeaderSlot>
          <CandidateDrawerHeader
            record={record}
            journey={outreachJourney}
            stageLabel={resolveCandidateDrawerStageLabel(outreachJourney)}
            statusLine={statusLine}
            isJourneyActionLoading={isOutreachActionLoading}
            canSendNextStepNow={
              primaryRun?.currentStepKind === 'DELAY' &&
              isNonEmptyString(primaryRun.pendingStepId)
            }
            policy={policy}
            onPauseJourney={() => void pauseJourney()}
            onResumeJourney={() => void resumeJourney()}
            onFollowUpOn={(resumeAt) => void snoozeJourney(resumeAt)}
            onSendNextStepNow={() => {
              if (primaryRun?.pendingStepId) {
                void skipDelayStep(
                  primaryRun.workflowRunId,
                  primaryRun.pendingStepId,
                );
              }
            }}
            onUpdateConversationStage={(outreachConversationStage) =>
              void updateOperatorControls({ outreachConversationStage })
            }
            onStopOutreach={handleStopOutreach}
          />
        </StyledHeaderSlot>
        {enrolledCandidateId !== null && (
          <CandidateDrawerNeedsYouCard
            key={openDecision?.id ?? primaryRun?.pendingFormStepId ?? 'none'}
            decision={openDecision}
            moreDecisionCount={Math.max(0, openDecisions.length - 1)}
            pendingDraft={openDecision === null ? pendingFormDraft : null}
            isBusy={
              isOutreachActionLoading ||
              (openDecision !== null && resolvingDecisionId === openDecision.id)
            }
            wasJustResolved={wasDecisionJustResolved}
            onApprove={(editedBody) => void handleApproveNeedsYou(editedBody)}
            onReject={() => void handleRejectNeedsYou()}
            onStopOutreach={handleStopOutreach}
          />
        )}
        <StyledTabContainer>
          <TabList
            componentInstanceId={tabListId}
            tabs={tabs}
            behaveAsLinks={false}
            isInSidePanel={true}
          />
        </StyledTabContainer>
        <StyledTabContent>
          {!selectedCandidateId ? (
            <StyledTabPlaceholder>No candidate selected</StyledTabPlaceholder>
          ) : (
            <>
              {activeTabId === 'conversation' && (
                <CandidateDrawerConversationTab
                  messages={messageHistory}
                  journey={outreachJourney}
                  nextStep={resolveCandidateDrawerNextStep(outreachJourney)}
                  hasOpenDecision={hasOpenDecision}
                  candidateName={candidateName}
                  senderName={senderDisplayName}
                  recruitingStatusLabel={conversationStatusLabel ?? null}
                  isLoading={isChatLoading}
                  error={chatError}
                />
              )}
              {activeTabId === 'context' && (
                <CandidateDrawerContextTab
                  record={record}
                  selectedTableRow={selectedTableRow}
                  isCandidateDataLoading={isCandidateDataLoading}
                  renderCv={renderCv}
                />
              )}
              {activeTabId === 'activity' && (
                <CandidateDrawerActivityTab
                  journey={outreachJourney}
                  isLoading={isOutreachJourneyLoading}
                  isRetrying={isRetryingRun}
                  onRetry={() => void handleRetryRun()}
                />
              )}
            </>
          )}
        </StyledTabContent>
      </StyledScrollArea>
      {selectedCandidateId &&
        activeTabId === 'conversation' &&
        renderMessageInput()}
    </StyledContainer>
  );
});
