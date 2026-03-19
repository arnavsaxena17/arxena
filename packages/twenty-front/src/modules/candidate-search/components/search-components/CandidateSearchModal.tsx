import { useArxJDUpload } from '@/arx-jd-upload/hooks/useArxJDUpload';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { ActionButtons } from '@/candidate-search/components/ai-chat-assistant/ActionButtons';
import { AIChatAssistant } from '@/candidate-search/components/ai-chat-assistant/AIChatAssistant';
import { ModalContainer } from '@/candidate-search/components/ai-chat-assistant/ModalContainer';
import { ModalHeader } from '@/candidate-search/components/ai-chat-assistant/ModalHeader';
import { CandidateSearchResultsTable } from '@/candidate-search/components/search-components/search-table/CandidateSearchResultsTable';
import { SearchParametersForm } from '@/candidate-search/components/search-components/SearchParametersForm';
import { isCandidateSearchModalOpenState } from '@/candidate-search/states/candidateSearchModalState';
import {
  CandidateSearchState,
  LinkedInSearchCategory,
  LinkedInSearchResult,
  LinkedInSearchType
} from '@/candidate-search/types/candidate-search.types';
import { jobIdAtom } from '@/candidate-table/states/states';
import { usePreviousHotkeyScope } from '@/ui/utilities/hotkey/hooks/usePreviousHotkeyScope';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { IconFilter, IconTable } from 'twenty-ui';

// Styled Components for Panels
const StyledPanelContainer = styled.div`
  display: flex;
  height: calc(100% - 120px); /* Reserve space for action buttons */
  width: 100%;
  z-index: 1001;
`;

const StyledLeftPanel = styled.div`
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

const StyledCenterPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

const StyledRightPanel = styled.div`
  flex: 0 0 350px;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  overflow: hidden;
  min-height: 0;
`;

const StyledPanelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledPanelTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledPanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(3)};
`;


export const CandidateSearchModal = () => {
  const [isCandidateSearchModalOpen, setIsCandidateSearchModalOpen] = useRecoilState(isCandidateSearchModalOpenState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentWorkspaceMember] = useRecoilState(currentWorkspaceMemberState);
  const currentJobId = useRecoilValue(jobIdAtom);
  
  // Use Recoil state for ParsedJD
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);
  
  const { updateAssistantThreadRecord } = useArxJDUpload('job');
  
  // Get strategy execution function
  
  const handleAssistantThreadUpdate = useCallback(async (
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => {
    const currentParsedJD = parsedJD;
    const threads = currentParsedJD?.assistantThreads ?? [];
    try {
      await updateAssistantThreadRecord(
        Array.isArray(threads) ? threads : [],
        searchType,
        searchCategory,
        generatedParameters,
        resolvedParameters
      );
      console.log('✅ Successfully saved search parameters to backend');
    } catch (error) {
      console.error('❌ Failed to save search parameters to backend:', error);
    }
  }, [parsedJD, updateAssistantThreadRecord]);
  
  // Create a unique key for this search to persist data - use job ID if available
  const persistenceKey = useMemo(() => 
    currentJobId ? `candidate-search-${currentJobId}` : 'candidate-search-standalone',
    [currentJobId]
  );
  
  const [searchState, setSearchState] = useState<CandidateSearchState>({
    isSearching: false,
    searchResults: [],
    selectedCandidates: [],
    currentPage: 0,
    totalPages: 0,
    totalCount: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchFunctionRef = useRef<(() => void) | null>(null);

  // Load persisted search state when modal opens
  useEffect(() => {
    if (isCandidateSearchModalOpen && persistenceKey) {
      try {
        const persistedSearchData = sessionStorage.getItem(`search-state-${persistenceKey}`);
        const persistedTableData = sessionStorage.getItem(`table-results-${persistenceKey}`);
        
        if (persistedSearchData) {
          const parsedSearchData = JSON.parse(persistedSearchData);
          const isRecent = Date.now() - parsedSearchData.timestamp < 24 * 60 * 60 * 1000; // 24 hours
          
          if (isRecent && parsedSearchData.searchResults && parsedSearchData.searchResults.length > 0) {
            console.log(`Loading ${parsedSearchData.searchResults.length} persisted search results`);
            setSearchState(prev => ({
              ...prev,
              ...parsedSearchData,
              isSearching: false,
            }));
            setShowResults(true);
          }
        } else if (persistedTableData) {
          const parsedTableData = JSON.parse(persistedTableData);
          const isRecent = Date.now() - parsedTableData.timestamp < 24 * 60 * 60 * 1000; // 24 hours
          
          if (isRecent && parsedTableData.results && parsedTableData.results.length > 0) {
            console.log(`Loading ${parsedTableData.results.length} persisted table results`);
            setSearchState(prev => ({
              ...prev,
              searchResults: parsedTableData.results,
              currentPage: parsedTableData.currentPage || 1,
              totalPages: parsedTableData.totalPages || 0,
              isSearching: false,
            }));
            setShowResults(true);
          }
        }
      } catch (error) {
        console.error('Failed to load persisted search data:', error);
      }
    }
  }, [isCandidateSearchModalOpen, persistenceKey]);

  // Persist search state when searchResults change
  useEffect(() => {
    if (persistenceKey && searchState.searchResults.length > 0 && !searchState.isSearching) {
      try {
        const persistedData = {
          ...searchState,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(`search-state-${persistenceKey}`, JSON.stringify(persistedData));
      } catch (error) {
        console.error('Failed to persist search state:', error);
      }
    }
  }, [searchState.searchResults, searchState.isSearching, persistenceKey]);

  const {
    setHotkeyScopeAndMemorizePreviousScope,
    goBackToPreviousHotkeyScope,
  } = usePreviousHotkeyScope();

  const closeModal = () => {
    setIsCandidateSearchModalOpen(false);
    goBackToPreviousHotkeyScope();
  };

  // Clear display data when modal is closed to prevent persistence across sessions
  useEffect(() => {
    if (!isCandidateSearchModalOpen) {
      // Clear display data from parsedJD when modal is closed
      setParsedJD((prevParsedJD: any) => {
        if (!prevParsedJD?.searchParameters) return prevParsedJD;
        
        const updatedSearchParameters = prevParsedJD.searchParameters.map((searchParam: any) => {
          if (searchParam.resolvedSearchParameters) {
            const updatedResolved = { ...searchParam.resolvedSearchParameters };
            
            // Clear display data for all parameter types to prevent persistence
            const displayKeys = ['industry_display', 'location_display', 'company_display', 'school_display'];
            displayKeys.forEach(displayKey => {
              if (updatedResolved[displayKey]) {
                delete updatedResolved[displayKey];
              }
            });
            
            // Also clear flat structure parameters to prevent persistence after page reload
            // This ensures that when data is fetched from backend, cleared parameters don't reappear
            const allSearchParams = [
              'keywords', 'network_distance', 'industry', 'location', 'company', 'school', 
              'profile_language', 'past_company', 'service', 'connections_of', 'followers_of', 'open_to',
              'advanced_keywords', 'seniority', 'job_type', 'presence', 'headcount'
            ];
            allSearchParams.forEach(param => {
              if (updatedResolved[param] !== undefined) {
                delete updatedResolved[param];
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
    }
  }, [isCandidateSearchModalOpen, setParsedJD]);




  // Create a placeholder search function that shows loading state when not ready
  const placeholderSearchFunction = useCallback(() => {
    if (!searchFunctionRef.current) {
      console.log('Search function not ready yet, please wait...');
      return;
    }
    searchFunctionRef.current();
  }, []);

  // Helper function to create search request body
  const createSearchRequestBody = useCallback((
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    searchParameters: any,
    cursor?: string
  ) => {
    // Use the current parsedJD from the component state
    const currentParsedJD = parsedJD;
    
    // Check if searchParameters contains resolved parameters (from stableSearchFunction)
    const hasResolvedParamsInSearchParams = searchParameters && 
      Object.keys(searchParameters).some(key => 
        ['keywords', 'industry', 'location', 'company', 'school', 'network_distance', 'profile_language'].includes(key)
      );

    const resolvedSearchParametersFromParsedJD =
      currentParsedJD?.assistantThreads?.[0]?.assistantParameters?.resolvedSearchParameters;

    const generatedSearchParameters =
      currentParsedJD?.assistantThreads?.[0]?.assistantParameters?.generatedSearchParameters;

    // Use resolved parameters from searchParameters if they contain actual search criteria,
    // otherwise fall back to resolved parameters from parsedJD
    const resolvedSearchParameters = hasResolvedParamsInSearchParams 
      ? searchParameters 
      : resolvedSearchParametersFromParsedJD;

    console.log('createSearchRequestBody - resolved parameters:', {
      hasResolvedParamsInSearchParams,
      resolvedSearchParameters,
      searchParameters,
      resolvedSearchParametersFromParsedJD
    });

    return {
      // Include filePath if available, otherwise use a placeholder
      filePath: currentParsedJD?.filePath || 'standalone_search',
      jobDescription: currentParsedJD?.description || '',
      jobTitle: currentParsedJD?.name || '',
      company: currentParsedJD?.companyName || '',
      location: currentParsedJD?.jobLocation || '',
      industry: currentParsedJD?.companyName || '',
      searchType,
      searchCategory,
      searchParameters,
      // Include resolved parameters if available
      ...(resolvedSearchParameters && { resolvedSearchParameters }),
      // Include generated parameters if available
      ...(generatedSearchParameters && { generatedSearchParameters }),
      // Include parsedJD for additional context
      parsedJD: currentParsedJD,
      options: {
        ...(cursor && { cursor }),
        limit: 10,
      },
    };
  }, [parsedJD]);

  // Helper function to make API request
  const makeSearchRequest = useCallback(async (
    requestBody: any,
    cursor?: string
  ) => {
    const endpoint = '/candidate-search/search-from-file';
    const limit = 10;
    
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      ...(cursor && { cursor }),
    });
    
    const url = `${process.env.REACT_APP_SERVER_BASE_URL}${endpoint}?${queryParams}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Search request failed: ${response.statusText}`);
    }

    return response.json();
  }, [tokenPair]);

  // Helper function to process search response
  const processSearchResponse = useCallback((
    searchResponse: any,
    searchParameters: any,
    isInitialSearch: boolean = false
  ) => {
    if (!searchResponse.searchResults?.items) {
      throw new Error('No search results returned');
    }

    const { items, cursor, paging } = searchResponse.searchResults;
    const totalCount = paging?.total_count || 0;
    
    return {
      searchResults: items,
      totalCount,
      totalPages: Math.ceil(totalCount / 10),
      cursor,
      searchParameters: searchResponse.resolvedSearchParameters || searchParameters,
      searchType: searchResponse.searchMetadata?.searchType,
      searchCategory: searchResponse.searchMetadata?.searchCategory,
    };
  }, []);

  const handleSearch = useCallback(async (
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    searchParameters: any
  ) => {
    console.log('CandidateSearchModal.handleSearch called with:', {
      searchType,
      searchCategory,
      searchParameters,
    });
    
    if (!parsedJD) {
      console.error('No parsedJD available for search');
      return;
    }
    
    setSearchState(prev => ({ ...prev, isSearching: true, error: undefined }));

    try {
      const requestBody = createSearchRequestBody(searchType, searchCategory, searchParameters);
      const searchResponse = await makeSearchRequest(requestBody);
      
      console.log('Full search response:', searchResponse);
      
      const processedData = processSearchResponse(searchResponse, searchParameters, true);
      
      setSearchState(prev => {
        // If there are existing results, add new results to the top
        if (prev.searchResults && prev.searchResults.length > 0) {
          const uniqueNewResults = deduplicateResults(prev.searchResults, processedData.searchResults);
          const combinedResults = [...uniqueNewResults, ...prev.searchResults];
          
          console.log('Adding new search results to top of existing results:', {
            existingResultsCount: prev.searchResults.length,
            newResultsCount: processedData.searchResults.length,
            uniqueNewResultsCount: uniqueNewResults.length,
            finalResultsCount: combinedResults.length,
            duplicatesRemoved: processedData.searchResults.length - uniqueNewResults.length
          });
          
          const updatedState = {
            ...prev,
            searchResults: combinedResults,
            currentPage: prev.currentPage, // Keep current page
            totalPages: Math.max(prev.totalPages, processedData.totalPages), // Use max of both
            totalCount: Math.max(prev.totalCount, processedData.totalCount), // Use max of both
            cursor: processedData.cursor, // Use new cursor for pagination
            searchParameters: processedData.searchParameters,
            searchType: processedData.searchType,
            searchCategory: processedData.searchCategory,
            isSearching: false,
            selectedCandidates: [], // Clear selections for new search
          };
          
          return updatedState;
        } else {
          // No existing results, use new results as before
          console.log('No existing results, using new search results as initial results:', {
            newResultsCount: processedData.searchResults.length
          });
          
          const newSearchState = {
            ...processedData,
            currentPage: 1,
            isSearching: false,
            selectedCandidates: [],
          };
          
          return {
            ...prev,
            ...newSearchState,
          };
        }
      });
      
      // Persist search state to session storage
      if (persistenceKey) {
        try {
          // We'll persist the state in a useEffect that watches for searchResults changes
          // This ensures we capture the final combined state
        } catch (error) {
          console.error('Failed to persist search state:', error);
        }
      }
      
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchState(prev => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }));
    }
  }, [parsedJD, createSearchRequestBody, makeSearchRequest, processSearchResponse, persistenceKey]);

  // Helper function to load a single page of results
  const loadSinglePage = useCallback(async (cursor: string) => {
    const requestBody = createSearchRequestBody(
      searchState.searchType || 'classic',
      searchState.searchCategory || 'people',
      searchState.searchParameters,
      cursor
    );
    
    const searchResponse = await makeSearchRequest(requestBody, cursor);
    console.log('Load more response:', searchResponse);
    
    if (!searchResponse.searchResults?.items) {
      return { results: [], nextCursor: undefined };
    }
    
    const { items, cursor: nextCursor } = searchResponse.searchResults;
    return { results: items, nextCursor };
  }, [searchState.searchType, searchState.searchCategory, searchState.searchParameters, createSearchRequestBody, makeSearchRequest]);

  // Helper function to deduplicate results
  const deduplicateResults = useCallback((
    existingResults: LinkedInSearchResult[],
    newResults: LinkedInSearchResult[]
  ) => {
    const existingIds = new Set(existingResults.map(r => r.id));
    return newResults.filter(result => !existingIds.has(result.id));
  }, []);

  const loadMoreCandidates = useCallback(async (pagesToLoad: number = 1) => {
    console.log('CandidateSearchModal.loadMoreCandidates called with:', {
      cursor: searchState.cursor,
      isSearching: searchState.isSearching,
      pagesToLoad,
    });
    
    if (!parsedJD) {
      console.error('No parsedJD available for loading more candidates');
      return;
    }
    
    if (!searchState.cursor || searchState.isSearching) return;

    setSearchState(prev => ({ ...prev, isSearching: true }));

    try {
      let currentCursor = searchState.cursor;
      let allNewResults: LinkedInSearchResult[] = [];
      let pagesLoaded = 0;

      // Load multiple pages sequentially
      for (let i = 0; i < pagesToLoad && currentCursor; i++) {
        const { results, nextCursor } = await loadSinglePage(currentCursor);
        
        if (results.length === 0) break;
        
        allNewResults = [...allNewResults, ...results];
        currentCursor = nextCursor;
        pagesLoaded++;
        
        // If no more cursor, break the loop
        if (!currentCursor) break;
      }

      console.log(`Loaded ${pagesLoaded} pages with ${allNewResults.length} total candidates`);
      
      setSearchState(prev => {
        const uniqueNewResults = deduplicateResults(prev.searchResults, allNewResults);
        
        const updatedState = {
          ...prev,
          searchResults: [...prev.searchResults, ...uniqueNewResults],
          currentPage: prev.currentPage + pagesLoaded,
          cursor: currentCursor,
          isSearching: false,
        };
        
        // Persist updated search state
        if (persistenceKey) {
          try {
            const persistedData = {
              ...updatedState,
              timestamp: Date.now(),
            };
            sessionStorage.setItem(`search-state-${persistenceKey}`, JSON.stringify(persistedData));
          } catch (error) {
            console.error('Failed to persist updated search state:', error);
          }
        }
        
        return updatedState;
      });
    } catch (error) {
      console.error('Load more error:', error);
      setSearchState(prev => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Load more failed',
      }));
    }
  }, [searchState.cursor, searchState.isSearching, parsedJD, loadSinglePage, deduplicateResults]);

  const handleLoadMore = useCallback(() => {
    loadMoreCandidates(1);
  }, [loadMoreCandidates]);

  const handleLoadMultiplePages = useCallback((pages: number) => {
    loadMoreCandidates(pages);
  }, [loadMoreCandidates]);

  const clearPersistedData = useCallback(() => {
    try {
      localStorage.removeItem(persistenceKey);
      sessionStorage.removeItem(`search-state-${persistenceKey}`);
      sessionStorage.removeItem(`table-results-${persistenceKey}`);
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

  const handleResultsPersist = useCallback((results: LinkedInSearchResult[]) => {
    // This callback is triggered when the table component persists results
    // We can use this to update our search state if needed
    console.log(`Table persisted ${results.length} results`);
  }, []);

  const handleProceedWithCandidates = useCallback(async () => {
    if (searchState.selectedCandidates.length === 0) {
      console.log('No candidates selected');
      return;
    }

    if (!parsedJD) {
      console.error('No parsedJD available for candidate upload');
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
        job_id: parsedJD.id || 'standalone_search',
        job_name: parsedJD.name,
        recruiterId: currentWorkspaceMember?.id,
        // Include job information for context
        job: {
          id: parsedJD.id || 'standalone_search',
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
        closeModal();
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
  }, [searchState.selectedCandidates, parsedJD, tokenPair, currentWorkspaceMember, clearPersistedData]);

  const handleSkipSearch = useCallback(() => {
    closeModal();
  }, []);

  if (!isCandidateSearchModalOpen) {
    return null;
  }

  return (
    <ModalContainer onBackdropClick={closeModal} onModalClick={(e) => e.stopPropagation()}>
      <ModalHeader title={parsedJD?.name} onClose={closeModal} />
      
      <StyledPanelContainer>
        {/* Left Panel - Search Parameters */}
        <StyledLeftPanel>
          <StyledPanelHeader>
            <IconFilter size={20} />
            <StyledPanelTitle>Search Filters</StyledPanelTitle>
          </StyledPanelHeader>
          <StyledPanelContent>
              <SearchParametersForm
                onSearch={handleSearch}
                isLoading={searchState.isSearching}
                onSearchRef={(fn: () => void) => { 
                  searchFunctionRef.current = fn; 
                }}
              onAssistantThreadUpdate={handleAssistantThreadUpdate}
              />
          </StyledPanelContent>
        </StyledLeftPanel>

        {/* Center Panel - Search Results */}
        <StyledCenterPanel>
          <StyledPanelHeader>
            <IconTable size={20} />
            <StyledPanelTitle>Search Results</StyledPanelTitle>
          </StyledPanelHeader>
          <StyledPanelContent>
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
              persistenceKey={persistenceKey}
              onResultsPersist={handleResultsPersist}
              onClear={clearPersistedData}
            />
          </StyledPanelContent>
        </StyledCenterPanel>

        {/* Right Panel - AI Chat Assistant */}
        <StyledRightPanel>
          {parsedJD && (
            <AIChatAssistant
              parsedJD={parsedJD}
            onJDUpload={async (file: File) => {
              // Handle JD upload - this would integrate with the existing upload system
              console.log('JD Upload requested:', file.name);
            }}
            onEnrichmentCreate={(enrichments: any[]) => {
              // Handle enrichment creation
              console.log('Enrichments created:', enrichments);
            }}
            onJDRemove={async () => {
              // Handle JD removal - this will be handled by the AIChatAssistant itself
              console.log('JD Remove requested - handled by AIChatAssistant');
            }}
            onJDReplace={async (files: File[]) => {
              // Handle JD replacement - this will be handled by the AIChatAssistant itself
              console.log('JD Replace requested:', files.map(f => f.name), '- handled by AIChatAssistant');
            }}
            onParsedJDUpdate={(updatedParsedJD: ParsedJD) => {
              // Update the parsedJD Recoil state when file operations occur
              setParsedJD(updatedParsedJD);
              console.log('ParsedJD updated via Recoil:', updatedParsedJD);
            }}
            />
          )}
        </StyledRightPanel>
      </StyledPanelContainer>

      {/* Action buttons at the bottom */}
      <ActionButtons
        showResults={showResults}
        isUploading={isUploading}
        selectedCandidatesCount={searchState.selectedCandidates.length}
        isSearching={searchState.isSearching}
        onBack={showResults ? () => setShowResults(false) : closeModal}
        onNext={handleProceedWithCandidates}
        onSkipSearch={handleSkipSearch}
        onSearch={placeholderSearchFunction}
        setShowResults={setShowResults}
        closeModal={closeModal}
      />
    </ModalContainer>
  );
};
