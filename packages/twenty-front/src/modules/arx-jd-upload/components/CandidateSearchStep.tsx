import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import { useCallback, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { IconRefresh } from 'twenty-ui';
import {
  CandidateSearchState,
  LinkedInSearchCategory,
  LinkedInSearchResult,
  LinkedInSearchType
} from '../types/CandidateSearch';
import { ParsedJD } from '../types/ParsedJD';
import { ArxJDStepNavigation } from './ArxJDStepNavigation';
import { CandidateSearchParametersForm } from './CandidateSearchParametersForm';
import { CandidateSearchResultsTable } from './CandidateSearchResultsTable';

type CandidateSearchStepProps = {
  parsedJD: ParsedJD;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
  onCandidatesSelected: (candidates: LinkedInSearchResult[]) => void;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledDescription = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  margin: 0;
`;

const StyledSearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
`;

const StyledLoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledErrorContainer = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.red10};
  border: 1px solid ${({ theme }) => theme.color.red20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.color.red60};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export const CandidateSearchStep = ({
  parsedJD,
  onSkip,
  onNext,
  onBack,
  onCandidatesSelected,
}: CandidateSearchStepProps) => {
  const [searchState, setSearchState] = useState<CandidateSearchState>({
    isSearching: false,
    searchResults: [],
    selectedCandidates: [],
    currentPage: 0,
    totalPages: 0,
    totalCount: 0,
  });

  const [showResults, setShowResults] = useState(false);
  const searchFunctionRef = useRef<(() => void) | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  console.log('tokenPair::', tokenPair);
  console.log('parsedJD.searchParameters::', parsedJD.searchParameters);
  console.log('parsedJD.searchParameters?.generatedSearchParameters::', parsedJD.searchParameters?.generatedSearchParameters);
  console.log('parsedJD.searchParameters?.resolvedSearchParameters::', parsedJD.searchParameters?.resolvedSearchParameters);
  // Create a placeholder search function that shows loading state when not ready
  const placeholderSearchFunction = useCallback(() => {
    if (!searchFunctionRef.current) {
      console.log('Search function not ready yet, please wait...');
      return;
    }
    searchFunctionRef.current();
  }, []);

  const handleSearch = useCallback(async (
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    searchParameters: any
  ) => {
    console.log('CandidateSearchStep.handleSearch called with:', {
      searchType,
      searchCategory,
      searchParameters,
      parsedJDHasFilePath: !!parsedJD.searchParameters?.filePath
    });
    
    setSearchState(prev => ({ ...prev, isSearching: true, error: undefined }));

    try {
      // Use file-based search if we have pre-generated search parameters
      const requestBody = parsedJD.searchParameters?.filePath 
        ? {
            filePath: parsedJD.searchParameters.filePath,
            parsedJobDescription: parsedJD.searchParameters.parsedJobDescription,
            // Use the updated searchParameters from the form, or fall back to resolved parameters (with LinkedIn IDs)
            generatedSearchParameters: parsedJD.searchParameters.resolvedSearchParameters || searchParameters || parsedJD.searchParameters.generatedSearchParameters,
            searchType,
            searchCategory,
            options: {
              limit: 10,
            },
          }
        : {
            jobDescription: parsedJD.description || '',
            jobTitle: parsedJD.name,
            company: parsedJD.companyName,
            location: parsedJD.jobLocation,
            industry: parsedJD.companyName, // Using company name as industry for now
            searchType,
            searchCategory,
            // Include the updated search parameters from the form
            searchParameters: searchParameters,
            // accountId will be retrieved from workspace by backend
            options: {
              limit: 10,
            },
          };

      const endpoint = parsedJD.searchParameters?.filePath 
        ? '/candidate-search/search/from-file'
        : '/candidate-search/search';

      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const searchResponse = await response.json();
      
      if (searchResponse.searchResults?.items) {
        setSearchState(prev => ({
          ...prev,
          searchResults: searchResponse.searchResults.items,
          totalCount: searchResponse.searchResults.paging?.total_count || 0,
          totalPages: Math.ceil((searchResponse.searchResults.paging?.total_count || 0) / 10),
          currentPage: 1,
          cursor: searchResponse.searchResults.paging?.cursor,
          searchParameters: searchParameters, // Store the parameters used for this search
          searchType: searchResponse.searchMetadata.searchType,
          searchCategory: searchResponse.searchMetadata.searchCategory,
          isSearching: false,
        }));
        setShowResults(true);
      } else {
        throw new Error('No search results returned');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchState(prev => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }));
    }
  }, [parsedJD]);

  const handleLoadMore = useCallback(async () => {
    if (!searchState.cursor || searchState.isSearching) return;

    setSearchState(prev => ({ ...prev, isSearching: true }));

    try {
      // Use file-based search if we have pre-generated search parameters
      const requestBody = parsedJD.searchParameters?.filePath 
        ? {
            filePath: parsedJD.searchParameters.filePath,
            parsedJobDescription: parsedJD.searchParameters.parsedJobDescription,
            generatedSearchParameters: parsedJD.searchParameters.resolvedSearchParameters || searchState.searchParameters || parsedJD.searchParameters.generatedSearchParameters,
            searchType: searchState.searchType || 'classic',
            searchCategory: searchState.searchCategory || 'people',
            options: {
              cursor: searchState.cursor,
              limit: 10,
            },
          }
        : {
            jobDescription: parsedJD.description || '',
            jobTitle: parsedJD.name,
            company: parsedJD.companyName,
            location: parsedJD.jobLocation,
            industry: parsedJD.companyName,
            searchType: searchState.searchType || 'classic',
            searchCategory: searchState.searchCategory || 'people',
            // Use the search parameters from the current search state
            searchParameters: searchState.searchParameters,
            // accountId will be retrieved from workspace by backend
            options: {
              cursor: searchState.cursor,
              limit: 10,
            },
          };

      const endpoint = parsedJD.searchParameters?.filePath 
        ? '/candidate-search/search/from-file'
        : '/candidate-search/search';

      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Load more failed: ${response.statusText}`);
      }

      const searchResponse = await response.json();
      
      if (searchResponse.searchResults?.items) {
        setSearchState(prev => ({
          ...prev,
          searchResults: [...prev.searchResults, ...searchResponse.searchResults.items],
          currentPage: prev.currentPage + 1,
          cursor: searchResponse.searchResults.paging?.cursor,
          isSearching: false,
        }));
      }
    } catch (error) {
      console.error('Load more error:', error);
      setSearchState(prev => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Load more failed',
      }));
    }
  }, [searchState.cursor, searchState.isSearching, parsedJD]);

  const handleCandidateSelection = useCallback((candidates: LinkedInSearchResult[]) => {
    setSearchState(prev => ({ ...prev, selectedCandidates: candidates }));
  }, []);

  const handleProceedWithCandidates = useCallback(() => {
    onCandidatesSelected(searchState.selectedCandidates);
    onNext();
  }, [searchState.selectedCandidates, onNext]);

  const handleSkipSearch = useCallback(() => {
    onSkip();
  }, [onSkip]);

  if (showResults) {
    return (
      <StyledContainer>
        <StyledHeader>
          <StyledTitle>Search Results</StyledTitle>
          <StyledDescription>
            Found {searchState.totalCount} candidates. Select the ones you want to add to your candidate pool.
          </StyledDescription>
        </StyledHeader>

        {searchState.error && (
          <StyledErrorContainer>
            {searchState.error}
          </StyledErrorContainer>
        )}

        <CandidateSearchResultsTable
          results={searchState.searchResults}
          selectedCandidates={searchState.selectedCandidates}
          onSelectionChange={handleCandidateSelection}
          isLoading={searchState.isSearching}
          hasMore={!!searchState.cursor}
          onLoadMore={handleLoadMore}
        />

        <ArxJDStepNavigation
          onBack={() => setShowResults(false)}
          onNext={handleProceedWithCandidates}
          onSkipSearch={handleSkipSearch}
          showBackButton={true}
          showNextButton={true}
          showSearchButton={false}
          showSkipSearchButton={true}
          nextLabel={`Add ${searchState.selectedCandidates.length} Candidates`}
          isNextDisabled={searchState.selectedCandidates.length === 0}
        />
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledTitle>Search Candidates</StyledTitle>
        <StyledDescription>
          Use LinkedIn to find candidates that match your job requirements. 
          We'll generate search parameters based on your job description.
        </StyledDescription>
      </StyledHeader>

      {searchState.error && (
        <StyledErrorContainer>
          {searchState.error}
        </StyledErrorContainer>
      )}

      {searchState.isSearching ? (
        <StyledLoadingContainer>
          <IconRefresh size={20} />
          <span style={{ marginLeft: '8px' }}>Searching LinkedIn...</span>
        </StyledLoadingContainer>
      ) : (
        <StyledSearchContainer>
          <CandidateSearchParametersForm
            parsedJD={parsedJD}
            onSearch={handleSearch}
            isLoading={searchState.isSearching}
            onSearchRef={(fn) => { 
              searchFunctionRef.current = fn; 
            }}
            generatedParameters={parsedJD.searchParameters?.generatedSearchParameters}
          />
        </StyledSearchContainer>
      )}

      <ArxJDStepNavigation
        onBack={onBack}
        onSearch={placeholderSearchFunction}
        onSkipSearch={handleSkipSearch}
        showBackButton={true}
        showNextButton={false}
        showSearchButton={true}
        showSkipSearchButton={true}
        isSearchDisabled={searchState.isSearching}
        searchLabel={
          searchState.isSearching 
            ? 'Searching...' 
            : 'Search LinkedIn'
        }
      />
    </StyledContainer>
  );
};
