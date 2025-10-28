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

