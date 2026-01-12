import type { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { addSearchResults, persistSearchMetadataToStorage } from '@/candidate-search/states/searchResultsState';
import type { EnrichmentsResponse, FiltersResponse, SearchParametersResponse, SortsResponse } from '@/candidate-search/types/candidate-search.types';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import type { ChatMessage } from '../types/chat-message.types';
import { clearLocalStorage } from '../utils/storage-helpers';

type ChatHandlerDeps = {
  parsedJD: ParsedJD;
  tokenPair: { accessToken: { token: string } } | null;
  searchConfig: { searchType: string; searchCategory: string };
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>;
  enqueueSnackBar: (message: string, options: { variant: SnackBarVariant }) => void;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setCurrentSearchParameters: (params: SearchParametersResponse | null) => void;
  setCurrentEnrichments: (enrichments: EnrichmentsResponse | null) => void;
  setCurrentFilters: (filters: FiltersResponse | null) => void;
  setCurrentSorts: (sorts: SortsResponse | null) => void;
  setSelectedSearchVariation: (variationId: string | null) => void;
  setResolvedParameters: React.Dispatch<React.SetStateAction<any>>;
  setChatInput: (input: string) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setIsTerminated?: (isTerminated: boolean) => void;
  setParsedJD: React.Dispatch<React.SetStateAction<ParsedJD | null>>;
  currentSearchFilterId: string;
  setSelectedSearchFilterId: (id: string) => void;
  setHasLoadedEnrichments?: (hasLoaded: boolean) => void;
  setHasLoadedFilters?: (hasLoaded: boolean) => void;
  setHasLoadedSorts?: (hasLoaded: boolean) => void;
  createOneSearchFilterRecord?: (data: any) => Promise<any>;
  currentWorkspaceMember?: { id: string } | null;
  setSearchResults?: React.Dispatch<React.SetStateAction<any[]>>;
  setSearchMetadata?: React.Dispatch<React.SetStateAction<any>>;
  jobId?: string;
  includeJD?: boolean;
};

export const createClearChatHandler = (deps: ChatHandlerDeps) => {
  return async () => {
    try {
      // Clear chat messages from state (this includes all message types: search_parameters, enrichments, filters, sorts, etc.)
      deps.setChatMessages([]);
      
      // Clear all localStorage data for this search filter
      if (deps.currentSearchFilterId) {
        clearLocalStorage(deps.currentSearchFilterId, 'chatMessages');
        clearLocalStorage(deps.currentSearchFilterId, 'resolvedParameters');
      }
      
      // Reset all state variables to start fresh for the next search
      deps.setCurrentSearchParameters(null);
      deps.setCurrentEnrichments(null);
      deps.setCurrentFilters(null);
      deps.setCurrentSorts(null);
      deps.setSelectedSearchVariation(null);
      deps.setResolvedParameters({});
      
      // Keep the loaded flags as TRUE to prevent re-loading from database after clear
      // This ensures that enrichments/filters/sorts don't automatically reload
      if (deps.setHasLoadedEnrichments) deps.setHasLoadedEnrichments(true);
      if (deps.setHasLoadedFilters) deps.setHasLoadedFilters(true);
      if (deps.setHasLoadedSorts) deps.setHasLoadedSorts(true);
      
      // Clear chat input
      deps.setChatInput('');
      
      // Reset termination state
      if (deps.setIsTerminated) {
        deps.setIsTerminated(false);
      }
      
      // Create a new search filter for the next iteration
      if (deps.createOneSearchFilterRecord && deps.parsedJD?.id && deps.currentWorkspaceMember?.id) {
        console.log('Creating new search filter after clear...');
        
        const searchFilterName = `${deps.searchConfig.searchType}_${deps.searchConfig.searchCategory}`;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const searchFilterDisplayName = `Search Filter - ${timestamp}`;
        
        const newSearchFilter = await deps.createOneSearchFilterRecord({
          name: searchFilterDisplayName,
          jobId: deps.parsedJD.id,
          recruiterId: deps.currentWorkspaceMember.id,
          searchFilterName,
          searchFilterParameter: {
            generatedSearchParameters: {},
            resolvedSearchParameters: {},
          },
        });
        
        console.log('New search filter created:', newSearchFilter);
        
        // Update parsedJD to add the new search filter at the beginning of the array (making it the active one)
        if (newSearchFilter?.id) {
          deps.setSelectedSearchFilterId(newSearchFilter.id);
          if (deps.parsedJD?.id) {
            localStorage.setItem(
              `lastSelectedSearchFilter_${deps.parsedJD.id}`,
              newSearchFilter.id
            );
          }
          deps.setParsedJD(prev => {
            if (!prev) return null;
            
            // Insert new search filter at the beginning so it becomes the active one
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
          
          deps.enqueueSnackBar(`Chat cleared successfully. New search filter created.`, {
            variant: SnackBarVariant.Success,
          });
        } else {
          deps.enqueueSnackBar('Chat cleared but failed to create new search filter. Please try again.', {
            variant: SnackBarVariant.Warning,
          });
        }
      } else {
        deps.enqueueSnackBar('Chat and all generated data cleared successfully. You can start a new search now.', {
          variant: SnackBarVariant.Success,
        });
      }
    } catch (error) {
      console.error('Error creating new search filter:', error);
      deps.enqueueSnackBar('Chat cleared but failed to create new search filter. Please try again.', {
        variant: SnackBarVariant.Warning,
      });
    }
  };
};

export const createChatSubmitHandler = (deps: ChatHandlerDeps) => {
  return async (userMessage: string, abortController?: AbortController) => {
    try {
      if (!deps.currentSearchFilterId) {
        await deps.addMessage({
          type: 'assistant',
          content: 'Please create a search filter first before I can help you generate search components.',
        });
        return;
      }

      if (!deps.tokenPair?.accessToken?.token) {
        await deps.addMessage({
          type: 'assistant',
          content: 'Authentication token not found. Please refresh the page and try again.',
        });
        return;
      }

      // Construct parsedJobDescription from parsedJD if not available
      const parsedJobDescription = deps.parsedJD.parsedJobDescription || {
        jobTitle: deps.parsedJD.name || '',
        company: deps.parsedJD.companyName || '',
        location: deps.parsedJD.jobLocation || '',
        industry: deps.parsedJD.companyName || '',
        requiredSkills: [],
        preferredSkills: [],
        experienceLevel: 'mid_level' as const,
        education: [],
        keywords: deps.parsedJD.description ? deps.parsedJD.description.split(' ').slice(0, 10) : [],
        responsibilities: [],
        qualifications: [],
        benefits: [],
        employmentType: 'full_time' as const,
        remoteWork: false,
        salaryRange: null,
      };

      const body = {
        searchFilterId: deps.currentSearchFilterId,
        message: userMessage,
        parsedJD: parsedJobDescription,
        searchType: deps.searchConfig.searchType || 'classic',
        searchCategory: deps.searchConfig.searchCategory || 'people',
        sampleResults: [], 
        dataDistribution: {},
        includeJd: deps.includeJD !== false, // Default to true if not specified
      };
      console.log('body to send to server for search filter', JSON.stringify(body, null, 2));

      // Try streaming first, fallback to regular if not supported
      try {
        const response = await handleStreamingResponse(
          process.env.REACT_APP_SERVER_BASE_URL + '/candidate-search/message/stream',
          body,
          deps.tokenPair.accessToken.token,
          deps,
          abortController
        );
        console.log('response from handleStreamingResponse', response);
        return;
      } catch (streamError) {
        // Check if error is due to abort
        if (abortController?.signal.aborted || streamError instanceof Error && streamError.name === 'AbortError') {
          console.log('Stream aborted by user');
          return;
        }
        console.warn('Streaming not available, falling back to regular request:', streamError);
        // Fall through to regular request
      }

      // Call the regular message endpoint as fallback
      const response = await fetch(process.env.REACT_APP_SERVER_BASE_URL+'/candidate-search/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deps.tokenPair.accessToken.token}`,
        },
        body: JSON.stringify(body),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Handle different response types
        switch (result.type) {
          case 'search_parameters':
            if (result.data?.generatedSearchParameters || result.data?.generatedParams) {
              deps.setCurrentSearchParameters(result.data);
              
              // Update parsedJD with search parameters
              deps.setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                
                if (searchFilterIndex !== -1) {
                  // Handle both formats: generatedSearchParameters (direct) or generatedParams (wrapped)
                  const responseData = result.data;
                  
                  // Check if we have generatedParams wrapper (from streaming response)
                  const generatedParamsWrapper = responseData.generatedParams || responseData.generatedSearchParameters || {};
                  
                  // Extract the actual generatedParams - could be nested or direct
                  const actualGeneratedParams = generatedParamsWrapper.generatedParams || generatedParamsWrapper;
                  
                  // Find the parameter key (classicPeopleSearch, etc.)
                  const parameterKeys = [
                    'classicPeopleSearch',
                    'classicCompaniesSearch',
                    'classicJobsSearch',
                    'salesNavigatorPeopleSearch',
                    'salesNavigatorCompaniesSearch',
                    'recruiterPeopleSearch'
                  ];
                  const parameterKey = parameterKeys.find(key => actualGeneratedParams[key]) || 'classicPeopleSearch';
                  
                  // Extract search parameters and strategies
                  const searchParams = actualGeneratedParams[parameterKey] || {};
                  const strategies = actualGeneratedParams.classicPeopleSearchStrategies || 
                                    generatedParamsWrapper.classicPeopleSearchStrategies ||
                                    actualGeneratedParams.strategies ||
                                    generatedParamsWrapper.strategies ||
                                    [];
                  
                  // Merge generatedSearchParameters to preserve strategies array
                  const existingGeneratedParams = updatedSearchFilters[searchFilterIndex].searchFilterParameter?.generatedSearchParameters || {};
                  
                  // Build merged params - ensure both search params and strategies are at top level
                  const mergedGeneratedParams: any = {
                    ...existingGeneratedParams,
                    [parameterKey]: searchParams,
                    // Always include strategies at top level if they exist
                    ...(strategies.length > 0 && {
                      classicPeopleSearchStrategies: strategies
                    }),
                  };
                  
                  console.log('chat-handlers (non-streaming) - Saving search parameters to parsedJD:', {
                    searchFilterId: deps.currentSearchFilterId,
                    parameterKey,
                    strategiesCount: strategies.length,
                    mergedGeneratedParamsKeys: Object.keys(mergedGeneratedParams),
                    hasStrategies: !!mergedGeneratedParams.classicPeopleSearchStrategies,
                    hasSearchParams: !!mergedGeneratedParams[parameterKey]
                  });
                  
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    searchFilterParameter: {
                      ...updatedSearchFilters[searchFilterIndex].searchFilterParameter,
                      generatedSearchParameters: mergedGeneratedParams,
                      resolvedSearchParameters: responseData.resolvedSearchParameters || responseData.resolvedParams,
                    }
                  };
                }
                
                return {
                  ...prev,
                  searchFilters: updatedSearchFilters
                };
              });
            }
            
            await deps.addMessage({
              type: 'search_parameters',
              content: result.chatMessage,
              metadata: {
                searchParameters: {
                  ...result.data,
                  // Ensure strategyResults are included even if nested
                  strategyResults: result.data.strategyResults || 
                                 (result.data.generatedParams?.strategyResults) ||
                                 (result.data.generatedSearchParameters?.strategyResults) ||
                                 undefined,
                },
                actionButtons: [
                  {
                    id: 'generate-enrichments',
                    label: 'Generate Enrichments',
                    action: 'generate_enrichments'
                  }
                ]
              }
            });
            break;

          case 'enrichments':
            if (result.data) {
              deps.setCurrentEnrichments(result.data);
              
              // Update parsedJD with enrichments
              deps.setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                
                if (searchFilterIndex !== -1) {
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    enrichmentConfigs: result.data.enrichments
                  };
                }
                
                return {
                  ...prev,
                  searchFilters: updatedSearchFilters
                };
              });
            }
            
            await deps.addMessage({
              type: 'enrichments',
              content: result.chatMessage,
              metadata: {
                enrichments: result.data,
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
            break;

          case 'filters':
            if (result.data) {
              deps.setCurrentFilters(result.data);
              
              // Update parsedJD with filters
              deps.setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                
                if (searchFilterIndex !== -1) {
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    columnFilters: result.data.handsontableFilters
                  };
                }
                
                return {
                  ...prev,
                  searchFilters: updatedSearchFilters
                };
              });
            }
            
            await deps.addMessage({
              type: 'filters',
              content: result.chatMessage,
              metadata: {
                filters: result.data,
                actionButtons: [
                  {
                    id: 'apply-filters',
                    label: 'Apply Filters',
                    action: 'apply_filters'
                  },
                  {
                    id: 'generate-sorts',
                    label: 'Generate Sorts',
                    action: 'generate_sorts'
                  }
                ]
              }
            });
            break;

          case 'sorts':
            if (result.data) {
              deps.setCurrentSorts(result.data);
              
              // Update parsedJD with sorts
              deps.setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                
                if (searchFilterIndex !== -1) {
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    // Note: columnSortConfigs might need to be added to the type definition
                    columnSortConfigs: result.data.sortStrategy
                  } as any;
                }
                
                return {
                  ...prev,
                  searchFilters: updatedSearchFilters
                };
              });
            }
            
            await deps.addMessage({
              type: 'sorts',
              content: result.chatMessage,
              metadata: {
                sorts: result.data,
                actionButtons: [
                  {
                    id: 'apply-sorts',
                    label: 'Apply Sorts',
                    action: 'apply_sorts'
                  }
                ]
              }
            });
            break;

          case 'complete_plan':
            // Handle complete plan response
            await deps.addMessage({
              type: 'assistant',
              content: result.chatMessage,
              metadata: {
                actionButtons: [
                  {
                    id: 'view-results',
                    label: 'View Results',
                    action: 'view_results'
                  }
                ]
              }
            });
            break;

          default:
            await deps.addMessage({
              type: 'assistant',
              content: result.chatMessage || 'I processed your request successfully.',
            });
        }
      } else {
        await deps.addMessage({
          type: 'assistant',
          content: result.chatMessage || 'Sorry, I encountered an error processing your request.',
        });
      }
    } catch (error) {
      // Don't show error if request was aborted
      if (abortController?.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        console.log('Request aborted by user');
        return;
      }
      console.error('Error processing chat message:', error);
      await deps.addMessage({
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };
};

/**
 * Handle streaming response from the server
 */
async function handleStreamingResponse(
  url: string,
  body: any,
  token: string,
  deps: ChatHandlerDeps,
  abortController?: AbortController
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use fetch with ReadableStream for POST support with Server-Sent Events
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: abortController?.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamingMessageId: string | null = null;
        let accumulatedContent = '';
        let lastStatusMessage: string | null = null;
        let isStreamComplete = false;

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        while (true) {
          // Check if aborted before reading
          if (abortController?.signal.aborted) {
            reader.cancel();
            // Mark current streaming message as complete if exists
            if (streamingMessageId && !isStreamComplete) {
              deps.setChatMessages(prev => 
                prev.map(msg => 
                  msg.id === streamingMessageId 
                    ? { ...msg, isStreaming: false, content: msg.content + '\n\n⚠️ Request terminated by user.' }
                    : msg
                )
              );
            }
            resolve();
            return;
          }

          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          // Check if aborted after reading
          if (abortController?.signal.aborted) {
            reader.cancel();
            // Mark current streaming message as complete if exists
            if (streamingMessageId && !isStreamComplete) {
              deps.setChatMessages(prev => 
                prev.map(msg => 
                  msg.id === streamingMessageId 
                    ? { ...msg, isStreaming: false, content: msg.content + '\n\n⚠️ Request terminated by user.' }
                    : msg
                )
              );
            }
            resolve();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.substring(7).trim();
              continue;
            }

            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                console.log('data in handleStreamingResponse line', {
                  currentEvent,
                  dataType: data.type,
                  hasData: !!data.data,
                  hasSuccess: data.success,
                  hasChatMessage: !!data.chatMessage,
                  dataKeys: data.data ? Object.keys(data.data) : []
                });
                if (currentEvent === 'status' && data.message) {
                  // Status update - create new message if this is a new status or previous stream is complete
                  const isNewStatus = lastStatusMessage !== data.message;
                  if (isNewStatus || isStreamComplete || !streamingMessageId) {
                    // Mark previous stream as complete if it exists
                    if (streamingMessageId && !isStreamComplete) {
                      deps.setChatMessages(prev => 
                        prev.map(msg => 
                          msg.id === streamingMessageId 
                            ? { ...msg, isStreaming: false }
                            : msg
                        )
                      );
                    }
                    
                    // Create a new streaming message for this status
                    streamingMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const streamingMessage: ChatMessage = {
                      id: streamingMessageId,
                      type: 'assistant',
                      content: data.message,
                      timestamp: new Date(),
                      isStreaming: true,
                    };
                    deps.setChatMessages(prev => [...prev, streamingMessage]);
                    accumulatedContent = data.message;
                    lastStatusMessage = data.message;
                    isStreamComplete = false;
                  } else {
                    // Update existing streaming message with same status
                    accumulatedContent = data.message;
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  }
                } else if (currentEvent === 'chunk' && data.content) {
                  // Stream chunk from OpenAI - append to current streaming message
                  if (!streamingMessageId || isStreamComplete) {
                    // Create a new streaming message if one doesn't exist or previous is complete
                    if (streamingMessageId && isStreamComplete) {
                      // Previous stream is complete, create new one
                      streamingMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                      const streamingMessage: ChatMessage = {
                        id: streamingMessageId,
                        type: 'assistant',
                        content: data.content,
                        timestamp: new Date(),
                        isStreaming: true,
                      };
                      deps.setChatMessages(prev => [...prev, streamingMessage]);
                      accumulatedContent = data.content;
                      isStreamComplete = false;
                    } else {
                      // No existing message, create one
                      streamingMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                      const streamingMessage: ChatMessage = {
                        id: streamingMessageId,
                        type: 'assistant',
                        content: data.content,
                        timestamp: new Date(),
                        isStreaming: true,
                      };
                      deps.setChatMessages(prev => [...prev, streamingMessage]);
                      accumulatedContent = data.content;
                    }
                  } else {
                    // Append chunk to existing streaming message
                    accumulatedContent += data.content;
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  }
                } else if (currentEvent === 'classification') {
                  // Classification event - create new message or update current
                  if (!streamingMessageId || isStreamComplete) {
                    // Create new message for classification
                    if (streamingMessageId && isStreamComplete) {
                      streamingMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    } else if (!streamingMessageId) {
                      streamingMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    }
                    const classificationType = data.type;
                    const classificationMessage: ChatMessage = {
                      id: streamingMessageId,
                      type: 'assistant',
                      content: classificationType === 'clarification_response'
                        ? 'Processing your clarification...'
                        : `Analyzing your request... (${classificationType})`,
                      timestamp: new Date(),
                      isStreaming: true,
                    };
                    deps.setChatMessages(prev => [...prev, classificationMessage]);
                    isStreamComplete = false;
                  } else {
                    // Update existing message
                    const classificationType = data.type;
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId
                          ? { 
                              ...msg, 
                              content: classificationType === 'clarification_response'
                                ? 'Processing your clarification...'
                                : `Analyzing your request... (${classificationType})`
                            }
                          : msg
                      )
                    );
                  }
                } else if (currentEvent === 'clarification' && data.questions) {
                  // Clarification event - display questions to user
                  if (streamingMessageId && !isStreamComplete) {
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, isStreaming: false }
                          : msg
                      )
                    );
                    isStreamComplete = true;
                  }

                  const clarificationMessage: ChatMessage = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: 'assistant',
                    content: data.message || 'I need some clarification to generate the best search parameters.',
                    timestamp: new Date(),
                    isStreaming: false,
                    metadata: {
                      clarification: {
                        questions: data.questions || [],
                        ambiguityReasons: data.ambiguityReasons || [],
                      },
                    },
                  };

                  await deps.addMessage(clarificationMessage);
                  
                  // Reset for next stream
                  streamingMessageId = null;
                  accumulatedContent = '';
                  lastStatusMessage = null;
                } else if ((currentEvent === 'message' || data.success === true || (data.type && data.data)) && (data.chatMessage || data.data)) {
                  // Final message with data - mark current stream as complete and create final message
                  // Also handle case where data.success === true indicates a final message even without explicit 'message' event
                  // OR when we have a type and data (indicating a structured response)
                  console.log('=== Entering message/final data handler ===', {
                    currentEvent,
                    dataSuccess: data.success,
                    dataType: data.type,
                    hasChatMessage: !!data.chatMessage,
                    hasData: !!data.data,
                    conditionMatch: 'message/final data handler'
                  });
                  
                  if (streamingMessageId && !isStreamComplete) {
                    // Mark current streaming message as complete
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, isStreaming: false }
                          : msg
                      )
                    );
                    isStreamComplete = true;
                  }
                  console.log('=== handleStreamingResponse - message event received ===', {
                    type: data.type,
                    hasData: !!data.data,
                    dataKeys: data.data ? Object.keys(data.data) : [],
                    hasStrategyResults: !!data.data?.strategyResults,
                    strategyResultsLength: data.data?.strategyResults?.length || 0,
                    hasGeneratedSearchParameters: !!data.data?.generatedSearchParameters,
                    hasResolvedSearchParameters: !!data.data?.resolvedSearchParameters,
                    hasSearchResultsPreview: !!data.data?.searchResultsPreview,
                    hasSetSearchResults: typeof deps.setSearchResults === 'function',
                    hasSetSearchMetadata: typeof deps.setSearchMetadata === 'function',
                    jobId: deps.jobId,
                    fullData: data.data
                  });
                  
                  // Extract strategyResults - they should be at the top level of data.data
                  const strategyResults = data.data?.strategyResults || 
                                         (data.data?.generatedParams?.strategyResults) ||
                                         (data.data?.generatedSearchParameters?.strategyResults) ||
                                         undefined;
                  
                  console.log('=== Extracted strategyResults ===', {
                    found: !!strategyResults,
                    length: strategyResults?.length || 0,
                    strategies: strategyResults?.map((sr: any) => ({
                      strategyId: sr.strategy?.id,
                      strategyLabel: sr.strategy?.label,
                      hasPreview: !!sr.preview,
                      previewItemCount: sr.preview?.itemCount,
                      hasTransformedCandidates: !!sr.preview?.transformedCandidates,
                      transformedCandidatesLength: sr.preview?.transformedCandidates?.length || 0
                    }))
                  });
                  
                  // Create a new final message (don't overwrite the streaming one)
                  await deps.addMessage({
                    type: (data.type as any) || 'assistant',
                    content: data.chatMessage || accumulatedContent || 'Processing complete.',
                    metadata: data.data ? {
                      searchParameters: data.type === 'search_parameters' ? {
                        ...data.data,
                        // Ensure strategyResults are included at top level
                        strategyResults: strategyResults,
                      } : undefined,
                      enrichments: data.type === 'enrichments' ? data.data : undefined,
                      filters: data.type === 'filters' ? data.data : undefined,
                      sorts: data.type === 'sorts' ? data.data : undefined,
                      actionButtons: getActionButtons(data.type),
                    } : undefined,
                  });
                  
                  console.log('=== Message added with metadata ===', {
                    type: data.type,
                    hasMetadata: !!data.data,
                    hasSearchParameters: data.type === 'search_parameters' && !!data.data,
                    hasStrategyResultsInMetadata: data.type === 'search_parameters' && !!strategyResults
                  });
                  
                  // Reset for next stream
                  streamingMessageId = null;
                  accumulatedContent = '';
                  lastStatusMessage = null;

                  // Handle data updates
                  console.log('=== Handle data updates - checking conditions ===', {
                    hasData: !!data.data,
                    dataType: data.type,
                    hasGeneratedSearchParameters: !!data.data?.generatedSearchParameters,
                    hasGeneratedParams: !!data.data?.generatedParams,
                    hasSetSearchResults: typeof deps.setSearchResults === 'function',
                    hasSetSearchMetadata: typeof deps.setSearchMetadata === 'function',
                    jobId: deps.jobId,
                    dataKeys: data.data ? Object.keys(data.data) : []
                  });
                  
                  if (data.data) {
                    if (data.type === 'search_parameters' && (data.data.generatedSearchParameters || data.data.generatedParams)) {
                      console.log('=== Entering search_parameters data handling ===');
                      
                      // Extract strategyResults from the response
                      const strategyResults = data.data.strategyResults || 
                                             (data.data.generatedParams?.strategyResults) ||
                                             (data.data.generatedSearchParameters?.strategyResults) ||
                                             undefined;
                      
                      // Extract searchResultsPreview for primary search results
                      const searchResultsPreview = data.data.searchResultsPreview;
                      
                      console.log('=== Auto-appending candidates from search results ===', {
                        hasSearchResultsPreview: !!searchResultsPreview,
                        searchResultsPreviewCandidatesCount: searchResultsPreview?.transformedCandidates?.length || 0,
                        hasStrategyResults: !!strategyResults,
                        strategyResultsLength: strategyResults?.length || 0,
                        totalStrategyCandidates: strategyResults?.reduce((sum: number, sr: any) => {
                          return sum + (sr.preview?.transformedCandidates?.length || 0);
                        }, 0) || 0,
                        hasSetSearchResults: typeof deps.setSearchResults === 'function',
                        setSearchResultsType: typeof deps.setSearchResults
                      });
                      
                      // Automatically append primary search results if available
                      console.log('=== Checking primary search results append conditions ===', {
                        hasTransformedCandidates: !!searchResultsPreview?.transformedCandidates,
                        isArray: Array.isArray(searchResultsPreview?.transformedCandidates),
                        length: searchResultsPreview?.transformedCandidates?.length || 0,
                        hasSetSearchResults: !!deps.setSearchResults,
                        setSearchResultsType: typeof deps.setSearchResults
                      });
                      
                      if (searchResultsPreview?.transformedCandidates && 
                          Array.isArray(searchResultsPreview.transformedCandidates) &&
                          searchResultsPreview.transformedCandidates.length > 0 &&
                          deps.setSearchResults) {
                        console.log('=== Auto-appending primary search results ===', {
                          count: searchResultsPreview.transformedCandidates.length,
                          firstCandidate: searchResultsPreview.transformedCandidates[0] ? {
                            id: searchResultsPreview.transformedCandidates[0].id,
                            tempId: searchResultsPreview.transformedCandidates[0].tempId,
                            fullName: searchResultsPreview.transformedCandidates[0].fullName
                          } : null
                        });
                        try {
                          console.log('=== Calling addSearchResults for primary results ===');
                          addSearchResults(deps.setSearchResults, deps.jobId)(searchResultsPreview.transformedCandidates, (result) => {
                            // Update metadata for primary search
                            if (deps.setSearchMetadata) {
                              deps.setSearchMetadata((prevMetadata: any) => {
                                const newTotalCount = (prevMetadata?.totalCount || 0) + result.added;
                                const newMetadata = {
                                  totalCount: newTotalCount,
                                  currentPage: prevMetadata?.currentPage || 1,
                                  totalPages: Math.ceil(newTotalCount / 10),
                                  cursor: searchResultsPreview.searchResults?.cursor || prevMetadata?.cursor,
                                  searchType: searchResultsPreview.searchMetadata?.searchType || prevMetadata?.searchType,
                                  searchCategory: searchResultsPreview.searchMetadata?.searchCategory || prevMetadata?.searchCategory,
                                  searchParameters: prevMetadata?.searchParameters,
                                };
                                persistSearchMetadataToStorage(newMetadata, deps.jobId);
                                return newMetadata;
                              });
                            }
                            
                            // Show success message with added count
                            if (result.added > 0) {
                              deps.enqueueSnackBar(
                                `Added ${result.added} candidate${result.added !== 1 ? 's' : ''} from primary search to results`,
                                { variant: SnackBarVariant.Success }
                              );
                            }
                            
                            // Show duplicate message if there are duplicates
                            if (result.duplicates > 0) {
                              deps.enqueueSnackBar(
                                `${result.duplicates} duplicate candidate${result.duplicates !== 1 ? 's' : ''} skipped from primary search`,
                                { variant: SnackBarVariant.Info }
                              );
                            }
                          });
                          console.log('=== addSearchResults called for primary results ===');
                        } catch (error) {
                          console.error('=== Error auto-appending primary search results ===', error);
                        }
                      }
                      
                      // Automatically append strategy results if available
                      console.log('=== Checking strategy results append conditions ===', {
                        hasStrategyResults: !!strategyResults,
                        isArray: Array.isArray(strategyResults),
                        length: strategyResults?.length || 0,
                        hasSetSearchResults: !!deps.setSearchResults
                      });
                      
                      if (strategyResults && Array.isArray(strategyResults) && strategyResults.length > 0 && deps.setSearchResults) {
                        let totalStrategyCandidates = 0;
                        const allStrategyCandidates: any[] = [];
                        
                        strategyResults.forEach((sr: any, index: number) => {
                          console.log(`=== Processing strategy ${index} ===`, {
                            strategyId: sr.strategy?.id,
                            strategyLabel: sr.strategy?.label || sr.strategy?.name,
                            hasPreview: !!sr.preview,
                            hasError: !!sr.preview?.error,
                            error: sr.preview?.error,
                            hasTransformedCandidates: !!sr.preview?.transformedCandidates,
                            transformedCandidatesLength: sr.preview?.transformedCandidates?.length || 0
                          });
                          
                          if (sr.preview?.error) {
                            console.warn(`=== Strategy ${sr.strategy?.label || sr.strategy?.name || sr.strategy?.id} failed ===`, {
                              error: sr.preview.error
                            });
                            // Optionally show error notification for failed strategies
                            if (strategyResults.filter((s: any) => s.preview?.error).length === 1) {
                              // Only show if this is the only failed strategy to avoid spam
                              deps.enqueueSnackBar(
                                `Search failed for "${sr.strategy?.label || sr.strategy?.name || 'strategy'}": ${sr.preview.error.details || sr.preview.error.message}`,
                                { variant: SnackBarVariant.Error }
                              );
                            }
                          } else if (sr.preview?.transformedCandidates && Array.isArray(sr.preview.transformedCandidates)) {
                            allStrategyCandidates.push(...sr.preview.transformedCandidates);
                            totalStrategyCandidates += sr.preview.transformedCandidates.length;
                          }
                        });
                        
                        console.log('=== Strategy candidates collection complete ===', {
                          totalCandidatesCollected: allStrategyCandidates.length,
                          strategiesWithResults: strategyResults.filter((sr: any) => sr.preview?.transformedCandidates?.length > 0).length
                        });
                        
                        if (allStrategyCandidates.length > 0) {
                          console.log('=== Auto-appending strategy search results ===', {
                            totalCandidates: allStrategyCandidates.length,
                            strategiesWithResults: strategyResults.filter((sr: any) => sr.preview?.transformedCandidates?.length > 0).length,
                            firstCandidate: allStrategyCandidates[0] ? {
                              id: allStrategyCandidates[0].id,
                              tempId: allStrategyCandidates[0].tempId,
                              fullName: allStrategyCandidates[0].fullName
                            } : null
                          });
                          
                          try {
                            console.log('=== Calling addSearchResults for strategy results ===');
                            addSearchResults(deps.setSearchResults, deps.jobId)(allStrategyCandidates, (result) => {
                              // Update metadata for strategy results
                              if (deps.setSearchMetadata) {
                                deps.setSearchMetadata((prevMetadata: any) => {
                                  const newTotalCount = (prevMetadata?.totalCount || 0) + result.added;
                                  const newMetadata = {
                                    totalCount: newTotalCount,
                                    currentPage: prevMetadata?.currentPage || 1,
                                    totalPages: Math.ceil(newTotalCount / 10),
                                    cursor: prevMetadata?.cursor,
                                    searchType: prevMetadata?.searchType,
                                    searchCategory: prevMetadata?.searchCategory,
                                    searchParameters: prevMetadata?.searchParameters,
                                  };
                                  persistSearchMetadataToStorage(newMetadata);
                                  return newMetadata;
                                });
                              }
                              
                              // Show success message with added count
                              if (result.added > 0) {
                                deps.enqueueSnackBar(
                                  `Added ${result.added} candidate${result.added !== 1 ? 's' : ''} from ${strategyResults.filter((sr: any) => sr.preview?.transformedCandidates?.length > 0).length} strateg${strategyResults.filter((sr: any) => sr.preview?.transformedCandidates?.length > 0).length !== 1 ? 'ies' : 'y'} to results`,
                                  { variant: SnackBarVariant.Success }
                                );
                              }
                              
                              // Show duplicate message if there are duplicates
                              if (result.duplicates > 0) {
                                deps.enqueueSnackBar(
                                  `${result.duplicates} duplicate candidate${result.duplicates !== 1 ? 's' : ''} skipped from strateg${strategyResults.filter((sr: any) => sr.preview?.transformedCandidates?.length > 0).length !== 1 ? 'ies' : 'y'}`,
                                  { variant: SnackBarVariant.Info }
                                );
                              }
                            });
                            console.log('=== addSearchResults called for strategy results ===');
                          } catch (error) {
                            console.error('=== Error auto-appending strategy results ===', error);
                          }
                        }
                      }
                      
                      console.log('=== Setting currentSearchParameters with strategyResults ===', {
                        hasStrategyResults: !!strategyResults,
                        strategyResultsLength: strategyResults?.length || 0,
                        dataKeys: Object.keys(data.data)
                      });
                      
                      // Ensure strategyResults are included in currentSearchParameters
                      const searchParamsData = {
                        ...data.data,
                        strategyResults: strategyResults,
                      };
                      deps.setCurrentSearchParameters(searchParamsData);
                      deps.setParsedJD(prev => {
                        if (!prev) return null;
                        const updatedSearchFilters = [...(prev.searchFilters || [])];
                        const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                        
                        console.log('chat-handlers (streaming) - Processing search parameters:', {
                          currentSearchFilterId: deps.currentSearchFilterId,
                          searchFilterIndex,
                          availableFilterIds: updatedSearchFilters.map(sf => sf.id),
                          hasGeneratedParams: !!data.data.generatedParams,
                          hasGeneratedSearchParameters: !!data.data.generatedSearchParameters,
                          dataKeys: Object.keys(data.data)
                        });
                        
                        if (searchFilterIndex !== -1) {
                          // Handle both formats: generatedSearchParameters (direct) or generatedParams (wrapped)
                          const responseData = data.data;
                          
                          // Check if we have generatedParams wrapper (from streaming response)
                          const generatedParamsWrapper = responseData.generatedParams || responseData.generatedSearchParameters || {};
                          
                          console.log('chat-handlers (streaming) - Extracting parameters:', {
                            generatedParamsWrapperKeys: Object.keys(generatedParamsWrapper),
                            hasNestedGeneratedParams: !!generatedParamsWrapper.generatedParams,
                            hasClassicPeopleSearch: !!generatedParamsWrapper.classicPeopleSearch,
                            hasStrategies: !!generatedParamsWrapper.classicPeopleSearchStrategies
                          });
                          
                          // Extract the actual generatedParams - could be nested or direct
                          const actualGeneratedParams = generatedParamsWrapper.generatedParams || generatedParamsWrapper;
                          
                          // Find the parameter key (classicPeopleSearch, etc.)
                          const parameterKeys = [
                            'classicPeopleSearch',
                            'classicCompaniesSearch',
                            'classicJobsSearch',
                            'salesNavigatorPeopleSearch',
                            'salesNavigatorCompaniesSearch',
                            'recruiterPeopleSearch'
                          ];
                          const parameterKey = parameterKeys.find(key => actualGeneratedParams[key]) || 'classicPeopleSearch';
                          
                          // Extract search parameters and strategies
                          const searchParams = actualGeneratedParams[parameterKey] || {};
                          const strategies = actualGeneratedParams.classicPeopleSearchStrategies || 
                                            generatedParamsWrapper.classicPeopleSearchStrategies ||
                                            actualGeneratedParams.strategies ||
                                            generatedParamsWrapper.strategies ||
                                            [];
                          
                          console.log('chat-handlers (streaming) - Extracted data:', {
                            parameterKey,
                            hasSearchParams: !!searchParams && Object.keys(searchParams).length > 0,
                            searchParamsKeys: Object.keys(searchParams),
                            strategiesCount: strategies.length,
                            strategiesSource: strategies.length > 0 ? (
                              actualGeneratedParams.classicPeopleSearchStrategies ? 'actualGeneratedParams' :
                              generatedParamsWrapper.classicPeopleSearchStrategies ? 'generatedParamsWrapper' :
                              'other'
                            ) : 'none'
                          });
                          
                          // Merge generatedSearchParameters to preserve strategies array
                          const existingGeneratedParams = updatedSearchFilters[searchFilterIndex].searchFilterParameter?.generatedSearchParameters || {};
                          
                          // Build merged params - ensure both search params and strategies are at top level
                          const mergedGeneratedParams: any = {
                            ...existingGeneratedParams,
                            [parameterKey]: searchParams,
                            // Always include strategies at top level if they exist
                            ...(strategies.length > 0 && {
                              classicPeopleSearchStrategies: strategies
                            }),
                          };
                          
                          console.log('chat-handlers (streaming) - Saving search parameters to parsedJD:', {
                            searchFilterId: deps.currentSearchFilterId,
                            parameterKey,
                            strategiesCount: strategies.length,
                            mergedGeneratedParamsKeys: Object.keys(mergedGeneratedParams),
                            hasStrategies: !!mergedGeneratedParams.classicPeopleSearchStrategies,
                            hasSearchParams: !!mergedGeneratedParams[parameterKey],
                            mergedGeneratedParams
                          });
                          
                          updatedSearchFilters[searchFilterIndex] = {
                            ...updatedSearchFilters[searchFilterIndex],
                            searchFilterParameter: {
                              ...updatedSearchFilters[searchFilterIndex].searchFilterParameter,
                              generatedSearchParameters: mergedGeneratedParams,
                              resolvedSearchParameters: responseData.resolvedSearchParameters || responseData.resolvedParams,
                            }
                          };
                        } else {
                          console.warn('chat-handlers (streaming) - Search filter not found:', {
                            currentSearchFilterId: deps.currentSearchFilterId,
                            availableFilterIds: updatedSearchFilters.map(sf => sf.id)
                          });
                        }
                        return { ...prev, searchFilters: updatedSearchFilters };
                      });
                    } else if (data.type === 'enrichments' && data.data) {
                      deps.setCurrentEnrichments(data.data);
                      deps.setParsedJD(prev => {
                        if (!prev) return null;
                        const updatedSearchFilters = [...(prev.searchFilters || [])];
                        const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                        if (searchFilterIndex !== -1) {
                          updatedSearchFilters[searchFilterIndex] = {
                            ...updatedSearchFilters[searchFilterIndex],
                            enrichmentConfigs: data.data.enrichments
                          };
                        }
                        return { ...prev, searchFilters: updatedSearchFilters };
                      });
                    } else if (data.type === 'filters' && data.data) {
                      deps.setCurrentFilters(data.data);
                      deps.setParsedJD(prev => {
                        if (!prev) return null;
                        const updatedSearchFilters = [...(prev.searchFilters || [])];
                        const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                        if (searchFilterIndex !== -1) {
                          updatedSearchFilters[searchFilterIndex] = {
                            ...updatedSearchFilters[searchFilterIndex],
                            columnFilters: data.data.handsontableFilters
                          };
                        }
                        return { ...prev, searchFilters: updatedSearchFilters };
                      });
                    } else if (data.type === 'sorts' && data.data) {
                      deps.setCurrentSorts(data.data);
                      deps.setParsedJD(prev => {
                        if (!prev) return null;
                        const updatedSearchFilters = [...(prev.searchFilters || [])];
                        const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                        if (searchFilterIndex !== -1) {
                          updatedSearchFilters[searchFilterIndex] = {
                            ...updatedSearchFilters[searchFilterIndex],
                            columnSortConfigs: data.data.sortStrategy
                          } as any;
                        }
                        return { ...prev, searchFilters: updatedSearchFilters };
                      });
                    }
                  }
                } else if (currentEvent === 'error' && data.error) {
                  // Error event - mark current stream as complete and create error message
                  if (streamingMessageId && !isStreamComplete) {
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, isStreaming: false }
                          : msg
                      )
                    );
                    isStreamComplete = true;
                  }
                  
                  // Create new error message
                  await deps.addMessage({
                    type: 'assistant',
                    content: data.chatMessage || data.error,
                  });
                  
                  streamingMessageId = null;
                  accumulatedContent = '';
                  lastStatusMessage = null;
                } else if (currentEvent === 'candidateScoringBatch') {
                  // Candidate scoring batch event - show batch progress
                  const batchMessage = data.message || 
                    (data.status === 'started' 
                      ? `Starting to score ${data.totalCandidates} candidates...`
                      : data.status === 'completed'
                      ? `Completed scoring ${data.completedCount || data.totalCandidates} candidates${data.averageScore ? ` (average relevance: ${(data.averageScore * 100).toFixed(0)}%)` : ''}`
                      : 'Scoring candidates...');
                  
                  // Update or create status message for batch scoring
                  if (!streamingMessageId || isStreamComplete) {
                    streamingMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const batchScoringMessage: ChatMessage = {
                      id: streamingMessageId,
                      type: 'assistant',
                      content: batchMessage,
                      timestamp: new Date(),
                      isStreaming: data.status === 'started',
                    };
                    deps.setChatMessages(prev => [...prev, batchScoringMessage]);
                    isStreamComplete = data.status === 'completed';
                  } else {
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { 
                              ...msg, 
                              content: batchMessage,
                              isStreaming: data.status !== 'completed'
                            }
                          : msg
                      )
                    );
                    if (data.status === 'completed') {
                      isStreamComplete = true;
                    }
                  }
                } else if (currentEvent === 'candidateScoringChunk') {
                  // Candidate-specific reasoning chunk - stream reasoning for individual candidate in parallel
                  const candidateScoringMessageId = `candidate-scoring-${data.candidateIndex}`;
                  
                  // Update or create message with streaming reasoning
                  deps.setChatMessages(prev => {
                    const existingIndex = prev.findIndex(msg => msg.id === candidateScoringMessageId);
                    if (existingIndex === -1) {
                      // Create new message for this candidate with initial content
                      const header = `🔍 Candidate ${data.candidateIndex}/${data.totalCandidates}: ${data.candidateName}\n`;
                      const candidateScoringMessage: ChatMessage = {
                        id: candidateScoringMessageId,
                        type: 'assistant',
                        content: `${header}Reasoning: ${data.content || ''}`,
                        timestamp: new Date(),
                        isStreaming: true,
                      };
                      return [...prev, candidateScoringMessage];
                    } else {
                      // Append chunk to existing message's reasoning
                      return prev.map(msg => {
                        if (msg.id === candidateScoringMessageId) {
                          // Extract header and existing reasoning, append new chunk
                          const parts = msg.content.split('Reasoning:');
                          const header = parts[0] || `🔍 Candidate ${data.candidateIndex}/${data.totalCandidates}: ${data.candidateName}\n`;
                          const existingReasoning = parts[1] || '';
                          return {
                            ...msg,
                            content: `${header}Reasoning: ${existingReasoning}${data.content || ''}`,
                            isStreaming: true,
                          };
                        }
                        return msg;
                      });
                    }
                  });
                } else if (currentEvent === 'candidateScoring') {
                  // Individual candidate scoring event - show progress for each candidate
                  const candidateScoringMessageId = `candidate-scoring-${data.candidateIndex}`;
                  
                  // Update or create message for this candidate
                  deps.setChatMessages(prev => {
                    const existingIndex = prev.findIndex(msg => msg.id === candidateScoringMessageId);
                    
                    if (data.status === 'analyzing') {
                      // Initial analyzing state
                      const analyzingMessage = `🔍 Analyzing candidate ${data.candidateIndex}/${data.totalCandidates}: ${data.candidateName}${data.candidateTitle ? ` (${data.candidateTitle})` : ''}${data.candidateCompany ? ` at ${data.candidateCompany}` : ''}...`;
                      
                      if (existingIndex === -1) {
                        // Create new message for this candidate
                        const candidateScoringMessage: ChatMessage = {
                          id: candidateScoringMessageId,
                          type: 'assistant',
                          content: analyzingMessage,
                          timestamp: new Date(),
                          isStreaming: true,
                        };
                        return [...prev, candidateScoringMessage];
                      } else {
                        // Update existing message
                        return prev.map(msg => 
                          msg.id === candidateScoringMessageId 
                            ? { ...msg, content: analyzingMessage, isStreaming: true }
                            : msg
                        );
                      }
                    } else if (data.status === 'completed' && data.score) {
                      // Completed state - show score and preserve any streamed reasoning
                      const scoreSummary = `✓ Candidate ${data.candidateIndex}/${data.totalCandidates}: ${data.candidateName} - ${(data.score.relevanceScore * 100).toFixed(0)}% relevant${data.score.relevanceLabel ? ` (${data.score.relevanceLabel.replace('_', ' ')})` : ''}`;
                      
                      if (existingIndex === -1) {
                        // Create new message with score
                        const finalContent = data.score.reasoning 
                          ? `${scoreSummary}\n\nReasoning: ${data.score.reasoning}`
                          : scoreSummary;
                        const candidateScoringMessage: ChatMessage = {
                          id: candidateScoringMessageId,
                          type: 'assistant',
                          content: finalContent,
                          timestamp: new Date(),
                          isStreaming: false,
                        };
                        return [...prev, candidateScoringMessage];
                      } else {
                        // Update existing message - preserve streamed reasoning if available
                        return prev.map(msg => {
                          if (msg.id === candidateScoringMessageId) {
                            // Check if we have streamed reasoning
                            const hasStreamedReasoning = msg.content.includes('Reasoning:') && msg.content.split('Reasoning:')[1].trim().length > 0;
                            const streamedReasoning = hasStreamedReasoning ? msg.content.split('Reasoning:')[1].trim() : '';
                            
                            // Use streamed reasoning if available, otherwise use score reasoning
                            const reasoning = streamedReasoning || data.score.reasoning || '';
                            const finalContent = reasoning 
                              ? `${scoreSummary}\n\nReasoning: ${reasoning}`
                              : scoreSummary;
                            
                            return {
                              ...msg,
                              content: finalContent,
                              isStreaming: false,
                            };
                          }
                          return msg;
                        });
                      }
                    } else if (data.status === 'error') {
                      // Error state
                      const errorMessage = `✗ Error scoring candidate ${data.candidateIndex}/${data.totalCandidates}: ${data.candidateName}`;
                      
                      if (existingIndex === -1) {
                        const candidateScoringMessage: ChatMessage = {
                          id: candidateScoringMessageId,
                          type: 'assistant',
                          content: errorMessage,
                          timestamp: new Date(),
                          isStreaming: false,
                        };
                        return [...prev, candidateScoringMessage];
                      } else {
                        return prev.map(msg => 
                          msg.id === candidateScoringMessageId 
                            ? { ...msg, content: errorMessage, isStreaming: false }
                            : msg
                        );
                      }
                    }
                    
                    return prev;
                  });
                } else if (currentEvent === 'validation') {
                  // Validation event - show validation results
                  // Always create a new message for validation (don't update existing streaming messages)
                  const validationMessage = data.message || 
                    `Validation: ${data.validation?.qualityAssessment || 'medium'} quality, ${data.validation?.relevanceScore ? (data.validation.relevanceScore * 100).toFixed(0) : 'N/A'}% relevance`;
                  
                  // Mark previous streaming message as complete if it exists
                  if (streamingMessageId && !isStreamComplete) {
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, isStreaming: false }
                          : msg
                      )
                    );
                    isStreamComplete = true;
                  }
                  
                  // Create a new dedicated validation message
                  const validationMessageId = `validation-${data.page || 'all'}-${Date.now()}`;
                  const validationMsg: ChatMessage = {
                    id: validationMessageId,
                    type: 'assistant',
                    content: validationMessage,
                    timestamp: new Date(),
                    isStreaming: false,
                  };
                  deps.setChatMessages(prev => [...prev, validationMsg]);
                  
                  // Reset streaming state for next message
                  streamingMessageId = null;
                  accumulatedContent = '';
                  lastStatusMessage = null;
                } else if (currentEvent === 'pageResults') {
                  // Page results event - show pagination progress
                  const pageMessage = `Page ${data.page}: Received ${data.candidatesReceived} candidates (total: ${data.totalCandidates})${data.strategyLabel ? ` for strategy: ${data.strategyLabel}` : ''}`;
                  
                  // Update status message with page results
                  if (streamingMessageId && !isStreamComplete) {
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, content: `${msg.content}\n${pageMessage}` }
                          : msg
                      )
                    );
                  } else {
                    // Create new message if needed
                    streamingMessageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const pageResultsMessage: ChatMessage = {
                      id: streamingMessageId,
                      type: 'assistant',
                      content: pageMessage,
                      timestamp: new Date(),
                      isStreaming: true,
                    };
                    deps.setChatMessages(prev => [...prev, pageResultsMessage]);
                    isStreamComplete = false;
                  }
                } else if (currentEvent === 'done') {
                  // Stream complete - mark current message as not streaming
                  if (streamingMessageId && !isStreamComplete) {
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, isStreaming: false }
                          : msg
                      )
                    );
                    isStreamComplete = true;
                  }
                } else if (data.success === true && data.type === 'search_parameters' && data.data) {
                  // Catch-all for search_parameters with success=true that might not have matched other conditions
                  // This ensures we always process the final data and auto-append candidates
                  console.log('=== Catch-all handler for search_parameters ===', {
                    currentEvent,
                    dataSuccess: data.success,
                    dataType: data.type,
                    hasData: !!data.data,
                    hasSearchResultsPreview: !!data.data.searchResultsPreview,
                    hasStrategyResults: !!data.data.strategyResults
                  });
                  
                  // Process the same way as the main message handler
                  if (streamingMessageId && !isStreamComplete) {
                    deps.setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, isStreaming: false }
                          : msg
                      )
                    );
                    isStreamComplete = true;
                  }
                  
                  // Extract and process candidates
                  const strategyResults = data.data.strategyResults || 
                                         (data.data.generatedParams?.strategyResults) ||
                                         (data.data.generatedSearchParameters?.strategyResults) ||
                                         undefined;
                  
                  const searchResultsPreview = data.data.searchResultsPreview;
                  
                  // Auto-append primary search results
                  if (searchResultsPreview?.transformedCandidates && 
                      Array.isArray(searchResultsPreview.transformedCandidates) &&
                      searchResultsPreview.transformedCandidates.length > 0 &&
                      deps.setSearchResults) {
                    console.log('=== Catch-all: Auto-appending primary search results ===', {
                      count: searchResultsPreview.transformedCandidates.length
                    });
                    try {
                      addSearchResults(deps.setSearchResults, deps.jobId)(searchResultsPreview.transformedCandidates, (result) => {
                        if (deps.setSearchMetadata) {
                          deps.setSearchMetadata((prevMetadata: any) => {
                            const newTotalCount = (prevMetadata?.totalCount || 0) + result.added;
                            const newMetadata = {
                              totalCount: newTotalCount,
                              currentPage: prevMetadata?.currentPage || 1,
                              totalPages: Math.ceil(newTotalCount / 10),
                              cursor: searchResultsPreview.searchResults?.cursor || prevMetadata?.cursor,
                              searchType: searchResultsPreview.searchMetadata?.searchType || prevMetadata?.searchType,
                              searchCategory: searchResultsPreview.searchMetadata?.searchCategory || prevMetadata?.searchCategory,
                              searchParameters: prevMetadata?.searchParameters,
                            };
                            persistSearchMetadataToStorage(newMetadata);
                            return newMetadata;
                          });
                        }
                        
                        // Show success message with added count
                        if (result.added > 0) {
                          deps.enqueueSnackBar(
                            `Added ${result.added} candidate${result.added !== 1 ? 's' : ''} from primary search to results`,
                            { variant: SnackBarVariant.Success }
                          );
                        }
                        
                        // Show duplicate message if there are duplicates
                        if (result.duplicates > 0) {
                          deps.enqueueSnackBar(
                            `${result.duplicates} duplicate candidate${result.duplicates !== 1 ? 's' : ''} skipped from primary search`,
                            { variant: SnackBarVariant.Info }
                          );
                        }
                      });
                    } catch (error) {
                      console.error('=== Catch-all: Error auto-appending primary search results ===', error);
                    }
                  }
                  
                  // Auto-append strategy results
                  if (strategyResults && Array.isArray(strategyResults) && strategyResults.length > 0 && deps.setSearchResults) {
                    const allStrategyCandidates: any[] = [];
                    
                    strategyResults.forEach((sr: any) => {
                      if (sr.preview?.transformedCandidates && Array.isArray(sr.preview.transformedCandidates)) {
                        allStrategyCandidates.push(...sr.preview.transformedCandidates);
                      }
                    });
                    
                    if (allStrategyCandidates.length > 0) {
                      console.log('=== Catch-all: Auto-appending strategy search results ===', {
                        totalCandidates: allStrategyCandidates.length
                      });
                      
                      try {
                        addSearchResults(deps.setSearchResults, deps.jobId)(allStrategyCandidates, (result) => {
                          if (deps.setSearchMetadata) {
                            deps.setSearchMetadata((prevMetadata: any) => {
                              const newTotalCount = (prevMetadata?.totalCount || 0) + result.added;
                              const newMetadata = {
                                totalCount: newTotalCount,
                                currentPage: prevMetadata?.currentPage || 1,
                                totalPages: Math.ceil(newTotalCount / 10),
                                cursor: prevMetadata?.cursor,
                                searchType: prevMetadata?.searchType,
                                searchCategory: prevMetadata?.searchCategory,
                                searchParameters: prevMetadata?.searchParameters,
                              };
                              persistSearchMetadataToStorage(newMetadata);
                              return newMetadata;
                            });
                          }
                          
                          // Show success message with added count
                          if (result.added > 0) {
                            deps.enqueueSnackBar(
                              `Added ${result.added} candidate${result.added !== 1 ? 's' : ''} from ${strategyResults.filter((sr: any) => sr.preview?.transformedCandidates?.length > 0).length} strateg${strategyResults.filter((sr: any) => sr.preview?.transformedCandidates?.length > 0).length !== 1 ? 'ies' : 'y'} to results`,
                              { variant: SnackBarVariant.Success }
                            );
                          }
                          
                          // Show duplicate message if there are duplicates
                          if (result.duplicates > 0) {
                            deps.enqueueSnackBar(
                              `${result.duplicates} duplicate candidate${result.duplicates !== 1 ? 's' : ''} skipped from strateg${strategyResults.filter((sr: any) => sr.preview?.transformedCandidates?.length > 0).length !== 1 ? 'ies' : 'y'}`,
                              { variant: SnackBarVariant.Info }
                            );
                          }
                        });
                      } catch (error) {
                        console.error('=== Catch-all: Error auto-appending strategy results ===', error);
                      }
                    }
                  }
                  
                  // Also add the message
                  await deps.addMessage({
                    type: 'search_parameters',
                    content: data.chatMessage || 'Generated search parameters.',
                    metadata: {
                      searchParameters: {
                        ...data.data,
                        strategyResults: strategyResults,
                      },
                      actionButtons: getActionButtons('search_parameters'),
                    },
                  });
                  
                  streamingMessageId = null;
                  accumulatedContent = '';
                  lastStatusMessage = null;
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
        }

        resolve();
      })
      .catch((error) => {
        // Don't reject if request was aborted
        if (abortController?.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          console.log('Stream aborted by user');
          resolve();
          return;
        }
        console.error('Streaming error:', error);
        reject(error);
      });
  });
}

function getActionButtons(type: string): Array<{ id: string; label: string; action: string }> {
  switch (type) {
    case 'search_parameters':
      return [
        { id: 'generate-enrichments', label: 'Generate Enrichments', action: 'generate_enrichments' }
      ];
    case 'enrichments':
      return [
        { id: 'execute-enrichments', label: 'Execute Enrichments', action: 'execute_enrichments' },
        { id: 'generate-filters', label: 'Generate Filters', action: 'generate_filters' }
      ];
    case 'filters':
      return [
        { id: 'apply-filters', label: 'Apply Filters', action: 'apply_filters' },
        { id: 'generate-sorts', label: 'Generate Sorts', action: 'generate_sorts' }
      ];
    case 'sorts':
      return [
        { id: 'apply-sorts', label: 'Apply Sorts', action: 'apply_sorts' }
      ];
    default:
      return [];
  }
}