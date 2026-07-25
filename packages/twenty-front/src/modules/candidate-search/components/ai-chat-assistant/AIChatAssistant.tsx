import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { enrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { ParsedJD, SearchParametersResponse } from '@/arx-jd-upload/types/ParsedJD';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSearchPlanGeneration } from '@/candidate-search/hooks/useSearchPlanGeneration';
import { activeAssistantThreadIdState, searchConfigState } from '@/candidate-search/states/searchConfigState';
import { searchMetadataState, searchResultsState } from '@/candidate-search/states/searchResultsState';
import { dataTableApplySortsFunctionState } from '@/candidate-table/states/dataTableApplySortsFunctionState';
import { chatMessagesSelector, filtersSelector, projectIdAtom, resolvedParametersSelector, sortsSelector } from '@/candidate-table/states/states';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDestroyOneRecord } from '@/object-record/hooks/useDestroyOneRecord';
import { useFindManyAttachments } from '@/candidate-search/hooks/useFindManyAttachments';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AiFilterConfig } from 'twenty-shared/types';
import type { AiFiltersResponse, FiltersResponse, LinkedInSearchType, SortsResponse } from 'twenty-shared/types';
import { Loader } from 'twenty-ui';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import {
  createApplyFiltersHandler,
  createApplyParametersHandler,
  createApplySortsHandler,
  createExecuteAiFiltersHandler,
  createSearchVariationSelectHandler,
  createViewStrategyResultsHandler,
} from './handlers/action-handlers';
import {
  createChatSubmitHandler,
  createClearChatHandler,
} from './handlers/chat-handlers';
import {
  createJDRemoveHandler,
  createJDReplaceHandler,
} from './handlers/file-handlers';
import {
  createAiFiltersHandler,
  createFiltersHandler,
  createSearchParametersHandler,
  createSortsHandler,
} from './handlers/search-plan-handlers';
import {
  StyledChatContainer,
  StyledLoaderContainer
} from './styled/StyledComponents';
import type { ChatMessage } from './types/chat-message.types';
import { loadFromLocalStorage, saveToLocalStorage } from './utils/storage-helpers';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

// Type definitions below

type AIChatAssistantProps = {
  parsedJD: ParsedJD;
  onJDUpload?: (file: File) => Promise<void>;
  onEnrichmentCreate?: (enrichments: any[]) => void;
  onJDRemove?: () => Promise<void>;
  onJDReplace?: (files: File[]) => Promise<void>;
  onParsedJDUpdate?: (updatedParsedJD: ParsedJD) => void;
};

export const AIChatAssistant = ({
  parsedJD,
  onJDUpload,
  onEnrichmentCreate,
  onJDRemove,
  onJDReplace,
  onParsedJDUpdate,
}: AIChatAssistantProps) => {
  type BackendChatMessage = { role: 'user' | 'assistant'; content: string; timestamp?: string; id?: string };
  const [enrichments] = useAtomState(enrichmentsState);
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();

  const snackBars = useMemo(
    () => ({
      enqueueSuccessSnackBar,
      enqueueErrorSnackBar,
      enqueueInfoSnackBar,
      enqueueWarningSnackBar,
    }),
    [
      enqueueSuccessSnackBar,
      enqueueErrorSnackBar,
      enqueueInfoSnackBar,
      enqueueWarningSnackBar,
    ],
  );
  const { destroyOneRecord } = useDestroyOneRecord({ objectNameSingular: 'attachment' });
  const { findManyAttachments } = useFindManyAttachments();
  const { uploadAttachmentFile } = useUploadAttachmentFile();
  const { createOneRecord: createOneAssistantThreadRecord } = useCreateOneRecord({
    objectNameSingular: 'assistantThread',
  });
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);

  const [chatMessages, setChatMessages] = useAtomState(chatMessagesSelector);
  const [resolvedParameters, setResolvedParameters] = useAtomState(resolvedParametersSelector);
  const [searchConfig, setSearchConfig] = useAtomState(searchConfigState);
  const [, setParsedJD] = useAtomState(parsedJDSelector);
  const [searchResults, setSearchResults] = useAtomState(searchResultsState);
  const [searchMetadata, setSearchMetadata] = useAtomState(searchMetadataState);
  const projectId = useAtomStateValue(projectIdAtom);
  
  const [activeAssistantThreadId, setActiveAssistantThreadId] = useAtomState(activeAssistantThreadIdState);

  const allAssistantThreads = parsedJD?.assistantThreads || [];

  // Auto-create assistant thread if none exists when component mounts (candidate-search chat is keyed by assistantThreadId)
  useEffect(() => {
    const createInitialAssistantThread = async () => {
      if (
        !parsedJD?.id ||
        !currentWorkspaceMember?.id ||
        !createOneAssistantThreadRecord ||
        isCreatingAssistantThreadRef.current
      ) {
        return;
      }
      if (activeAssistantThreadId) {
        return;
      }
      isCreatingAssistantThreadRef.current = true;
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const displayName = `Search - ${searchConfig.searchType}_${searchConfig.searchCategory} - ${timestamp}`;
        const newThread = await createOneAssistantThreadRecord({
          name: displayName,
          projectId: parsedJD.id,
          recruiterId: currentWorkspaceMember.id,
          assistantParameters: { generatedSearchParameters: {}, resolvedSearchParameters: {} },
          messages: [],
        });
        if (newThread?.id) {
          const summary = {
            id: newThread.id,
            name: displayName,
            assistantParameters: { generatedSearchParameters: {}, resolvedSearchParameters: {} },
            enrichmentConfigs: [],
            columnFilters: [],
          };
          setParsedJD(prev =>
            prev
              ? { ...prev, assistantThreads: [summary, ...(prev.assistantThreads || [])] }
              : null,
          );
          setActiveAssistantThreadId(newThread.id);
          localStorage.setItem(`lastSelectedAssistantThread_${parsedJD.id}`, newThread.id);
          console.log('Auto-created initial assistant thread:', newThread.id);
        }
      } catch (error) {
        console.error('Error auto-creating initial assistant thread:', error);
      } finally {
        isCreatingAssistantThreadRef.current = false;
      }
    };
    createInitialAssistantThread();
  }, [
    parsedJD?.id,
    currentWorkspaceMember?.id,
    createOneAssistantThreadRecord,
    searchConfig.searchType,
    searchConfig.searchCategory,
    setParsedJD,
    setActiveAssistantThreadId,
    activeAssistantThreadId,
  ]);

  // Initialize activeAssistantThreadId from saved or first thread/filter
  useEffect(() => {
    if (activeAssistantThreadId) return;
    const firstThreadId = parsedJD?.assistantThreads?.[0]?.id;
    if (!firstThreadId) return;
    const saved = localStorage.getItem(`lastSelectedAssistantThread_${parsedJD?.id}`);
    const validSaved = saved && allAssistantThreads.some(t => t.id === saved);
    const id = validSaved ? saved : firstThreadId;
    setActiveAssistantThreadId(id);
  }, [
    parsedJD?.assistantThreads,
    parsedJD?.id,
    activeAssistantThreadId,
    setActiveAssistantThreadId,
    allAssistantThreads,
  ]);

  const currentAssistantThreadId =
    activeAssistantThreadId ||
    parsedJD?.assistantThreads?.[0]?.id ||
    '';
  
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedSearchVariation, setSelectedSearchVariation] = useState<string | null>(null);
  const [includeJD, setIncludeJD] = useState(true);
  const [currentSearchParameters, setCurrentSearchParameters] = useState<SearchParametersResponse | null>(null);
  const [currentAiFilters, setCurrentAiFilters] = useState<AiFiltersResponse | null>(null);
  const [currentFilters, setCurrentFilters] = useState<FiltersResponse | null>(null);
  const [currentSorts, setCurrentSorts] = useState<SortsResponse | null>(null);
  const searchPlanGeneration = useSearchPlanGeneration();
  const tokenPair = useAtomStateValue(tokenPairState);

  const fetchChatHistoryFromBackend = useCallback(async (assistantThreadId: string) => {
    if (!assistantThreadId || !tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      return null;
    }
    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/candidate-search/${assistantThreadId}/history`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
        }
      );

      if (!response.ok) {
        console.warn('Failed to fetch chat history from backend:', response.statusText);
        return null;
      }

      const result = await response.json();
      if (result.success && result.chatHistory && Array.isArray(result.chatHistory)) {
        // Convert backend format to frontend format
        const convertedMessages: ChatMessage[] = result.chatHistory.map((msg: BackendChatMessage) => ({
          id: msg.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          isStreaming: false,
        }));
        return convertedMessages;
      }
      return null;
    } catch (error) {
      console.error('Error fetching chat history from backend:', error);
      return null;
    }
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  // Load chat history from backend when component mounts or thread changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!currentAssistantThreadId || !tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
        return;
      }

      // First try to load from localStorage (faster, may be more up-to-date)
      const savedMessages = loadFromLocalStorage(currentAssistantThreadId, 'chatMessages');
      
      // Then fetch from backend to ensure we have the latest
      const backendMessages = await fetchChatHistoryFromBackend(currentAssistantThreadId);
      
      // Merge: prefer backend if it exists and has messages, otherwise use localStorage
      if (backendMessages && backendMessages.length > 0) {
        // Backend is source of truth - merge with localStorage if needed
        // If localStorage has more recent messages (by timestamp), keep those
        const allMessages = [...backendMessages];
        if (savedMessages && Array.isArray(savedMessages) && savedMessages.length > 0) {
          // Check for messages in localStorage that aren't in backend (e.g., streaming messages not yet saved)
          savedMessages.forEach((localMsg: ChatMessage) => {
            const existsInBackend = backendMessages.some(
              (backendMsg: ChatMessage) => backendMsg.id === localMsg.id
            );
            if (!existsInBackend) {
              allMessages.push(localMsg);
            }
          });
        }
        // Sort by timestamp
        allMessages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setChatMessages(allMessages);
        saveToLocalStorage(currentAssistantThreadId, 'chatMessages', allMessages);
      } else if (savedMessages && Array.isArray(savedMessages) && savedMessages.length > 0) {
        // Only localStorage available
        setChatMessages(savedMessages);
      } else {
        // No messages found - initialize with welcome message
        const welcomeMessage = {
          id: 'welcome',
          type: 'assistant' as const,
          content: 'Welcome! I can help you create complete search plans (parameters + AI filters + filters), upload job descriptions, and set up individual components. Try saying "generate complete plan" or use the action buttons below!',
          timestamp: new Date(),
        };
        setChatMessages([welcomeMessage]);
        saveToLocalStorage(currentAssistantThreadId, 'chatMessages', [welcomeMessage]);
      }
    };

    loadChatHistory();
  }, [currentAssistantThreadId, tokenPair?.accessOrWorkspaceAgnosticToken?.token, fetchChatHistoryFromBackend, setChatMessages]);

  // Auto-save chatMessages to localStorage whenever they change
  useEffect(() => {
    if (currentAssistantThreadId && chatMessages.length > 0) {
      // Debounce the save to avoid excessive localStorage writes
      const timeoutId = setTimeout(() => {
        saveToLocalStorage(currentAssistantThreadId, 'chatMessages', chatMessages);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [chatMessages, currentAssistantThreadId]);
  const applyGeneratedSorts = useAtomStateValue(dataTableApplySortsFunctionState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCreatingAssistantThreadRef = useRef(false);
  
  // Flags to track if data has been initially loaded from database
  // Initialize to TRUE to prevent auto-loading of existing metadata
  // Users should explicitly generate or request data loading
  const [hasLoadedAiFilters, setHasLoadedAiFilters] = useState(true);
  const [hasLoadedFilters, setHasLoadedFilters] = useState(true);
  const [hasLoadedSorts, setHasLoadedSorts] = useState(true);
  
  // Load existing data from database selectors
  const existingAiFilters: AiFilterConfig[] = useMemo(() => {
    const thread = parsedJD?.assistantThreads?.find(t => t.id === currentAssistantThreadId);
    return (thread?.enrichmentConfigs as AiFilterConfig[] | undefined) ?? [];
  }, [parsedJD?.assistantThreads, currentAssistantThreadId]);
  const existingFilters = useAtomStateValue(filtersSelector);
  const existingSorts = useAtomStateValue(sortsSelector);
  // Debug logging moved to useEffect to prevent repeated logging

  // Helper functions to check for existing data in the currently selected search filter
  const hasExistingSearchParameters = useCallback(() => {
    const thread = parsedJD?.assistantThreads?.find(t => t.id === currentAssistantThreadId);
    const generated = thread?.assistantParameters?.generatedSearchParameters;
    return !!(generated && typeof generated === 'object' && Object.keys(generated).length > 0);
  }, [parsedJD?.assistantThreads, currentAssistantThreadId]);

  const hasExistingAiFilters = useCallback(() => {
    const thread = parsedJD?.assistantThreads?.find(t => t.id === currentAssistantThreadId);
    return !!(thread?.enrichmentConfigs && thread.enrichmentConfigs.length > 0) || existingAiFilters.length > 0;
  }, [parsedJD?.assistantThreads, currentAssistantThreadId, existingAiFilters]);

  const hasExistingFilters = useCallback(() => {
    const thread = parsedJD?.assistantThreads?.find(t => t.id === currentAssistantThreadId);
    const columnFilters = thread?.columnFilters;
    return !!(Array.isArray(columnFilters) && columnFilters.length > 0) || existingFilters.length > 0;
  }, [parsedJD?.assistantThreads, currentAssistantThreadId, existingFilters]);

  const hasExistingSorts = useCallback(() => {
    return !!existingSorts;
  }, [existingSorts]);

  const hasExistingEnrichments = useCallback(() => {
    const thread = parsedJD?.assistantThreads?.find(t => t.id === currentAssistantThreadId);
    return !!(thread?.enrichmentConfigs && thread.enrichmentConfigs.length > 0);
  }, [parsedJD?.assistantThreads, currentAssistantThreadId]);
  
  // Debug logging for button states (only log when parsedJD changes)
  useEffect(() => {
    if (parsedJD?.id) {
      console.log('AIChatAssistant Debug Info:', {
        hasExistingSearchParameters: hasExistingSearchParameters(),
        hasExistingAiFilters: hasExistingAiFilters(),
        hasExistingFilters: hasExistingFilters(),
        hasExistingSorts: hasExistingSorts(),
        currentSearchParameters: !!currentSearchParameters,
        currentAiFilters: !!currentAiFilters,
        parsedJD: {
          assistantThreads: parsedJD?.assistantThreads?.map(t => ({
            id: t.id,
            hasAssistantParameters: !!t.assistantParameters,
            enrichmentCount: t.enrichmentConfigs?.length ?? 0,
            columnFiltersCount: (t.columnFilters as unknown[] | undefined)?.length ?? 0,
          })),
        }
      });
    }
  }, [parsedJD?.id]);
  
  // Monitor when applyGeneratedSorts becomes available
  useEffect(() => {
    console.log('AIChatAssistant: applyGeneratedSorts changed:', applyGeneratedSorts);
  }, [applyGeneratedSorts]);
  // Fetch attachments for the current job using parsedJD.id
  useEffect(() => {
    const fetchAttachments = async () => {
      if (!parsedJD?.id) {
        setAttachments([]);
        return;
      }

      try {
        const fetchedAttachments = await findManyAttachments({
          filter: { projectId: { eq: parsedJD.id } },
          orderBy: [{ createdAt: 'DescNullsFirst' }],
        });
        setAttachments(fetchedAttachments);
        console.log('AIChatAssistant - Fetched attachments for job:', parsedJD.id, fetchedAttachments);
      } catch (error) {
        console.error('Error fetching attachments:', error);
        setAttachments([]);
      }
    };

    fetchAttachments();
  }, [parsedJD?.id, findManyAttachments]);

  // Note: Welcome message initialization is now handled in the chat history loading useEffect above

  const addMessage = useCallback(async (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    // Update local state
    setChatMessages(prev => {
      const updated = [...prev, newMessage];
      
      // Save to localStorage for persistence
      if (currentAssistantThreadId) {
        saveToLocalStorage(currentAssistantThreadId, 'chatMessages', updated);
      }
      
      return updated;
    });
    
    if (parsedJD?.assistantThreads?.[0]?.id && tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      try {
        console.log ("addMessage - Saving chat message to backend::");
      } catch (error) {
        console.error('Error saving chat message to backend:', error);
        // Don't show error to user as the message is still added locally
      }
    }
  }, [setChatMessages, parsedJD?.assistantThreads, tokenPair]);

  // Load existing AI filters from database when component mounts
  useEffect(() => {
    if (existingAiFilters.length > 0 && !currentAiFilters && !hasLoadedAiFilters) {
        console.log('Loading existing AI filters from database:', existingAiFilters);
      const aiFiltersResponse: AiFiltersResponse = {
        aiFilters: existingAiFilters,
        overallStrategy: 'Loaded from existing configuration',
        reasoning: 'AI filters loaded from database',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: false,
          sampleDataSize: undefined
        }
      };
      setCurrentAiFilters(aiFiltersResponse);
      setHasLoadedAiFilters(true);
      
      // Add a message to show the existing AI filters (use 'enrichments' type for ChatMessage compatibility)
      addMessage({
        type: 'enrichments',
        content: `Loaded ${existingAiFilters.length} existing AI filter configurations from database.`,
        metadata: {
          aiFilters: aiFiltersResponse,
          actionButtons: [
            {
              id: 'execute-ai-filters',
              label: 'Execute AI filters',
              action: 'execute_ai_filters'
            },
            {
              id: 'generate-filters',
              label: 'Generate Filters',
              action: 'generate_filters'
            }
          ]
        }
      });
    }
  }, [existingAiFilters, currentAiFilters, hasLoadedAiFilters, addMessage]);

  // Load existing filters from database when component mounts
  useEffect(() => {
    if (existingFilters.length > 0 && !currentFilters && !hasLoadedFilters) {
      console.log('Loading existing filters from database:', existingFilters);
      const filtersResponse: FiltersResponse = {
        filterStrategy: { name: 'Loaded Strategy', description: 'Loaded from existing configuration', targetShortlistSize: 50, priority: 'balanced' as const, reasoning: 'Loaded from database' },
        handsontableFilters: existingFilters,
        candidateSearchFilters: [],
        reasoning: 'Filters loaded from database',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasDataDistribution: false,
          dataDistributionFields: undefined
        }
      };
      setCurrentFilters(filtersResponse);
      setHasLoadedFilters(true);
      
      // Add a message to show the existing filters
      addMessage({
        type: 'filters',
        content: `Loaded ${existingFilters.length} existing filter configurations from database.`,
        metadata: {
          filters: filtersResponse,
          actionButtons: [
            {
              id: 'apply-filters',
              label: 'Apply Filters',
              action: 'apply_filters'
            }
          ]
        }
      });
    }
  }, [existingFilters, currentFilters, hasLoadedFilters, addMessage]);

  // Load existing sorts from database when component mounts
  useEffect(() => {
    if (existingSorts && !currentSorts && !hasLoadedSorts) {
      console.log('Loading existing sorts from database:', existingSorts);
      const sortsResponse: SortsResponse = {
        sortStrategy: existingSorts,
        reasoning: existingSorts.reasoning || 'Loaded from existing configuration',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: false,
          sampleDataSize: null,
          hasAiFilters: existingAiFilters.length > 0,
          aiFiltersCount: existingAiFilters.length,
          hasFilters: existingFilters.length > 0,
          filtersCount: existingFilters.length
        }
      };
      setCurrentSorts(sortsResponse);
      setHasLoadedSorts(true);
      
      // Add a message to show the existing sorts
      addMessage({
        type: 'sorts',
        content: `Loaded existing sorting strategy with ${existingSorts.sortColumns.length} sort columns. The sorting configuration prioritizes candidates based on ${existingSorts.name}.`,
        metadata: {
          sorts: sortsResponse,
          actionButtons: [
            {
              id: 'apply-sorts',
              label: 'Apply Sorting',
              action: 'apply_sorts',
              disabled: false
            }
          ]
        }
      });
    }
  }, [existingSorts, currentSorts, hasLoadedSorts, existingAiFilters, existingFilters, addMessage]);

  // Group dependencies for cleaner handler creation
  const fileHandlerDeps = useMemo(() => ({
    parsedJD,
    attachments,
    addMessage,
    snackBars,
    setAttachments,
    setIsUploadingFile,
    destroyOneRecord,
    uploadAttachmentFile,
    findManyAttachments,
    onJDRemove,
    onJDReplace,
    onJDUpload,
  }), [parsedJD, attachments, addMessage, snackBars, destroyOneRecord, uploadAttachmentFile, findManyAttachments, onJDRemove, onJDReplace, onJDUpload]);

  const searchPlanHandlerDeps = useMemo(() => ({
    parsedJD,
    searchPlanGeneration,
    addMessage,
    snackBars,
    setCurrentSearchParameters,
    setCurrentAiFilters,
    setCurrentFilters,
    setCurrentSorts,
    setResolvedParameters,
    setParsedJD,
    currentAssistantThreadId,
    currentSearchParameters,
    currentAiFilters,
    searchConfig,
    hasExistingSearchParameters,
    hasExistingAiFilters,
    hasExistingEnrichments,
  }), [parsedJD, searchPlanGeneration, addMessage, snackBars, currentAssistantThreadId, currentSearchParameters, currentAiFilters, searchConfig, hasExistingSearchParameters, hasExistingAiFilters, hasExistingEnrichments]);

  const actionHandlerDeps = useMemo(() => ({
    snackBars,
    currentSearchParameters,
    currentSorts,
    applyGeneratedSorts,
    setSelectedSearchVariation,
    setResolvedParameters,
    setSearchConfig,
    setParsedJD,
    currentAssistantThreadId,
    projectId,
  }), [snackBars, currentSearchParameters, currentSorts, applyGeneratedSorts, currentAssistantThreadId, projectId]);

  const chatHandlerDeps = useMemo(() => ({
    parsedJD,
    tokenPair,
    searchConfig,
    addMessage,
    snackBars,
    setChatMessages,
    setCurrentSearchParameters,
    setCurrentAiFilters,
    setCurrentFilters,
    setCurrentSorts,
    setSelectedSearchVariation,
    setResolvedParameters,
    setChatInput,
    setIsProcessing,
    setIsTerminated,
    setParsedJD,
    currentAssistantThreadId,
    setActiveAssistantThreadId,
    setHasLoadedAiFilters,
    setHasLoadedFilters,
    setHasLoadedSorts,
    createOneAssistantThreadRecord,
    currentWorkspaceMember,
    setSearchResults,
    setSearchMetadata,
    projectId,
    includeJD,
  }), [parsedJD, tokenPair, searchConfig, addMessage, snackBars, currentAssistantThreadId, setActiveAssistantThreadId, createOneAssistantThreadRecord, currentWorkspaceMember, setSearchResults, setSearchMetadata, projectId, includeJD, setIsTerminated]);

  // Create handler instances using grouped dependencies
  const handleJDRemove = useMemo(() => createJDRemoveHandler(fileHandlerDeps), [fileHandlerDeps]);
  const handleJDReplace = useMemo(() => createJDReplaceHandler(fileHandlerDeps), [fileHandlerDeps]);

  const handleGenerateSearchParameters = useMemo(() => createSearchParametersHandler(searchPlanHandlerDeps), [searchPlanHandlerDeps]);
  const handleGenerateAiFilters = useMemo(() => createAiFiltersHandler(searchPlanHandlerDeps), [searchPlanHandlerDeps]);
  const handleGenerateFilters = useMemo(() => createFiltersHandler(searchPlanHandlerDeps), [searchPlanHandlerDeps]);
  const handleGenerateSorts = useMemo(() => createSortsHandler(searchPlanHandlerDeps), [searchPlanHandlerDeps]);

  const handleSearchVariationSelect = useMemo(() => createSearchVariationSelectHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleExecuteAiFilters = useMemo(() => createExecuteAiFiltersHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleApplyFilters = useMemo(() => createApplyFiltersHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleApplySorts = useMemo(() => createApplySortsHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleApplyParameters = useMemo(() => createApplyParametersHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleViewStrategyResults = useMemo(() => 
    createViewStrategyResultsHandler({
      setSearchResults,
      setSearchMetadata,
      projectId,
      snackBars,
      tokenPair,
    }),
    [setSearchResults, setSearchMetadata, projectId, snackBars, tokenPair]
  )

  const handleClearChat = useMemo(() => createClearChatHandler(chatHandlerDeps), [chatHandlerDeps]);
  const chatSubmitHandler = useMemo(() => createChatSubmitHandler(chatHandlerDeps), [chatHandlerDeps]);

  const handleSearchFilterSwitch = useCallback(async (_assistantThreadId: string) => {
    // Candidate-search is keyed only by assistantThreadId now. Thread switching is handled
    // via `activeAssistantThreadIdState` and `lastSelectedAssistantThread_*`.
    return;
  }, []);

  const handleAssistantThreadSwitch = useCallback((assistantThreadId: string) => {
    setActiveAssistantThreadId(assistantThreadId);
    if (parsedJD?.id) {
      localStorage.setItem(`lastSelectedAssistantThread_${parsedJD.id}`, assistantThreadId);
    }
  }, [parsedJD?.id, setActiveAssistantThreadId]);

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessing(false);
      setIsTerminated(true);
    }
  }, []);

  const handleSearchTypeChange = useCallback((newSearchType: LinkedInSearchType) => {
    console.log('Search type changing from', searchConfig.searchType, 'to', newSearchType);
    setSearchConfig(prev => {
      const updated = { ...prev, searchType: newSearchType };
      console.log('Updated searchConfig:', updated);
      return updated;
    });
  }, [setSearchConfig, searchConfig.searchType]);

  // Cleanup: abort any pending requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsProcessing(true);
    setIsTerminated(false);

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Add user message to chat
    await addMessage({
      type: 'user',
      content: userMessage,
    });

    try {
      // Call the handler with abort controller
      await chatSubmitHandler(userMessage, abortController);
    } catch (error) {
      // Don't show error if request was aborted
      if (abortController.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        console.log('Request aborted by user');
      } else {
        console.error('Error in chat submit:', error);
      }
    } finally {
      // Clean up abort controller
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsProcessing(false);
    }
  }, [chatInput, isProcessing, addMessage, chatSubmitHandler]);

  // Check if JD has attachments
  const hasJD = attachments && attachments.length > 0;

  // Get JD file name for display
  const getJDFileName = useCallback(() => {
    if (attachments && attachments.length > 0 && attachments[0]?.name) {
      return attachments[0].name;
    }
    if (parsedJD?.name) {
      const jobCode = parsedJD.jobCode ? `${parsedJD.jobCode} - ` : '';
      return `${jobCode}${parsedJD.name}.pdf`;
    }
    return undefined;
  }, [attachments, parsedJD]);

  // Handler to trigger JD replace (opens file picker)
  const handleJDReplaceTrigger = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt';
    input.multiple = false;
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      if (files.length > 0 && handleJDReplace) {
        await handleJDReplace(files);
      }
    };
    input.click();
  }, [handleJDReplace]);

  return (
    <>
      <ChatHeader 
        onClearChat={handleClearChat}
        assistantThreads={allAssistantThreads}
        currentAssistantThreadId={currentAssistantThreadId}
        onAssistantThreadSelect={handleAssistantThreadSwitch}
        onJDRemove={handleJDRemove}
        onJDReplace={handleJDReplaceTrigger}
        hasJD={hasJD}
        isUploading={isUploadingFile}
        parsedJD={parsedJD}
        jdFileName={getJDFileName()}
        includeJD={includeJD}
        onIncludeJDChange={setIncludeJD}
        isStreaming={isProcessing}
        onStopStreaming={handleStopStreaming}
        searchType={searchConfig.searchType}
        onSearchTypeChange={handleSearchTypeChange}
      />
      <StyledChatContainer>
        <ChatMessages 
          messages={chatMessages}
          onSearchVariationSelect={handleSearchVariationSelect}
          onGenerateAiFilters={handleGenerateAiFilters}
          onExecuteAiFilters={handleExecuteAiFilters}
          onGenerateFilters={handleGenerateFilters}
          onApplyFilters={handleApplyFilters}
          onApplySorts={handleApplySorts}
          onApplyParameters={handleApplyParameters}
          onViewStrategyResults={handleViewStrategyResults}
          selectedSearchVariation={selectedSearchVariation}
          isProcessing={isProcessing}
          isTerminated={isTerminated}
        />

        {/* Record Action Bar */}
        {searchPlanGeneration.isGenerating && (
          <StyledLoaderContainer>
            <Loader />
            <span>Generating search plan...</span>
          </StyledLoaderContainer>
        )}

        {/* Chat Input */}
        <ChatInput
          value={chatInput}
          onChange={setChatInput}
          onSubmit={handleChatSubmit}
          disabled={isProcessing}
        />
      </StyledChatContainer>
    </>
  );
};