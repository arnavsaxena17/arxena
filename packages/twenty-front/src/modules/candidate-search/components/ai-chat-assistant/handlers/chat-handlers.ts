import type { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
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
  setParsedJD: React.Dispatch<React.SetStateAction<ParsedJD | null>>;
  currentSearchFilterId: string;
  setHasLoadedEnrichments?: (hasLoaded: boolean) => void;
  setHasLoadedFilters?: (hasLoaded: boolean) => void;
  setHasLoadedSorts?: (hasLoaded: boolean) => void;
  createOneSearchFilterRecord?: (data: any) => Promise<any>;
  currentWorkspaceMember?: { id: string } | null;
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
          
          deps.enqueueSnackBar(`Chat cleared successfully. New search filter "${searchFilterDisplayName}" created.`, {
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
  return async (userMessage: string) => {
    try {
      if (!deps.parsedJD?.searchFilters?.[0]?.id) {
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
      };
      console.log('body to send to server for search filter', JSON.stringify(body, null, 2));

      // Call the message endpoint
      const response = await fetch(process.env.REACT_APP_SERVER_BASE_URL+'/candidate-search/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deps.tokenPair.accessToken.token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Handle different response types
        switch (result.type) {
          case 'search_parameters':
            if (result.data?.generatedSearchParameters) {
              deps.setCurrentSearchParameters(result.data);
              
              // Update parsedJD with search parameters
              deps.setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
                
                if (searchFilterIndex !== -1) {
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    searchFilterParameter: {
                      ...updatedSearchFilters[searchFilterIndex].searchFilterParameter,
                      generatedSearchParameters: result.data.generatedSearchParameters,
                      resolvedSearchParameters: result.data.resolvedSearchParameters,
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
                searchParameters: result.data,
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
      console.error('Error processing chat message:', error);
      await deps.addMessage({
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };
};

