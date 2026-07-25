import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { TransformedCandidateForTable } from 'twenty-shared/arx';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type SearchMetadata = {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  cursor?: string;
  searchType?: string;
  searchCategory?: string;
  searchParameters?: any;
};

const DEFAULT_METADATA: SearchMetadata = {
  totalCount: 0,
  currentPage: 0,
  totalPages: 0,
};

function getBaseUrl(): string {
  return REACT_APP_SERVER_BASE_URL ?? '';
}

/**
 * Fetch search results and metadata from backend cache (3 months TTL).
 * Returns null when not found or when accessToken is missing.
 */
export const fetchSearchResultsCache = async (
  projectId: string | undefined,
  accessToken: string | undefined,
): Promise<{ results: any[]; metadata: SearchMetadata } | null> => {
  if (!projectId || projectId === 'project-id' || projectId === '__search__' || !accessToken) return null;
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;
  try {
    const res = await fetch(
      `${baseUrl}/candidate-search/cache/results?projectId=${encodeURIComponent(projectId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const metadata: SearchMetadata = data.metadata
      ? { ...DEFAULT_METADATA, ...data.metadata }
      : DEFAULT_METADATA;
    return { results, metadata };
  } catch (error) {
    console.error('Failed to fetch search results from cache:', error);
    return null;
  }
};

/**
 * Persist search results and metadata to backend cache (3 months TTL).
 * No-op when accessToken is missing.
 */
export const persistSearchResultsCache = async (
  payload: { projectId: string; results: any[]; metadata: SearchMetadata },
  accessToken: string | undefined,
): Promise<void> => {
  if (!payload.projectId || payload.projectId === 'project-id' || !accessToken) return;
  const baseUrl = getBaseUrl();
  if (!baseUrl) return;
  try {
    const res = await fetch(`${baseUrl}/candidate-search/cache/results`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        projectId: payload.projectId,
        results: payload.results,
        metadata: payload.metadata,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (error) {
    console.error('Failed to persist search results to cache:', error);
  }
};

// Helper to load search metadata from backend cache (job-aware)
export const loadSearchMetadataFromStorage = async (
  projectId?: string,
  accessToken?: string,
): Promise<SearchMetadata> => {
  const cached = await fetchSearchResultsCache(projectId, accessToken);
  return cached?.metadata ?? DEFAULT_METADATA;
};


/**
 * State for temporary search results (not yet saved to database)
 * Stores transformed candidate objects which extend UserProfile from the backend
 * These come from the backend candidate-search service and include:
 * - All UserProfile fields (experience, education, skills, etc.)
 * - UI-specific fields (__isFetched, tempId)
 * - Display aliases (jobTitle, company, location)
 * - UI state fields (candConversationStatus, status, etc.)
 */
export const searchResultsState = createAtomState<
  TransformedCandidateForTable[]
>({
  key: 'candidate-search/searchResultsState',
  defaultValue: [],
});

// State for search metadata
// Note: This atom is initialized with empty default. Metadata should be loaded per-projectId in components.
export const searchMetadataState = createAtomState<{
  totalCount: number;
  currentPage: number;
  totalPages: number;
  cursor?: string;
  searchType?: string;
  searchCategory?: string;
  searchParameters?: any;
}>({
  key: 'candidate-search/searchMetadataState',
  defaultValue: {
    totalCount: 0,
    currentPage: 0,
    totalPages: 0,
  },
});

// Selector to get count of fetched candidates
export const fetchedCandidatesCountSelector = createAtomSelector({
  key: 'candidate-search/fetchedCandidatesCountSelector',
  get: ({ get }) => {
    const searchResults = get(searchResultsState);
    return searchResults.length;
  },
});

// Selector to get count of saved candidates (from database)
export const savedCandidatesCountSelector = createAtomSelector({
  key: 'candidate-search/savedCandidatesCountSelector',
  get: () => {
    // This will be used with the main table data to count saved candidates
    // Implementation will be added when integrating with DataTable
    return 0;
  },
});

// Helper to add search results (transformed candidates from backend)
export const addSearchResults = (setSearchResults: any, projectId?: string) => (newResults: any[], onComplete?: (result: { added: number; duplicates: number }) => void, sortByScore?: boolean) => {
  // Validate projectId before proceeding - don't add results if projectId is invalid
  if (!projectId || projectId === 'project-id') {
    console.error('=== addSearchResults - INVALID projectId, skipping ===', {
      projectId,
      newResultsCount: newResults.length,
      error: 'Cannot add search results without a valid projectId'
    });
    if (onComplete) {
      setTimeout(() => {
        onComplete({ added: 0, duplicates: newResults.length });
      }, 0);
    }
    return;
  }

  console.log('=== addSearchResults function called ===', {
    newResultsCount: newResults.length,
    projectId,
    sortByScore,
    newResultsSample: newResults.slice(0, 2).map((r: any) => ({
      id: r.id,
      tempId: r.tempId,
      fullName: r.fullName,
      relevanceScore: r.relevanceScore,
      keys: Object.keys(r)
    }))
  });

  // Capture projectId at call time to ensure we use the correct one
  const currentProjectId = projectId;

  setSearchResults((prev: any[]) => {
    console.log('=== addSearchResults - inside setSearchResults callback ===', {
      prevCount: prev.length,
      newResultsCount: newResults.length,
      currentProjectId,
      sortByScore,
      prevSample: prev.slice(0, 2).map((r: any) => ({
        id: r.id,
        tempId: r.tempId,
        fullName: r.fullName,
        relevanceScore: r.relevanceScore
      }))
    });

    // Re-validate projectId inside the callback to ensure it hasn't changed
    // If projectId is invalid, don't merge with existing results
    if (!currentProjectId || currentProjectId === 'project-id') {
      console.error('=== addSearchResults - projectId became invalid during execution, aborting ===', {
        currentProjectId,
        prevCount: prev.length,
        newResultsCount: newResults.length
      });
      // Return existing results without adding new ones
      return prev;
    }

    // Deduplicate based on ID (could be LinkedIn ID or tempId)
    const existingIds = new Set(prev.map(r => r.tempId || r.id));
    console.log('=== addSearchResults - existing IDs ===', {
      existingIdsCount: existingIds.size,
      existingIds: Array.from(existingIds).slice(0, 10)
    });

    const uniqueNewResults = newResults.filter(result => {
      const resultId = result.tempId || result.id;
      const isDuplicate = existingIds.has(resultId);
      if (isDuplicate) {
        console.log('=== addSearchResults - filtering duplicate ===', {
          resultId,
          fullName: result.fullName
        });
      }
      return !isDuplicate;
    });

    const duplicatesCount = newResults.length - uniqueNewResults.length;

    console.log('=== addSearchResults - after deduplication ===', {
      uniqueNewResultsCount: uniqueNewResults.length,
      filteredOut: duplicatesCount
    });

    // Combine new results with existing results
    let updatedResults = [...uniqueNewResults, ...prev];
    
    // Sort by relevanceScore descending if sortByScore is true
    if (sortByScore) {
      updatedResults = updatedResults.sort((a, b) => {
        const scoreA = a.relevanceScore ?? 0;
        const scoreB = b.relevanceScore ?? 0;
        // Sort descending (highest score first)
        return scoreB - scoreA;
      });
      console.log('=== addSearchResults - sorted by relevanceScore ===', {
        totalCount: updatedResults.length,
        topScores: updatedResults.slice(0, 5).map((r: any) => ({
          fullName: r.fullName,
          relevanceScore: r.relevanceScore
        }))
      });
    }
    
    console.log('=== addSearchResults - final updated results ===', {
      totalCount: updatedResults.length,
      newResultsOnTop: uniqueNewResults.length,
      existingResults: prev.length,
      sorted: sortByScore,
      currentProjectId
    });
    
    // Persist to localStorage with currentProjectId (captured at call time)
    // This ensures we always use the projectId that was valid when addSearchResults was called
    // Fire and forget - don't block state update on storage operation
    persistSearchResultsToStorage(updatedResults, currentProjectId).catch((error) => {
      console.error('Failed to persist search results (non-blocking):', error);
    });
    
    console.log('=== addSearchResults - returning updated results ===', {
      count: updatedResults.length,
      persistedWithProjectId: currentProjectId
    });
    
    // Defer onComplete callback to avoid triggering state updates within a state updater
    // This ensures the callback runs after the current state update completes
    if (onComplete) {
      const result = {
        added: uniqueNewResults.length,
        duplicates: duplicatesCount
      };
      // Use setTimeout to defer execution after the current state update
      setTimeout(() => {
        onComplete(result);
      }, 0);
    }
    
    return updatedResults;
  });
};


// No-op when using backend cache (TTL is 3 months)
export const clearPersistedSearchResultsFromStorage = async () => {};

// Helper to persist search results to backend cache (3 months TTL).
// Pass options.accessToken and options.metadata to persist; otherwise no-op.
export const persistSearchResultsToStorage = async (
  results: any[],
  projectId?: string,
  options?: { accessToken?: string; metadata?: SearchMetadata },
) => {
  if (projectId === 'project-id' || !projectId || !options?.accessToken) return;
  const metadata = options.metadata ?? DEFAULT_METADATA;
  await persistSearchResultsCache(
    { projectId, results, metadata: { ...DEFAULT_METADATA, ...metadata } },
    options.accessToken,
  );
};

// Helper to load search results from backend cache (job-aware)
export const loadSearchResultsFromStorage = async (
  projectId?: string,
  accessToken?: string,
): Promise<any[]> => {
  const cached = await fetchSearchResultsCache(projectId, accessToken);
  if (!cached?.results?.length) return [];
  const results = cached.results;
  const seen = new Map<string, any>();
  const deduplicated: any[] = [];
  for (const result of results) {
    const resultId = result.tempId || result.id;
    if (!resultId) continue;
    if (!seen.has(resultId)) {
      seen.set(resultId, result);
      deduplicated.push(result);
    }
  }
  return deduplicated;
};

// No-op when using backend cache (cache expires after 3 months)
export const clearSearchResultsFromStorage = (_projectId?: string) => {};

// Helper to persist search metadata to backend cache (3 months TTL).
// When accessToken is provided, uses options.results or fetches current cache then PUTs merged results + metadata.
export const persistSearchMetadataToStorage = (
  metadata: SearchMetadata,
  projectId?: string,
  options?: { accessToken?: string; results?: any[] },
) => {
  if (!options?.accessToken || !projectId || projectId === 'project-id') return;
  const mergedMetadata = { ...DEFAULT_METADATA, ...metadata };
  if (options.results !== undefined) {
    persistSearchResultsCache(
      { projectId, results: options.results, metadata: mergedMetadata },
      options.accessToken,
    ).catch((err) =>
      console.error('Failed to persist search metadata to cache:', err),
    );
    return;
  }
  fetchSearchResultsCache(projectId, options.accessToken).then((cached) => {
    const results = cached?.results ?? [];
    return persistSearchResultsCache(
      { projectId, results, metadata: mergedMetadata },
      options.accessToken,
    );
  }).catch((err) =>
    console.error('Failed to persist search metadata to cache:', err),
  );
};

// No-op when using backend cache
export const clearSearchMetadataFromStorage = (_projectId?: string) => {};

// Helper to remove saved candidates from search results
export const removeSavedFromSearchResults = (setSearchResults: any, projectId?: string) => (savedCandidates: any[]) => {
  setSearchResults((prev: any[]) => {
    // Extract unique string keys from saved candidates
    const savedUniqueKeys = new Set(savedCandidates.map(candidate => candidate.uniqueStringKey).filter(Boolean));
    
    // Filter out candidates that have been saved
    const filteredResults = prev.filter(result => {
      // Check if this result has been saved by comparing uniqueStringKey or id
      const resultKey = result.tempId || result.id;
      return !savedUniqueKeys.has(resultKey);
    });
    
    console.log(`Removed ${prev.length - filteredResults.length} saved candidates from search results`);
    
    // Update localStorage with projectId
    // Fire and forget - don't block state update on storage operation
    persistSearchResultsToStorage(filteredResults, projectId).catch((error) => {
      console.error('Failed to persist search results after removal (non-blocking):', error);
    });
    
    return filteredResults;
  });
};

// Helper to handle successful upload-profiles response
export const handleUploadProfilesSuccess = (setSearchResults: any, setSearchMetadata: any, projectId?: string) => (response: any) => {
  if (response.status === 'ok' && response.savedCandidates) {
    console.log(`Successfully saved ${response.savedCandidates.length} candidates`);
    
    // Remove saved candidates from search results
    removeSavedFromSearchResults(setSearchResults, projectId)(response.savedCandidates);
    
    // Update search metadata to reflect the reduced count
    setSearchMetadata((prev: any) => ({
      ...prev,
      totalCount: Math.max(0, prev.totalCount - response.savedCandidates.length)
    }));
    
    console.log('Updated search results and metadata after successful upload');
  }
};

// Helper to clear all search results
export const clearSearchResults = (setSearchResults: any, projectId?: string) => () => {
  setSearchResults([]);
  clearSearchResultsFromStorage(projectId);
  clearSearchMetadataFromStorage(projectId);
};
