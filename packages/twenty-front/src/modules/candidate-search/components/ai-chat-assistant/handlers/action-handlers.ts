import { addSearchResults, persistSearchMetadataToStorage } from '@/candidate-search/states/searchResultsState';
import type { SearchParametersResponse, SortsResponse } from '@/candidate-search/types/candidate-search.types';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { saveToLocalStorage } from '../utils/storage-helpers';

type ActionHandlerDeps = {
  enqueueSnackBar: (message: string, options: { variant: SnackBarVariant }) => void;
  currentSearchParameters: SearchParametersResponse | null;
  currentSorts: SortsResponse | null;
  applyGeneratedSorts: ((sorts: SortsResponse) => void) | null;
  setSelectedSearchVariation: (variationId: string) => void;
  setResolvedParameters: React.Dispatch<React.SetStateAction<any>>;
  setSearchConfig: (config: { searchType: any; searchCategory: any }) => void;
  setParsedJD?: React.Dispatch<React.SetStateAction<any>>;
  currentSearchFilterId: string;
};

export const createSearchVariationSelectHandler = (deps: ActionHandlerDeps) => {
  return (variationId: string) => {
    deps.setSelectedSearchVariation(variationId);
    
    // Update resolved parameters with the selected variation
    if (deps.currentSearchParameters) {
      const selectedVariation = deps.currentSearchParameters.variations.find(v => v.id === variationId);
      if (selectedVariation) {
        const searchType = deps.currentSearchParameters.metadata.searchType;
        const searchCategory = deps.currentSearchParameters.metadata.searchCategory;
        
        // Update searchConfigState to match the variation's search type and category
        deps.setSearchConfig({
          searchType: searchType as any,
          searchCategory: searchCategory as any,
        });
        
        // Convert searchType to camelCase to match backend parameter key construction
        const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
        const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
        const resolvedParams = selectedVariation.resolvedSearchParameters || selectedVariation.searchParameters || {};
        deps.setResolvedParameters((prevResolved: any) => {
          const updated = {
            ...prevResolved,
            [parameterKey]: resolvedParams
          };
          
          // Save to localStorage for persistence
          if (deps.currentSearchFilterId) {
            saveToLocalStorage(deps.currentSearchFilterId, 'resolvedParameters', updated);
          }
          
          return updated;
        });
        
        deps.enqueueSnackBar(`Search variation "${selectedVariation.name}" selected and applied to search form`, {
          variant: SnackBarVariant.Success,
        });
      }
    }
  };
};

export const createExecuteEnrichmentsHandler = (deps: ActionHandlerDeps) => {
  return () => {
    deps.enqueueSnackBar('Enrichments execution started', {
      variant: SnackBarVariant.Success,
    });
    // TODO: Implement enrichment execution
  };
};

export const createApplyFiltersHandler = (deps: ActionHandlerDeps) => {
  return () => {
    deps.enqueueSnackBar('Filters applied successfully', {
      variant: SnackBarVariant.Success,
    });
    // TODO: Implement filter application
  };
};

export const createApplySortsHandler = (deps: ActionHandlerDeps) => {
  return async () => {
    console.log("handleApplySorts called");
    console.log("currentSorts:", JSON.stringify(deps.currentSorts, null, 2));
    console.log("applyGeneratedSorts:", JSON.stringify(deps.applyGeneratedSorts, null, 2));
    
    if (!deps.currentSorts) {
      deps.enqueueSnackBar('No sorting configuration available to apply', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    if (!deps.applyGeneratedSorts) {
      deps.enqueueSnackBar('DataTable is not ready yet. Please ensure the candidate table is loaded and try again.', {
        variant: SnackBarVariant.Warning,
      });
      console.warn('DataTable applyGeneratedSorts function not available yet');
      console.warn('This might happen if the AIChatAssistant is in a modal and the DataTable is not mounted yet');
      return;
    }

    try {
      // Apply the generated sorts to the DataTable
      deps.applyGeneratedSorts(deps.currentSorts);
      
      deps.enqueueSnackBar(`Sorting strategy "${deps.currentSorts.sortStrategy.name}" applied successfully`, {
        variant: SnackBarVariant.Success,
      });
      
      console.log('Applied sorts:', deps.currentSorts);
    } catch (error) {
      console.error('Error applying sorts:', error);
      deps.enqueueSnackBar('Failed to apply sorting configuration', {
        variant: SnackBarVariant.Error,
      });
    }
  };
};

export const createApplyParametersHandler = (deps: ActionHandlerDeps) => {
  return (parameters: any) => {
    console.log('handleApplyParameters called with:', parameters);
    
    if (!parameters) {
      console.warn('No parameters provided to apply');
      return;
    }

    try {
      // Update resolvedParameters with the provided parameters
      deps.setResolvedParameters((prevResolved: any) => {
        // Deep merge: For nested objects like classicPeopleSearch, we need to properly merge
        // the inner properties to ensure AI-generated values override existing ones
        const updated = { ...prevResolved };
        
        Object.keys(parameters).forEach(key => {
          if (parameters[key] && typeof parameters[key] === 'object' && !Array.isArray(parameters[key])) {
            // For nested objects, merge deeply
            updated[key] = {
              ...(updated[key] || {}),
              ...parameters[key]
            };
          } else {
            // For primitives and arrays, directly override
            updated[key] = parameters[key];
          }
        });
        
        console.log('Applied parameters to resolvedParameters:', {
          previous: prevResolved,
          new: parameters,
          updated,
          note: 'Deep merge applied to ensure AI values override existing values'
        });
        
        // Save to localStorage for persistence
        if (deps.currentSearchFilterId) {
          saveToLocalStorage(deps.currentSearchFilterId, 'resolvedParameters', updated);
        }
        
        return updated;
      });
      
      // Also update parsedJD state if available
      if (deps.setParsedJD && deps.currentSearchFilterId) {
        deps.setParsedJD((prev: any) => {
          if (!prev) return null;
          
          const updatedSearchFilters = [...(prev.searchFilters || [])];
          const searchFilterIndex = updatedSearchFilters.findIndex((sf: any) => sf.id === deps.currentSearchFilterId);
          
          if (searchFilterIndex !== -1) {
            updatedSearchFilters[searchFilterIndex] = {
              ...updatedSearchFilters[searchFilterIndex],
              searchFilterParameter: {
                ...updatedSearchFilters[searchFilterIndex].searchFilterParameter,
                resolvedSearchParameters: {
                  ...updatedSearchFilters[searchFilterIndex].searchFilterParameter?.resolvedSearchParameters,
                  ...parameters
                }
              }
            };
            
            console.log('Updated parsedJD with applied parameters:', {
              searchFilterId: deps.currentSearchFilterId,
              parameters
            });
          }
          
          return {
            ...prev,
            searchFilters: updatedSearchFilters
          };
        });
      }
      
      console.log('Parameters applied successfully');
    } catch (error) {
      console.error('Error applying parameters:', error);
      deps.enqueueSnackBar('Failed to apply search parameters', {
        variant: SnackBarVariant.Error,
      });
    }
  };
};

type ViewStrategyResultsHandlerDeps = {
  setSearchResults: React.Dispatch<React.SetStateAction<any[]>>;
  setSearchMetadata: React.Dispatch<React.SetStateAction<any>>;
  jobId?: string;
  enqueueSnackBar: (message: string, options: { variant: SnackBarVariant }) => void;
};

export const createViewStrategyResultsHandler = (deps: ViewStrategyResultsHandlerDeps) => {
  return (strategy: any, preview: any, parameterKey: string) => {
    console.log('=== createViewStrategyResultsHandler called ===', {
      strategyId: strategy?.id,
      strategyLabel: strategy?.label || strategy?.name,
      hasPreview: !!preview,
      previewKeys: preview ? Object.keys(preview) : [],
      candidateCount: preview?.transformedCandidates?.length || 0,
      itemCount: preview?.itemCount,
      hasTransformedCandidates: !!preview?.transformedCandidates,
      transformedCandidatesType: Array.isArray(preview?.transformedCandidates) ? 'array' : typeof preview?.transformedCandidates,
      jobId: deps.jobId,
      parameterKey,
      fullPreview: preview
    });

    // Handle different preview structures - check for transformedCandidates in various locations
    let candidatesToAdd: any[] = [];
    
    if (preview?.transformedCandidates && Array.isArray(preview.transformedCandidates)) {
      candidatesToAdd = preview.transformedCandidates;
    } else if (preview?.searchResults?.items && Array.isArray(preview.searchResults.items)) {
      // Fallback: if transformedCandidates not available, use raw searchResults items
      console.warn('=== transformedCandidates not found, using raw searchResults.items ===');
      candidatesToAdd = preview.searchResults.items;
    } else if (preview?.items && Array.isArray(preview.items)) {
      // Another fallback: check for items directly on preview
      console.warn('=== transformedCandidates not found, using preview.items ===');
      candidatesToAdd = preview.items;
    }

    if (!preview || candidatesToAdd.length === 0) {
      console.warn('=== No candidates found for strategy ===', {
        strategyId: strategy?.id,
        hasPreview: !!preview,
        hasTransformedCandidates: !!preview?.transformedCandidates,
        transformedCandidatesLength: preview?.transformedCandidates?.length || 0,
        itemCount: preview?.itemCount,
        hasSearchResultsItems: !!preview?.searchResults?.items,
        searchResultsItemsLength: preview?.searchResults?.items?.length || 0
      });
      deps.enqueueSnackBar('No candidates found for this strategy', {
        variant: SnackBarVariant.Warning,
      });
      return;
    }

    console.log('=== Adding candidates to search results state ===', {
      count: candidatesToAdd.length,
      firstCandidate: candidatesToAdd[0] ? {
        id: candidatesToAdd[0].id,
        tempId: candidatesToAdd[0].tempId,
        fullName: candidatesToAdd[0].fullName,
        name: candidatesToAdd[0].name,
        jobTitle: candidatesToAdd[0].jobTitle,
        headline: candidatesToAdd[0].headline,
        keys: Object.keys(candidatesToAdd[0])
      } : 'N/A',
      allCandidates: candidatesToAdd.slice(0, 5).map((c: any) => ({
        id: c.id,
        tempId: c.tempId,
        fullName: c.fullName || c.name
      }))
    });

    // Add results to search results state - this will append to existing results
    console.log('=== Calling addSearchResults ===');
    try {
      addSearchResults(deps.setSearchResults, deps.jobId)(candidatesToAdd);
      console.log('=== addSearchResults called successfully ===');
    } catch (error) {
      console.error('=== Error calling addSearchResults ===', error);
      deps.enqueueSnackBar('Failed to add candidates to search results', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    // Update metadata - append to existing totalCount instead of replacing
    deps.setSearchMetadata((prevMetadata: any) => {
      const newTotalCount = (prevMetadata?.totalCount || 0) + candidatesToAdd.length;
      const newMetadata = {
        totalCount: newTotalCount,
        currentPage: prevMetadata?.currentPage || 1,
        totalPages: Math.ceil(newTotalCount / 10),
        cursor: preview.searchResults?.cursor || preview?.cursor || prevMetadata?.cursor,
        searchType: preview.searchMetadata?.searchType || prevMetadata?.searchType,
        searchCategory: preview.searchMetadata?.searchCategory || prevMetadata?.searchCategory,
        searchParameters: strategy.parameters || prevMetadata?.searchParameters,
      };
      
      console.log('=== Updating search metadata ===', {
        previous: prevMetadata,
        new: newMetadata,
        addedCount: candidatesToAdd.length
      });
      
      persistSearchMetadataToStorage(newMetadata);
      return newMetadata;
    });

    // Verify the state was updated
    setTimeout(() => {
      console.log('=== State update completed ===');
      console.log('Check searchResultsState in Recoil DevTools or browser console.');
      console.log('Candidates added:', candidatesToAdd.length);
    }, 100);

    deps.enqueueSnackBar(
      `Added ${candidatesToAdd.length} candidate${candidatesToAdd.length !== 1 ? 's' : ''} from "${strategy.label || strategy.name || 'strategy'}" strategy to search results`,
      {
        variant: SnackBarVariant.Success,
      }
    );
  };
};

