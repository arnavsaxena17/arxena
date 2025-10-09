import { useSearchParameters } from '@/arx-jd-upload/hooks/useSearchParameters';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  CandidateSearchState,
  LinkedInSearchCategory,
  LinkedInSearchResult,
  LinkedInSearchType
} from '@/candidate-search/CandidateSearch';
import { isCandidateSearchModalOpenState } from '@/candidate-search/candidateSearchModalState';
import { ActionButtons } from '@/candidate-search/components/AIChatAssistant/ActionButtons';
import { AIChatAssistant } from '@/candidate-search/components/AIChatAssistant/AIChatAssistant';
import { CandidateSearchResultsTable } from '@/candidate-search/components/CandidateSearchResultsTable';
import { ModalContainer } from '@/candidate-search/components/Modal/ModalContainer';
import { ModalHeader } from '@/candidate-search/components/Modal/ModalHeader';
import { AIChatPanel, PanelContainer, SearchFiltersPanel, SearchResultsPanel } from '@/candidate-search/components/Panels/PanelComponents';
import { SearchParametersForm } from '@/candidate-search/components/SearchPanel/SearchParametersForm';
import { usePreviousHotkeyScope } from '@/ui/utilities/hotkey/hooks/usePreviousHotkeyScope';
import { AppHotkeyScope } from '@/ui/utilities/hotkey/types/AppHotkeyScope';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';


// Create a default ParsedJD for standalone search
const createDefaultParsedJD = (): ParsedJD => ({
  name: 'General Candidate Search',
  description: 'Search for candidates using LinkedIn',
  jobCode: 'GENERAL_SEARCH',
  jobLocation: '',
  salaryBracket: '',
  isActive: true,
  specificCriteria: '',
  pathPosition: '',
  companyName: '',
  chatFlow: {
    order: {
      initialChat: false,
      videoInterview: false,
      meetingScheduling: false,
    },
    questions: [],
  },
  videoInterview: {
    questions: [],
  },
  meetingScheduling: {
    meetingType: 'online',
    availableDates: [],
  },
});

export const CandidateSearchModal = () => {
  const [isCandidateSearchModalOpen, setIsCandidateSearchModalOpen] = useRecoilState(isCandidateSearchModalOpenState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentWorkspaceMember] = useRecoilState(currentWorkspaceMemberState);
  const { generateAndResolveSearchParameters } = useSearchParameters();
  
  // Create a default ParsedJD for standalone search
  const parsedJD = createDefaultParsedJD();
  
  // Create a unique key for this search to persist data
  const persistenceKey = 'candidate-search-standalone';
  
  const [searchState, setSearchState] = useState<CandidateSearchState>({
    isSearching: false,
    searchResults: [],
    selectedCandidates: [],
    currentPage: 0,
    totalPages: 0,
    totalCount: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [currentGeneratedParameters, setCurrentGeneratedParameters] = useState<any>(undefined);
  const [showResults, setShowResults] = useState(false);
  const searchFunctionRef = useRef<(() => void) | null>(null);

  const {
    setHotkeyScopeAndMemorizePreviousScope,
    goBackToPreviousHotkeyScope,
  } = usePreviousHotkeyScope();

  const closeModal = () => {
    setIsCandidateSearchModalOpen(false);
    goBackToPreviousHotkeyScope();
  };

  useEffect(() => {
    if (isCandidateSearchModalOpen) {
      setHotkeyScopeAndMemorizePreviousScope(AppHotkeyScope.App, {
        commandMenu: false,
        goto: false,
        keyboardShortcutMenu: false,
      });
    }
  }, [isCandidateSearchModalOpen, setHotkeyScopeAndMemorizePreviousScope]);

  // Helper function to transform parsedJD to include parsedJobDescription
  const transformParsedJD = useCallback((jd: ParsedJD) => {
    return {
      ...jd,
      parsedJobDescription: jd.parsedJobDescription || {
        jobTitle: jd.name || '',
        company: jd.companyName || '',
        location: jd.jobLocation || '',
        industry: jd.companyName || '',
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
    console.log('CandidateSearchModal.handleSearch called with:', {
      searchType,
      searchCategory,
      searchParameters,
    });
    
    setSearchState(prev => ({ ...prev, isSearching: true, error: undefined }));

    try {
      // Transform parsedJD to include parsedJobDescription if not already present
      const transformedParsedJD = transformParsedJD(parsedJD);

      const requestBody = {
        jobDescription: parsedJD.description || '',
        jobTitle: parsedJD.name,
        company: parsedJD.companyName,
        location: parsedJD.jobLocation,
        industry: parsedJD.companyName,
        searchType,
        searchCategory,
        searchParameters: searchParameters,
        options: {
          limit: 10,
        },
      };

      const endpoint = '/candidate-search/search/from-file';

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
          searchParameters: searchParameters,
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
  }, [parsedJD, tokenPair, transformParsedJD]);

  const loadMoreCandidates = useCallback(async (pagesToLoad: number = 1) => {
    console.log('CandidateSearchModal.loadMoreCandidates called with:', {
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

        const requestBody: any = {
          jobDescription: parsedJD.description || '',
          jobTitle: parsedJD.name,
          company: parsedJD.companyName,
          location: parsedJD.jobLocation,
          industry: parsedJD.companyName,
          searchType: searchState.searchType || 'classic',
          searchCategory: searchState.searchCategory || 'people',
          searchParameters: searchState.searchParameters,
          options: {
            cursor: newCursor,
            limit: 10,
          },
        };

        const endpoint = '/candidate-search/search/from-file';

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
  }, [searchState.cursor, searchState.isSearching, searchState.searchParameters, searchState.searchType, searchState.searchCategory, parsedJD, tokenPair, transformParsedJD]);

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
      <ModalHeader onClose={closeModal} />
      
      <PanelContainer>
        {/* Left Panel - Search Parameters */}
        <SearchFiltersPanel>
          <SearchParametersForm
            parsedJD={parsedJD}
            onSearch={handleSearch}
            isLoading={searchState.isSearching}
            onSearchRef={(fn: () => void) => { 
              searchFunctionRef.current = fn; 
            }}
            generatedParameters={currentGeneratedParameters}
            searchFilterId={parsedJD.searchFilterId}
            onSearchFilterUpdate={undefined}
            onGeneratedParametersChange={setCurrentGeneratedParameters}
          />
        </SearchFiltersPanel>

        {/* Center Panel - Search Results */}
        <SearchResultsPanel>
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
        </SearchResultsPanel>

        {/* Right Panel - AI Chat Assistant */}
        <AIChatPanel>
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
          />
        </AIChatPanel>
      </PanelContainer>

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
