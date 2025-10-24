import { useArxJDUpload } from '@/arx-jd-upload/hooks/useArxJDUpload';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { SearchParametersForm } from '@/candidate-search/components/search-components/SearchParametersForm';
import {
  addRecentSearch,
  isSearchPanelOpenState,
  loadSearchConfigFromStorage,
  loadSearchParametersFromStorage,
  persistentSearchConfigState,
  persistentSearchParametersState,
  persistSearchConfig,
  persistSearchParameters,
  recentSearchesState
} from '@/candidate-search/states/searchPanelState';
import { addSearchResults, persistSearchMetadataToStorage, searchMetadataState, searchResultsState } from '@/candidate-search/states/searchResultsState';
import { LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/types/candidate-search.types';
import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useCallback, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { IconSearch, IconX } from 'twenty-ui';

const StyledSearchPanel = styled.div<{ isOpen: boolean; width: number }>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: ${({ isOpen, width }) => isOpen ? `${width}px` : '0px'};
  background-color: ${({ theme }) => theme.background.primary};
  border-right: 1px solid ${({ theme }) => theme.border.color.light};
  z-index: 1001;
  transition: width 300ms ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const StyledPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
  min-height: 60px;
`;

const StyledPanelTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledPanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledCloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledSearchTypeSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledSearchTypeTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledRadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledRadioOption = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.medium};
  }
  
  input[type="radio"] {
    margin: 0;
  }
  
  input[type="radio"]:checked + span {
    color: ${({ theme }) => theme.color.blue};
    font-weight: ${({ theme }) => theme.font.weight.medium};
  }
`;

const StyledStrategySection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledStrategyTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledStrategyInfo = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.4;
`;

const StyledRecentSearches = styled.div`
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledRecentSearchesTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledRecentSearchItem = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: ${({ theme }) => theme.spacing(2)};
  border: none;
  background: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
`;

const StyledRecentSearchName = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledRecentSearchMeta = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

type SearchPanelProps = {
  width?: number;
};

export const SearchPanel = ({ width = 350 }: SearchPanelProps) => {
  const [isOpen, setIsOpen] = useRecoilState(isSearchPanelOpenState);
  const [searchConfig, setSearchConfig] = useRecoilState(persistentSearchConfigState);
  const [searchParameters, setSearchParameters] = useRecoilState(persistentSearchParametersState);
  const [recentSearches, setRecentSearches] = useRecoilState(recentSearchesState);
  const [searchResults, setSearchResults] = useRecoilState(searchResultsState);
  const [searchMetadata, setSearchMetadata] = useRecoilState(searchMetadataState);
  
  const parsedJD = useRecoilValue(parsedJDSelector);
  const { updateSearchFilterRecord } = useArxJDUpload('job');
  const { enqueueSnackBar } = useSnackBar();
  const [tokenPair] = useRecoilState(tokenPairState);
  const jobId = useRecoilValue(jobIdAtom);
  const jobs = useRecoilValue(jobsState);

  // Check if job is still loading
  const currentJob = jobs.find(job => job.id === jobId);
  const isJobLoading = jobId && jobId !== 'job-id' && !currentJob;

  // Initialize persistent state from localStorage when panel opens
  useEffect(() => {
    if (isOpen) {
      const savedConfig = loadSearchConfigFromStorage();
      const savedParameters = loadSearchParametersFromStorage();
      
      console.log('Loading saved config from localStorage:', savedConfig);
      console.log('Loading saved parameters from localStorage:', savedParameters);
      
      // Always update config if we have saved data
      if (savedConfig) {
        setSearchConfig(savedConfig);
      }
      
      // Always update parameters if we have saved data
      if (savedParameters) {
        setSearchParameters(savedParameters);
      }
    }
  }, [isOpen, setSearchConfig, setSearchParameters]); // Run when panel opens

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  // Create a wrapper function that provides the searchFilterId
  const handleSearchFilterUpdate = useCallback(async (
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => {
    const currentParsedJD = parsedJD;
    const searchFilters = currentParsedJD?.searchFilters;
    
    if (searchFilters) {
      try {
        await updateSearchFilterRecord(
          searchFilters,
          searchType,
          searchCategory,
          generatedParameters,
          resolvedParameters
        );
        console.log('✅ Successfully saved search parameters to backend via updateSearchFilterRecord');
      } catch (error) {
        console.error('❌ Failed to save search parameters to backend:', error);
      }
    } else {
      console.log('⚠️ No searchFilterId available - cannot save to backend');
    }
  }, [updateSearchFilterRecord, parsedJD]);

  const handleSearch = useCallback(async (
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    searchParameters: any
  ) => {
    console.log('SearchPanel.handleSearch called with:', {
      searchType,
      searchCategory,
      searchParameters,
    });

    // Persist the search configuration and parameters
    persistSearchConfig(setSearchConfig)({ searchType, searchCategory });
    persistSearchParameters(setSearchParameters)(searchParameters);
    
    if (!parsedJD) {
      if (isJobLoading) {
        console.log('Job is still loading, waiting for job data...');
        enqueueSnackBar('Loading job data, please wait...', {
          variant: SnackBarVariant.Info,
        });
        return;
      } else {
        console.error('No parsedJD available for search');
        enqueueSnackBar('No job description available for search', {
          variant: SnackBarVariant.Error,
        });
        return;
      }
    }

    try {
      // Call the existing search endpoint
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/search/from-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
        },
        body: JSON.stringify({
          filePath: parsedJD.filePath || 'standalone_search',
          jobDescription: parsedJD.description || '',
          jobTitle: parsedJD.name || '',
          company: parsedJD.companyName || '',
          location: parsedJD.jobLocation || '',
          industry: parsedJD.companyName || '',
          searchType,
          searchCategory,
          searchParameters,
          parsedJD,
          options: {
            limit: 10,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Search request failed: ${response.statusText}`);
      }

      const searchResponse = await response.json();
      
      if (searchResponse.searchResults?.items) {
        const { items, cursor, paging } = searchResponse.searchResults;
        const totalCount = paging?.total_count || 0;
        
        // Add results to search results state
        addSearchResults(setSearchResults)(items);
        
        // Update metadata
        const newMetadata = {
          totalCount,
          currentPage: 1,
          totalPages: Math.ceil(totalCount / 10),
          cursor,
          searchType: searchResponse.searchMetadata?.searchType,
          searchCategory: searchResponse.searchMetadata?.searchCategory,
          searchParameters: searchResponse.resolvedSearchParameters || searchParameters,
        };
        setSearchMetadata(newMetadata);
        persistSearchMetadataToStorage(newMetadata);
        
        // Add to recent searches
        addRecentSearch(setRecentSearches)({
          name: `${searchParameters.keywords || 'Search'} - ${searchCategory}`,
          searchType,
          searchCategory,
          parameters: searchParameters,
          resultCount: items.length,
        });
        
        enqueueSnackBar(`Found ${items.length} candidates`, {
          variant: SnackBarVariant.Success,
        });
      } else if (searchResponse.transformedCandidates) {
        // Handle transformed candidates for DataTable
        const transformedCandidates = searchResponse.transformedCandidates;
        const totalCount = searchResponse.searchResults?.paging?.total_count || transformedCandidates.length;
        
        // Add transformed candidates to search results state
        addSearchResults(setSearchResults)(transformedCandidates);
        
        // Update metadata
        const newMetadata = {
          totalCount,
          currentPage: 1,
          totalPages: Math.ceil(totalCount / 10),
          cursor: searchResponse.searchResults?.cursor,
          searchType: searchResponse.searchMetadata?.searchType,
          searchCategory: searchResponse.searchMetadata?.searchCategory,
          searchParameters: searchResponse.resolvedSearchParameters || searchParameters,
        };
        setSearchMetadata(newMetadata);
        persistSearchMetadataToStorage(newMetadata);
        
        // Add to recent searches
        addRecentSearch(setRecentSearches)({
          name: `${searchParameters.keywords || 'Search'} - ${searchCategory}`,
          searchType,
          searchCategory,
          parameters: searchParameters,
          resultCount: transformedCandidates.length,
        });
        
        enqueueSnackBar(`Found ${transformedCandidates.length} candidates`, {
          variant: SnackBarVariant.Success,
        });
      } else {
        enqueueSnackBar('No search results found', {
          variant: SnackBarVariant.Warning,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      enqueueSnackBar('Search failed. Please try again.', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [parsedJD, setSearchResults, setSearchMetadata, setRecentSearches, enqueueSnackBar]);

  const handleRecentSearchClick = useCallback((recentSearch: any) => {
    // Update persistent state
    persistSearchConfig(setSearchConfig)({ 
      searchType: recentSearch.searchType, 
      searchCategory: recentSearch.searchCategory 
    });
    persistSearchParameters(setSearchParameters)(recentSearch.parameters);
    
    // Trigger search with recent parameters
    handleSearch(recentSearch.searchType, recentSearch.searchCategory, recentSearch.parameters);
  }, [handleSearch, setSearchConfig, setSearchParameters]);

  if (!isOpen) {
    return null;
  }

  return (
    <StyledSearchPanel isOpen={isOpen} width={width}>
      <StyledPanelHeader>
        <StyledPanelTitle>
          <IconSearch size={20} />
          New Search
        </StyledPanelTitle>
        <StyledCloseButton onClick={closePanel}>
          <IconX size={16} />
        </StyledCloseButton>
      </StyledPanelHeader>

      <StyledPanelContent>
        {/* Search Strategy */}
        {isJobLoading ? (
          <StyledStrategySection>
            <StyledStrategyTitle>Loading Job Data...</StyledStrategyTitle>
            <StyledStrategyInfo>
              <div>Please wait while we load the job information...</div>
            </StyledStrategyInfo>
          </StyledStrategySection>
        ) : parsedJD ? (
          <StyledStrategySection>
            <StyledStrategyTitle>Search Strategy</StyledStrategyTitle>
            <StyledStrategyInfo>
              <div><strong>Job:</strong> {parsedJD.name}</div>
              <div><strong>Company:</strong> {parsedJD.companyName}</div>
              <div><strong>Location:</strong> {parsedJD.jobLocation}</div>
            </StyledStrategyInfo>
          </StyledStrategySection>
        ) : (
          <StyledStrategySection>
            <StyledStrategyTitle>No Job Data</StyledStrategyTitle>
            <StyledStrategyInfo>
              <div>No job description available. Please select a job first.</div>
            </StyledStrategyInfo>
          </StyledStrategySection>
        )}

        {/* Search Parameters Form */}
        {!isJobLoading && (
          <SearchParametersForm
            onSearch={handleSearch}
            isLoading={false}
            onSearchFilterUpdate={handleSearchFilterUpdate}
            searchType={searchConfig.searchType}
            searchCategory={searchConfig.searchCategory}
            initialParameters={searchParameters}
          />
        )}

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <StyledRecentSearches>
            <StyledRecentSearchesTitle>Recent Searches</StyledRecentSearchesTitle>
            {recentSearches.map((search) => (
              <StyledRecentSearchItem
                key={search.id}
                onClick={() => handleRecentSearchClick(search)}
              >
                <StyledRecentSearchName>{search.name}</StyledRecentSearchName>
                <StyledRecentSearchMeta>
                  {search.resultCount} results • {search.timestamp.toLocaleDateString()}
                </StyledRecentSearchMeta>
              </StyledRecentSearchItem>
            ))}
          </StyledRecentSearches>
        )}
      </StyledPanelContent>
    </StyledSearchPanel>
  );
};
