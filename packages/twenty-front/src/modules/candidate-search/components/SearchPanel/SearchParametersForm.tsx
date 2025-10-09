import { useSearchParameters } from '@/arx-jd-upload/hooks/useSearchParameters';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/CandidateSearch';
import { SearchParametersManager } from '@/candidate-search/components/search-components/SearchParametersManager';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

import { CompanyFilters } from './CompanyFilters';
import { JobFilters } from './JobFilters';
import { LoadingStatus } from './LoadingStatus';
import { SearchCategorySelector } from './SearchCategorySelector';
import { StyledAdvancedSection, StyledForm } from './SearchFormComponents.styled';
import { SearchTypeSelector } from './SearchTypeSelector';

type SearchParametersFormProps = {
  parsedJD: ParsedJD;
  onSearch: (searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory, parameters: any) => void;
  isLoading: boolean;
  onSearchRef?: (searchFn: () => void) => void;
  generatedParameters?: any;
  searchFilterId?: string;
  onSearchFilterUpdate?: (  
    searchFilterId: string,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>;
  onGeneratedParametersChange?: (parameters: any) => void;
};

export const SearchParametersForm = ({
  parsedJD,
  onSearch,
  isLoading,
  onSearchRef,
  generatedParameters,
  searchFilterId,
  onSearchFilterUpdate,
  onGeneratedParametersChange,
}: SearchParametersFormProps) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [searchType, setSearchType] = useState<LinkedInSearchType>('classic');
  const [searchCategory, setSearchCategory] = useState<LinkedInSearchCategory>('people');
  
  // Use the centralized search parameters service
  const { generateAndResolveSearchParameters, hasSearchParameters, isGenerating, isResolving } = useSearchParameters();
  const [easyApply, setEasyApply] = useState<boolean | undefined>(undefined);
  const [inYourNetwork, setInYourNetwork] = useState<boolean | undefined>(undefined);
  const [fairChanceEmployer, setFairChanceEmployer] = useState<boolean | undefined>(undefined);
  const [hasJobOffers, setHasJobOffers] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [datePosted, setDatePosted] = useState<number | undefined>(undefined);
  const [locationWithinArea, setLocationWithinArea] = useState<number | undefined>(undefined);
  const [advancedParameters, setAdvancedParameters] = useState<any>({});
  const [resolvedParameters, setResolvedParameters] = useState<any>(null);
  const [localGeneratedParameters, setLocalGeneratedParameters] = useState<any>(() => {
    // Initialize with merged parameters if available
    return generatedParameters || {};
  });
  const hasSetResolvedParameters = useRef(false);
  const lastNotifiedParameters = useRef<any>(null);
  
  // Create a stable resolved parameters object that doesn't change unless the actual resolved parameters change
  const stableResolvedParameters = useMemo(() => {
    return resolvedParameters;
  }, [resolvedParameters]);

  // Debug logging - only log when values actually change to reduce noise
  const lastLoggedGeneratedParams = useRef<any>(null);
  useEffect(() => {
    const currentStr = JSON.stringify(generatedParameters);
    const lastStr = JSON.stringify(lastLoggedGeneratedParams.current);
    if (currentStr !== lastStr) {
      console.log('CandidateSearchParametersForm received generatedParameters:', generatedParameters);
      lastLoggedGeneratedParams.current = generatedParameters;
    }
  }, [generatedParameters]);

  // Sync local generated parameters with props - use deep comparison to prevent infinite loops
  useEffect(() => {
    if (generatedParameters) {
      setLocalGeneratedParameters((prev: any) => {
        // Deep comparison to prevent unnecessary updates
        const prevStr = JSON.stringify(prev);
        const newStr = JSON.stringify(generatedParameters);
        
        if (prevStr === newStr) {
          return prev; // No change needed
        }
        
        // Merge with existing parameters to preserve all search types
        const merged = {
          ...prev,
          ...generatedParameters
        };
        console.log('Merging generated parameters from props:', {
          previous: prev,
          new: generatedParameters,
          merged: merged
        });
        return merged;
      });
    }
  }, [JSON.stringify(generatedParameters)]); // Use JSON.stringify for deep comparison

  // Notify parent when generated parameters change - use deep comparison to prevent infinite loops
  useEffect(() => {
    if (onGeneratedParametersChange && localGeneratedParameters) {
      const currentStr = JSON.stringify(localGeneratedParameters);
      const lastStr = JSON.stringify(lastNotifiedParameters.current);
      
      if (currentStr !== lastStr) {
        onGeneratedParametersChange(localGeneratedParameters);
        lastNotifiedParameters.current = localGeneratedParameters;
      }
    }
  }, [JSON.stringify(localGeneratedParameters), onGeneratedParametersChange]);

  // Helper function to check if search parameters exist for a given search type and category
  const checkHasSearchParameters = useCallback((searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory) => {
    return hasSearchParameters(localGeneratedParameters, searchType, searchCategory);
  }, [localGeneratedParameters, hasSearchParameters]);

  // Helper function to generate missing search parameters
  const generateMissingSearchParameters = useCallback(async (
    searchType: LinkedInSearchType, 
    searchCategory: LinkedInSearchCategory
  ) => {
    if (!parsedJD.parsedJobDescription) {
      console.log('Missing parsed job description for parameter generation');
      return null;
    }

    try {
      const result = await generateAndResolveSearchParameters(
        parsedJD.parsedJobDescription,
        searchType,
        searchCategory
      );
      
      // Update the local generated parameters state - properly merge with existing parameters
      setLocalGeneratedParameters((prev: any) => {
        const merged = {
          ...prev,
          ...result.generatedParameters
        };
        console.log('Merging generated parameters:', {
          previous: prev,
          new: result.generatedParameters,
          merged: merged
        });
        return merged;
      });
      
      // Update resolved parameters - properly merge with existing parameters
      setResolvedParameters((prev: any) => {
        const merged = {
          ...prev,
          ...result.resolvedParameters
        };
        console.log('Merging resolved parameters:', {
          previous: prev,
          new: result.resolvedParameters,
          merged: merged
        });
        return merged;
      });
      
      // Explicitly save the merged parameters to the database
      if (onSearchFilterUpdate && result.resolvedParameters) {
        // Get the merged parameters that will be saved
        const mergedGeneratedParams = {
          ...localGeneratedParameters,
          ...result.generatedParameters
        };
        const mergedResolvedParams = {
          ...resolvedParameters,
          ...result.resolvedParameters
        };
        
        console.log('Explicitly saving merged parameters to database:', {
          searchFilterId,
          searchType,
          searchCategory,
          mergedGeneratedParams,
          mergedResolvedParams,
          note: searchFilterId ? 'Updating existing search filter' : 'Creating new search filter'
        });
        
        try {
          if (searchFilterId) {
            // Update existing search filter
            await onSearchFilterUpdate(
              searchFilterId,
              searchType,
              searchCategory,
              mergedGeneratedParams,
              mergedResolvedParams
            );
            console.log('Successfully updated existing search filter with merged parameters');
          } else {
            console.log('No searchFilterId available - cannot save parameters to database');
            console.log('Parameters generated and resolved but not saved:', {
              searchType,
              searchCategory,
              mergedGeneratedParams,
              mergedResolvedParams
            });
          }
        } catch (error) {
          console.error('Failed to save merged parameters to database:', error);
        }
      } else if (!onSearchFilterUpdate) {
        console.log('No onSearchFilterUpdate function available - cannot save parameters');
      } else if (!result.resolvedParameters) {
        console.log('No resolved parameters available - cannot save');
      }
      
      return result.generatedParameters;
    } catch (error) {
      console.error('Failed to generate search parameters:', error);
      return null;
    }
  }, [parsedJD.parsedJobDescription, generateAndResolveSearchParameters]);

  // Handler for search type changes
  const handleSearchTypeChange = useCallback(async (newSearchType: LinkedInSearchType) => {
    console.log('Search type changed to:', newSearchType);
    setSearchType(newSearchType);
    
    // Check if we have parameters for this search type and category
    if (!checkHasSearchParameters(newSearchType, searchCategory)) {
      console.log(`Missing parameters for ${newSearchType} ${searchCategory} in handleSearchTypeChange, generating...`);
      const generatedParams = await generateMissingSearchParameters(newSearchType, searchCategory);
      console.log('Generated parameters:', generatedParams);
      console.log('Local searchFilterId:', searchFilterId);
      console.log('Resolved parameters:', onSearchFilterUpdate);
      // Update search filter record if we have the necessary props
      if (searchFilterId && onSearchFilterUpdate && generatedParams) {
        // Get the merged parameters that will be saved
        const mergedGeneratedParams = {
          ...localGeneratedParameters,
          ...generatedParams
        };
        const mergedResolvedParams = {
          ...resolvedParameters
        };
        
        console.log('Updating search filter record on type change with merged parameters:', {
          searchFilterId,
          newSearchType,
          searchCategory,
          mergedGeneratedParams,
          mergedResolvedParams
        });
        try {
          await onSearchFilterUpdate(
            searchFilterId,
            newSearchType,
            searchCategory,
            mergedGeneratedParams, // Use the merged generated parameters
            mergedResolvedParams // Use the merged resolved parameters
          );
          console.log('Successfully updated search filter record on type change with merged parameters');
        } catch (error) {
          console.error('Failed to update search filter record on type change:', error);
        }
      }
    }
  }, [searchCategory, checkHasSearchParameters, generateMissingSearchParameters, searchFilterId, onSearchFilterUpdate, localGeneratedParameters, resolvedParameters]);

  // Handler for search category changes
  const handleSearchCategoryChange = useCallback(async (newSearchCategory: LinkedInSearchCategory) => {
    console.log('Search category changed to:', newSearchCategory);
    setSearchCategory(newSearchCategory);
    
    // Check if we have parameters for this search type and category
    if (!checkHasSearchParameters(searchType, newSearchCategory)) {
      console.log(`Missing parameters for ${searchType} ${newSearchCategory}, generating...`);
      const generatedParams = await generateMissingSearchParameters(searchType, newSearchCategory);
      
      // Update search filter record if we have the necessary props
      if (searchFilterId && onSearchFilterUpdate && generatedParams) {
        try {
          await onSearchFilterUpdate(
            searchFilterId,
            searchType,
            newSearchCategory,
            localGeneratedParameters, // Use the merged generated parameters
            resolvedParameters // Use the merged resolved parameters
          );
        } catch (error) {
          console.error('Failed to update search filter record on category change:', error);
        }
      }
    }
  }, [searchType, checkHasSearchParameters, generateMissingSearchParameters, searchFilterId, onSearchFilterUpdate, localGeneratedParameters, resolvedParameters]);

  // Check if parameters are already resolved from upload flow
  useEffect(() => {
    if (parsedJD.searchParameters?.[0]?.resolvedSearchParameters && !hasSetResolvedParameters.current) {
      console.log('Parameters already resolved from upload flow');
      setResolvedParameters(parsedJD.searchParameters[0].resolvedSearchParameters);
      hasSetResolvedParameters.current = true;
    }
  }, [parsedJD.searchParameters?.[0]?.resolvedSearchParameters]);

  // Initialize resolved parameters immediately if available - prevent infinite loops
  useEffect(() => {
    if (parsedJD.searchParameters?.[0]?.resolvedSearchParameters && !resolvedParameters) {
      console.log('Initializing resolved parameters from upload flow');
      setResolvedParameters(parsedJD.searchParameters[0].resolvedSearchParameters);
    }
  }, [parsedJD.searchParameters?.[0]?.resolvedSearchParameters]); // Remove resolvedParameters from dependencies

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
      ...advancedParameters, // Include advanced parameters from SearchParametersManager
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
      advancedParameters
    });
    
    onSearch(searchType, searchCategory, parameters);
  }, [
    searchType, searchCategory, easyApply, inYourNetwork, fairChanceEmployer, hasJobOffers, 
    sortBy, datePosted, locationWithinArea, onSearch, advancedParameters
  ]);

  const handleAdvancedParametersChange = useCallback((newParameters: any) => {
    console.log('CandidateSearchParametersForm.handleAdvancedParametersChange called:', {
      newParameters
    });
    setAdvancedParameters(newParameters);
    
    // Update resolvedParameters to reflect the new user-modified parameters
    // This ensures that when parameters are modified, the resolvedParameters state is updated
    setResolvedParameters((prevResolved: any) => {
      if (prevResolved) {
        // Update the resolved parameters with the new user-modified parameters
        const updatedResolved = { ...prevResolved };
        if (updatedResolved.classicPeopleSearch) {
          updatedResolved.classicPeopleSearch = {
            ...updatedResolved.classicPeopleSearch,
            ...newParameters
          };
        } else if (updatedResolved.classicCompaniesSearch) {
          updatedResolved.classicCompaniesSearch = {
            ...updatedResolved.classicCompaniesSearch,
            ...newParameters
          };
        } else if (updatedResolved.classicJobsSearch) {
          updatedResolved.classicJobsSearch = {
            ...updatedResolved.classicJobsSearch,
            ...newParameters
          };
        }
        return updatedResolved;
      }
      return prevResolved;
    });
  }, []); // Empty dependency array is correct here since we don't need to recreate the function

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
          generatedParameters={localGeneratedParameters}
          resolvedParameters={stableResolvedParameters}
          searchFilterId={searchFilterId}
          onSearchFilterUpdate={onSearchFilterUpdate}
        />
      </StyledAdvancedSection>
    </StyledForm>
  );
};
