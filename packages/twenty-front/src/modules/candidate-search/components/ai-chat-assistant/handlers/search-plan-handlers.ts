import type { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import type { EnrichmentsResponse, FiltersResponse, SearchParametersResponse, SortsResponse } from '@/candidate-search/types/candidate-search.types';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import type { ChatMessage } from '../types/chat-message.types';
import { saveToLocalStorage } from '../utils/storage-helpers';

type SearchPlanGenerationService = {
  generateSearchParameters: (searchFilterId: string, searchType: 'classic' | 'sales_navigator' | 'recruiter', searchCategory: 'people' | 'companies' | 'jobs') => Promise<SearchParametersResponse | null>;
  generateEnrichments: (searchFilterId: string) => Promise<EnrichmentsResponse | null>;
  generateFilters: (searchFilterId: string, enrichments: EnrichmentsResponse) => Promise<FiltersResponse | null>;
  generateSorts: (searchFilterId: string, searchParams: SearchParametersResponse, enrichments: EnrichmentsResponse, filters: FiltersResponse) => Promise<SortsResponse | null>;
  isGenerating: boolean;
};

type SearchPlanHandlerDeps = {
  parsedJD: ParsedJD;
  searchPlanGeneration: SearchPlanGenerationService;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>;
  enqueueSnackBar: (message: string, options: { variant: SnackBarVariant }) => void;
  setCurrentSearchParameters: (params: SearchParametersResponse | null) => void;
  setCurrentEnrichments: (enrichments: EnrichmentsResponse | null) => void;
  setCurrentFilters: (filters: FiltersResponse | null) => void;
  setCurrentSorts: (sorts: SortsResponse | null) => void;
  setResolvedParameters: React.Dispatch<React.SetStateAction<any>>;
  setParsedJD: React.Dispatch<React.SetStateAction<ParsedJD | null>>;
  currentSearchFilterId: string;
  currentSearchParameters: SearchParametersResponse | null;
  currentEnrichments: EnrichmentsResponse | null;
  searchConfig: { searchType: string; searchCategory: string };
  hasExistingSearchParameters: () => boolean;
  hasExistingEnrichments: () => boolean;
};

export const createSearchParametersHandler = (deps: SearchPlanHandlerDeps) => {
  return async (
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs'
  ) => {
    if (!deps.currentSearchFilterId) {
      deps.enqueueSnackBar('No search filter found. Please create a search filter first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      const result = await deps.searchPlanGeneration.generateSearchParameters(
        deps.currentSearchFilterId,
        searchType,
        searchCategory
      );
      console.log(`handleGenerateSearchParameters - Result: ${JSON.stringify(result, null, 2)}`);

      if (result) {
        deps.setCurrentSearchParameters(result);
        
        // Update resolved parameters with the resolved search parameters (LinkedIn IDs + display info)
        const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
        const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
        const resolvedParams = result.variations[0]?.resolvedSearchParameters || {};
        
        console.log('AIChatAssistant - Setting resolved parameters:', {
          parameterKey,
          resolvedParams,
        });
        
        deps.setResolvedParameters((prevResolved: any) => {
          const updated = {
            ...prevResolved,
            [parameterKey]: resolvedParams
          };
          console.log('AIChatAssistant - Updated resolved parameters:', updated);
          
          // Save to localStorage for persistence
          if (deps.currentSearchFilterId) {
            saveToLocalStorage(deps.currentSearchFilterId, 'resolvedParameters', updated);
          }
          
          return updated;
        });
        
        // Also update parsedJD state to ensure PRIORITY 1 in resolvedParametersSelector returns correct data
        if (deps.currentSearchFilterId) {
          deps.setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchFilters = [...(prev.searchFilters || [])];
            const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
            
            if (searchFilterIndex !== -1) {
              updatedSearchFilters[searchFilterIndex] = {
                ...updatedSearchFilters[searchFilterIndex],
                searchFilterParameter: {
                  ...updatedSearchFilters[searchFilterIndex].searchFilterParameter,
                  generatedSearchParameters: {
                    ...updatedSearchFilters[searchFilterIndex].searchFilterParameter?.generatedSearchParameters,
                    [parameterKey]: result.variations[0]?.searchParameters
                  },
                  resolvedSearchParameters: {
                    ...updatedSearchFilters[searchFilterIndex].searchFilterParameter?.resolvedSearchParameters,
                    [parameterKey]: resolvedParams
                  }
                }
              };
              
              console.log('AIChatAssistant - Updated parsedJD with resolved parameters:', {
                parameterKey,
                resolvedParams,
                searchFilterId: deps.currentSearchFilterId
              });
            }
            
            return {
              ...prev,
              searchFilters: updatedSearchFilters
            };
          });
        }
        
        await deps.addMessage({
          type: 'search_parameters',
          content: `Generated ${result.variations.length} search strategy variations for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`,
          metadata: {
            searchParameters: result,
            actionButtons: [
              {
                id: 'select-variation',
                label: 'Select Variation',
                action: 'select_search_variation'
              },
              {
                id: 'generate-enrichments',
                label: 'Generate Enrichments',
                action: 'generate_enrichments'
              }
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error generating search parameters:', error);
      deps.enqueueSnackBar('Failed to generate search parameters', {
        variant: SnackBarVariant.Error,
      });
    }
  };
};

export const createEnrichmentsHandler = (deps: SearchPlanHandlerDeps) => {
  return async () => {
    if (!deps.currentSearchFilterId) {
      deps.enqueueSnackBar('No search filter found. Please create a search filter first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      const result = await deps.searchPlanGeneration.generateEnrichments(
        deps.currentSearchFilterId
      );

      console.log(`handleGenerateEnrichments - Result: ${JSON.stringify(result, null, 2)}`);

      if (result) {
        deps.setCurrentEnrichments(result);
        
        // Save enrichments to parsedJD state
        if (deps.currentSearchFilterId) {
          deps.setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchFilters = [...(prev.searchFilters || [])];
            const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
            
            if (searchFilterIndex !== -1) {
              updatedSearchFilters[searchFilterIndex] = {
                ...updatedSearchFilters[searchFilterIndex],
                enrichmentConfigs: result.enrichments
              };
              
              console.log('AIChatAssistant - Saved enrichments to parsedJD:', {
                searchFilterId: deps.currentSearchFilterId,
                enrichmentsCount: result.enrichments.length,
                enrichments: result.enrichments.map(e => ({ id: e.id, name: e.name }))
              });
            }
            
            return {
              ...prev,
              searchFilters: updatedSearchFilters
            };
          });
        }
        
        await deps.addMessage({
          type: 'enrichments',
          content: `Generated ${result.enrichments.length} enrichment configurations for candidate evaluation.`,
          metadata: {
            enrichments: result,
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
    } catch (error) {
      console.error('Error generating enrichments:', error);
      deps.enqueueSnackBar('Failed to generate enrichments', {
        variant: SnackBarVariant.Error,
      });
    }
  };
};

export const createFiltersHandler = (deps: SearchPlanHandlerDeps) => {
  return async () => {
    if (!deps.currentSearchFilterId || !deps.currentEnrichments) {
      deps.enqueueSnackBar('No search filter or enrichments found. Please generate enrichments first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      const result = await deps.searchPlanGeneration.generateFilters(
        deps.currentSearchFilterId,
        deps.currentEnrichments
      );

      console.log(`handleGenerateFilters - Result: ${JSON.stringify(result, null, 2)}`);

      if (result) {
        deps.setCurrentFilters(result);
        
        // Save filters to parsedJD state
        if (deps.currentSearchFilterId) {
          deps.setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchFilters = [...(prev.searchFilters || [])];
            const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
            
            if (searchFilterIndex !== -1) {
              updatedSearchFilters[searchFilterIndex] = {
                ...updatedSearchFilters[searchFilterIndex],
                columnFilters: result.handsontableFilters
              };
              
              console.log('AIChatAssistant - Saved filters to parsedJD:', {
                searchFilterId: deps.currentSearchFilterId,
                filtersCount: result.handsontableFilters.length,
                filters: result.handsontableFilters.map(f => ({ column: f.column, type: f.type }))
              });
            }
            
            return {
              ...prev,
              searchFilters: updatedSearchFilters
            };
          });
        }
        
        await deps.addMessage({
          type: 'filters',
          content: `Generated filter strategy with ${result.handsontableFilters.length} Handsontable filters and ${result.candidateSearchFilters.length} CandidateSearch filters.`,
          metadata: {
            filters: result,
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
    } catch (error) {
      console.error('Error generating filters:', error);
      deps.enqueueSnackBar('Failed to generate filters', {
        variant: SnackBarVariant.Error,
      });
    }
  };
};

export const createSortsHandler = (deps: SearchPlanHandlerDeps) => {
  return async () => {
    if (!deps.currentSearchFilterId) {
      deps.enqueueSnackBar('No search filter found. Please create a search filter first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    // Check if we have the required data (either in local state or in parsedJD)
    const hasSearchParams = deps.currentSearchParameters || deps.hasExistingSearchParameters();
    const hasEnrichments = deps.currentEnrichments || deps.hasExistingEnrichments();
    
    if (!hasSearchParams || !hasEnrichments) {
      deps.enqueueSnackBar('No search parameters or enrichments found. Please generate search parameters and enrichments first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      // If we don't have local state but have existing data, we need to regenerate
      // the missing pieces to get the proper response objects
      let searchParametersToUse = deps.currentSearchParameters;
      let enrichmentsToUse = deps.currentEnrichments;
      
      // If we have existing enrichments but no local state, regenerate enrichments to get the response object
      if (!enrichmentsToUse && deps.hasExistingEnrichments()) {
        console.log('Regenerating enrichments to get response object for sorts generation');
        enrichmentsToUse = await deps.searchPlanGeneration.generateEnrichments(deps.currentSearchFilterId);
        if (enrichmentsToUse) {
          deps.setCurrentEnrichments(enrichmentsToUse);
        }
      }
      
      // If we have existing search parameters but no local state, regenerate search parameters to get the response object
      if (!searchParametersToUse && deps.hasExistingSearchParameters()) {
        console.log('Regenerating search parameters to get response object for sorts generation');
        // We need to determine the search type and category from the existing data
        const validSearchCategory = deps.searchConfig.searchCategory === 'posts' ? 'people' : deps.searchConfig.searchCategory;
        searchParametersToUse = await deps.searchPlanGeneration.generateSearchParameters(
          deps.currentSearchFilterId,
          deps.searchConfig.searchType as 'classic' | 'sales_navigator' | 'recruiter',
          validSearchCategory as 'people' | 'companies' | 'jobs'
        );
        if (searchParametersToUse) {
          deps.setCurrentSearchParameters(searchParametersToUse);
        }
      }
      
      if (!searchParametersToUse || !enrichmentsToUse) {
        deps.enqueueSnackBar('Unable to retrieve search parameters or enrichments. Please regenerate them.', {
          variant: SnackBarVariant.Error,
        });
        return;
      }

      const result = await deps.searchPlanGeneration.generateSorts(
        deps.currentSearchFilterId,
        searchParametersToUse,
        enrichmentsToUse,
        // We need filters for sorts generation, but we can create a minimal one if not available
        { 
          filterStrategy: { name: 'Default', description: 'Default filter strategy', targetShortlistSize: 50, priority: 'balanced' as const, reasoning: 'Default strategy' },
          handsontableFilters: [],
          candidateSearchFilters: [],
          reasoning: 'Default filters',
          metadata: { generatedAt: new Date().toISOString(), hasDataDistribution: false, dataDistributionFields: [] }
        }
      );

      console.log(`handleGenerateSorts - Result: ${JSON.stringify(result, null, 2)}`);

      if (result) {
        deps.setCurrentSorts(result);
        
        // Save sorts to parsedJD state
        if (deps.currentSearchFilterId) {
          deps.setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchFilters = [...(prev.searchFilters || [])];
            const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === deps.currentSearchFilterId);
            
            if (searchFilterIndex !== -1) {
              updatedSearchFilters[searchFilterIndex] = {
                ...updatedSearchFilters[searchFilterIndex],
                // Store flattened sort data
                sortColumns: result.sortStrategy.sortColumns,
                sortStrategyName: result.sortStrategy.name,
                sortStrategyDescription: result.sortStrategy.description,
                sortStrategyReasoning: result.sortStrategy.reasoning,
              };
              
              console.log('AIChatAssistant - Saved sorts to parsedJD:', {
                searchFilterId: deps.currentSearchFilterId,
                sortColumnsCount: result.sortStrategy.sortColumns.length,
                sortStrategy: result.sortStrategy.name
              });
            }
            
            return {
              ...prev,
              searchFilters: updatedSearchFilters
            };
          });
        }
        
        await deps.addMessage({
          type: 'sorts',
          content: `Generated multi-column sorting strategy with ${result.sortStrategy.sortColumns.length} sort columns. The sorting configuration prioritizes candidates based on ${result.sortStrategy.name}.`,
          metadata: {
            sorts: result,
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
    } catch (error) {
      console.error('Error generating sorts:', error);
      deps.enqueueSnackBar('Failed to generate sorts', {
        variant: SnackBarVariant.Error,
      });
    }
  };
};

