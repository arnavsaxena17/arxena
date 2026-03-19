import { useSearchParameters } from '@/arx-jd-upload/hooks/useSearchParameters';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { cleanSearchParameters } from '@/arx-jd-upload/utils/searchParametersUtils';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { SearchParametersManager } from '@/candidate-search/components/search-components/SearchParametersManager';
import { activeAssistantThreadIdState, searchConfigState } from '@/candidate-search/states/searchConfigState';
import { chatMessagesSelector, resolvedParametersSelector } from '@/candidate-table/states/states';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { LinkedInSearchCategory, LinkedInSearchType } from 'twenty-shared';

import { StyledAdvancedSection, StyledForm } from '../../styles/SearchFormComponents.styled';
import { CompanyFilters } from './CompanyFilters';
import { JobFilters } from './JobFilters';
import { LoadingStatus } from './LoadingStatus';
import { SearchCategorySelector } from './SearchCategorySelector';
import { SearchTypeSelector } from './SearchTypeSelector';

type SearchParametersFormProps = {
  onSearch: (searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory, parameters: any) => void;
  isLoading: boolean;
  onSearchRef?: (searchFn: () => void) => void;
  generatedParameters?: any;
  onAssistantThreadUpdate?: (  
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>;
  searchType?: LinkedInSearchType;
  searchCategory?: LinkedInSearchCategory;
  initialParameters?: any;
};

export const SearchParametersForm = ({
  onSearch,
  isLoading,
  onSearchRef,
  generatedParameters,
  onAssistantThreadUpdate,
  searchType: propSearchType,
  searchCategory: propSearchCategory,
  initialParameters,
}: SearchParametersFormProps) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [searchConfig, setSearchConfig] = useRecoilState(searchConfigState);
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);
  const [resolvedParameters, setResolvedParameters] = useRecoilState(resolvedParametersSelector);
  const [chatMessages, setChatMessages] = useRecoilState(chatMessagesSelector);
  
  const activeAssistantThreadId = useRecoilValue(activeAssistantThreadIdState);
  const assistantThreadId =
    activeAssistantThreadId || parsedJD?.assistantThreads?.[0]?.id;
  
  // Use props if provided, otherwise fall back to Recoil state
  const searchType = propSearchType || searchConfig.searchType;
  const searchCategory = propSearchCategory || searchConfig.searchCategory;
  
  // Remove redundant local state management - let useSearchParametersManager handle everything
  
  // Use the centralized search parameters service
  const { generateSearchParameters, hasSearchParameters, isGenerating, isResolving } = useSearchParameters();
  const [easyApply, setEasyApply] = useState<boolean | undefined>(undefined);
  const [inYourNetwork, setInYourNetwork] = useState<boolean | undefined>(undefined);
  const [fairChanceEmployer, setFairChanceEmployer] = useState<boolean | undefined>(undefined);
  const [hasJobOffers, setHasJobOffers] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [datePosted, setDatePosted] = useState<number | undefined>(undefined);
  const [locationWithinArea, setLocationWithinArea] = useState<number | undefined>(undefined);
  // Create a stable resolved parameters object that doesn't change unless the actual resolved parameters change
  const stableResolvedParameters = useMemo(() => {
    return resolvedParameters;
  }, [resolvedParameters]);

  // Create a ref to store the current form parameters (user-modified keywords, etc.)
  const currentFormParametersRef = React.useRef<any>(null);

  // Initialize ref with initialParameters if available
  useEffect(() => {
    if (initialParameters) {
      currentFormParametersRef.current = initialParameters;
    }
  }, [initialParameters]);

  // Helper function to check if search parameters exist for a given search type and category
  const checkHasSearchParameters = useCallback((searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory) => {
    return hasSearchParameters(resolvedParameters, searchType, searchCategory, assistantThreadId || '');
  }, [resolvedParameters, hasSearchParameters, assistantThreadId]);

  // Helper function to generate missing search parameters
  const generateMissingSearchParameters = useCallback(async (
    searchType: LinkedInSearchType, 
    searchCategory: LinkedInSearchCategory,
    assistantThreadId: string
  ) => {
    if (!parsedJD?.parsedJobDescription) {
      console.log('Missing parsed job description for parameter generation');
      return null;
    }

    try {
      const result = await generateSearchParameters(
        parsedJD?.parsedJobDescription,
        searchType,
        searchCategory,
        assistantThreadId
      );
      
      // Update resolved parameters with the new generated and resolved parameters
      setResolvedParameters((prev: any) => ({
        ...prev,
        ...result.resolvedParameters
      }));
      
      // Save to backend if we have the necessary props
      if (onAssistantThreadUpdate && result.resolvedParameters && assistantThreadId) {
        try {
          await onAssistantThreadUpdate(
            searchType,
            searchCategory,
            result.generatedParameters,
            result.resolvedParameters
          );
          console.log('Successfully saved generated parameters to backend');
        } catch (error) {
          console.error('Failed to save generated parameters to backend:', error);
        }
      }
      
      return result.generatedParameters;
    } catch (error) {
      console.error('Failed to generate search parameters:', error);
      return null;
    }
  }, [parsedJD?.parsedJobDescription, generateSearchParameters, onAssistantThreadUpdate, assistantThreadId]);

  // Handler for search type changes
  const handleSearchTypeChange = useCallback(async (newSearchType: LinkedInSearchType) => {
    console.log('Search type changed to:', newSearchType);
    
    setSearchConfig(prev => ({ ...prev, searchType: newSearchType }));
    
    // Check if we have parameters for this search type and category
    if (!checkHasSearchParameters(newSearchType, searchCategory)) {
      console.log(`Missing parameters for ${newSearchType} ${searchCategory}, generating...`);
      if (assistantThreadId) {
        await generateMissingSearchParameters(newSearchType, searchCategory, assistantThreadId);
      }
    }
  }, [searchCategory, checkHasSearchParameters, generateMissingSearchParameters, setSearchConfig]);

  const handleSearchCategoryChange = useCallback(async (newSearchCategory: LinkedInSearchCategory) => {
    console.log('Search category changed to:', newSearchCategory);
    setSearchConfig(prev => ({ ...prev, searchCategory: newSearchCategory }));
    if (!checkHasSearchParameters(searchType, newSearchCategory)) {
      console.log(`Missing parameters for ${searchType} ${newSearchCategory}, generating...`);
      if (assistantThreadId) {
        await generateMissingSearchParameters(searchType, newSearchCategory, assistantThreadId);
      }
    }
  }, [searchType, checkHasSearchParameters, generateMissingSearchParameters, setSearchConfig]);

  // Track if we've initialized from parsedJD (only do this once)
  const [hasInitializedFromParsedJD, setHasInitializedFromParsedJD] = useState(false);

  // Initialize resolved parameters from parsedJD ONLY ONCE on component mount
  useEffect(() => {
    const threadResolved = parsedJD?.assistantThreads?.[0]?.assistantParameters?.resolvedSearchParameters;
    if (!hasInitializedFromParsedJD && threadResolved) {
      console.log('One-time initialization of resolved parameters from assistantThread:', threadResolved);

      const hasExistingResolvedParams = resolvedParameters && Object.keys(resolvedParameters).length > 0;
      if (!hasExistingResolvedParams) {
        setResolvedParameters(threadResolved);
      }
      setHasInitializedFromParsedJD(true);
    }
  }, [hasInitializedFromParsedJD, parsedJD?.assistantThreads, setResolvedParameters, resolvedParameters]);

  // Watch for real-time updates to resolvedParameters from AIChatAssistant
  useEffect(() => {
    if (resolvedParameters) {

      // Check if we have parameters for the current search type/category
      // Convert searchType to camelCase to match backend parameter key construction
      const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
      const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
      const currentParams = resolvedParameters[parameterKey];
      
    } 
  }, [resolvedParameters, searchType, searchCategory]);

  // Create a stable search function that always calls the current handleSearch
  const stableSearchFunction = useCallback((overrideParameters?: any) => {
    const basicParameters: any = {
      easyApply: easyApply,
      inYourNetwork: inYourNetwork,
      fairChanceEmployer: fairChanceEmployer,
      hasJobOffers: hasJobOffers,
      sortBy: sortBy,
      datePosted: datePosted,
      locationWithinArea: locationWithinArea,
    };
    
    // Remove undefined values from basic parameters
    Object.keys(basicParameters).forEach(key => {
      if (basicParameters[key] === undefined) {
        delete basicParameters[key];
      }
    });

    // PRIORITY 1: Use overrideParameters if provided (from form's current state)
    // PRIORITY 2: Use currentFormParametersRef (latest user modifications)
    // PRIORITY 3: Fall back to resolvedParameters (may contain generated params)
    let formParams = overrideParameters || currentFormParametersRef.current;
    
    // If we don't have form params, get from resolvedParameters
    if (!formParams) {
      const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
      const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
      formParams = resolvedParameters?.[parameterKey] || {};
    }
    
    // Merge basic parameters with form parameters (preserving user's custom keywords)
    const parameters = {
      ...basicParameters,
      ...formParams,
    };

    
    onSearch(searchType, searchCategory, parameters);
  }, [
    searchType, searchCategory, easyApply, inYourNetwork, fairChanceEmployer, hasJobOffers, 
    sortBy, datePosted, locationWithinArea, resolvedParameters, onSearch
  ]);

  const handleAdvancedParametersChange = useCallback(async (newParameters: any) => {
    // Store current form parameters in ref to preserve user modifications
    currentFormParametersRef.current = newParameters;
    
    // Persist parameters to localStorage for cross-session persistence
    try {
      const persistenceKey = 'candidate-search-parameters';
      const persistedData = {
        parameters: newParameters,
        timestamp: Date.now(),
      };
      localStorage.setItem(persistenceKey, JSON.stringify(persistedData));
      console.log('Persisted updated search parameters to localStorage:', newParameters);
    } catch (error) {
      console.error('Failed to persist search parameters to localStorage:', error);
    }
    
    // Update resolvedParameters to reflect the new user-modified parameters
    setResolvedParameters((prevResolved: any) => {
      const updatedResolved = prevResolved ? { ...prevResolved } : {};
      
      // Update the appropriate search type/category parameters
      // Convert searchType to camelCase to match backend parameter key construction
      const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
      const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
      updatedResolved[parameterKey] = {
        ...updatedResolved[parameterKey],
        ...newParameters
      };
      
      return updatedResolved;
    });
    
    // Save to backend if we have the necessary props
    if (assistantThreadId && onAssistantThreadUpdate) {
      try {
        // Convert searchType to camelCase to match backend parameter key construction
        const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_: string  , letter: string) => letter.toUpperCase());
        const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
        const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;

        // Shape resolved parameters for backend so they are stored under the correct search key
        const backendResolvedParameters = {
          [parameterKey]: newParameters,
        };

        console.log('Saving user-modified parameters to backend:', {
          assistantThreadId,
          searchType,
          searchCategory,
          parameterKey,
          backendResolvedParameters,
          note: 'User modified parameters are being saved to assistantThread'
        });
        
        await onAssistantThreadUpdate(
          searchType,
          searchCategory,
          generatedParameters, // Use existing generated parameters
          backendResolvedParameters // Use the new parameters under the correct parameter key
        );
        
        console.log('Successfully saved user-modified parameters to backend');
      } catch (error) {
        console.error('Failed to save user-modified parameters to backend:', error);
      }
    }
  }, [assistantThreadId, onAssistantThreadUpdate, searchType, searchCategory, generatedParameters]);


const handleClear = async () => {
  console.log('CandidateSearchParametersForm.handleClear called');
  console.log('CandidateSearchParametersForm.handleClear - current searchType:', searchType, 'searchCategory:', searchCategory);
  
  // Clear all parameters for the current search type and category
  // Convert searchType to camelCase to match backend parameter key construction
  const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
  const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
  const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
  console.log('CandidateSearchParametersForm.handleClear - clearing parameter key:', parameterKey);
  
  // Update resolvedParametersState (PRIORITY 3) - remove the specific parameter key
  setResolvedParameters((prevResolved: any) => {
    if (!prevResolved) return prevResolved;
    
    const { [parameterKey]: removed, ...remaining } = prevResolved;
    console.log('CandidateSearchParametersForm.handleClear - updated resolvedParameters:', {
      removed: parameterKey,
      remaining: Object.keys(remaining),
      updated: remaining
    });
    return remaining;
  });
  
  // Clear parsedJD.searchParameters by removing the specific parameter key
  setParsedJD((prevParsedJD: any) => {
    if (!prevParsedJD?.searchParameters) return prevParsedJD;
    
    // Convert searchType to camelCase to match backend parameter key construction
    const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
    const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
    const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
    
    // Create a deep copy of search parameters
    const updatedSearchParameters = prevParsedJD.searchParameters.map((param: any) => {
      if (!param) return param;
      
      const updatedParam = { ...param };
      
      // Remove the specific parameter key from generatedSearchParameters
      if (updatedParam.generatedSearchParameters) {
        const { [parameterKey]: removed, ...remainingGenerated } = updatedParam.generatedSearchParameters;
        updatedParam.generatedSearchParameters = remainingGenerated;
      }
      
      // Remove the specific parameter key from resolvedSearchParameters
      if (updatedParam.resolvedSearchParameters) {
        const { [parameterKey]: removed, ...remainingResolved } = updatedParam.resolvedSearchParameters;
        updatedParam.resolvedSearchParameters = remainingResolved;
      }
      
      return updatedParam;
    });
    
    // Clean up any empty entries
    const cleanedSearchParameters = cleanSearchParameters(updatedSearchParameters);
    
    console.log('CandidateSearchParametersForm.handleClear - updated search parameters:', {
      originalCount: prevParsedJD.searchParameters.length,
      cleanedCount: cleanedSearchParameters?.length ?? 0,
      parameterKey,
      cleanedSearchParameters
    });
    
    return {
      ...prevParsedJD,
      searchParameters: cleanedSearchParameters ?? []
    };
  });
  
  console.log('CandidateSearchParametersForm.handleClear resolvedParameters:', resolvedParameters);
  
  // Save cleared parameters to backend to ensure persistence after page reload
  if (assistantThreadId && onAssistantThreadUpdate) {
    try {
      console.log('Saving cleared parameters to backend:', {
        assistantThreadId,
        searchType,
        searchCategory,
        note: 'Cleared parameters are being saved to assistantThread'
      });
      
      // Create cleared parameters object for backend - remove the parameter key entirely
      const clearedBackendParams: any = {};
      // Don't include the parameterKey at all - this will remove it from the backend
      
      await onAssistantThreadUpdate(
        searchType,
        searchCategory,
        generatedParameters, // Use existing generated parameters
        clearedBackendParams // Use the cleared parameters
      );
      
      console.log('Successfully saved cleared parameters to backend');
    } catch (error) {
      console.error('Failed to save cleared parameters to backend:', error);
    }
  }
  
  // Also clear the basic search parameters
  setEasyApply(undefined);
  setInYourNetwork(undefined);
  setFairChanceEmployer(undefined);
  setHasJobOffers(undefined);
  setSortBy('relevance');
  setDatePosted(undefined);
  setLocationWithinArea(undefined);
  
  // Clear chat messages to reset the AI chat assistant
  setChatMessages([]);
  
  console.log('CandidateSearchParametersForm.handleClear completed successfully');
};

  // Expose search function to parent component
  React.useEffect(() => {
    if (onSearchRef) {
      onSearchRef(stableSearchFunction);
    }
  }, [onSearchRef, stableSearchFunction]);

  return (
    <StyledForm>
      <SearchTypeSelector
        searchType={searchType}
        onSearchTypeChange={handleSearchTypeChange}
      />

      <SearchCategorySelector
        searchCategory={searchCategory}
        onSearchCategoryChange={handleSearchCategoryChange}
      />

      {/* <ParametersDisplay
        parsedJD={parsedJD}
        advancedParameters={advancedParameters}
        searchType={searchType}
        searchCategory={searchCategory}
        resolvedParameters={stableResolvedParameters}
      /> */}

      {searchCategory === 'jobs' && (
        <JobFilters
          sortBy={sortBy}
          onSortByChange={setSortBy}
          datePosted={datePosted}
          onDatePostedChange={setDatePosted}
          locationWithinArea={locationWithinArea}
          onLocationWithinAreaChange={setLocationWithinArea}
          easyApply={easyApply}
          onEasyApplyChange={setEasyApply}
          inYourNetwork={inYourNetwork}
          onInYourNetworkChange={setInYourNetwork}
          fairChanceEmployer={fairChanceEmployer}
          onFairChanceEmployerChange={setFairChanceEmployer}
        />
      )}

      {searchCategory === 'companies' && (
        <CompanyFilters
          hasJobOffers={hasJobOffers}
          onHasJobOffersChange={setHasJobOffers}
        />
      )}

      <LoadingStatus
        isGenerating={isGenerating}
        isResolving={isResolving}
        searchType={searchType}
        searchCategory={searchCategory}
      />

      <StyledAdvancedSection>
        <SearchParametersManager
          searchType={searchType}
          searchCategory={searchCategory}
          onParametersChange={handleAdvancedParametersChange}
          generatedParameters={generatedParameters}
          resolvedParameters={stableResolvedParameters}
          initialParameters={initialParameters}
          onAssistantThreadUpdate={onAssistantThreadUpdate}
          onSearch={stableSearchFunction}
          onClear={handleClear}
        />
      </StyledAdvancedSection>
    </StyledForm>
  );
};
