import { useSearchParameters } from '@/arx-jd-upload/hooks/useSearchParameters';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { SearchParametersManager } from '@/candidate-search/components/search-components/SearchParametersManager';
import { searchConfigState } from '@/candidate-search/states/searchConfigState';
import { LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/types/CandidateSearch';
import { resolvedParametersSelector } from '@/candidate-table/states/states';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';

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
  onSearchFilterUpdate?: (  
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>;
};

export const SearchParametersForm = ({
  onSearch,
  isLoading,
  onSearchRef,
  generatedParameters,
  onSearchFilterUpdate,
}: SearchParametersFormProps) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [searchConfig, setSearchConfig] = useRecoilState(searchConfigState);
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);
  const [resolvedParameters, setResolvedParameters] = useRecoilState(resolvedParametersSelector);
  
  // Extract searchType and searchCategory from Recoil state
  const { searchType, searchCategory } = searchConfig;
  
  // Remove redundant local state management - let useSearchParametersManager handle everything
  
  // Use the centralized search parameters service
  const { generateAndResolveSearchParameters, hasSearchParameters, isGenerating, isResolving } = useSearchParameters();
  const [easyApply, setEasyApply] = useState<boolean | undefined>(undefined);
  const [inYourNetwork, setInYourNetwork] = useState<boolean | undefined>(undefined);
  const [fairChanceEmployer, setFairChanceEmployer] = useState<boolean | undefined>(undefined);
  const [hasJobOffers, setHasJobOffers] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [datePosted, setDatePosted] = useState<number | undefined>(undefined);
  const [locationWithinArea, setLocationWithinArea] = useState<number | undefined>(undefined);
  const searchFilterId = parsedJD?.searchFilters?.[0]?.id;
  // Create a stable resolved parameters object that doesn't change unless the actual resolved parameters change
  const stableResolvedParameters = useMemo(() => {
    return resolvedParameters;
  }, [resolvedParameters]);

  // Helper function to check if search parameters exist for a given search type and category
  const checkHasSearchParameters = useCallback((searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory) => {
    return hasSearchParameters(resolvedParameters, searchType, searchCategory, searchFilterId || '');
  }, [resolvedParameters, hasSearchParameters, searchFilterId]);

  // Helper function to generate missing search parameters
  const generateMissingSearchParameters = useCallback(async (
    searchType: LinkedInSearchType, 
    searchCategory: LinkedInSearchCategory,
    searchFilterId: string
  ) => {
    if (!parsedJD?.parsedJobDescription) {
      console.log('Missing parsed job description for parameter generation');
      return null;
    }

    try {
      const result = await generateAndResolveSearchParameters(
        parsedJD?.parsedJobDescription,
        searchType,
        searchCategory,
        searchFilterId
      );
      
      // Update resolved parameters with the new generated and resolved parameters
      setResolvedParameters((prev: any) => ({
        ...prev,
        ...result.resolvedParameters
      }));
      
      // Save to backend if we have the necessary props
      if (onSearchFilterUpdate && result.resolvedParameters && parsedJD?.searchFilters?.[0]?.id) {
        try {
          await onSearchFilterUpdate(
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
  }, [parsedJD?.parsedJobDescription, generateAndResolveSearchParameters, onSearchFilterUpdate, parsedJD?.searchFilters, searchFilterId]);

  // Handler for search type changes
  const handleSearchTypeChange = useCallback(async (newSearchType: LinkedInSearchType) => {
    console.log('Search type changed to:', newSearchType);
    
    setSearchConfig(prev => ({ ...prev, searchType: newSearchType }));
    
    // Check if we have parameters for this search type and category
    if (!checkHasSearchParameters(newSearchType, searchCategory)) {
      console.log(`Missing parameters for ${newSearchType} ${searchCategory}, generating...`);
      if (searchFilterId) {
        await generateMissingSearchParameters(newSearchType, searchCategory, searchFilterId);
      }
    }
  }, [searchCategory, checkHasSearchParameters, generateMissingSearchParameters, setSearchConfig]);

  const handleSearchCategoryChange = useCallback(async (newSearchCategory: LinkedInSearchCategory) => {
    console.log('Search category changed to:', newSearchCategory);
    setSearchConfig(prev => ({ ...prev, searchCategory: newSearchCategory }));
    if (!checkHasSearchParameters(searchType, newSearchCategory)) {
      console.log(`Missing parameters for ${searchType} ${newSearchCategory}, generating...`);
      if (searchFilterId) {
        await generateMissingSearchParameters(searchType, newSearchCategory, searchFilterId);
      }
    }
  }, [searchType, checkHasSearchParameters, generateMissingSearchParameters, setSearchConfig]);

  // Initialize resolved parameters from parsedJD when component mounts
  useEffect(() => {
    if (parsedJD?.searchParameters) {
      for (const searchParam of parsedJD.searchParameters) {
        if (searchParam.resolvedSearchParameters) {
          console.log('Initializing resolved parameters from parsedJD:', searchParam.resolvedSearchParameters);
          
          // Only initialize if resolvedParameters is empty or if parsedJD has newer data
          // This prevents overriding parameters set by search variation selection
          const hasExistingResolvedParams = resolvedParameters && Object.keys(resolvedParameters).length > 0;
          
          if (!hasExistingResolvedParams) {
            setResolvedParameters(searchParam.resolvedSearchParameters);
          }
          break;
        }
      }
    }
  }, [parsedJD?.searchParameters, setResolvedParameters, resolvedParameters]);

  // Watch for real-time updates to resolvedParameters from AIChatAssistant
  useEffect(() => {
    if (resolvedParameters) {
      console.log('SearchParametersForm - resolvedParameters updated:', resolvedParameters);
      
      // Check if we have parameters for the current search type/category
      const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
      const currentParams = resolvedParameters[parameterKey];
      
      if (currentParams && Object.keys(currentParams).length > 0) {
        console.log(`SearchParametersForm - Found parameters for ${parameterKey}:`, currentParams);
        console.log('SearchParametersForm - These parameters should now be visible in the form fields');
        // The SearchParametersManager will automatically pick up these changes via its resolvedParameters prop
      } else {
        console.log(`SearchParametersForm - No parameters found for ${parameterKey} in resolvedParameters`);
        console.log('SearchParametersForm - Available keys in resolvedParameters:', Object.keys(resolvedParameters));
      }
    } else {
      console.log('SearchParametersForm - resolvedParameters is null/undefined');
    }
  }, [resolvedParameters, searchType, searchCategory]);

  // Create a stable search function that always calls the current handleSearch
  const stableSearchFunction = useCallback(() => {
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

    // Get resolved search parameters for the current search type/category
    const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
    const resolvedParams = resolvedParameters?.[parameterKey] || {};
    
    // Merge basic parameters with resolved parameters
    const parameters = {
      ...basicParameters,
      ...resolvedParams,
    };
    
    console.log('CandidateSearchParametersForm.stableSearchFunction calling onSearch with:', {
      searchType,
      searchCategory,
      basicParameters,
      resolvedParams,
      finalParameters: parameters,
    });
    
    onSearch(searchType, searchCategory, parameters);
  }, [
    searchType, searchCategory, easyApply, inYourNetwork, fairChanceEmployer, hasJobOffers, 
    sortBy, datePosted, locationWithinArea, resolvedParameters, onSearch
  ]);

  const handleAdvancedParametersChange = useCallback(async (newParameters: any) => {
    console.log('CandidateSearchParametersForm.handleAdvancedParametersChange called:', {
      newParameters,
      searchType,
      searchCategory
    });
    
    // Update resolvedParameters to reflect the new user-modified parameters
    setResolvedParameters((prevResolved: any) => {
      const updatedResolved = prevResolved ? { ...prevResolved } : {};
      
      // Update the appropriate search type/category parameters
      const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
      updatedResolved[parameterKey] = {
        ...updatedResolved[parameterKey],
        ...newParameters
      };
      
      return updatedResolved;
    });
    
    // Save to backend if we have the necessary props
    if (parsedJD?.searchFilters?.[0]?.id && onSearchFilterUpdate) {
      try {
        console.log('Saving user-modified parameters to backend:', {
          searchFilterId: parsedJD.searchFilters?.[0]?.id,
          searchType,
          searchCategory,
          note: 'User modified parameters are being saved to searchFilter'
        });
        
        await onSearchFilterUpdate(
          searchType,
          searchCategory,
          generatedParameters, // Use existing generated parameters
          newParameters // Use the new parameters directly
        );
        
        console.log('Successfully saved user-modified parameters to backend');
      } catch (error) {
        console.error('Failed to save user-modified parameters to backend:', error);
      }
    }
  }, [parsedJD?.searchFilters, onSearchFilterUpdate, searchType, searchCategory, generatedParameters]);


const handleClear = async () => {
  console.log('CandidateSearchParametersForm.handleClear called');
  console.log('CandidateSearchParametersForm.handleClear - current searchType:', searchType, 'searchCategory:', searchCategory);
  
  // Clear all parameters for the current search type and category
  const clearedParameters: any = {};
  const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
  clearedParameters[parameterKey] = {};
  console.log('CandidateSearchParametersForm.handleClear clearedParameters:', clearedParameters);
  
  // Update resolvedParametersState (PRIORITY 3)
  setResolvedParameters((prevResolved: any) => {
    const updated = {
      ...prevResolved,
      ...clearedParameters
    };
    console.log('CandidateSearchParametersForm.handleClear - updated resolvedParameters:', updated);
    return updated;
  });
  
  // Also clear parsedJD.searchParameters (PRIORITY 1) to ensure the clear takes effect
  setParsedJD((prevParsedJD: any) => {
    if (!prevParsedJD?.searchParameters) return prevParsedJD;
    
    const updatedSearchParameters = prevParsedJD.searchParameters.map((searchParam: any) => {
      if (searchParam.resolvedSearchParameters) {
        const updatedResolved = { ...searchParam.resolvedSearchParameters };
        
        // Clear the resolved parameters for the current search type/category (nested structure)
        updatedResolved[parameterKey] = {};
        
        // Also clear flat structure parameters that are specific to the current search type/category
        if (searchType === 'classic') {
          if (searchCategory === 'people') {
            // Clear classic people search parameters from flat structure
            const classicPeopleParams = ['keywords', 'network_distance', 'industry', 'location', 'company', 'school', 
              'profile_language', 'past_company', 'service', 'connections_of', 'followers_of', 'open_to',
              'advanced_keywords'];
            classicPeopleParams.forEach(param => {
              if (updatedResolved[param] !== undefined) {
                delete updatedResolved[param];
              }
            });
          } else if (searchCategory === 'companies') {
            const classicCompaniesParams = ['keywords', 'industry', 'location', 'headcount'];
            classicCompaniesParams.forEach(param => {
              if (updatedResolved[param] !== undefined) {
                delete updatedResolved[param];
              }
            });
          } else if (searchCategory === 'jobs') {
            const classicJobsParams = ['keywords', 'industry', 'location', 'company', 'seniority', 'job_type', 'presence'];
            classicJobsParams.forEach(param => {
              if (updatedResolved[param] !== undefined) {
                delete updatedResolved[param];
              }
            });
          }
        }
        
        // Clear display data for all parameter types to ensure UI is properly reset
        const displayKeys = ['industry_display', 'location_display', 'company_display', 'school_display'];
        displayKeys.forEach(displayKey => {
          if (updatedResolved[displayKey]) {
            delete updatedResolved[displayKey];
          }
        });
        
        return {
          ...searchParam,
          resolvedSearchParameters: updatedResolved
        };
      }
      return searchParam;
    });
    
    return {
      ...prevParsedJD,
      searchParameters: updatedSearchParameters
    };
  });
  
  console.log('CandidateSearchParametersForm.handleClear resolvedParameters:', resolvedParameters);
  
  // Save cleared parameters to backend to ensure persistence after page reload
  if (parsedJD?.searchFilters?.[0]?.id && onSearchFilterUpdate) {
    try {
      console.log('Saving cleared parameters to backend:', {
        searchFilterId: parsedJD.searchFilters?.[0]?.id,
        searchType,
        searchCategory,
        note: 'Cleared parameters are being saved to searchFilter'
      });
      
      // Create cleared parameters object for backend
      const clearedBackendParams: any = {};
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          clearedBackendParams.classicPeopleSearch = {};
        } else if (searchCategory === 'companies') {
          clearedBackendParams.classicCompaniesSearch = {};
        } else if (searchCategory === 'jobs') {
          clearedBackendParams.classicJobsSearch = {};
        }
      }
      
      await onSearchFilterUpdate(
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
          onSearchFilterUpdate={onSearchFilterUpdate}
          onSearch={stableSearchFunction}
          onClear={handleClear}
        />
      </StyledAdvancedSection>
    </StyledForm>
  );
};
