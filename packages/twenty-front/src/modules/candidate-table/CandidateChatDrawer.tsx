import { tokenPairState } from '@/auth/states/tokenPairState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { getPermanentId, isUUID } from '@/candidate-table/HotHooks';
import { candidateDataState, processedDataSelector, selectedCandidateIdState, tableStateAtom, unreadMessagesCountsState } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconArrowsSplit2, IconFileText, IconMessage, IconUser, IconVideo } from 'twenty-ui/icon';
import axios from 'axios';
import dayjs from 'dayjs';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MessageNode } from 'twenty-shared/arx';
import { graphqlToFetchAllCandidateDataWithFieldValues } from 'twenty-shared/graphql';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const AttachmentPanel = lazy(() => import('./AttachmentPanel'));
import { CandidateInfoHeader } from './CandidateInfoHeader';
import { CandidateProfileTab } from './CandidateProfileTab';
import { CandidateWarmPathTab } from './CandidateWarmPathTab';
import VideoInterviewTab from './VideoInterviewTab';
import { useTemplates } from './hooks/useTemplates';

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
  flex: 1;
  height: calc(100% - 120px); /* Adjusted to make room for message input */
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const ChatView = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 40px; /* Add extra padding at bottom to prevent overlap with input */
  display: flex;
  flex-direction: column-reverse;
  height: 100%;
`;

const DateSeparator = styled.div`
  text-align: center;
  margin: 16px 0;
  color: ${props => themeCssVariables.font.color.secondary};
  font-size: ${props => themeCssVariables.font.size.sm};
`;

const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const MessageBubble = styled.div<{ isSent: boolean; deliveryFailed?: boolean }>`
  max-width: 70%;
  margin: ${props => props.isSent ? '8px 8px 8px auto' : '8px'};
  padding: 12px 16px;
  border-radius: 16px;
  background-color: ${props => {
    if (props.deliveryFailed && props.isSent) {
      return '#1e40af';
    }
    return props.isSent ? '#2563eb' : '#f3f4f6';
  }};
  color: ${props => props.isSent ? 'white' : 'inherit'};
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  position: relative;
  border: ${props =>
    props.deliveryFailed ? `2px solid ${themeCssVariables.color.red}` : 'none'};
  box-sizing: border-box;

  ${props => props.isSent ? `
    border-bottom-right-radius: 4px;
  ` : `
    border-bottom-left-radius: 4px;
  `}
`;

const MessageStatus = styled.div<{ isSent: boolean }>`
  font-size: 11px;
  color: ${props => themeCssVariables.font.color.light};
  margin-top: 4px;
  text-align: ${props => props.isSent ? 'right' : 'left'};
  display: flex;
  align-items: center;
  justify-content: ${props => props.isSent ? 'flex-end' : 'flex-start'};
  gap: 4px;
`;

const StatusIcon = styled.span<{ status: string }>`
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
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
  }
`;

const MessageTime = styled.div<{ isSent: boolean }>`
  font-size: 11px;
  color: ${props => themeCssVariables.font.color.light};
  margin-top: 4px;
  text-align: ${props => props.isSent ? 'right' : 'left'};
`;

const MessageGroup = styled.div`
  margin: 8px 0;
`;

const DateLabel = styled.span`
  background-color: ${props => themeCssVariables.background.primary};
  padding: 0 12px;
  color: ${props => themeCssVariables.font.color.light};
  font-size: 12px;
  position: relative;
  z-index: 1;
`;

// Message input styles
const MessageInputContainer = styled.div`
  border-top: 1px solid ${props => themeCssVariables.border.color.light};
  padding: ${props => themeCssVariables.spacing[2]};
  background-color: ${props => themeCssVariables.background.primary};
  position: sticky;
  bottom: 0;
  box-sizing: border-box;
  width: 100%;
  z-index: 1;
`;

const MessageInputTabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => themeCssVariables.border.color.light};
  margin-bottom: ${props => themeCssVariables.spacing[2]};
  width: 100%;
  box-sizing: border-box;
`;

const MessageInputTab = styled.div<{ isActive: boolean }>`
  padding: ${props => themeCssVariables.spacing[1]} ${props => themeCssVariables.spacing[2]};
  cursor: pointer;
  color: ${props => props.isActive ? themeCssVariables.font.color.primary : themeCssVariables.font.color.tertiary};
  font-weight: ${props => props.isActive ? 'bold' : 'normal'};
  border-bottom: 2px solid ${props => props.isActive ? themeCssVariables.font.color.primary : 'transparent'};
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  gap: ${props => themeCssVariables.spacing[2]};
`;

const StyledChatInput = styled.input`
  flex: 1;
  padding: ${props => themeCssVariables.spacing[2]};
  border-radius: ${props => themeCssVariables.border.radius.md};
  border: 1px solid ${props => themeCssVariables.border.color.medium};
  font-size: ${props => themeCssVariables.font.size.md};
  outline: none;
  box-sizing: border-box;
  min-width: 0; /* Prevents input from overflowing */
  background-color: ${props => props.disabled ? themeCssVariables.background.secondary : themeCssVariables.background.primary};
  color: ${props => props.disabled ? themeCssVariables.font.color.tertiary : themeCssVariables.font.color.primary};
  cursor: ${props => props.disabled ? 'not-allowed' : 'text'};
  
  &:focus:not(:disabled) {
    border-color: ${props => themeCssVariables.font.color.primary};
  }
`;

const StyledButton = styled.button`
  padding: ${props => themeCssVariables.spacing[2]} ${props => themeCssVariables.spacing[3]};
  background-color: ${props => props.disabled ? themeCssVariables.color.gray : themeCssVariables.color.blue8};
  color: ${props => props.disabled ? themeCssVariables.font.color.tertiary : 'white'};
  border: none;
  border-radius: ${props => themeCssVariables.border.radius.md};
  font-weight: 500;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  white-space: nowrap;
  opacity: ${props => props.disabled ? 0.6 : 1};
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: ${props => themeCssVariables.color.gray};
    color: black;
  }
`;

const TemplateContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => themeCssVariables.spacing[2]};
  width: 100%;
  box-sizing: border-box;
`;

const TemplateSelect = styled.select`
  width: 100%;
  padding: ${props => themeCssVariables.spacing[2]};
  border-radius: ${props => themeCssVariables.border.radius.md};
  border: 1px solid ${props => themeCssVariables.border.color.medium};
  font-size: ${props => themeCssVariables.font.size.md};
  outline: none;
  box-sizing: border-box;
  background-color: ${props => props.disabled ? themeCssVariables.background.secondary : themeCssVariables.background.primary};
  color: ${props => props.disabled ? themeCssVariables.font.color.tertiary : themeCssVariables.font.color.primary};
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  
  &:focus:not(:disabled) {
    border-color: ${props => themeCssVariables.font.color.primary};
  }
`;

const TemplatePreview = styled.div`
  width: 100%;
  padding: ${props => themeCssVariables.spacing[2]};
  border: 1px solid ${props => themeCssVariables.border.color.light};
  border-radius: ${props => themeCssVariables.border.radius.md};
  background-color: ${props => themeCssVariables.background.secondary};
  min-height: 80px;
  font-size: ${props => themeCssVariables.font.size.sm};
  color: ${props => themeCssVariables.font.color.secondary};
  box-sizing: border-box;
`;

const ChatStatusBar = styled.div`
  padding: ${props => themeCssVariables.spacing[1]} ${props => themeCssVariables.spacing[2]};
  margin-bottom: ${props => themeCssVariables.spacing[1]};
  font-size: ${props => themeCssVariables.font.size.sm};
  color: ${props => themeCssVariables.font.color.secondary};
  background-color: ${props => themeCssVariables.background.secondary};
  border-radius: ${props => themeCssVariables.border.radius.sm};
  border-left: 3px solid ${props => themeCssVariables.color.blue8};
`;

const DoNotRespondBanner = styled.div`
  padding: ${props => themeCssVariables.spacing[1]} ${props => themeCssVariables.spacing[2]};
  margin-bottom: ${props => themeCssVariables.spacing[1]};
  font-size: ${props => themeCssVariables.font.size.sm};
  color: ${props => themeCssVariables.font.color.primary};
  background-color: ${props => themeCssVariables.background.tertiary};
  border-radius: ${props => themeCssVariables.border.radius.sm};
  border-left: 3px solid ${props => themeCssVariables.color.orange};
  display: flex;
  align-items: center;
  gap: ${props => themeCssVariables.spacing[1]};
`;

const DoNotRespondBubble = styled.div`
  max-width: 70%;
  margin: 8px 8px 8px auto;
  padding: 10px 14px;
  border-radius: 16px;
  border-bottom-right-radius: 4px;
  font-size: 13px;
  color: ${props => themeCssVariables.font.color.tertiary};
  background-color: ${props => themeCssVariables.background.tertiary};
  border: 1px dashed ${props => themeCssVariables.border.color.medium};
  font-style: italic;
`;

const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  ONLY_ADDED_NO_CONVERSATION: 'No Conversation',
  CONVERSATION_STARTED_HAS_NOT_RESPONDED: 'Started, No Response',
  SHARED_JD_HAS_NOT_RESPONDED: 'Shared JD, No Response',
  CANDIDATE_REFUSES_TO_RELOCATE: 'Refuses Relocation',
  STOPPED_RESPONDING_ON_QUESTIONS: 'Stopped Responding',
  CANDIDATE_SALARY_OUT_OF_RANGE: 'Salary Out of Range',
  CANDIDATE_IS_KEEN_TO_CHAT: 'Keen to Chat',
  CANDIDATE_DECLINED_OPPORTUNITY: 'Declined Opportunity',
  CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT: 'Followed Up',
  CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION: 'Reluctant on Compensation',
  CONVERSATION_CLOSED_TO_BE_CONTACTED: 'Closed to Contact',
};

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

// Add type definitions at the top of the file after imports
type WhatsAppMessage = {
  node: {
    id: string;
    whatsappDeliveryStatus: string;
  };
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
  whatsappMessages?: {
    edges: WhatsAppMessage[];
  };
};

export const CandidateChatDrawer = React.memo(() => {
  const [tokenPair] = useAtomState(tokenPairState);
  const [candidateData, setCandidateData] = useAtomState(candidateDataState);
  const tableState = useAtomStateValue(tableStateAtom);
  const processedData = useAtomStateValue(processedDataSelector);
  const searchResults = useAtomStateValue(searchResultsState);
  const setUnreadMessagesCounts = useSetAtomState(unreadMessagesCountsState);
  
  // Memoize candidateId to prevent unnecessary re-renders
  const candidateId = useAtomStateValue(selectedCandidateIdState);


  
  const [messageHistory, setMessageHistory] = useState<MessageNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string>('Candidate');
  const prevCandidateIdRef = useRef<string | null>(null);
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
    {
      id: 'video-interview',
      title: 'Video Interview',
      Icon: IconVideo,
    },
  ], []);

  // Get personId from candidateData instead of processedData to avoid dependency on frequently changing selector
  const personId = useMemo(() => {
    return candidateData?.peopleId || candidateData?.personId || null;
  }, [candidateData?.peopleId, candidateData?.personId]);
  

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
    if (!isLoading && activeTabId === 'chat') {
      scrollToBottom();
    }
  }, [messageHistory, isLoading, activeTabId, scrollToBottom]);

  // Also scroll to bottom when switching to chat tab
  useEffect(() => {
    if (activeTabId === 'chat' && !isLoading) {
      scrollToBottom();
    }
  }, [activeTabId, isLoading, scrollToBottom]);

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

  const fetchMessages = React.useCallback(async () => {
    if (!candidateId || !tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      console.log('Missing candidateId or token, skipping fetch');
      setIsLoading(false);
      return;
    }
    
    // Get permanent ID (UUID) - ensure we only send UUIDs, not LinkedIn IDs or tempIds
    const rowData = { id: candidateId };
    const permanentId = getPermanentId(rowData, tableState.rawData || []);
    if (!permanentId || !isUUID(permanentId)) {
      console.log(`Skipping fetch messages for candidate ${candidateId} - no valid UUID found (permanentId: ${permanentId})`);
      setIsLoading(false);
      return;
    }
    
    try {
      
      const response = await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
        { candidateId: permanentId },
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
      setError('Failed to load chat messages');
      setMessageHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [candidateId, tokenPair?.accessOrWorkspaceAgnosticToken?.token, tableState.rawData]);

  // Debounced version of fetchMessages to prevent excessive API calls
  const debouncedFetchMessages = useCallback(() => {
    if (fetchMessagesTimeoutRef.current) {
      clearTimeout(fetchMessagesTimeoutRef.current);
    }
    fetchMessagesTimeoutRef.current = setTimeout(() => {
      fetchMessages();
    }, 1000); // Debounce by 1 second
  }, [fetchMessages]);

  const fetchCandidateData = React.useCallback(async () => {
    if (!candidateId || !tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      return;
    }
    
    // Get permanent ID (UUID) - ensure we only send UUIDs, not LinkedIn IDs or tempIds
    const rowData = { id: candidateId };
    const permanentId = getPermanentId(rowData, tableState.rawData || []);
    if (!permanentId || !isUUID(permanentId)) {
      console.log(`Skipping fetch candidate data from backend for candidate ${candidateId} - no valid UUID found (permanentId: ${permanentId})`);
      
      // Try to find candidate in searchResults first (where LinkedIn candidates are), then processedData
      const allCandidates = [...searchResults, ...processedData];
      const candidateFromTable = allCandidates.find((row) => {
        return row.id === candidateId || 
               row.tempId === candidateId ||
               getPermanentId(row, tableState.rawData || []) === candidateId;
      });
      
      if (candidateFromTable) {
        setCandidateData(candidateFromTable as any);
        if (candidateFromTable.name) {
          setCandidateName(candidateFromTable.name);
        }
        const candidateAny = candidateFromTable as any;
        if (candidateAny.phone || candidateAny.phoneNumber?.primaryPhoneNumber) {
          setPhoneNumber(
            typeof candidateAny.phone === 'string' 
              ? candidateAny.phone 
              : candidateAny.phoneNumber?.primaryPhoneNumber || ''
          );
        }
        setIsLoading(false);
      }
      return;
    }
    
    try {
      setIsLoading(true);
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
              id: { eq: permanentId }
            }
          },
        }),
      });
      
      const responseData = await response.json();
      if (responseData?.data?.candidates?.edges?.[0]?.node) {
        const candidate = responseData.data.candidates.edges[0].node;
        // Only update if candidate ID changed or data is different
        setCandidateData((prev: any) => {
          if (prev?.id === candidate.id) {
            // Compare key fields to avoid unnecessary updates
            if (
              prev.name === candidate.name &&
              prev.status === candidate.status &&
              prev.candConversationStatus === candidate.candConversationStatus &&
              prev.updatedAt === candidate.updatedAt
            ) {
              return prev; // Return previous value to prevent re-render
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
      }
    } catch (error) {
      console.error('Error fetching candidate data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [candidateId, tokenPair?.accessOrWorkspaceAgnosticToken?.token, tableState.rawData, processedData, searchResults, setCandidateData, setCandidateName, setPhoneNumber]);

  // Start polling when component mounts and candidateId is available
  useEffect(() => {
    if (!candidateId) return;
    
    // Initial fetch
    fetchMessages();
    fetchCandidateData();

    // Set up polling interval with longer interval to reduce load
    pollingIntervalRef.current = setInterval(() => {
      debouncedFetchMessages();
      fetchCandidateData();
    }, 30000); // Poll every 30 seconds instead of 10

    // Cleanup interval on unmount or when candidateId changes
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
  }, [candidateId]); // Only depend on candidateId - callbacks are stable via useCallback

  // Set default active tab
  useEffect(() => {
    if (!activeTabId) {
      // Check if we have a default tab in localStorage
      const defaultTab = localStorage.getItem('candidate-chat-default-tab');
      if (defaultTab && (defaultTab === 'chat' || defaultTab === 'profile' || defaultTab === 'warm-path' || defaultTab === 'cv' || defaultTab === 'video-interview')) {
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
    if (candidateId && tokenPair?.accessOrWorkspaceAgnosticToken?.token && messageHistory.length > 0) {
      // Get permanent ID (UUID) - ensure we only use UUIDs, not LinkedIn IDs or tempIds
      const rowData = { id: candidateId };
      const permanentId = getPermanentId(rowData, tableState.rawData || []);
      if (!permanentId || !isUUID(permanentId)) {
        console.log(`Skipping mark as read for candidate ${candidateId} - no valid UUID found (permanentId: ${permanentId})`);
        return;
      }

      // Only mark as read once per candidate - reset when candidateId changes
      if (hasMarkedAsReadRef.current === candidateId) {
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
          // Update for both permanentId (UUID) and candidateId (in case it's different, e.g., LinkedIn ID)
          setUnreadMessagesCounts(prev => {
            const updated = { ...prev };
            updated[permanentId] = 0;
            // Also update candidateId if it's different from permanentId (for search result candidates)
            if (candidateId !== permanentId) {
              updated[candidateId] = 0;
            }
            return updated;
          });
          
          // Mark that we've processed this candidate
          hasMarkedAsReadRef.current = candidateId;
        }).catch(error => {
          console.error('Error updating message status:', error);
        });
      } else {
        // No unread messages, but still mark as processed and update count to 0
        setUnreadMessagesCounts(prev => {
          const updated = { ...prev };
          updated[permanentId] = 0;
          if (candidateId !== permanentId) {
            updated[candidateId] = 0;
          }
          return updated;
        });
        hasMarkedAsReadRef.current = candidateId;
      }
    }
    
    // Reset the ref when candidateId changes
    if (hasMarkedAsReadRef.current !== candidateId) {
      hasMarkedAsReadRef.current = null;
    }
  }, [candidateId, tokenPair, messageHistory, tableState.rawData, setUnreadMessagesCounts]);

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
        candidateId: candidateId || '',
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
        candidateId: candidateId || '',
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
    ? (CONVERSATION_STATUS_LABELS[candidateData.candConversationStatus] || candidateData.candConversationStatus)
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
      {isLoading ? (
        <div>Loading chat history... for {candidateId}</div>
      ) : error ? (
        <div>{error}</div>
      ) : messageHistory.length === 0 ? (
        <div id = "candidate-chat-no-messages" data-candidate-id={candidateId} data-person-id={personId}>No chat messages found for {candidateName}</div>
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
    <Suspense fallback={null}>
      <AttachmentPanel
        isOpen={true}
        onClose={() => setActiveTabId('chat')}
        candidateId={candidateId || ''}
        candidateName={candidateName}
        PanelContainer={StyledInlineContainer}
      />
    </Suspense>
  );

  const renderProfileTab = () => (
    <CandidateProfileTab 
      candidateData={candidateData}
      isLoading={isLoading}
    />
  );

  const renderVideoInterviewTab = () => (
    <VideoInterviewTab 
      candidateData={candidateData}
      isLoading={isLoading}
    />
  );

  // Custom styled container for inline usage inside the drawer
  const StyledInlineContainer = styled.div<{ isOpen: boolean }>`
    position: relative;
    width: 100%;
    height: 100%;
    background-color: #f5f5f5;
    overflow-y: auto;
  `;

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
      <CandidateInfoHeader candidateData={candidateData} />
      <TabContainer>
        <TabList
          componentInstanceId={tabListId}
          tabs={tabs}
          loading={isLoading}
        />
      </TabContainer>
      <TabContent>
        {!candidateId ? (
          <div style={{padding: '20px'}}>No candidate selected</div>
        ) : isLoading ? (
          <div style={{padding: '20px'}}>Loading chat...</div>
        ) : error ? (
          <div style={{padding: '20px'}}>Error: {error}</div>
        ) : (
          <>
            {activeTabId === 'chat' && renderChatTab()}
            {activeTabId === 'profile' && renderProfileTab()}
            {activeTabId === 'warm-path' && renderWarmPathTab()}
            {activeTabId === 'cv' && renderCVTab()}
            {activeTabId === 'video-interview' && renderVideoInterviewTab()}
          </>
        )}
      </TabContent>
      {candidateId && activeTabId === 'chat' && renderMessageInput()}
    </StyledContainer>
  );
}); 