import { currentProjectIdState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { CandidateOutreachJourneyTab, resolveJourneyHeaderLabels } from '@/candidate-table/CandidateOutreachJourneyTab';
import { useCandidateOutreachJourney } from '@/outreach-home/hooks/useCandidateOutreachJourney';
import { useStopOutreach } from '@/outreach-home/hooks/useStopOutreach';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { findSelectedTableRow, isUUID, resolveChatLookupIds } from '@/candidate-table/HotHooks';
import { candidateDataState, processedDataSelector, selectedCandidateIdState, tableStateAtom, unreadMessagesCountsState } from '@/candidate-table/states/states';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { styled } from '@linaria/react';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessages, MessageNode } from 'twenty-shared/arx';
import { graphqlToFetchAllCandidateDataWithFieldValues } from 'twenty-shared/graphql';
import { IconArrowsSplit2, IconFileText, IconMessage, IconTimelineEvent, IconUser } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CANDIDATE_CONVERSATION_STATUS_LABELS } from '@/candidate-table/constants/candidate-status-labels';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { CandidateInfoHeader } from './CandidateInfoHeader';
import { CandidateProfileTab } from './CandidateProfileTab';
import { CandidateWarmPathTab } from './CandidateWarmPathTab';
import { useTemplates } from './hooks/useTemplates';

const AttachmentPanel = lazy(() => import('./AttachmentPanel'));

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

const TabContainer = styled.div`
  padding: 0 ${themeCssVariables.spacing[2]};
`;

const TabContent = styled.div`
  display: flex;
  flex: 1; /* Adjusted to make room for message input */
  flex-direction: column;
  height: calc(100% - 120px);
  overflow-y: auto;
`;

// Module scope: defining styled() inside render remounts AttachmentPanel children
// every drawer re-render and leaves the PDF viewer blank.
const StyledInlineAttachmentContainer = styled.div<{ isOpen: boolean }>`
  background-color: ${themeCssVariables.background.secondary};
  height: 100%;
  overflow-y: auto;
  position: relative;
  width: 100%;
`;

const ChatView = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column-reverse;
  height: 100%; /* Add extra padding at bottom to prevent overlap with input */
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 40px;
`;

const DateSeparator = styled.div`
  color: ${props => themeCssVariables.font.color.secondary};
  font-size: ${props => themeCssVariables.font.size.sm};
  margin: 16px 0;
  text-align: center;
`;

const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const MessageBubble = styled.div<{ isSent: boolean; deliveryFailed?: boolean }>`
  background-color: ${props => {
    if (props.deliveryFailed && props.isSent) {
      return '#1e40af';
    }
    return props.isSent
      ? themeCssVariables.color.blue
      : themeCssVariables.background.tertiary;
  }};
  border: ${props =>
    props.deliveryFailed ? `2px solid ${themeCssVariables.color.red}` : 'none'};
  border-bottom-left-radius: ${props => (props.isSent ? '16px' : '4px')};
  border-bottom-right-radius: ${props => (props.isSent ? '4px' : '16px')};
  border-radius: 16px;
  box-sizing: border-box;
  color: ${props =>
    props.isSent ? 'white' : themeCssVariables.font.color.primary};
  font-size: 14px;
  line-height: 1.5;
  margin: ${props => props.isSent ? '8px 8px 8px auto' : '8px'};
  max-width: 70%;
  padding: 12px 16px;
  position: relative;

  white-space: pre-wrap;
  word-break: break-word;
`;

const MessageStatus = styled.div<{ isSent: boolean }>`
  align-items: center;
  color: ${props => themeCssVariables.font.color.light};
  display: flex;
  font-size: 11px;
  gap: 4px;
  justify-content: ${props => props.isSent ? 'flex-end' : 'flex-start'};
  margin-top: 4px;
  text-align: ${props => props.isSent ? 'right' : 'left'};
`;

const StatusIcon = styled.span<{ status: string }>`
  align-items: center;
  display: inline-flex;
  height: 16px;
  justify-content: center;
  width: 16px;

  &::before {
    background-color: ${props => {
      switch (props.status) {
        case 'sent':
          return '#9CA3AF';
        case 'delivered':
          return '#10B981';
        case 'read':
          return '#3B82F6';
        case 'failed':
          return '#EF4444';
        default:
          return '#9CA3AF';
      }
    }};
    border-radius: 50%;
    content: '';
    height: 8px;
    width: 8px;
  }
`;

const MessageTime = styled.div<{ isSent: boolean }>`
  color: ${props => themeCssVariables.font.color.light};
  font-size: 11px;
  margin-top: 4px;
  text-align: ${props => props.isSent ? 'right' : 'left'};
`;

const MessageGroup = styled.div`
  margin: 8px 0;
`;

const DateLabel = styled.span`
  background-color: ${props => themeCssVariables.background.primary};
  color: ${props => themeCssVariables.font.color.light};
  font-size: 12px;
  padding: 0 12px;
  position: relative;
  z-index: 1;
`;

// Message input styles
const MessageInputContainer = styled.div`
  background-color: ${props => themeCssVariables.background.primary};
  border-top: 1px solid ${props => themeCssVariables.border.color.light};
  bottom: 0;
  box-sizing: border-box;
  padding: ${props => themeCssVariables.spacing[2]};
  position: sticky;
  width: 100%;
  z-index: 1;
`;

const MessageInputTabContainer = styled.div`
  border-bottom: 1px solid ${props => themeCssVariables.border.color.light};
  box-sizing: border-box;
  display: flex;
  margin-bottom: ${props => themeCssVariables.spacing[2]};
  width: 100%;
`;

const MessageInputTab = styled.div<{ isActive: boolean }>`
  border-bottom: 2px solid ${props => props.isActive ? themeCssVariables.font.color.primary : 'transparent'};
  color: ${props => props.isActive ? themeCssVariables.font.color.primary : themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-weight: ${props => props.isActive ? 'bold' : 'normal'};
  padding: ${props => themeCssVariables.spacing[1]} ${props => themeCssVariables.spacing[2]};
`;

const InputWrapper = styled.div`
  align-items: center;
  box-sizing: border-box;
  display: flex;
  gap: ${props => themeCssVariables.spacing[2]};
  width: 100%;
`;

const StyledChatInput = styled.input`
  background-color: ${props => props.disabled ? themeCssVariables.background.secondary : themeCssVariables.background.primary};
  border: 1px solid ${props => themeCssVariables.border.color.medium};
  border-radius: ${props => themeCssVariables.border.radius.md};
  box-sizing: border-box;
  color: ${props => props.disabled ? themeCssVariables.font.color.tertiary : themeCssVariables.font.color.primary};
  cursor: ${props => props.disabled ? 'not-allowed' : 'text'};
  flex: 1;
  font-size: ${props => themeCssVariables.font.size.md}; /* Prevents input from overflowing */
  min-width: 0;
  outline: none;
  padding: ${props => themeCssVariables.spacing[2]};

  &:focus:not(:disabled) {
    border-color: ${props => themeCssVariables.font.color.primary};
  }
`;

const StyledButton = styled.button`
  background-color: ${props => props.disabled ? themeCssVariables.color.gray : themeCssVariables.color.blue8};
  border: none;
  border-radius: ${props => themeCssVariables.border.radius.md};
  color: ${props => props.disabled ? themeCssVariables.font.color.tertiary : 'white'};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-weight: 500;
  opacity: ${props => props.disabled ? 0.6 : 1};
  padding: ${props => themeCssVariables.spacing[2]} ${props => themeCssVariables.spacing[3]};
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background-color: ${props => themeCssVariables.color.gray};
    color: black;
  }
`;

const TemplateContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${props => themeCssVariables.spacing[2]};
  width: 100%;
`;

const TemplateSelect = styled.select`
  background-color: ${props => props.disabled ? themeCssVariables.background.secondary : themeCssVariables.background.primary};
  border: 1px solid ${props => themeCssVariables.border.color.medium};
  border-radius: ${props => themeCssVariables.border.radius.md};
  box-sizing: border-box;
  color: ${props => props.disabled ? themeCssVariables.font.color.tertiary : themeCssVariables.font.color.primary};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-size: ${props => themeCssVariables.font.size.md};
  outline: none;
  padding: ${props => themeCssVariables.spacing[2]};
  width: 100%;

  &:focus:not(:disabled) {
    border-color: ${props => themeCssVariables.font.color.primary};
  }
`;

const TemplatePreview = styled.div`
  background-color: ${props => themeCssVariables.background.secondary};
  border: 1px solid ${props => themeCssVariables.border.color.light};
  border-radius: ${props => themeCssVariables.border.radius.md};
  box-sizing: border-box;
  color: ${props => themeCssVariables.font.color.secondary};
  font-size: ${props => themeCssVariables.font.size.sm};
  min-height: 80px;
  padding: ${props => themeCssVariables.spacing[2]};
  width: 100%;
`;

const ChatStatusBar = styled.div`
  background-color: ${props => themeCssVariables.background.secondary};
  border-left: 3px solid ${props => themeCssVariables.color.blue8};
  border-radius: ${props => themeCssVariables.border.radius.sm};
  color: ${props => themeCssVariables.font.color.secondary};
  font-size: ${props => themeCssVariables.font.size.sm};
  margin-bottom: ${props => themeCssVariables.spacing[1]};
  padding: ${props => themeCssVariables.spacing[1]} ${props => themeCssVariables.spacing[2]};
`;

const DoNotRespondBanner = styled.div`
  align-items: center;
  background-color: ${props => themeCssVariables.background.tertiary};
  border-left: 3px solid ${props => themeCssVariables.color.orange};
  border-radius: ${props => themeCssVariables.border.radius.sm};
  color: ${props => themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${props => themeCssVariables.font.size.sm};
  gap: ${props => themeCssVariables.spacing[1]};
  margin-bottom: ${props => themeCssVariables.spacing[1]};
  padding: ${props => themeCssVariables.spacing[1]} ${props => themeCssVariables.spacing[2]};
`;

const DoNotRespondBubble = styled.div`
  background-color: ${props => themeCssVariables.background.tertiary};
  border: 1px dashed ${props => themeCssVariables.border.color.medium};
  border-bottom-right-radius: 4px;
  border-radius: 16px;
  color: ${props => themeCssVariables.font.color.tertiary};
  font-size: 13px;
  font-style: italic;
  margin: 8px 8px 8px auto;
  max-width: 70%;
  padding: 10px 14px;
`;

function isDoNotRespondMessage(content: string | undefined): boolean {
  if (!content || typeof content !== 'string') return false;
  return content.includes('#DONTRESPOND#') || content.includes('DONTRESPOND');
}

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

const groupMessagesByDate = (messages: MessageNode[]) => {
  const groups: { [key: string]: MessageNode[] } = {};

  messages.forEach(message => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });

  return groups;
};

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
  const prevConversationStatusRef = useRef<string | null>(null);

  // Use the templates hook
  const { templates, templatePreviews, isLoading: isLoadingTemplates } = useTemplates();

  // Tab handling for main tabs
  const tabListId = 'candidate-chat-drawer-tabs';
  const [activeTabId, setActiveTabId] = useAtomComponentState(
    activeTabIdComponentState,
    tabListId,
  );

  // Memoize tabs array to prevent recreation on every render
  const tabs = useMemo(() => [
    {
      id: 'journey',
      title: 'Journey',
      Icon: IconTimelineEvent,
    },
    {
      id: 'chat',
      title: 'Chat',
      Icon: IconMessage,
    },
    {
      id: 'profile',
      title: 'Profile',
      Icon: IconUser,
    },
    {
      id: 'warm-path',
      title: 'Warm path',
      Icon: IconArrowsSplit2,
    },
    {
      id: 'cv',
      title: 'CV',
      Icon: IconFileText,
    },
  ], []);

  const selectedTableRow = useMemo(() => {
    return findSelectedTableRow(selectedCandidateId, [
      ...searchResults,
      ...processedData,
      ...((tableState.rawData || []) as Record<string, unknown>[]),
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
      (typeof candidateData?.projectsId === 'string'
        ? candidateData.projectsId
        : null)
    );
  }, [
    candidateData?.projectsId,
    currentProjectId,
    outreachContext.projectId,
  ]);

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
    pauseJourney,
    resumeJourney,
    snoozeJourney,
    skipDelayStep,
    approveFormStep,
  } = useCandidateOutreachJourney({
    projectId: outreachProjectId,
    candidateId: enrolledCandidateId,
    enabled: Boolean(outreachProjectId && enrolledCandidateId),
  });

  const { stopOutreachForCandidates } = useStopOutreach();

  const outreachHeaderLabels = useMemo(
    () => resolveJourneyHeaderLabels(outreachJourney),
    [outreachJourney],
  );

  // Get personId from the selected table row first (GTM people rows), then candidateData
  const personId = useMemo(() => {
    return chatLookupIds.personId || candidateData?.peopleId || candidateData?.personId || null;
  }, [candidateData?.peopleId, candidateData?.personId, chatLookupIds.personId]);


  // Message input tabs
  const [activeMessageTab, setActiveMessageTab] = useState<'direct' | 'template'>('direct');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = 0;
    }
  }, []);

  // Scroll to bottom when messages change or when loading completes
  useEffect(() => {
    if (!isChatLoading && activeTabId === 'chat') {
      scrollToBottom();
    }
  }, [messageHistory, isChatLoading, activeTabId, scrollToBottom]);

  // Also scroll to bottom when switching to chat tab
  useEffect(() => {
    if (activeTabId === 'chat' && !isChatLoading) {
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

  const getTemplatePreview = useCallback((templateName: string): string => {
    if (!templateName) return 'Select a template to see preview';
    return templatePreviews[templateName] || 'Template preview not available';
  }, [templatePreviews]);

  const fetchMessages = React.useCallback(async (options?: { background?: boolean }) => {
    const isBackgroundRefresh = options?.background === true;

    if (!selectedCandidateId || !tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
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
      console.log(`Skipping fetch messages for candidate ${selectedCandidateId} - no valid UUID found (candidateId: ${candidateId}, personId: ${lookupPersonId})`);
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
        { headers: { Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}` } }
      );

      const sortedMessages = response.data.sort(
        (a: any, b: any) => b.position - a.position
      );

      // Check if messages have actually changed by comparing with current state
      setMessageHistory(prevMessageHistory => {
        const hasMessagesChanged = JSON.stringify(sortedMessages) !== JSON.stringify(prevMessageHistory);

        if (hasMessagesChanged) {
          // Fetch candidate name if available in the messages
          if (sortedMessages.length > 0 && sortedMessages[0].candidateName) {
            setCandidateName(sortedMessages[0].candidateName);
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
  }, [chatLookupIds, selectedCandidateId, tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

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
          ? (row.phoneNumber as { primaryPhoneNumber: string }).primaryPhoneNumber
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

  const fetchCandidateData = React.useCallback(async (options?: { background?: boolean }) => {
    const isBackgroundRefresh = options?.background === true;

    if (!selectedCandidateId || !tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      return;
    }

    const candidateIdToFetch = chatLookupIds.candidateId;
    const shouldFetchCandidate = !!candidateIdToFetch && isUUID(candidateIdToFetch);

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
              id: { eq: candidateIdToFetch }
            }
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
              prev.candConversationStatus === candidate.candConversationStatus &&
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
        if (candidate?.phoneNumber?.primaryPhoneNumber) {
          setPhoneNumber(candidate?.phoneNumber?.primaryPhoneNumber);
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
  }, [
    applyTableRowAsCandidateData,
    chatLookupIds.candidateId,
    chatLookupIds.personId,
    selectedCandidateId,
    selectedTableRow,
    setCandidateData,
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
  ]);

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

  // Set default active tab
  useEffect(() => {
    if (!activeTabId) {
      // Check if we have a default tab in localStorage
      const defaultTab = localStorage.getItem('candidate-chat-default-tab');
      if (defaultTab && (defaultTab === 'chat' || defaultTab === 'profile' || defaultTab === 'warm-path' || defaultTab === 'cv' || defaultTab === 'journey')) {
        setActiveTabId(defaultTab);
        // Clear the stored value after using it
        localStorage.removeItem('candidate-chat-default-tab');
      } else {
        setActiveTabId('chat');
      }
    }
  }, [activeTabId, setActiveTabId]);

  // Add effect to mark messages as read when drawer opens
  useEffect(() => {
    if (selectedCandidateId && tokenPair?.accessOrWorkspaceAgnosticToken?.token && messageHistory.length > 0) {
      // Get permanent ID (UUID) - ensure we only use UUIDs, not LinkedIn IDs or tempIds
      const permanentId =
        chatLookupIds.candidateId && isUUID(chatLookupIds.candidateId)
          ? chatLookupIds.candidateId
          : chatLookupIds.personId && isUUID(chatLookupIds.personId)
            ? chatLookupIds.personId
            : null;
      if (!permanentId) {
        console.log(`Skipping mark as read for candidate ${selectedCandidateId} - no valid UUID found`);
        return;
      }

      // Only mark as read once per candidate - reset when selectedCandidateId changes
      if (hasMarkedAsReadRef.current === selectedCandidateId) {
        return;
      }

      // Get unread messages from the message history
      const unreadMessageIds = messageHistory
        ?.filter(msg => msg.whatsappDeliveryStatus === 'receivedFromCandidate')
        ?.map(msg => msg.id) || [];

      if (unreadMessageIds.length > 0) {
        // Update messages in the database
        axios.post(
          `${REACT_APP_SERVER_BASE_URL}/arx-chat/update-whatsapp-delivery-status`,
          { listOfMessagesIds: unreadMessageIds },
          { headers: { Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}` } },
        ).then(() => {
          // Update local message history to mark messages as read
          setMessageHistory(prev =>
            prev.map(msg =>
              unreadMessageIds.includes(msg.id)
                ? { ...msg, whatsappDeliveryStatus: 'read' }
                : msg
            )
          );

          // Immediately update unread messages count in state to 0 for this candidate
          // Update for both permanentId (UUID) and selectedCandidateId (in case it's different, e.g., LinkedIn ID)
          setUnreadMessagesCounts(prev => {
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
        }).catch(error => {
          console.error('Error updating message status:', error);
        });
      } else {
        // No unread messages, but still mark as processed and update count to 0
        setUnreadMessagesCounts(prev => {
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
  }, [selectedCandidateId, tokenPair, messageHistory, chatLookupIds.candidateId, chatLookupIds.personId, setUnreadMessagesCounts]);

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
          phoneNumberTo: phoneNumber
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`
          }
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
        projectsId: '',
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

      setMessageHistory(prev => [newMessage, ...prev]);

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
        serverMsg || (error instanceof Error ? error.message : 'Failed to send message'),
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
        { templateName: templateName, phoneNumberTo: phoneNumber.replace('+', ''), },
        { headers: { Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}` }, },
      );
      console.log('Template sent successfully');
      showSnackbar('Template sent successfully', 'success');
      setSelectedTemplate('');

      const newMessage: MessageNode = {
        recruiterId: '',
        message: `Template: ${templateName}\n${getTemplatePreview(templateName)}`,
        candidateId: selectedCandidateId || '',
        projectsId: '',
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
      setMessageHistory(prev => [newMessage, ...prev]);
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
    ? (CANDIDATE_CONVERSATION_STATUS_LABELS[candidateData.candConversationStatus] || candidateData.candConversationStatus)
    : null;

  const conversationStatusChanged =
    conversationStatusLabel &&
    prevConversationStatusRef.current !== null &&
    prevConversationStatusRef.current !== candidateData?.candConversationStatus;

  useEffect(() => {
    if (candidateData?.candConversationStatus != null) {
      prevConversationStatusRef.current = candidateData.candConversationStatus;
    }
  }, [candidateData?.candConversationStatus]);

  const hasLatestDoNotRespond = useMemo(() => {
    if (!messageHistory.length) return false;
    const sorted = [...messageHistory].sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
    const latestBot = sorted.find(m => m.name === 'botMessage');
    return latestBot ? isDoNotRespondMessage(latestBot.message) : false;
  }, [messageHistory]);

  const renderChatTab = () => (
    <ChatView ref={chatContainerRef}>
      {conversationStatusLabel && (
        <ChatStatusBar>
          {conversationStatusChanged ? (
            <>Status updated: {conversationStatusLabel}</>
          ) : (
            <>Conversation status: {conversationStatusLabel}</>
          )}
        </ChatStatusBar>
      )}
      {isChatLoading ? (
        <div>Loading chat history... for {selectedCandidateId}</div>
      ) : chatError ? (
        <div>{chatError}</div>
      ) : messageHistory.length === 0 ? (
        <div id = "candidate-chat-no-messages" data-candidate-id={selectedCandidateId} data-person-id={personId}>No chat messages found for {candidateName}</div>
      ) : (
        <MessageContainer>
          {Object.entries(groupMessagesByDate(messageHistory)).map(([date, messages]) => (
            <React.Fragment key={date}>
              <DateSeparator>
                <DateLabel>{date}</DateLabel>
              </DateSeparator>
              {messages.map((message) => {
                const isSent = message.name === 'botMessage';
                const status = message.whatsappDeliveryStatus || 'sent';
                const isDoNotRespond = isSent && isDoNotRespondMessage(message.message);
                const deliveryFailed = isSent && status === 'failed';
                return (
                  <MessageGroup key={message.id}>
                    {isDoNotRespond ? (
                      <DoNotRespondBubble>AI chose not to respond</DoNotRespondBubble>
                    ) : (
                      <MessageBubble isSent={isSent} deliveryFailed={deliveryFailed}>
                        {message.message}
                      </MessageBubble>
                    )}
                    <MessageStatus isSent={isSent}>
                      <StatusIcon status={status} />
                      {formatTime(message.createdAt)}
                      {isSent && !isDoNotRespond && (
                        <span>
                          {status === 'sent' && 'Sent'}
                          {status === 'delivered' && 'Delivered'}
                          {status === 'read' && 'Read'}
                          {status === 'failed' && 'Failed'}
                        </span>
                      )}
                    </MessageStatus>
                  </MessageGroup>
                );
              })}
            </React.Fragment>
          ))}
        </MessageContainer>
      )}
    </ChatView>
  );

  const renderWarmPathTab = () => (
    <CandidateWarmPathTab
      candidateData={candidateData}
      isActive={activeTabId === 'warm-path'}
    />
  );

  const renderCVTab = () => (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading CV...</div>}>
      <AttachmentPanel
        isOpen={true}
        onClose={() => setActiveTabId('chat')}
        candidateId={selectedCandidateId || ''}
        candidateName={candidateName}
        PanelContainer={StyledInlineAttachmentContainer}
      />
    </Suspense>
  );

  const renderProfileTab = () => (
    <CandidateProfileTab
      candidateData={candidateData}
      isLoading={isCandidateDataLoading}
    />
  );


  const renderMessageInput = () => (
    <MessageInputContainer>
      {hasLatestDoNotRespond && (
        <DoNotRespondBanner>
          <span>Last response: AI chose not to respond to this message.</span>
        </DoNotRespondBanner>
      )}
      <MessageInputTabContainer>
        <MessageInputTab
          isActive={activeMessageTab === 'direct'}
          onClick={() => setActiveMessageTab('direct')}
        >
          Direct Message
        </MessageInputTab>
        <MessageInputTab
          isActive={activeMessageTab === 'template'}
          onClick={() => setActiveMessageTab('template')}
        >
          Template Message
        </MessageInputTab>
      </MessageInputTabContainer>

      {activeMessageTab === 'direct' ? (
        <InputWrapper>
          <StyledChatInput
            ref={inputRef}
            type="text"
            placeholder={isSendingMessage ? "Sending message..." : "Type your message"}
            disabled={isSendingMessage}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSendingMessage) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <StyledButton onClick={handleSubmit} disabled={isSendingMessage}>
            {isSendingMessage ? 'Sending...' : 'Send'}
          </StyledButton>
        </InputWrapper>
      ) : (
        <TemplateContainer>
          <TemplateSelect
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            disabled={isSendingMessage}
          >
            <option value="" disabled>Select a template</option>
            {templates.map((template) => (
              <option key={template} value={template}>{template}</option>
            ))}
          </TemplateSelect>
          <TemplatePreview>
            {isLoadingTemplates
              ? "Loading templates..."
              : getTemplatePreview(selectedTemplate)}
          </TemplatePreview>
          <StyledButton
            onClick={() => handleTemplateSend(selectedTemplate)}
            disabled={!selectedTemplate || isSendingMessage}
          >
            {isSendingMessage ? 'Sending...' : 'Send Template'}
          </StyledButton>
        </TemplateContainer>
      )}
    </MessageInputContainer>
  );


  return (
    <StyledContainer>
      <CandidateInfoHeader
        candidateData={candidateData}
        outreachStageLabel={outreachHeaderLabels.outreachStageLabel}
        outreachNextStepLabel={outreachHeaderLabels.outreachNextStepLabel}
        pendingChannel={outreachHeaderLabels.pendingChannel}
      />
      <TabContainer>
        <TabList
          componentInstanceId={tabListId}
          tabs={tabs}
          behaveAsLinks={false}
          isInSidePanel={true}
        />
      </TabContainer>
      <TabContent>
        {!selectedCandidateId ? (
          <div style={{padding: '20px'}}>No candidate selected</div>
        ) : (
          <>
            {activeTabId === 'journey' && enrolledCandidateId ? (
              <CandidateOutreachJourneyTab
                journey={outreachJourney}
                isLoading={isOutreachJourneyLoading}
                isActionLoading={isOutreachActionLoading}
                onPause={() => void pauseJourney()}
                onResume={() => void resumeJourney()}
                onStop={() =>
                  void stopOutreachForCandidates(
                    [enrolledCandidateId],
                    outreachProjectId,
                  )
                }
                onSnooze={(resumeAt) => void snoozeJourney(resumeAt)}
                onSkipDelay={(workflowRunId, stepId) =>
                  void skipDelayStep(workflowRunId, stepId)
                }
                onApproveForm={(input) => void approveFormStep(input)}
              />
            ) : null}
            {activeTabId === 'journey' && !enrolledCandidateId ? (
              <div style={{ padding: '20px' }}>
                Enroll this person in outreach to manage their journey.
              </div>
            ) : null}
            {activeTabId === 'chat' && renderChatTab()}
            {activeTabId === 'profile' && renderProfileTab()}
            {activeTabId === 'warm-path' && renderWarmPathTab()}
            {activeTabId === 'cv' && renderCVTab()}
          </>
        )}
      </TabContent>
      {selectedCandidateId && activeTabId === 'chat' && renderMessageInput()}
    </StyledContainer>
  );
});
