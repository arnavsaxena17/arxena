import { useSearchParameters } from '@/arx-jd-upload/hooks/useSearchParameters';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { SearchParametersManager } from '@/candidate-search/components/search-components/SearchParametersManager';
import { LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/types/CandidateSearch';
import { resolvedParametersSelector } from '@/candidate-table/states/states';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';

import { CompanyFilters } from './CompanyFilters';
import { JobFilters } from './JobFilters';
import { LoadingStatus } from './LoadingStatus';
import { SearchCategorySelector } from './SearchCategorySelector';
import { StyledAdvancedSection, StyledForm } from './SearchFormComponents.styled';
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
  onGeneratedParametersChange?: (parameters: any) => void;
};

export const SearchParametersForm = ({
  onSearch,
  isLoading,
  onSearchRef,
  generatedParameters,
  onSearchFilterUpdate,
  onGeneratedParametersChange,
}: SearchParametersFormProps) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [searchType, setSearchType] = useState<LinkedInSearchType>('classic');
  const [searchCategory, setSearchCategory] = useState<LinkedInSearchCategory>('people');
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);
  const [resolvedParameters, setResolvedParameters] = useRecoilState(resolvedParametersSelector);
  
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
  
  // Create a stable resolved parameters object that doesn't change unless the actual resolved parameters change
  const stableResolvedParameters = useMemo(() => {
    return resolvedParameters;
  }, [resolvedParameters]);

  // Helper function to check if search parameters exist for a given search type and category
  const checkHasSearchParameters = useCallback((searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory) => {
    return hasSearchParameters(resolvedParameters, searchType, searchCategory);
  }, [resolvedParameters, hasSearchParameters]);

  // Helper function to generate missing search parameters
  const generateMissingSearchParameters = useCallback(async (
    searchType: LinkedInSearchType, 
    searchCategory: LinkedInSearchCategory
  ) => {
    if (!parsedJD?.parsedJobDescription) {
      console.log('Missing parsed job description for parameter generation');
      return null;
    }

    try {
      const result = await generateAndResolveSearchParameters(
        parsedJD?.parsedJobDescription,
        searchType,
        searchCategory
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
  }, [parsedJD?.parsedJobDescription, generateAndResolveSearchParameters, onSearchFilterUpdate, parsedJD?.searchFilters]);

  // Handler for search type changes
  const handleSearchTypeChange = useCallback(async (newSearchType: LinkedInSearchType) => {
    console.log('Search type changed to:', newSearchType);
    
    setSearchType(newSearchType);
    
    // Check if we have parameters for this search type and category
    if (!checkHasSearchParameters(newSearchType, searchCategory)) {
      console.log(`Missing parameters for ${newSearchType} ${searchCategory}, generating...`);
      await generateMissingSearchParameters(newSearchType, searchCategory);
    }
  }, [searchCategory, checkHasSearchParameters, generateMissingSearchParameters]);

  // Handler for search category changes
  const handleSearchCategoryChange = useCallback(async (newSearchCategory: LinkedInSearchCategory) => {
    console.log('Search category changed to:', newSearchCategory);
    
    setSearchCategory(newSearchCategory);
    
    // Check if we have parameters for this search type and category
    if (!checkHasSearchParameters(searchType, newSearchCategory)) {
      console.log(`Missing parameters for ${searchType} ${newSearchCategory}, generating...`);
      await generateMissingSearchParameters(searchType, newSearchCategory);
    }
  }, [searchType, checkHasSearchParameters, generateMissingSearchParameters]);

  // Initialize resolved parameters from parsedJD if available
  useEffect(() => {
    if (parsedJD?.searchParameters) {
      // Look for resolved parameters in any of the search parameters
      for (const searchParam of parsedJD.searchParameters) {
        if (searchParam.resolvedSearchParameters) {
          console.log('Initializing resolved parameters from parsedJD:', searchParam.resolvedSearchParameters);
          setResolvedParameters(searchParam.resolvedSearchParameters);
          break; // Use the first one found
        }
      }
    }
  }, [parsedJD?.searchParameters, setResolvedParameters]);

  // Create a stable search function that always calls the current handleSearch
  const stableSearchFunction = useCallback(() => {
    const parameters: any = {
      easyApply: easyApply,
      inYourNetwork: inYourNetwork,
      fairChanceEmployer: fairChanceEmployer,
      hasJobOffers: hasJobOffers,
      sortBy: sortBy,
      datePosted: datePosted,
      locationWithinArea: locationWithinArea,
    };
    
    // Remove undefined values
    Object.keys(parameters).forEach(key => {
      if (parameters[key] === undefined) {
        delete parameters[key];
      }
    });
    
    console.log('CandidateSearchParametersForm.stableSearchFunction calling onSearch with:', {
      searchType,
      searchCategory,
      parameters,
    });
    
    onSearch(searchType, searchCategory, parameters);
  }, [
    searchType, searchCategory, easyApply, inYourNetwork, fairChanceEmployer, hasJobOffers, 
    sortBy, datePosted, locationWithinArea, onSearch
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
        />
      </StyledAdvancedSection>
    </StyledForm>
  );
};
