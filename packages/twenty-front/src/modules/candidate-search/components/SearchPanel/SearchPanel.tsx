import { useArxJDUpload } from '@/arx-jd-upload/hooks/useArxJDUpload';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { SearchParametersForm } from '@/candidate-search/components/search-components/SearchParametersForm';
import { activeSearchFilterIdState } from '@/candidate-search/states/searchConfigState';
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
import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { LinkedInSearchCategory, LinkedInSearchType } from 'twenty-shared';
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
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
  min-height: 40px;
`;

const StyledPanelTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
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
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
`;

const StyledStrategyTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledStrategyInfo = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.3;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
  
  div {
    margin: ${({ theme }) => theme.spacing(0.25)} 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
  }
  
  strong {
    white-space: normal;
  }
`;

const StyledStrategyList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledStrategyItem = styled.div`
  padding: ${({ theme }) => theme.spacing(1.5)};
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledStrategyItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledStrategyItemName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  flex: 1;
  margin-right: ${({ theme }) => theme.spacing(1)};
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
`;

const StyledStrategyItemBadge = styled.span<{ aggressiveness?: string }>`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ aggressiveness, theme }) => {
    if (aggressiveness === 'focused') return theme.color.blue10;
    if (aggressiveness === 'balanced') return theme.color.green10;
    if (aggressiveness === 'broad') return theme.color.orange10;
    return theme.background.secondary;
  }};
  color: ${({ aggressiveness, theme }) => {
    if (aggressiveness === 'focused') return theme.color.blue80;
    if (aggressiveness === 'balanced') return theme.color.green80;
    if (aggressiveness === 'broad') return theme.color.orange80;
    return theme.font.color.secondary;
  }};
`;

const StyledStrategyItemDetails = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  line-height: 1.3;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
`;

const StyledStrategyItemDetailRow = styled.div`
  margin: ${({ theme }) => theme.spacing(0.25)} 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
  
  span {
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
  }
`;

const StyledStrategyItemDetailLabel = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-right: ${({ theme }) => theme.spacing(1)};
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
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
`;

const StyledRecentSearchName = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
`;

const StyledRecentSearchMeta = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  margin-top: ${({ theme }) => theme.spacing(1)};
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
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
  const activeSearchFilterId = useRecoilValue(activeSearchFilterIdState);
  const { updateSearchFilterRecord } = useArxJDUpload('job');
  const { enqueueSnackBar } = useSnackBar();
  const [tokenPair] = useRecoilState(tokenPairState);
  const jobId = useRecoilValue(jobIdAtom);
  const jobs = useRecoilValue(jobsState);

  // Check if job is still loading
  const currentJob = jobs.find(job => job.id === jobId);
  const isJobLoading = jobId && jobId !== 'job-id' && !currentJob;

  // Track if we've initialized from localStorage (only do this once on mount)
  const [hasInitializedFromStorage, setHasInitializedFromStorage] = useState(false);

  // Initialize from localStorage ONLY ONCE on component mount
  useEffect(() => {
    if (!hasInitializedFromStorage) {
      const savedConfig = loadSearchConfigFromStorage();
      const savedParameters = loadSearchParametersFromStorage();
      
      console.log('Initial load from localStorage (one-time):', {
        savedConfig,
        savedParameters,
        note: 'This only happens once on mount, not on every panel open'
      });
      
      // Only load if we have saved data
      if (savedConfig) {
        setSearchConfig(savedConfig);
      }
      
      if (savedParameters) {
        setSearchParameters(savedParameters);
      }
      
      setHasInitializedFromStorage(true);
    }
  }, [hasInitializedFromStorage, setSearchConfig, setSearchParameters]); // Only run once

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  // Auto-save searchConfig to localStorage whenever it changes (but skip initial load)
  useEffect(() => {
    if (hasInitializedFromStorage) {
      persistSearchConfig(searchConfig);
      console.log('Auto-saved searchConfig to localStorage:', searchConfig);
    }
  }, [searchConfig, hasInitializedFromStorage]);

  // Auto-save searchParameters to localStorage whenever they change (but skip initial load)
  useEffect(() => {
    if (hasInitializedFromStorage && searchParameters) {
      try {
        const persistenceKey = 'candidate-search-parameters';
        const persistedData = {
          parameters: searchParameters,
          timestamp: Date.now(),
        };
        localStorage.setItem(persistenceKey, JSON.stringify(persistedData));
        console.log('Auto-saved searchParameters to localStorage:', searchParameters);
      } catch (error) {
        console.error('Failed to auto-save search parameters to localStorage:', error);
      }
    }
  }, [searchParameters, hasInitializedFromStorage]);

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
          searchFilters.map(sf => ({
            id: sf.id,
            name: sf.name || '',
            searchFilterParameter: sf.searchFilterParameter,
            searchFilterName: sf.searchFilterName,
            searchFilterFields: sf.searchFilterFields,
            chatHistory: sf.chatHistory,
          })),
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
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/search-from-file`, {
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
      
      // Prioritize transformed candidates when available (these extend UserProfile)
      if (searchResponse.transformedCandidates) {
        const transformedCandidates = searchResponse.transformedCandidates;
        const totalCount = searchResponse.searchResults?.paging?.total_count || transformedCandidates.length;
        
        // Add transformed candidates to search results state
        addSearchResults(setSearchResults, jobId)(transformedCandidates);
        
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
        persistSearchMetadataToStorage(newMetadata, jobId, {
          accessToken: tokenPair?.accessToken?.token,
          results: searchResults,
        });

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
      } else if (searchResponse.searchResults?.items) {
        // Fallback to raw search results if no transformed candidates
        const { items, cursor, paging } = searchResponse.searchResults;
        const totalCount = paging?.total_count || 0;
        
        // Add results to search results state
        addSearchResults(setSearchResults, jobId)(items);
        
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
        persistSearchMetadataToStorage(newMetadata, jobId, {
          accessToken: tokenPair?.accessToken?.token,
          results: searchResults,
        });

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

  // Extract search strategies from parsedJD
  const searchStrategies = useMemo(() => {
    if (!parsedJD?.searchFilters) return [];
    console.log('SearchPanel - Extracting strategies from parsedJD:', {
      searchFilters: parsedJD.searchFilters,
      activeSearchFilterId,
      parsedJD
    });
    
    // Get the active search filter or first available
    const currentSearchFilterId = activeSearchFilterId || parsedJD.searchFilters[0]?.id;
    console.log('SearchPanel - Current search filter ID:', currentSearchFilterId);
    const searchFilter = parsedJD.searchFilters.find(sf => sf.id === currentSearchFilterId) || parsedJD.searchFilters[0];
    console.log('SearchPanel - Search filter:', searchFilter);
    
    // Early return if no search filter found
    if (!searchFilter) {
      return [];
    }
    
    const searchFilterParameter = searchFilter.searchFilterParameter as any;
    const generatedParams = searchFilterParameter?.generatedSearchParameters as any || {};
    const resolvedParamsRoot = searchFilterParameter?.resolvedSearchParameters as any || {};

    console.log('SearchPanel - Extracting strategies from generatedParams:', {
      searchFilterId: currentSearchFilterId,
      generatedParamsKeys: Object.keys(generatedParams || {}),
      hasStrategies: !!generatedParams?.classicPeopleSearchStrategies,
      strategiesCount: generatedParams?.classicPeopleSearchStrategies?.length || 0,
      generatedParams
    });

    // 1) Start from existing AI-generated strategies when available
    let strategies: any[] = [];

    if (generatedParams.classicPeopleSearchStrategies && Array.isArray(generatedParams.classicPeopleSearchStrategies)) {
      strategies = generatedParams.classicPeopleSearchStrategies;
    } else if (generatedParams.generatedParams?.classicPeopleSearchStrategies && Array.isArray(generatedParams.generatedParams.classicPeopleSearchStrategies)) {
      strategies = generatedParams.generatedParams.classicPeopleSearchStrategies;
    } else if (generatedParams.strategies && Array.isArray(generatedParams.strategies)) {
      strategies = generatedParams.strategies;
    }

    // 2) Derive a "custom" strategy from the latest resolved parameters (manual form edits)
    // Convert search type/category to the parameter key used for storage
    const camelCaseSearchType = searchConfig.searchType.replace(/_([a-z])/g, (_: string, letter: string) =>
      letter.toUpperCase(),
    );
    const capitalizedCategory =
      searchConfig.searchCategory.charAt(0).toUpperCase() + searchConfig.searchCategory.slice(1);
    const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;

    const customParams =
      resolvedParamsRoot?.[parameterKey] ||
      resolvedParamsRoot?.classicPeopleSearch ||
      null;

    if (customParams && typeof customParams === 'object') {
      const hasNonEmptyField = Object.entries(customParams).some(([key, value]) => {
        if (
          key === 'location_display' ||
          key === 'company_display' ||
          key === 'industry_display' ||
          key === 'school_display'
        ) {
          return false;
        }
        if (value === null || value === undefined) return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return String(value).trim().length > 0;
      });

      if (hasNonEmptyField) {
        const existingCustom = strategies.find(
          (strategy: any) => strategy.id === 'custom_manual' || strategy.label === 'Custom (search form)',
        );

        const customStrategy = {
          id: 'custom_manual',
          label: 'Custom (search form)',
          goal: 'User-edited search parameters from the search form.',
          description:
            'Strategy based on the latest parameters you manually configured in the search form (keywords, filters, etc.).',
          filterFocus: 'Manual form edits',
          parameters: customParams,
        };

        if (existingCustom) {
          strategies = strategies.map((strategy: any) =>
            strategy.id === existingCustom.id ? customStrategy : strategy,
          );
        } else {
          strategies = [...strategies, customStrategy];
        }
      }
    }

    return strategies;
  }, [parsedJD, activeSearchFilterId]);

  if (!isOpen) {
    return null;
  }

  return (
    <StyledSearchPanel isOpen={isOpen} width={width}>
      <StyledPanelHeader>
        <StyledPanelTitle>
          <IconSearch size={16} />
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
            {searchStrategies.length > 0 ? (
              <>
                <StyledStrategyInfo>
                  <div><strong>Job:</strong> {parsedJD.name}</div>
                  <div><strong>Company:</strong> {parsedJD.companyName || 'N/A'}</div>
                  <div><strong>Location:</strong> {parsedJD.jobLocation || 'N/A'}</div>
                </StyledStrategyInfo>
                <StyledStrategyList>
                  {searchStrategies.map((strategy: any) => (
                    <StyledStrategyItem key={strategy.id}>
                      <StyledStrategyItemHeader>
                        <StyledStrategyItemName>
                          {strategy.label || strategy.name || `Strategy ${strategy.id}`}
                        </StyledStrategyItemName>
                        {strategy.aggressiveness && (
                          <StyledStrategyItemBadge aggressiveness={strategy.aggressiveness}>
                            {strategy.aggressiveness.toUpperCase()}
                          </StyledStrategyItemBadge>
                        )}
                      </StyledStrategyItemHeader>
                      <StyledStrategyItemDetails>
                        {strategy.goal && (
                          <StyledStrategyItemDetailRow>
                            <StyledStrategyItemDetailLabel>Goal:</StyledStrategyItemDetailLabel>
                            {strategy.goal}
                          </StyledStrategyItemDetailRow>
                        )}
                        {strategy.filterFocus && (
                          <StyledStrategyItemDetailRow>
                            <StyledStrategyItemDetailLabel>Filter Focus:</StyledStrategyItemDetailLabel>
                            {strategy.filterFocus}
                          </StyledStrategyItemDetailRow>
                        )}
                        {strategy.parameters?.keywords && (
                          <StyledStrategyItemDetailRow>
                            <StyledStrategyItemDetailLabel>Keywords:</StyledStrategyItemDetailLabel>
                            <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>
                              {strategy.parameters.keywords.length > 80 
                                ? `${strategy.parameters.keywords.substring(0, 80)}...` 
                                : strategy.parameters.keywords}
                            </span>
                          </StyledStrategyItemDetailRow>
                        )}
                      </StyledStrategyItemDetails>
                    </StyledStrategyItem>
                  ))}
                </StyledStrategyList>
              </>
            ) : (
              <StyledStrategyInfo>
                <div><strong>Job:</strong> {parsedJD.name}</div>
                <div><strong>Company:</strong> {parsedJD.companyName || 'N/A'}</div>
                <div><strong>Location:</strong> {parsedJD.jobLocation || 'N/A'}</div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#888' }}>
                  No search strategies generated yet. Generate search parameters in the AI Assistant to see strategies here.
                </div>
              </StyledStrategyInfo>
            )}
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
