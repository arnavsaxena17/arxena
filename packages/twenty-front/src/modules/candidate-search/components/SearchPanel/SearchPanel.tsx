import { IconApi, IconBrandLinkedin, IconSearch, IconX } from 'twenty-ui/icon';
import { useArxJDUpload } from '@/arx-jd-upload/hooks/useArxJDUpload';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import type { AssistantThread } from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { SearchParametersForm } from '@/candidate-search/components/search-components/SearchParametersForm';
import {
    getCandidateSearchApolloCompaniesUrl,
    getCandidateSearchApolloJobPostingsUrl,
    getCandidateSearchApolloPeopleUrl,
    getCandidateSearchFromFileUrl,
} from '@/candidate-search/constants/candidateSearchApiPaths';
import { candidateSearchDataSourceState } from '@/candidate-search/states/candidateSearchDataSourceState';
import { activeAssistantThreadIdState } from '@/candidate-search/states/searchConfigState';
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
import { projectIdAtom, projectsState } from '@/candidate-table/states/states';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useTheme } from 'twenty-ui/theme-constants';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LinkedInSearchCategory,
  LinkedInSearchType,
} from '@/candidate-search/types/candidate-search.types';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledSearchPanel = styled.div<{ isOpen: boolean; width: number }>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: ${({ isOpen, width }) => isOpen ? `${width}px` : '0px'};
  background-color: ${themeCssVariables.background.primary};
  border-right: 1px solid ${themeCssVariables.border.color.light};
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
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing[2]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  background-color: ${themeCssVariables.background.secondary};
  min-height: 40px;
`;

const StyledPanelTitle = styled.h3`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledPanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledDataSourceSection = styled.div`
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledDataSourceLabel = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledDataSourceTrack = styled.div`
  display: flex;
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.tertiary};
  padding: ${themeCssVariables.spacing['0.5']};
  gap: ${themeCssVariables.spacing['0.5']};
`;

const StyledDataSourceOption = styled.button<{ isActive: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${themeCssVariables.spacing[1]};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  min-height: 32px;
  padding: ${themeCssVariables.spacing[1]};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-family: inherit;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  ${({ isActive }) =>
    isActive
      ? `
    background: ${themeCssVariables.background.primary};
    color: ${themeCssVariables.font.color.primary};
    box-shadow: ${themeCssVariables.boxShadow.light};
  `
      : `
    background: transparent;
    color: ${themeCssVariables.font.color.secondary};
    &:hover {
      background: ${themeCssVariables.background.transparent.light};
      color: ${themeCssVariables.font.color.primary};
    }
  `}

  &:focus-visible {
    outline: 2px solid ${themeCssVariables.color.blue};
    outline-offset: 1px;
  }
`;

const StyledCloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};

  &:hover {
    background-color: ${themeCssVariables.background.secondary};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledSearchTypeSection = styled.div`
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const StyledSearchTypeTitle = styled.h4`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  margin: 0 0 ${themeCssVariables.spacing[2]} 0;
`;

const StyledRadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledRadioOption = styled.label`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  cursor: pointer;
  padding: ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.light};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.secondary};
    border-color: ${themeCssVariables.border.color.medium};
  }

  input[type="radio"] {
    margin: 0;
  }

  input[type="radio"]:checked + span {
    color: ${themeCssVariables.color.blue};
    font-weight: ${themeCssVariables.font.weight.medium};
  }
`;

const StyledStrategySection = styled.div`
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.md};
  border: 1px solid ${themeCssVariables.border.color.light};
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
`;

const StyledStrategyTitle = styled.h4`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  margin: 0 0 ${themeCssVariables.spacing[1]} 0;
`;

const StyledStrategyInfo = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
  line-height: 1.3;
  margin-bottom: ${themeCssVariables.spacing[1]};
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;

  div {
    margin: ${themeCssVariables.spacing['1']} 0;
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
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledStrategyItem = styled.div`
  padding: ${themeCssVariables.spacing['1.5']};
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
`;

const StyledStrategyItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${themeCssVariables.spacing['0.5']};
`;

const StyledStrategyItemName = styled.div`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xs};
  flex: 1;
  margin-right: ${themeCssVariables.spacing[1]};
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
`;

const StyledStrategyItemBadge = styled.span<{ aggressiveness?: string }>`
  padding: ${themeCssVariables.spacing['0.5']} ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  background-color: ${({ aggressiveness }) => {
    if (aggressiveness === 'focused') return themeCssVariables.color.blue10;
    if (aggressiveness === 'balanced') return themeCssVariables.color.green10;
    if (aggressiveness === 'broad') return themeCssVariables.color.orange10;
    return themeCssVariables.background.secondary;
  }};
  color: ${({ aggressiveness }) => {
    if (aggressiveness === 'focused') return themeCssVariables.color.blue8;
    if (aggressiveness === 'balanced') return themeCssVariables.color.green8;
    if (aggressiveness === 'broad') return themeCssVariables.color.orange8;
    return themeCssVariables.font.color.secondary;
  }};
`;

const StyledStrategyItemDetails = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
  margin-top: ${themeCssVariables.spacing['0.5']};
  line-height: 1.3;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
`;

const StyledStrategyItemDetailRow = styled.div`
  margin: ${themeCssVariables.spacing['1']} 0;
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
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-right: ${themeCssVariables.spacing[1]};
`;

const StyledRecentSearches = styled.div`
  margin-top: ${themeCssVariables.spacing[4]};
`;

const StyledRecentSearchesTitle = styled.h4`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  margin: 0 0 ${themeCssVariables.spacing[2]} 0;
`;

const StyledRecentSearchItem = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: ${themeCssVariables.spacing[2]};
  border: none;
  background: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  transition: background-color 0.2s ease;
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;

  &:hover {
    background-color: ${themeCssVariables.background.secondary};
  }
`;

const StyledRecentSearchName = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
`;

const StyledRecentSearchMeta = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
  margin-top: ${themeCssVariables.spacing[1]};
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
`;

type SearchPanelProps = {
  width?: number;
};

function parseApolloKeywords(keywords: string | undefined): {
  personTitles: string[];
  qKeywords: string | undefined;
} {
  const kw = (keywords ?? '').trim();
  if (!kw) {
    return { personTitles: [], qKeywords: undefined };
  }
  if (kw.includes(',')) {
    const titles = kw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { personTitles: titles, qKeywords: kw };
  }
  return { personTitles: [kw], qKeywords: kw };
}

function extractApolloOrganizationList(
  organizationsPayload: Record<string, unknown> | undefined,
): Record<string, unknown>[] {
  if (!organizationsPayload) {
    return [];
  }
  const inner = organizationsPayload.organizations;
  if (Array.isArray(inner)) {
    return inner.filter(
      (o): o is Record<string, unknown> =>
        o !== null && typeof o === 'object',
    );
  }
  return [];
}

export const SearchPanel = ({ width = 350 }: SearchPanelProps) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useAtomState(isSearchPanelOpenState);
  const [searchConfig, setSearchConfig] = useAtomState(persistentSearchConfigState);
  const [searchParameters, setSearchParameters] = useAtomState(persistentSearchParametersState);
  const [recentSearches, setRecentSearches] = useAtomState(recentSearchesState);
  const [searchResults, setSearchResults] = useAtomState(searchResultsState);
  const [searchMetadata, setSearchMetadata] = useAtomState(searchMetadataState);
  const [candidateSearchDataSource, setCandidateSearchDataSource] =
    useAtomState(candidateSearchDataSourceState);

  const parsedJD = useAtomStateValue(parsedJDSelector);
  const activeAssistantThreadId = useAtomStateValue(activeAssistantThreadIdState);
  const { updateAssistantThreadRecord } = useArxJDUpload('project');
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();
  const [tokenPair] = useAtomState(tokenPairState);
  const projectId = useAtomStateValue(projectIdAtom);
  const projects = useAtomStateValue(projectsState);

  // Check if job is still loading
  const currentProject = projects.find(
    (project) => project.id === projectId,
  );
  const isJobLoading =
    projectId && projectId !== 'project-id' && !currentProject;

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

  // Persist current plan state to assistant thread
  const handleAssistantThreadUpdate = useCallback(async (
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: unknown,
    resolvedParameters: unknown,
  ) => {
    const currentParsedJD = parsedJD;
    const assistantThreads = currentParsedJD?.assistantThreads;

    if (assistantThreads && assistantThreads.length > 0) {
      try {
        const assistantThreadId =
          activeAssistantThreadId ?? assistantThreads[0]?.id;

        // `useArxJDUpload.updateAssistantThreadRecord` uses `assistantThread.id` only;
        // construct a minimal thread object for type-safety.
        const assistantThread: AssistantThread = {
          id: assistantThreadId,
          name:
            assistantThreads.find((t) => t.id === assistantThreadId)?.name ??
            assistantThreads[0]?.name ??
            '',
          messages: [],
          lastTableData: null,
        };

        await updateAssistantThreadRecord(
          assistantThread,
          assistantThreads,
          searchType,
          searchCategory,
          generatedParameters,
          resolvedParameters
        );
        console.log('✅ Successfully saved search parameters to backend via updateAssistantThreadRecord');
      } catch (error) {
        console.error('❌ Failed to save search parameters to backend:', error);
      }
    } else {
      console.log('⚠️ No assistantThreadId available - cannot save to backend');
    }
  }, [updateAssistantThreadRecord, parsedJD, activeAssistantThreadId]);

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
        console.log('Project is still loading, waiting for job data...');
        enqueueInfoSnackBar({ message: 'Loading job data, please wait...' });
        return;
      } else {
        console.error('No parsedJD available for search');
        enqueueErrorSnackBar({ message: 'No job description available for search' });
        return;
      }
    }

    try {
      const authToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

      if (candidateSearchDataSource === 'apollo') {
        if (!authToken) {
          enqueueErrorSnackBar({ message: 'Sign in to run Apollo search.' });
          return;
        }

        if (searchCategory === 'posts') {
          enqueueWarningSnackBar({ message: 'Apollo does not support post search in this panel.' });
          return;
        }

        if (searchCategory === 'people') {
          const { personTitles, qKeywords } = parseApolloKeywords(
            searchParameters.keywords,
          );
          const apolloRes = await fetch(getCandidateSearchApolloPeopleUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              keywords: qKeywords,
              personTitles: personTitles.length > 0 ? personTitles : undefined,
              page: 1,
              perPage: 25,
            }),
          });

          if (!apolloRes.ok) {
            throw new Error(`Apollo search failed: ${apolloRes.statusText}`);
          }

          const searchResponse = await apolloRes.json();

          if (searchResponse.transformedCandidates) {
            const transformedCandidates = searchResponse.transformedCandidates;
            const totalCount =
              searchResponse.searchResults?.paging?.total_count ||
              transformedCandidates.length;

            addSearchResults(setSearchResults, projectId)(transformedCandidates);

            const newMetadata = {
              totalCount,
              currentPage: 1,
              totalPages: Math.ceil(totalCount / 10),
              cursor: searchResponse.searchResults?.cursor,
              searchType: searchResponse.searchMetadata?.searchType,
              searchCategory: searchResponse.searchMetadata?.searchCategory,
              searchParameters:
                searchResponse.resolvedSearchParameters || searchParameters,
            };
            setSearchMetadata(newMetadata);
            persistSearchMetadataToStorage(newMetadata, projectId, {
              accessToken: authToken,
              results: searchResults,
            });

            addRecentSearch(setRecentSearches)({
              name: `${searchParameters.keywords || 'Search'} - ${searchCategory}`,
              searchType,
              searchCategory,
              parameters: searchParameters,
              resultCount: transformedCandidates.length,
            });

            enqueueSuccessSnackBar({ message: `Found ${transformedCandidates.length} candidates` });
          } else if (searchResponse.searchResults?.items) {
            const { items, cursor, paging } = searchResponse.searchResults;
            const totalCount = paging?.total_count || 0;

            addSearchResults(setSearchResults, projectId)(items);

            const newMetadata = {
              totalCount,
              currentPage: 1,
              totalPages: Math.ceil(totalCount / 10),
              cursor,
              searchType: searchResponse.searchMetadata?.searchType,
              searchCategory: searchResponse.searchMetadata?.searchCategory,
              searchParameters:
                searchResponse.resolvedSearchParameters || searchParameters,
            };
            setSearchMetadata(newMetadata);
            persistSearchMetadataToStorage(newMetadata, projectId, {
              accessToken: authToken,
              results: searchResults,
            });

            addRecentSearch(setRecentSearches)({
              name: `${searchParameters.keywords || 'Search'} - ${searchCategory}`,
              searchType,
              searchCategory,
              parameters: searchParameters,
              resultCount: items.length,
            });

            enqueueSuccessSnackBar({ message: `Found ${items.length} candidates` });
          } else {
            enqueueWarningSnackBar({ message: 'No search results found' });
          }
          return;
        }

        if (searchCategory === 'companies') {
          const orgName =
            (searchParameters.keywords ?? '').trim() ||
            (parsedJD.companyName ?? '').trim();
          if (!orgName) {
            enqueueWarningSnackBar({ message: 'Enter keywords or ensure the job has a company name.' });
            return;
          }

          const apolloRes = await fetch(getCandidateSearchApolloCompaniesUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              organizationName: orgName,
              page: 1,
              perPage: 25,
            }),
          });

          if (!apolloRes.ok) {
            throw new Error(`Apollo company search failed: ${apolloRes.statusText}`);
          }

          const data = (await apolloRes.json()) as {
            organizations?: Record<string, unknown>;
          };
          const orgList = extractApolloOrganizationList(data.organizations);
          const items = orgList.map((org, index) => {
            const id = String(org.organization_id ?? org.id ?? `apollo_org_${index}`);
            const name = String(org.name ?? '');
            return {
              id,
              name,
              type: 'COMPANY',
              object: 'SearchResult',
              profile_url:
                typeof org.linkedin_url === 'string' ? org.linkedin_url : '',
              location: [
                typeof org.city === 'string' ? org.city : '',
                typeof org.country === 'string' ? org.country : '',
              ]
                .filter(Boolean)
                .join(', ') || null,
              industry: typeof org.industry === 'string' ? org.industry : '',
              headline: name,
              source: 'apollo',
            };
          });

          addSearchResults(setSearchResults, projectId)(items);
          const newMetadata = {
            totalCount: items.length,
            currentPage: 1,
            totalPages: 1,
            searchType: 'apollo',
            searchCategory,
            searchParameters,
          };
          setSearchMetadata(newMetadata);
          persistSearchMetadataToStorage(newMetadata, projectId, {
            accessToken: authToken,
            results: searchResults,
          });
          addRecentSearch(setRecentSearches)({
            name: `${orgName} - companies`,
            searchType,
            searchCategory,
            parameters: searchParameters,
            resultCount: items.length,
          });
          enqueueSuccessSnackBar({ message: `Found ${items.length} companies` });
          return;
        }

        if (searchCategory === 'jobs') {
          const companyQuery =
            (parsedJD.companyName ?? '').trim() ||
            (searchParameters.keywords ?? '').trim();
          if (!companyQuery) {
            enqueueWarningSnackBar({ message: 'Set a company name on the job or enter keywords.' });
            return;
          }

          const resolveRes = await fetch(getCandidateSearchApolloCompaniesUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              organizationName: companyQuery,
              page: 1,
              perPage: 5,
            }),
          });

          if (!resolveRes.ok) {
            throw new Error(`Apollo company lookup failed: ${resolveRes.statusText}`);
          }

          const resolveData = (await resolveRes.json()) as {
            organizations?: Record<string, unknown>;
          };
          const orgList = extractApolloOrganizationList(resolveData.organizations);
          const firstOrg = orgList[0];
          const orgId = firstOrg
            ? String(firstOrg.organization_id ?? firstOrg.id ?? '')
            : '';

          if (!orgId) {
            enqueueWarningSnackBar({ message: 'No Apollo organization matched for job postings.' });
            return;
          }

          const jobsRes = await fetch(
            getCandidateSearchApolloJobPostingsUrl(orgId, 1, 25),
            {
              headers: { Authorization: `Bearer ${authToken}` },
            },
          );

          if (!jobsRes.ok) {
            throw new Error(`Apollo job postings failed: ${jobsRes.statusText}`);
          }

          const jobsData = (await jobsRes.json()) as {
            jobPostings?: Record<string, unknown>;
          };
          const jp = jobsData.jobPostings as
            | { organization_job_postings?: Record<string, unknown>[] }
            | undefined;
          const postings = Array.isArray(jp?.organization_job_postings)
            ? jp.organization_job_postings
            : [];

          const items = postings.map((p, index) => {
            const id = String(p.id ?? `apollo_job_${index}`);
            const title = String(p.title ?? '');
            const url = typeof p.url === 'string' ? p.url : '';
            return {
              id,
              name: title,
              title,
              url,
              object: 'SearchResult',
              type: 'JOB',
              source: 'apollo',
            };
          });

          addSearchResults(setSearchResults, projectId)(items);
          const newMetadata = {
            totalCount: items.length,
            currentPage: 1,
            totalPages: 1,
            searchType: 'apollo',
            searchCategory,
            searchParameters,
          };
          setSearchMetadata(newMetadata);
          persistSearchMetadataToStorage(newMetadata, projectId, {
            accessToken: authToken,
            results: searchResults,
          });
          addRecentSearch(setRecentSearches)({
            name: `${companyQuery} - jobs`,
            searchType,
            searchCategory,
            parameters: searchParameters,
            resultCount: items.length,
          });
          enqueueSuccessSnackBar({ message: `Found ${items.length} job postings` });
          return;
        }

        return;
      }

      // Call the existing LinkedIn search endpoint
      const response = await fetch(getCandidateSearchFromFileUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
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
        addSearchResults(setSearchResults, projectId)(transformedCandidates);

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
        persistSearchMetadataToStorage(newMetadata, projectId, {
          accessToken: tokenPair?.accessOrWorkspaceAgnosticToken?.token,
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

        enqueueSuccessSnackBar({ message: `Found ${transformedCandidates.length} candidates` });
      } else if (searchResponse.searchResults?.items) {
        // Fallback to raw search results if no transformed candidates
        const { items, cursor, paging } = searchResponse.searchResults;
        const totalCount = paging?.total_count || 0;

        // Add results to search results state
        addSearchResults(setSearchResults, projectId)(items);

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
        persistSearchMetadataToStorage(newMetadata, projectId, {
          accessToken: tokenPair?.accessOrWorkspaceAgnosticToken?.token,
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

        enqueueSuccessSnackBar({ message: `Found ${items.length} candidates` });
      } else {
        enqueueWarningSnackBar({ message: 'No search results found' });
      }
    } catch (error) {
      console.error('Search error:', error);
      enqueueErrorSnackBar({ message: 'Search failed. Please try again.' });
    }
  }, [
    parsedJD,
    candidateSearchDataSource,
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    projectId,
    searchResults,
    setSearchResults,
    setSearchMetadata,
    setRecentSearches,

    isJobLoading,
  ]);

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
    if (!parsedJD?.assistantThreads) return [];
    console.log('SearchPanel - Extracting strategies from parsedJD:', {
      assistantThreads: parsedJD.assistantThreads,
      activeAssistantThreadId,
      parsedJD
    });

    // Get the active assistant thread or first available
    const currentAssistantThreadId = activeAssistantThreadId || parsedJD.assistantThreads[0]?.id;
    console.log('SearchPanel - Current assistant thread ID:', currentAssistantThreadId);
    const thread = parsedJD.assistantThreads.find(t => t.id === currentAssistantThreadId) || parsedJD.assistantThreads[0];
    console.log('SearchPanel - Assistant thread:', thread);

    if (!thread) {
      return [];
    }

    const generatedParams = (thread.assistantParameters as any)?.generatedSearchParameters as any || {};
    const resolvedParamsRoot = (thread.assistantParameters as any)?.resolvedSearchParameters as any || {};

    console.log('SearchPanel - Extracting strategies from generatedParams:', {
      assistantThreadId: currentAssistantThreadId,
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
  }, [parsedJD, activeAssistantThreadId]);

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
        <StyledDataSourceSection
          role="radiogroup"
          aria-label="Candidate search data source"
        >
          <StyledDataSourceLabel>Data source</StyledDataSourceLabel>
          <StyledDataSourceTrack>
            <StyledDataSourceOption
              type="button"
              isActive={candidateSearchDataSource === 'apollo'}
              role="radio"
              aria-checked={candidateSearchDataSource === 'apollo'}
              onClick={() => {
                setCandidateSearchDataSource('apollo');
              }}
            >
              <IconApi size={theme.icon.size.sm} />
              Apollo
            </StyledDataSourceOption>
            <StyledDataSourceOption
              type="button"
              isActive={candidateSearchDataSource === 'linkedin'}
              role="radio"
              aria-checked={candidateSearchDataSource === 'linkedin'}
              onClick={() => {
                setCandidateSearchDataSource('linkedin');
              }}
            >
              <IconBrandLinkedin size={theme.icon.size.sm} />
              LinkedIn
            </StyledDataSourceOption>
          </StyledDataSourceTrack>
        </StyledDataSourceSection>

        {/* Search Strategy */}
        {isJobLoading ? (
          <StyledStrategySection>
            <StyledStrategyTitle>Loading Project Data...</StyledStrategyTitle>
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
                  <div><strong>Project:</strong> {parsedJD.name}</div>
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
                <div><strong>Project:</strong> {parsedJD.name}</div>
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
            <StyledStrategyTitle>No Project Data</StyledStrategyTitle>
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
            onAssistantThreadUpdate={handleAssistantThreadUpdate}
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
