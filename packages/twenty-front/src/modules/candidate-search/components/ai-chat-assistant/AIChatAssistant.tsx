import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { ParsedJD, SearchParametersResponse } from '@/arx-jd-upload/types/ParsedJD';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSearchPlanGeneration } from '@/candidate-search/hooks/useSearchPlanGeneration';
import { activeSearchFilterIdState, searchConfigState } from '@/candidate-search/states/searchConfigState';
import { searchMetadataState, searchResultsState } from '@/candidate-search/states/searchResultsState';
import { dataTableApplySortsFunctionState } from '@/candidate-table/states/dataTableApplySortsFunctionState';
import { chatMessagesSelector, enrichmentsSelector, filtersSelector, jobIdAtom, resolvedParametersSelector, sortsSelector } from '@/candidate-table/states/states';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDestroyOneRecord } from '@/object-record/hooks/useDestroyOneRecord';
import { useFindManyAttachments } from '@/object-record/hooks/useFindManyAttachments';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { ChatMessage as BackendChatMessage, EnrichmentsResponse, FiltersResponse, LinkedInSearchType, SortsResponse } from 'twenty-shared';
import { Loader } from 'twenty-ui';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import {
  createApplyFiltersHandler,
  createApplyParametersHandler,
  createApplySortsHandler,
  createExecuteEnrichmentsHandler,
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
  createEnrichmentsHandler,
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
  const [enrichments] = useRecoilState(enrichmentsState);
  const { enqueueSnackBar } = useSnackBar();
  const { destroyOneRecord } = useDestroyOneRecord({ objectNameSingular: 'attachment' });
  const { findManyAttachments } = useFindManyAttachments();
  const { uploadAttachmentFile } = useUploadAttachmentFile();
  const { createOneRecord: createOneSearchFilterRecord } = useCreateOneRecord({ 
    objectNameSingular: 'searchFilter' 
  });
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const [chatMessages, setChatMessages] = useRecoilState(chatMessagesSelector);
  const [resolvedParameters, setResolvedParameters] = useRecoilState(resolvedParametersSelector);
  const [searchConfig, setSearchConfig] = useRecoilState(searchConfigState);
  const [, setParsedJD] = useRecoilState(parsedJDSelector);
  const [searchResults, setSearchResults] = useRecoilState(searchResultsState);
  const [searchMetadata, setSearchMetadata] = useRecoilState(searchMetadataState);
  const jobId = useRecoilValue(jobIdAtom);
  
  // Get all search filters from parsedJD
  const allSearchFilters = parsedJD?.searchFilters || [];
  
  // Use global Recoil state for selected search filter (so form stays in sync)
  const [selectedSearchFilterId, setSelectedSearchFilterId] = useRecoilState(activeSearchFilterIdState);
  
  // Auto-create search filter if none exists when component mounts
  useEffect(() => {
    const createInitialSearchFilter = async () => {
      // Only create if we have parsedJD with an id, but no search filters
      // Use ref to prevent multiple simultaneous creations
      if (
        parsedJD?.id &&
        (!parsedJD.searchFilters || parsedJD.searchFilters.length === 0) &&
        createOneSearchFilterRecord &&
        currentWorkspaceMember?.id &&
        !isCreatingSearchFilterRef.current
      ) {
        isCreatingSearchFilterRef.current = true;
        try {
          const searchFilterName = `${searchConfig.searchType}_${searchConfig.searchCategory}`;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const searchFilterDisplayName = `Search Filter - ${timestamp}`;
          
          const newSearchFilter = await createOneSearchFilterRecord({
            name: searchFilterDisplayName,
            jobId: parsedJD.id,
            recruiterId: currentWorkspaceMember.id,
            searchFilterName,
            searchFilterParameter: {
              generatedSearchParameters: {},
              resolvedSearchParameters: {},
            },
          });
          
          if (newSearchFilter?.id) {
            // Update parsedJD to include the new search filter
            setParsedJD(prev => {
              if (!prev) return null;
              
              const updatedSearchFilters = [
                {
                  id: newSearchFilter.id,
                  name: searchFilterDisplayName,
                  searchFilterName,
                  searchFilterParameter: {
                    generatedSearchParameters: {},
                    resolvedSearchParameters: {},
                  },
                  enrichmentConfigs: [],
                  columnFilters: [],
                  sortColumns: [],
                },
                ...(prev.searchFilters || [])
              ];
              
              return {
                ...prev,
                searchFilters: updatedSearchFilters
              };
            });
            
            // Set the new search filter as selected
            setSelectedSearchFilterId(newSearchFilter.id);
            
            // Save to localStorage for persistence
            localStorage.setItem(
              `lastSelectedSearchFilter_${parsedJD.id}`,
              newSearchFilter.id
            );
            
            console.log('Auto-created initial search filter:', newSearchFilter.id);
          }
        } catch (error) {
          console.error('Error auto-creating initial search filter:', error);
          // Don't show error to user as this is a background operation
        } finally {
          isCreatingSearchFilterRef.current = false;
        }
      }
    };
    
    createInitialSearchFilter();
  }, [parsedJD?.id, parsedJD?.searchFilters, createOneSearchFilterRecord, currentWorkspaceMember?.id, searchConfig.searchType, searchConfig.searchCategory, setParsedJD, setSelectedSearchFilterId]);

  // Initialize selectedSearchFilterId if empty
  useEffect(() => {
    if (!selectedSearchFilterId && parsedJD?.searchFilters?.[0]?.id) {
      const firstFilterId = parsedJD.searchFilters[0].id;
      
      // Try to load last selected filter from localStorage
      const savedFilterId = localStorage.getItem(`lastSelectedSearchFilter_${parsedJD?.id}`);
      
      // Verify the saved filter still exists in the current search filters
      if (savedFilterId && allSearchFilters.some(sf => sf.id === savedFilterId)) {
        setSelectedSearchFilterId(savedFilterId);
      } else {
        setSelectedSearchFilterId(firstFilterId);
      }
    }
  }, [parsedJD?.searchFilters, parsedJD?.id, selectedSearchFilterId, setSelectedSearchFilterId, allSearchFilters]);
  
  // Use selectedSearchFilterId as the current search filter ID
  const currentSearchFilterId = selectedSearchFilterId || parsedJD?.searchFilters?.[0]?.id || '';
  
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedSearchVariation, setSelectedSearchVariation] = useState<string | null>(null);
  const [includeJD, setIncludeJD] = useState(true);
  const [currentSearchParameters, setCurrentSearchParameters] = useState<SearchParametersResponse | null>(null);
  const [currentEnrichments, setCurrentEnrichments] = useState<EnrichmentsResponse | null>(null);
  const [currentFilters, setCurrentFilters] = useState<FiltersResponse | null>(null);
  const [currentSorts, setCurrentSorts] = useState<SortsResponse | null>(null);
  const searchPlanGeneration = useSearchPlanGeneration();
  const tokenPair = useRecoilValue(tokenPairState);

  // Function to fetch chat history from backend
  const fetchChatHistoryFromBackend = useCallback(async (searchFilterId: string) => {
    if (!searchFilterId || !tokenPair?.accessToken?.token) {
      return null;
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/${searchFilterId}/history`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair.accessToken.token}`,
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
  }, [tokenPair?.accessToken?.token]);

  // Load chat history from backend when component mounts or search filter changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!currentSearchFilterId || !tokenPair?.accessToken?.token) {
        return;
      }

      // First try to load from localStorage (faster, may be more up-to-date)
      const savedMessages = loadFromLocalStorage(currentSearchFilterId, 'chatMessages');
      
      // Then fetch from backend to ensure we have the latest
      const backendMessages = await fetchChatHistoryFromBackend(currentSearchFilterId);
      
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
        saveToLocalStorage(currentSearchFilterId, 'chatMessages', allMessages);
      } else if (savedMessages && Array.isArray(savedMessages) && savedMessages.length > 0) {
        // Only localStorage available
        setChatMessages(savedMessages);
      } else {
        // No messages found - initialize with welcome message
        const welcomeMessage = {
          id: 'welcome',
          type: 'assistant' as const,
          content: 'Welcome! I can help you create complete search plans (parameters + enrichments + filters), upload job descriptions, and set up individual components. Try saying "generate complete plan" or use the action buttons below!',
          timestamp: new Date(),
        };
        setChatMessages([welcomeMessage]);
        saveToLocalStorage(currentSearchFilterId, 'chatMessages', [welcomeMessage]);
      }
    };

    loadChatHistory();
  }, [currentSearchFilterId, tokenPair?.accessToken?.token, fetchChatHistoryFromBackend, setChatMessages]);

  // Auto-save chatMessages to localStorage whenever they change
  useEffect(() => {
    if (currentSearchFilterId && chatMessages.length > 0) {
      // Debounce the save to avoid excessive localStorage writes
      const timeoutId = setTimeout(() => {
        saveToLocalStorage(currentSearchFilterId, 'chatMessages', chatMessages);
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [chatMessages, currentSearchFilterId]);
  const applyGeneratedSorts = useRecoilValue(dataTableApplySortsFunctionState);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCreatingSearchFilterRef = useRef(false);
  
  // Flags to track if data has been initially loaded from database
  // Initialize to TRUE to prevent auto-loading of existing metadata
  // Users should explicitly generate or request data loading
  const [hasLoadedEnrichments, setHasLoadedEnrichments] = useState(true);
  const [hasLoadedFilters, setHasLoadedFilters] = useState(true);
  const [hasLoadedSorts, setHasLoadedSorts] = useState(true);
  
  // Load existing data from database selectors
  const existingEnrichments = useRecoilValue(enrichmentsSelector);
  const existingFilters = useRecoilValue(filtersSelector);
  const existingSorts = useRecoilValue(sortsSelector);
  // Debug logging moved to useEffect to prevent repeated logging

  // Helper functions to check for existing data in the currently selected search filter
  const hasExistingSearchParameters = useCallback(() => {
    const currentFilter = parsedJD?.searchFilters?.find(sf => sf.id === currentSearchFilterId);
    return !!(currentFilter?.searchFilterParameter?.generatedSearchParameters && 
      Object.keys(currentFilter.searchFilterParameter.generatedSearchParameters).length > 0);
  }, [parsedJD?.searchFilters, currentSearchFilterId]);

  const hasExistingEnrichments = useCallback(() => {
    const currentFilter = parsedJD?.searchFilters?.find(sf => sf.id === currentSearchFilterId);
    return !!(currentFilter?.enrichmentConfigs && currentFilter.enrichmentConfigs.length > 0) || existingEnrichments.length > 0;
  }, [parsedJD?.searchFilters, currentSearchFilterId, existingEnrichments]);

  const hasExistingFilters = useCallback(() => {
    const currentFilter = parsedJD?.searchFilters?.find(sf => sf.id === currentSearchFilterId);
    return !!(currentFilter?.columnFilters && currentFilter.columnFilters.length > 0) || existingFilters.length > 0;
  }, [parsedJD?.searchFilters, currentSearchFilterId, existingFilters]);

  const hasExistingSorts = useCallback(() => {
    const currentFilter = parsedJD?.searchFilters?.find(sf => sf.id === currentSearchFilterId);
    return !!(currentFilter?.sortColumns && currentFilter.sortColumns.length > 0) || !!existingSorts;
  }, [parsedJD?.searchFilters, currentSearchFilterId, existingSorts]);
  
  // Debug logging for button states (only log when parsedJD changes)
  useEffect(() => {
    if (parsedJD?.id) {
      console.log('AIChatAssistant Debug Info:', {
        hasExistingSearchParameters: hasExistingSearchParameters(),
        hasExistingEnrichments: hasExistingEnrichments(),
        hasExistingFilters: hasExistingFilters(),
        hasExistingSorts: hasExistingSorts(),
        currentSearchParameters: !!currentSearchParameters,
        currentEnrichments: !!currentEnrichments,
        parsedJD: {
          hasSearchFilters: !!parsedJD?.searchFilters?.length,
          searchFiltersData: parsedJD?.searchFilters?.map(sf => ({
            hasSearchFilterParameter: !!sf.searchFilterParameter?.generatedSearchParameters,
            hasEnrichmentConfigs: !!sf.enrichmentConfigs?.length,
            hasColumnFilters: !!sf.columnFilters?.length,
            hasSortColumns: !!sf.sortColumns?.length
          }))
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
          filter: { jobId: { eq: parsedJD.id } },
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
      if (currentSearchFilterId) {
        saveToLocalStorage(currentSearchFilterId, 'chatMessages', updated);
      }
      
      return updated;
    });
    
    // Save to backend if we have a searchFilterId
    if (parsedJD?.searchFilters?.[0]?.id && tokenPair?.accessToken?.token) {
      try {
        console.log ("addMessage - Saving chat message to backend::");
        // await sendChatMessage(message.content, parsedJD.searchFilters[0].id, tokenPair);
      } catch (error) {
        console.error('Error saving chat message to backend:', error);
        // Don't show error to user as the message is still added locally
      }
    }
  }, [setChatMessages, parsedJD?.searchFilters, tokenPair]);

  // Load existing enrichments from database when component mounts
  useEffect(() => {
    if (existingEnrichments.length > 0 && !currentEnrichments && !hasLoadedEnrichments) {
      console.log('Loading existing enrichments from database:', existingEnrichments);
      const enrichmentsResponse: EnrichmentsResponse = {
        enrichments: existingEnrichments,
        overallStrategy: 'Loaded from existing configuration',
        reasoning: 'Enrichments loaded from database',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: false,
          sampleDataSize: undefined
        }
      };
      setCurrentEnrichments(enrichmentsResponse);
      setHasLoadedEnrichments(true);
      
      // Add a message to show the existing enrichments
      addMessage({
        type: 'enrichments',
        content: `Loaded ${existingEnrichments.length} existing enrichment configurations from database.`,
        metadata: {
          enrichments: enrichmentsResponse,
          actionButtons: [
            {
              id: 'execute-enrichments',
              label: 'Execute Enrichments',
              action: 'execute_enrichments'
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
  }, [existingEnrichments, currentEnrichments, hasLoadedEnrichments, addMessage]);

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
          hasEnrichments: existingEnrichments.length > 0,
          enrichmentsCount: existingEnrichments.length,
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
  }, [existingSorts, currentSorts, hasLoadedSorts, existingEnrichments, existingFilters, addMessage]);

  // Group dependencies for cleaner handler creation
  const fileHandlerDeps = useMemo(() => ({
    parsedJD,
    attachments,
    addMessage,
    enqueueSnackBar,
    setAttachments,
    setIsUploadingFile,
    destroyOneRecord,
    uploadAttachmentFile,
    findManyAttachments,
    onJDRemove,
    onJDReplace,
    onJDUpload,
  }), [parsedJD, attachments, addMessage, enqueueSnackBar, destroyOneRecord, uploadAttachmentFile, findManyAttachments, onJDRemove, onJDReplace, onJDUpload]);

  const searchPlanHandlerDeps = useMemo(() => ({
    parsedJD,
    searchPlanGeneration,
    addMessage,
    enqueueSnackBar,
    setCurrentSearchParameters,
    setCurrentEnrichments,
    setCurrentFilters,
    setCurrentSorts,
    setResolvedParameters,
    setParsedJD,
    currentSearchFilterId,
    currentSearchParameters,
    currentEnrichments,
    searchConfig,
    hasExistingSearchParameters,
    hasExistingEnrichments,
  }), [parsedJD, searchPlanGeneration, addMessage, enqueueSnackBar, currentSearchFilterId, currentSearchParameters, currentEnrichments, searchConfig, hasExistingSearchParameters, hasExistingEnrichments]);

  const actionHandlerDeps = useMemo(() => ({
    enqueueSnackBar,
    currentSearchParameters,
    currentSorts,
    applyGeneratedSorts,
    setSelectedSearchVariation,
    setResolvedParameters,
    setSearchConfig,
    setParsedJD,
    currentSearchFilterId,
    jobId,
  }), [enqueueSnackBar, currentSearchParameters, currentSorts, applyGeneratedSorts, currentSearchFilterId, jobId]);

  const chatHandlerDeps = useMemo(() => ({
    parsedJD,
    tokenPair,
    searchConfig,
    addMessage,
    enqueueSnackBar,
    setChatMessages,
    setCurrentSearchParameters,
    setCurrentEnrichments,
    setCurrentFilters,
    setCurrentSorts,
    setSelectedSearchVariation,
    setResolvedParameters,
    setChatInput,
    setIsProcessing,
    setIsTerminated,
    setParsedJD,
    currentSearchFilterId,
    setSelectedSearchFilterId,
    setHasLoadedEnrichments,
    setHasLoadedFilters,
    setHasLoadedSorts,
    createOneSearchFilterRecord,
    currentWorkspaceMember,
    setSearchResults,
    setSearchMetadata,
    jobId,
    includeJD,
  }), [parsedJD, tokenPair, searchConfig, addMessage, enqueueSnackBar, currentSearchFilterId, setSelectedSearchFilterId, createOneSearchFilterRecord, currentWorkspaceMember, setSearchResults, setSearchMetadata, jobId, includeJD, setIsTerminated]);

  // Create handler instances using grouped dependencies
  const handleJDRemove = useMemo(() => createJDRemoveHandler(fileHandlerDeps), [fileHandlerDeps]);
  const handleJDReplace = useMemo(() => createJDReplaceHandler(fileHandlerDeps), [fileHandlerDeps]);

  const handleGenerateSearchParameters = useMemo(() => createSearchParametersHandler(searchPlanHandlerDeps), [searchPlanHandlerDeps]);
  const handleGenerateEnrichments = useMemo(() => createEnrichmentsHandler(searchPlanHandlerDeps), [searchPlanHandlerDeps]);
  const handleGenerateFilters = useMemo(() => createFiltersHandler(searchPlanHandlerDeps), [searchPlanHandlerDeps]);
  const handleGenerateSorts = useMemo(() => createSortsHandler(searchPlanHandlerDeps), [searchPlanHandlerDeps]);

  const handleSearchVariationSelect = useMemo(() => createSearchVariationSelectHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleExecuteEnrichments = useMemo(() => createExecuteEnrichmentsHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleApplyFilters = useMemo(() => createApplyFiltersHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleApplySorts = useMemo(() => createApplySortsHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleApplyParameters = useMemo(() => createApplyParametersHandler(actionHandlerDeps), [actionHandlerDeps]);
  const handleViewStrategyResults = useMemo(() => 
    createViewStrategyResultsHandler({
      setSearchResults,
      setSearchMetadata,
      jobId,
      enqueueSnackBar,
    }), 
    [setSearchResults, setSearchMetadata, jobId, enqueueSnackBar]
  );

  const handleClearChat = useMemo(() => createClearChatHandler(chatHandlerDeps), [chatHandlerDeps]);
  const chatSubmitHandler = useMemo(() => createChatSubmitHandler(chatHandlerDeps), [chatHandlerDeps]);

  // Handler for switching between search filters
  const handleSearchFilterSwitch = useCallback(async (newSearchFilterId: string) => {
    if (newSearchFilterId === currentSearchFilterId) {
      return; // No need to switch if it's the same filter
    }

    console.log('Switching search filter:', {
      from: currentSearchFilterId,
      to: newSearchFilterId
    });

    // Update the selected search filter ID
    setSelectedSearchFilterId(newSearchFilterId);
    
    // Save to localStorage for persistence
    if (parsedJD?.id) {
      localStorage.setItem(`lastSelectedSearchFilter_${parsedJD.id}`, newSearchFilterId);
    }

    // Load chat messages for the new filter (will be handled by the useEffect that watches currentSearchFilterId)
    // But we can pre-load from localStorage for immediate display
    const savedMessages = loadFromLocalStorage(newSearchFilterId, 'chatMessages');
    if (savedMessages && Array.isArray(savedMessages) && savedMessages.length > 0) {
      setChatMessages(savedMessages);
    } else {
      // Set empty array - the useEffect will load from backend or create welcome message
      setChatMessages([]);
    }

    // Load resolved parameters for the new filter
    const savedResolvedParams = loadFromLocalStorage(newSearchFilterId, 'resolvedParameters');
    if (savedResolvedParams) {
      setResolvedParameters(savedResolvedParams);
    } else {
      setResolvedParameters({});
    }

    // Reset current state for search plan components
    setCurrentSearchParameters(null);
    setCurrentEnrichments(null);
    setCurrentFilters(null);
    setCurrentSorts(null);
    setSelectedSearchVariation(null);
    setIsTerminated(false);

    // IMPORTANT: Set load flags to TRUE to prevent auto-loading from database
    // This gives users a clean slate - they need to explicitly generate or load data
    // This prevents old metadata from automatically appearing when switching filters
    setHasLoadedEnrichments(true);
    setHasLoadedFilters(true);
    setHasLoadedSorts(true);

    console.log('Search filter switched successfully to:', newSearchFilterId);
  }, [currentSearchFilterId, parsedJD?.id, setChatMessages, setResolvedParameters, setSelectedSearchFilterId]);

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
        searchFilters={allSearchFilters}
        currentSearchFilterId={currentSearchFilterId}
        onSearchFilterSelect={handleSearchFilterSwitch}
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
          onGenerateEnrichments={handleGenerateEnrichments}
          onExecuteEnrichments={handleExecuteEnrichments}
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