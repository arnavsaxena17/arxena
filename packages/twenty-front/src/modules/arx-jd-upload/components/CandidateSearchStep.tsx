import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  onSearchFilterUpdate?: (
    searchFilterId: string,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>;
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
  onSearchFilterUpdate,
}: CandidateSearchStepProps) => {
  // Create a unique key for this job description to persist data
  const persistenceKey = `candidate-search-${parsedJD.id || parsedJD.name || 'default'}`;
  
  const [searchState, setSearchState] = useState<CandidateSearchState>({
    isSearching: false,
    searchResults: [],
    selectedCandidates: [],
    currentPage: 0,
    totalPages: 0,
    totalCount: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [currentGeneratedParameters, setCurrentGeneratedParameters] = useState<any>(parsedJD.searchParameters?.[0]?.generatedSearchParameters);
  console.log('searchState::', searchState);

  // Helper function to transform parsedJD to include parsedJobDescription
  const transformParsedJD = useCallback((jd: ParsedJD) => {
    return {
      ...jd,
      parsedJobDescription: jd.parsedJobDescription || {
        jobTitle: jd.name || '',
        company: jd.companyName || '',
        location: jd.jobLocation || '',
        industry: jd.companyName || '', // Using company name as industry for now
        requiredSkills: [],
        preferredSkills: [],
        experienceLevel: 'mid_level' as const,
        education: [],
        keywords: [],
        responsibilities: [],
        qualifications: [],
        benefits: [],
        employmentType: 'full_time' as const,
        remoteWork: false,
        salaryRange: null,
      }
    };
  }, []);

  const [showResults, setShowResults] = useState(false);
  const searchFunctionRef = useRef<(() => void) | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentWorkspaceMember] = useRecoilState(currentWorkspaceMemberState);

  // Load persisted data on component mount
  useEffect(() => {
    try {
      const persistedData = localStorage.getItem(persistenceKey);
      if (persistedData) {
        const parsed = JSON.parse(persistedData);
        setSearchState(prev => ({
          ...prev,
          searchResults: parsed.searchResults || [],
          selectedCandidates: parsed.selectedCandidates || [],
          currentPage: parsed.currentPage || 0,
          totalPages: parsed.totalPages || 0,
          totalCount: parsed.totalCount || 0,
          cursor: parsed.cursor,
          searchParameters: parsed.searchParameters,
          searchType: parsed.searchType,
          searchCategory: parsed.searchCategory,
        }));
        if (parsed.searchResults && parsed.searchResults.length > 0) {
          setShowResults(true);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted search data:', error);
    }
  }, [persistenceKey]);

  // Persist data whenever search state changes
  useEffect(() => {
    try {
      const dataToPersist = {
        searchResults: searchState.searchResults,
        selectedCandidates: searchState.selectedCandidates,
        currentPage: searchState.currentPage,
        totalPages: searchState.totalPages,
        totalCount: searchState.totalCount,
        cursor: searchState.cursor,
        searchParameters: searchState.searchParameters,
        searchType: searchState.searchType,
        searchCategory: searchState.searchCategory,
      };
      localStorage.setItem(persistenceKey, JSON.stringify(dataToPersist));
    } catch (error) {
      console.error('Failed to persist search data:', error);
    }
  }, [searchState, persistenceKey]);
  console.log('tokenPair::', tokenPair);
  console.log('parsedJD.searchParameters::', parsedJD.searchParameters);
  console.log('parsedJD.parsedJobDescription::', parsedJD.parsedJobDescription);
  console.log('parsedJD.filePath::', parsedJD.filePath);
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
      parsedJDHasFilePath: !!parsedJD.filePath
    });
    
    setSearchState(prev => ({ ...prev, isSearching: true, error: undefined }));
    console.log('searchState::', searchState);

    try {
      // Transform parsedJD to include parsedJobDescription if not already present
      const transformedParsedJD = transformParsedJD(parsedJD);

      // Use file-based search if we have pre-generated search parameters
      const requestBody = parsedJD.filePath 
        ? {
            filePath: parsedJD.filePath,
            parsedJobDescription: transformedParsedJD.parsedJobDescription,
            parsedJD: transformedParsedJD, // Pass the transformed parsedJD object
            generatedSearchParameters: searchParameters || currentGeneratedParameters,
            resolvedSearchParameters: parsedJD.searchParameters?.[0]?.resolvedSearchParameters,
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

      const endpoint = parsedJD.filePath 
        ? '/candidate-search/search/from-file'
        : '/candidate-search/search/from-file';

      // Backend expects pagination options (limit) via query params, not body
      const initialLimit = 10;
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}${endpoint}?limit=${initialLimit}`, {
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
      console.log('Full search response:', searchResponse);
      
      if (searchResponse.searchResults?.items) {
        const cursor = searchResponse.searchResults?.cursor;
        console.log('Cursor from response:', cursor);
        
        setSearchState(prev => ({
          ...prev,
          searchResults: searchResponse.searchResults.items,
          totalCount: searchResponse.searchResults.paging?.total_count || 0,
          totalPages: Math.ceil((searchResponse.searchResults.paging?.total_count || 0) / 10),
          currentPage: 1,
          cursor: cursor,
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

  const loadMoreCandidates = useCallback(async (pagesToLoad: number = 1) => {
    console.log('CandidateSearchStep.loadMoreCandidates called with:', {
      cursor: searchState.cursor,
      isSearching: searchState.isSearching,
      pagesToLoad,
    });
    
    if (!searchState.cursor || searchState.isSearching) return;

    setSearchState(prev => ({ ...prev, isSearching: true }));

    try {
      let currentCursor = searchState.cursor;
      let allNewResults: LinkedInSearchResult[] = [];
      let newCursor: string | undefined = currentCursor;
      let pagesLoaded = 0;

      // Load multiple pages
      for (let i = 0; i < pagesToLoad && newCursor; i++) {
        // Transform parsedJD to include parsedJobDescription if not already present
        const transformedParsedJD = transformParsedJD(parsedJD);

        // Use file-based search if we have pre-generated search parameters
        const requestBody: any = parsedJD.filePath 
          ? {
              filePath: parsedJD.filePath,
              parsedJobDescription: transformedParsedJD.parsedJobDescription,
              parsedJD: transformedParsedJD, // Pass the transformed parsedJD object
              generatedSearchParameters: searchState.searchParameters || currentGeneratedParameters,
              resolvedSearchParameters: parsedJD.searchParameters?.[0]?.resolvedSearchParameters,
              searchType: searchState.searchType || 'classic',
              searchCategory: searchState.searchCategory || 'people',
              options: {
                cursor: newCursor,
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
                cursor: newCursor,
                limit: 10,
              },
            };

        const endpoint = parsedJD.filePath 
          ? '/candidate-search/search/from-file'
          : '/candidate-search/search/from-file';

        // Backend controller reads cursor and limit from query params, not request body
        const pageLimit = 10;
        const urlWithQuery = `${process.env.REACT_APP_SERVER_BASE_URL}${endpoint}?cursor=${encodeURIComponent(newCursor)}&limit=${pageLimit}`;
        const response: Response = await fetch(urlWithQuery, {
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

        const searchResponse: any = await response.json();
        console.log(`Load more response for page ${i + 1}:`, searchResponse);
        
        if (searchResponse.searchResults?.items) {
          allNewResults = [...allNewResults, ...searchResponse.searchResults.items];
          // Prefer top-level cursor; fallback to paging.cursor for backward compatibility
          newCursor = searchResponse.searchResults.cursor || searchResponse.searchResults.paging?.cursor;
          pagesLoaded++;
          
          // If no more cursor, break the loop
          if (!newCursor) break;
        } else {
          break;
        }
      }

      console.log(`Loaded ${pagesLoaded} pages with ${allNewResults.length} total candidates`);
      
      setSearchState(prev => {
        // Deduplicate results to prevent duplicates
        const existingIds = new Set(prev.searchResults.map(r => r.id));
        const uniqueNewResults = allNewResults.filter(result => !existingIds.has(result.id));
        
        return {
          ...prev,
          searchResults: [...prev.searchResults, ...uniqueNewResults],
          currentPage: prev.currentPage + pagesLoaded,
          cursor: newCursor,
          isSearching: false,
        };
      });
    } catch (error) {
      console.error('Load more error:', error);
      setSearchState(prev => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Load more failed',
      }));
    }
  }, [searchState.cursor, searchState.isSearching, searchState.searchParameters, searchState.searchType, searchState.searchCategory, parsedJD, tokenPair]);

  const handleLoadMore = useCallback(() => {
    loadMoreCandidates(1);
  }, [loadMoreCandidates]);

  const handleLoadMultiplePages = useCallback((pages: number) => {
    loadMoreCandidates(pages);
  }, [loadMoreCandidates]);

  const clearPersistedData = useCallback(() => {
    try {
      localStorage.removeItem(persistenceKey);
      setSearchState({
        isSearching: false,
        searchResults: [],
        selectedCandidates: [],
        currentPage: 0,
        totalPages: 0,
        totalCount: 0,
      });
      setShowResults(false);
    } catch (error) {
      console.error('Failed to clear persisted data:', error);
    }
  }, [persistenceKey]);

  const handleCandidateSelection = useCallback((candidates: LinkedInSearchResult[]) => {
    setSearchState(prev => ({ ...prev, selectedCandidates: candidates }));
  }, []);

  const handleProceedWithCandidates = useCallback(async () => {
    if (searchState.selectedCandidates.length === 0) {
      console.log('No candidates selected');
      return;
    }

    setIsUploading(true);
    setSearchState(prev => ({ ...prev, error: undefined }));

    try {
      console.log('Uploading selected candidates:', searchState.selectedCandidates.length);
      
      // Prepare the request body for upload-profiles endpoint
      const uploadRequestBody = {
        linkedin_search_results: searchState.selectedCandidates,
        data_source: 'linkedin_search',
        job_id: parsedJD.id,
        job_name: parsedJD.name,
        recruiterId: currentWorkspaceMember?.id,
        // Include job information for context
        job: {
          id: parsedJD.id,
          name: parsedJD.name,
          company: parsedJD.companyName,
          location: parsedJD.jobLocation,
          recruiterId: currentWorkspaceMember?.id,
        },
        // Include parsed JD for additional context
        parsedJD: parsedJD,
      };

      console.log('Upload request body:', uploadRequestBody);

      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/upload-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
        },
        body: JSON.stringify(uploadRequestBody),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadResult = await response.json();
      console.log('Upload result:', uploadResult);

      if (uploadResult.status === 'ok' || uploadResult.status === 'success') {
        console.log(`Successfully uploaded ${searchState.selectedCandidates.length} candidates`);
        // Clear persisted data after successful upload
        clearPersistedData();
        onCandidatesSelected(searchState.selectedCandidates);
        onNext();
      } else {
        throw new Error(uploadResult.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading candidates:', error);
      setSearchState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to upload candidates',
      }));
    } finally {
      setIsUploading(false);
    }
  }, [searchState.selectedCandidates, parsedJD, tokenPair, currentWorkspaceMember, onCandidatesSelected, onNext, clearPersistedData]);

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
          onLoadMultiplePages={handleLoadMultiplePages}
          currentPage={searchState.currentPage}
          totalPages={searchState.totalPages}
          onNextPage={handleLoadMore}
        />

        <ArxJDStepNavigation
          onBack={() => setShowResults(false)}
          onNext={handleProceedWithCandidates}
          onSkipSearch={handleSkipSearch}
          showBackButton={true}
          showNextButton={true}
          showSearchButton={false}
          showSkipSearchButton={true}
          nextLabel={
            isUploading 
              ? `Uploading ${searchState.selectedCandidates.length} Candidates...` 
              : `Add ${searchState.selectedCandidates.length} Candidates`
          }
          isNextDisabled={searchState.selectedCandidates.length === 0 || isUploading}
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
            generatedParameters={(() => {
              // Merge all search parameters from the array into a single object
              const allGeneratedParams = {};
              parsedJD.searchParameters?.forEach(searchParam => {
                if (searchParam.generatedSearchParameters) {
                  Object.assign(allGeneratedParams, searchParam.generatedSearchParameters);
                }
              });
              return Object.keys(allGeneratedParams).length > 0 ? allGeneratedParams : undefined;
            })()}
            searchFilterId={parsedJD.searchFilterId}
            onSearchFilterUpdate={onSearchFilterUpdate}
            onGeneratedParametersChange={setCurrentGeneratedParameters}
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
