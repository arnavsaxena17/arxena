import { Enrichment, enrichmentsState, sampleEnrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { getCandidateSearchFromFileUrl } from '@/candidate-search/constants/candidateSearchApiPaths';
import { fetchSearchResultsCache, persistSearchMetadataToStorage, persistSearchResultsToStorage, searchMetadataState, searchResultsState } from '@/candidate-search/states/searchResultsState';
import { afterChange, afterSelectionEnd, getPermanentId, isUUID, performRedo, performUndo, updateUnreadMessagesStatus } from '@/candidate-table/HotHooks';
import { CANDIDATE_CONVERSATION_STATUS_LABELS, isAiFilterField } from '@/candidate-table/TableColumns';
import { NaukriQueueStatusEffect } from '@/candidate-table/components/NaukriQueueStatusEffect';
import { SortingControls } from '@/candidate-table/components/SortingControls';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { dataTableApplySortsFunctionState } from '@/candidate-table/states/dataTableApplySortsFunctionState';
import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { candidateStateSelector, columnsSelector, FilterCondition, filteredCandidatesCountState, getRowBorderColor, processedDataSelector, selectedCandidateIdState, selectedConversationStatusState, SortConfig, tableStateAtom, unreadMessagesCountsState } from "@/candidate-table/states/states";
import { getCustomSortFunction, needsCustomSorting } from '@/candidate-table/utils/enumSortingUtils';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useNotification } from '@/notification-context/NotificationContextProvider';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useWebSocketEvent } from '@/websocket-context/useWebSocketEvent';
import styled from '@emotion/styled';
import { HotTable } from '@handsontable/react-wrapper';
import axios from 'axios';
import Handsontable from 'handsontable';
import { CellChange, ChangeSource } from 'handsontable/common';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { IconPlus, IconX, Loader } from 'twenty-ui';

const StyledTableWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const StyledTableContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  .handsontable {
    overflow: visible;
  }

  .handsontable .ht_clone_top {
    /* Keep header above table content but below right drawer (z-index: 30) */
    z-index: 20;
  }

  /* Hide scrollbar only in header's wtHolder */
  .handsontable .ht_clone_top .wtHolder {
    overflow: hidden !important;
    -ms-overflow-style: none;
  }

  /* Hide scrollbar for the left fixed column */
  .handsontable .ht_clone_left .wtHolder {
    overflow: hidden !important;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .handsontable .ht_clone_left .wtHolder::-webkit-scrollbar {
    display: none;
  }

  .handsontable .wtHolder {
    overflow: auto;
  }

  /* Style for selected rows */
  .handsontable tr.selected-row td {
    background-color: ${({ theme }) => theme.background.tertiary} !important;
  }

  /* Ensure selected row style persists on hover */
  .handsontable tr.selected-row:hover td {
    background-color: ${({ theme }) => theme.background.tertiary} !important;
  }
`;

const StyledLoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledErrorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledEmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledEmptyIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border-radius: 50%;
  background-color: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledEmptyIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border: none;
  padding: 0;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.font.color.secondary};
    background-color: ${({ theme }) => theme.background.secondary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.blue};
    outline-offset: 2px;
  }
`;

const StyledEmptyTitle = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(1)};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledEmptyDescription = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
  max-width: 300px;
`;


const StyledFilterBadge = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  display: flex;
  align-items: center;
  background-color: ${({ theme }) => theme.background.secondary};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  z-index: 102;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledControlsContainer = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  right: ${({ theme }) => theme.spacing(2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  z-index: 102;
  max-width: 400px;
`;

const StyledClearButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: ${({ theme }) => theme.font.color.tertiary};
  &:hover {
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

interface DataTableProps {
    jobId: string;
    onImportCandidatesClick?: () => void;
}

type ColumnRenderer = (
  instance: Handsontable.Core,
  td: HTMLTableCellElement,
  row: number,
  column: number,
  prop: string | number,
  value: any,
  cellProperties: Handsontable.CellProperties
) => HTMLTableCellElement;



export const DataTable = forwardRef<{ refreshData: () => Promise<void>; removeFilter: (columnIndex: number) => void; clearAllFilters: () => void; clearAllFiltersAndSorts: () => void; toggleSortingControls?: () => void; applyGeneratedSorts?: (sorts: any) => void; loadMoreCandidates?: (pages?: number) => Promise<void>; hasMoreCandidates?: boolean; isLoadingMore?: boolean }, DataTableProps>(({ jobId, onImportCandidatesClick }, ref) => {
    const tableRef = useRef<any>(null);
    const tableState = useRecoilValue(tableStateAtom);
    const setTableState = useSetRecoilState(tableStateAtom);
    const setFilteredCount = useSetRecoilState(filteredCandidatesCountState);
    const [tokenPair] = useRecoilState(tokenPairState);
    const [isSortingControlsVisible, setIsSortingControlsVisible] = useState(false);
    const processedData = useRecoilValue(processedDataSelector);
    const [searchResults, setSearchResults] = useRecoilState(searchResultsState);
    const [searchMetadata, setSearchMetadata] = useRecoilState(searchMetadataState);
    const getCandidateState = useRecoilValue(candidateStateSelector);
    const customEnrichments = useRecoilValue(enrichmentsState);
    const sampleEnrichments = useRecoilValue(sampleEnrichmentsState);
    const selectedStatus = useRecoilValue(selectedConversationStatusState);
    const setSelectedStatus = useSetRecoilState(selectedConversationStatusState);
    const setDataTableRefreshFunction = useSetRecoilState(dataTableRefreshFunctionState);
    const setDataTableApplySortsFunction = useSetRecoilState(dataTableApplySortsFunctionState);
    const { showNotification } = useNotification();
    
    // Pagination state
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // Helper function for consistent deduplication of search results
    const deduplicateSearchResults = useCallback((results: any[]): any[] => {
      const seen = new Map<string, any>();
      const deduplicated: any[] = [];
      
      for (const result of results) {
        // Use consistent ID: tempId || id (same as addSearchResults)
        const resultId = result.tempId || result.id;
        if (!resultId) continue;
        
        if (!seen.has(resultId)) {
          seen.set(resultId, result);
          deduplicated.push(result);
        }
      }
      
      return deduplicated;
    }, []);
    
    // Merge database candidates with search results
    // Note: searchResults now contain TransformedCandidateForTable (extends UserProfile)
    const mergedData = useMemo(() => {
      // In contexts like Assistant, processedData can be empty even though
      // rawData (from get-candidates-by-job-id) has candidates. In that case,
      // fall back to using rawData as the base dataset.
      const baseProcessedData =
        processedData.length > 0 ? processedData : (tableState.rawData ?? []);
      // Search results are already transformed to the correct format by the backend
      // They extend UserProfile and have all necessary fields including:
      // - __isFetched, tempId (UI fields)
      // - jobTitle, company, location (display aliases)
      // - candConversationStatus, status (UI state)
      // - All UserProfile fields (experience, education, skills, etc.)
      console.log("DataTable mergedData calculation:", {
        searchResultsCount: searchResults.length,
        processedDataCount: processedData.length,
        firstSearchResult: searchResults[0],
        firstProcessedData: processedData[0]
      });
      
      // Deduplicate when merging: baseProcessedData (saved/raw candidates) takes priority
      // Create a set of all unique identifiers from baseProcessedData
      const processedDataIds = new Set<string>();
      baseProcessedData.forEach((candidate: any) => {
        const candidateId = candidate.tempId || candidate.id;
        if (candidateId) {
          processedDataIds.add(candidateId);
        }
      });
      
      // Filter searchResults to exclude any that are already in processedData
      const uniqueSearchResults = searchResults.filter((candidate: any) => {
        const candidateId = candidate.tempId || candidate.id;
        return !candidateId || !processedDataIds.has(candidateId);
      });
      
      // Merge with processedData first (saved candidates), then unique searchResults
      const mergedData = [...baseProcessedData, ...uniqueSearchResults];
      
      // Also deduplicate within each array to be safe
      const deduplicatedMergedData = deduplicateSearchResults(mergedData);
      
      if (deduplicatedMergedData.length !== mergedData.length) {
        console.log(`Deduplicated mergedData: ${mergedData.length} -> ${deduplicatedMergedData.length} (removed ${mergedData.length - deduplicatedMergedData.length} duplicates)`);
      }
      
      console.log("mergedData total count:", deduplicatedMergedData.length);
      console.log("mergedData sample (first 2):", deduplicatedMergedData.slice(0, 2));
      return deduplicatedMergedData;
    }, [searchResults, processedData, tableState.rawData, deduplicateSearchResults]);

    // Merge enrichments
    const allAiFilters = useMemo(() => {
      const merged = [...customEnrichments, ...sampleEnrichments];
      // Deduplicate by modelName, preferring custom enrichments over samples
      return merged.reduce<Enrichment[]>((acc, current) => {
        const exists = acc.find(item => item.modelName === current.modelName);
        if (!exists) {
          return [...acc, current];
        }
        return acc;
      }, []);
    }, [customEnrichments, sampleEnrichments]);

    const columns = useRecoilValue(columnsSelector);
    const searchQuery = useRecoilValue(chatSearchQueryState);
    const setSearchQuery = useSetRecoilState(chatSearchQueryState);
    const { openRightDrawer } = useRightDrawer();
    const setContextStoreTargetedRecordsRule = useSetRecoilComponentStateV2(
      contextStoreTargetedRecordsRuleComponentState,
      jobId
    );
    const setContextStoreNumberOfSelectedRecords = useSetRecoilComponentStateV2(
      contextStoreNumberOfSelectedRecordsComponentState,
      jobId
    );
    const setSelectedCandidateId = useSetRecoilState(selectedCandidateIdState);
    const setUnreadMessagesCounts = useSetRecoilState(unreadMessagesCountsState);

    // Guard to prevent sort/apply loops
    const isApplyingSortRef = useRef(false);
    // Store sortConfig in ref to avoid recreating refreshData callback
    const sortConfigRef = useRef<SortConfig[]>(tableState.sortConfig);
    
    // Sync ref with state on mount and when state changes externally
    useEffect(() => {
      sortConfigRef.current = tableState.sortConfig;
    }, [tableState.sortConfig]);

    const areSortConfigsEqual = (a?: SortConfig[] | null, b?: SortConfig[] | null) => {
      if (!a && !b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i].column !== b[i].column || a[i].sortOrder !== b[i].sortOrder) return false;
      }
      return true;
    };

    // Sorting functionality
    const handleSortChange = useCallback((sortConfig: SortConfig[]) => {
      console.log("handleSortChange called with:", sortConfig);
      sortConfigRef.current = sortConfig;
      setTableState(prev => ({
        ...prev,
        sortConfig
      }));

      // Apply sorting immediately when configuration changes
      const hot = tableRef.current?.hotInstance;
      if (hot && sortConfig.length > 0) {
        console.log("Applying multi-column sort:", sortConfig);
        const multiColumnSortingPlugin = hot.getPlugin('multiColumnSorting');
        if (multiColumnSortingPlugin) {
          const current = multiColumnSortingPlugin.getSortConfig();
          if (areSortConfigsEqual(current as SortConfig[] | null, sortConfig)) {
            console.log('Skip sort: already applied');
            return;
          }
          
          // Register custom sorting functions for enum columns
          const columns = hot.getSettings().columns;
          sortConfig.forEach(sortItem => {
            const column = columns?.[sortItem.column];
            if (column && needsCustomSorting(column.data)) {
              const customSortFunction = getCustomSortFunction(column.data, sortItem.sortOrder);
              if (customSortFunction) {
                // Register the custom sort function for this column
                multiColumnSortingPlugin.setSortFunction(sortItem.column, customSortFunction);
                console.log(`Registered custom sort function for column ${column.data}`);
              }
            }
          });
          
          console.log("Multi-column sorting plugin found, applying sort");
          isApplyingSortRef.current = true;
          multiColumnSortingPlugin.sort(sortConfig);
          
          // Verify the sort was applied
          setTimeout(() => {
            const currentSortConfig = multiColumnSortingPlugin.getSortConfig();
            console.log("Current sort config after applying:", currentSortConfig);
            // safety reset in case afterColumnSort didn't run
            isApplyingSortRef.current = false;
          }, 100);
        } else {
          console.error("Multi-column sorting plugin not found");
        }
      } else if (hot && sortConfig.length === 0) {
        console.log("Clearing multi-column sort");
        // Clear sorting if no sort config
        const multiColumnSortingPlugin = hot.getPlugin('multiColumnSorting');
        if (multiColumnSortingPlugin) {
          multiColumnSortingPlugin.clearSort();
        }
      } else {
        console.log("Hot instance not available or no sort config");
      }
    }, [setTableState]);

    const handleClearSort = useCallback(() => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return;

      const multiColumnSortingPlugin = hot.getPlugin('multiColumnSorting');
      if (multiColumnSortingPlugin) {
        multiColumnSortingPlugin.clearSort();
      }

      setTableState(prev => ({
        ...prev,
        sortConfig: []
      }));
    }, [setTableState]);
    // const searchPlanFilters = useSearchPlanFilters();
    
    const filteredData = useMemo(() => {
      let filtered = mergedData;
      
      // Apply status filter if selected
      if (selectedStatus) {
        filtered = filtered.filter((candidate: any) => 
          candidate.candConversationStatus === selectedStatus
        );
      }
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((candidate: any) => {
          return Object.values(candidate).some(value => {
            if (typeof value === 'string') {
              return value.toLowerCase().includes(query);
            }
            return false;
          });
        });
      }

      // Apply search plan filters
      // if (searchPlanFilters.filters.isActive) {
      //   filtered = searchPlanFilters.getFilteredData(filtered);
      // }

      // Note: We don't set filtered count here anymore as it's handled by afterFilter
      return filtered;
    }, [mergedData, searchQuery, selectedStatus]);

    const mutatableData = useMemo(() => {
      return filteredData.map((candidate: any) => {
        // Get permanent ID - check if LinkedIn candidate has been saved to database
        const candidateId = getPermanentId(candidate, tableState.rawData);
        // Check if this candidate is selected
        // Note: selectedRowIds now contains permanent IDs when available
        const isSelected = candidateId ? tableState.selectedRowIds.includes(candidateId) : false;
        
        return {
          ...candidate,
          isEditable: true,
          checkbox: isSelected // Sync checkbox with selectedRowIds
        };
      });
    }, [filteredData, tableState.selectedRowIds]);
  
    // const keyDownHandler = (event: KeyboardEvent) => {
    //   handleKeyDown(event, tableRef, tableState, setTableState);
    // };

    // Create a function to get the latest token
    const getLatestToken = useCallback(() => {
      return tokenPair?.accessToken?.token;
    }, [tokenPair]);

    const afterChangeHandler = ( changes: CellChange[] | null, source: ChangeSource) => {
      afterChange( tableRef, changes, source, jobId, getLatestToken, setTableState, setSelectedCandidateId, refreshData, tableState.rawData);
    }

    // const beforeOnCellMouseDownHandler = (event: MouseEvent, coords: { row: number; col: number }) => {
    //   console.log("event in beforeOnCellMouseDownHandler", event);
    //   beforeOnCellMouseDown(tableRef, event, coords, tableState , setTableState)
    // }

    const refreshData = useCallback(async (specificIds?: string[]) => {
      if (!jobId || jobId === "job-id" || jobId === '__search__') return;
      try {
        const requestBody = specificIds?.length 
          ? { jobId, candidateIds: specificIds }
          : { jobId };

        console.log("This is the request body in refreshData::::", requestBody);
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-candidates-by-job-id`,
          requestBody,
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
        );
        const rawData = response.data;
        const unreadMessagesCounts: Record<string, number> = {};
        rawData.forEach((candidate: any) => {
          if (!candidate || typeof candidate !== 'object' || !candidate.id) return;
          const unreadCount = candidate?.whatsappMessages?.edges
            ?.filter((edge: any) => edge?.node?.whatsappDeliveryStatus === 'receivedFromCandidate')
            ?.length || 0;
          unreadMessagesCounts[candidate.id] = unreadCount;
        });
        
        if (specificIds?.length) {
          setTableState(prev => {
            console.log("Partial refresh in refreshData", rawData);
            const updatedRawData = [...prev.rawData];
            for (const newData of rawData) {
              if (!newData || !newData.id) continue;
              const index = updatedRawData.findIndex(item => item.id === newData.id);
              if (index >= 0) {
                updatedRawData[index] = newData;
              } else {
                updatedRawData.push(newData);
              }
            }
            return { 
              ...prev, 
              rawData: updatedRawData,
            };
          });
          setUnreadMessagesCounts(prev => ({ ...prev, ...unreadMessagesCounts }));
        } else {
          setTableState(prev => ({
            ...prev,
            rawData,
            isLoading: false,
            selectedRowIds: [] // Clear selected rows on full refresh
          }));
          setUnreadMessagesCounts(unreadMessagesCounts);
          setSelectedCandidateId(null);
          
          // Clear context store states when clearing selected rows
          setContextStoreNumberOfSelectedRecords(0);
          setContextStoreTargetedRecordsRule({
            mode: 'selection',
            selectedRecordIds: [],
          });
        }

        // Reapply multi-column sorting after data refresh
        setTimeout(() => {
          const hot = tableRef.current?.hotInstance;
          const currentSortConfig = sortConfigRef.current;
          if (hot && currentSortConfig.length > 0) {
            console.log("Reapplying multi-column sort after data refresh:", currentSortConfig);
            const multiColumnSortingPlugin = hot.getPlugin('multiColumnSorting');
            if (multiColumnSortingPlugin) {
              const current = multiColumnSortingPlugin.getSortConfig();
              if (!areSortConfigsEqual(current as SortConfig[] | null, currentSortConfig)) {
                // Register custom sorting functions for enum columns
                const columns = hot.getSettings().columns;
                currentSortConfig.forEach(sortItem => {
                  const column = columns?.[sortItem.column];
                  if (column && needsCustomSorting(column.data)) {
                    const customSortFunction = getCustomSortFunction(column.data, sortItem.sortOrder);
                    if (customSortFunction) {
                      multiColumnSortingPlugin.setSortFunction(sortItem.column, customSortFunction);
                      console.log(`Registered custom sort function for column ${column.data} after data refresh`);
                    }
                  }
                });
                
                isApplyingSortRef.current = true;
                multiColumnSortingPlugin.sort(currentSortConfig);
                setTimeout(() => { isApplyingSortRef.current = false; }, 50);
              }
            }
          }
        }, 100); // Small delay to ensure table is updated

        // Show notification using the new system
        // await showNotification({
        //   title: 'Data Refreshed',
        //   body: specificIds?.length 
        //     ? `Successfully refreshed data for ${specificIds.length} candidates`
        //     : 'Successfully refreshed all candidate data',
        //   icon: '/favicon.ico'
        // });
      } catch (error) {
        console.error('Data refresh failed:', error);
        await showNotification({
          title: 'Refresh Failed',
          body: 'Failed to refresh candidate data. Please try again.',
          icon: '/favicon.ico'
        });
        setUnreadMessagesCounts({});
        setSelectedCandidateId(null);
      }
    }, [jobId, setTableState, tokenPair, showNotification, setUnreadMessagesCounts, setSelectedCandidateId]);
    
    // Method to remove a specific filter
    const removeFilter = useCallback((columnIndex: number) => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return;
      
      console.log('Removing filter for column:', columnIndex);
      
      // Get the filters plugin
      const filtersPlugin = hot.getPlugin('filters');
      
      // Remove conditions for the specific column
      filtersPlugin.removeConditions(columnIndex);
      
      // Reapply filters to update the table display
      filtersPlugin.filter();
      
      console.log('Filter removal completed');
    }, []);

    // Method to clear all filters
    const clearAllFilters = useCallback(() => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return;
      
      console.log('Clearing all filters');
      
      const filtersPlugin = hot.getPlugin('filters');
      filtersPlugin.clearConditions();
      filtersPlugin.filter();
      setSearchQuery('');
      
      console.log('All filters cleared');
    }, [setSearchQuery]);

    // Method to clear all sorts
    const clearAllSorts = useCallback(() => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return;
      
      console.log('Clearing all sorts');
      
      const multiColumnSortingPlugin = hot.getPlugin('multiColumnSorting');
      if (multiColumnSortingPlugin) {
        multiColumnSortingPlugin.clearSort();
      }
      
      // Clear sort config from state
      sortConfigRef.current = [];
      setTableState(prev => ({
        ...prev,
        sortConfig: []
      }));
      
      console.log('All sorts cleared');
    }, [setTableState]);

    // Method to clear all filters and sorts
    const clearAllFiltersAndSorts = useCallback(() => {
      console.log('Clearing all filters and sorts');
      
      // Clear filters
      clearAllFilters();
      
      // Clear sorts
      clearAllSorts();
      
      // Clear selected conversation status
      setSelectedStatus(null);
      
      console.log('All filters, sorts, and search cleared');
    }, [clearAllFilters, clearAllSorts, setSelectedStatus]);

    // Method to apply generated sorts
    const applyGeneratedSorts = useCallback((sorts: any) => {
      console.log("applyGeneratedSorts called with:", JSON.stringify(sorts, null, 2));
      const hot = tableRef.current?.hotInstance;
      if (!hot || !sorts?.sortStrategy?.sortColumns) {
        console.warn('Cannot apply sorts: Hot instance not available or invalid sorts data');
        return;
      }
      
      console.log('Applying generated sorts:', sorts);
      
      // Convert column names to column indices
      const sortConfig: SortConfig[] = [];
      const columns = hot.getSettings().columns;
      
      sorts.sortStrategy.sortColumns.forEach((sortColumn: any) => {
        // Find the column index by matching the column name
        const columnIndex = columns?.findIndex((col: any) => 
          col.data === sortColumn.column || col.title === sortColumn.column
        );
        
        if (columnIndex !== undefined && columnIndex >= 0) {
          sortConfig.push({
            column: columnIndex,
            sortOrder: sortColumn.sortOrder
          });
          console.log(`Mapped column "${sortColumn.column}" to index ${columnIndex} with order ${sortColumn.sortOrder}`);
        } else {
          console.warn(`Column "${sortColumn.column}" not found in table columns. Available columns:`, 
            columns?.map((col: any, idx: number) => `${idx}: ${col.data || col.title}`).join(', '));
        }
      });
      
      if (sortConfig.length > 0) {
        console.log('Converted sort config:', sortConfig);
        handleSortChange(sortConfig);
      } else {
        console.warn('No valid sort columns found. Available columns:', 
          columns?.map((col: any, idx: number) => `${idx}: ${col.data || col.title}`).join(', '));
      }
    }, [handleSortChange]);

    // Method to load more candidates from search results
    const loadMoreCandidates = useCallback(async (pagesToLoad: number = 1) => {
      console.log('DataTable.loadMoreCandidates called with:', {
        cursor: searchMetadata.cursor,
        isLoadingMore,
        pagesToLoad,
      });
      
      if (!searchMetadata.cursor || isLoadingMore) return;

      setIsLoadingMore(true);

      try {
        console.log(`Loading ${pagesToLoad} more pages of candidates...`);
        
        // Create proper request body with the original search parameters
        const requestBody = {
          filePath: 'standalone_search', // Default file path for pagination
          jobDescription: '',
          jobTitle: '',
          company: '',
          location: '',
          industry: '',
          searchType: searchMetadata.searchType || 'classic',
          searchCategory: searchMetadata.searchCategory || 'people',
          // Use the original search parameters that were used in the initial search
          resolvedSearchParameters: searchMetadata.searchParameters || {},
        };

        console.log('Load more request body:', requestBody);
        console.log('Current cursor being sent:', searchMetadata.cursor);
        console.log('Current search results count:', searchResults.length);
        
        // Make API call to load more search results
        const response = await axios.post(
          getCandidateSearchFromFileUrl(),
          requestBody,
          { 
            headers: { 
              'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
              'Content-Type': 'application/json'
            },
            params: {
              cursor: searchMetadata.cursor,
              limit: 10 * pagesToLoad
            }
          }
        );

        // Prioritize transformed candidates (which extend UserProfile)
        let newResults: any[];
        let nextCursor: string | undefined;
        let paging: any;

        if (response.data?.transformedCandidates) {
          // Use transformed candidates when available
          newResults = response.data.transformedCandidates;
          nextCursor = response.data.searchResults?.cursor;
          paging = response.data.searchResults?.paging;
        } else if (response.data?.searchResults?.items) {
          // Fallback to raw search results
          const searchResults = response.data.searchResults;
          newResults = searchResults.items;
          nextCursor = searchResults.cursor;
          paging = searchResults.paging;
        } else {
          console.error('No search results or transformed candidates returned from API:', response.data);
          throw new Error('No search results returned');
        }
        
        console.log('API response details:', {
          newResultsCount: newResults.length,
          nextCursor: nextCursor,
          paging: paging,
          newResults: newResults.slice(0, 3) // Log first 3 results for debugging
        });
        
        // Check if LinkedIn API returned empty results
        if (newResults.length === 0) {
          console.warn('LinkedIn API returned 0 results. This could mean:');
          console.warn('1. No more results available');
          console.warn('2. Cursor is invalid or expired');
          console.warn('3. LinkedIn API is having issues');
          console.warn('Current cursor:', searchMetadata.cursor);
          console.warn('Next cursor:', nextCursor);
          
          // If no results and no next cursor, we've reached the end
          if (!nextCursor) {
            console.log('No next cursor available - reached end of results');
            await showNotification({
              title: 'No More Results',
              body: 'You have reached the end of available search results.',
              icon: '/favicon.ico'
            });
            return;
          }
        }
        
        // Deduplicate new results against existing ones
        // Use consistent ID field: tempId || id (same as addSearchResults)
        const existingIds = new Set(searchResults.map((r: any) => r.tempId || r.id));
        const uniqueNewResults = newResults.filter((result: any) => {
          const resultId = result.tempId || result.id;
          return resultId && !existingIds.has(resultId);
        });
        
        console.log('Deduplication details:', {
          existingIdsCount: existingIds.size,
          uniqueNewResultsCount: uniqueNewResults.length,
          duplicateCount: newResults.length - uniqueNewResults.length
        });
        
        // Check if all new results are duplicates
        if (newResults.length > 0 && uniqueNewResults.length === 0) {
          console.warn('All new results are duplicates! This suggests the LinkedIn API is returning the same results.');
          console.log('First few new result IDs:', newResults.slice(0, 3).map((r: any) => r.id));
          console.log('First few existing result IDs:', Array.from(existingIds).slice(0, 3));
          
          // LinkedIn API cursor issue - it's returning the same results
          // Clear the cursor to prevent further attempts
          const updatedMetadata = {
            ...searchMetadata,
            currentPage: searchMetadata.currentPage + pagesToLoad,
            cursor: undefined, // Clear cursor since it's not working
            totalCount: paging?.total_count || searchMetadata.totalCount,
          };
          
          setSearchMetadata(updatedMetadata);
          persistSearchMetadataToStorage(updatedMetadata, jobId, {
            accessToken: tokenPair?.accessToken?.token,
            results: searchResults,
          });

          await showNotification({
            title: 'LinkedIn API Limitation',
            body: 'LinkedIn API is returning duplicate results. This is a known limitation with LinkedIn\'s pagination. Try refining your search criteria for better results.',
            icon: '/favicon.ico'
          });
          return;
        }
        
        // Update search results state with concatenated data
        console.log('Before updating searchResults:', {
          prevCount: searchResults.length,
          uniqueNewResultsCount: uniqueNewResults.length,
          firstNewResult: uniqueNewResults[0]
        });
        setSearchResults((prev: any[]) => {
          const updated = [...prev, ...uniqueNewResults];
          // DEDUPLICATE the entire array to remove any duplicates that might exist in prev
          const deduplicated = deduplicateSearchResults(updated);
          if (deduplicated.length !== updated.length) {
            console.log(`Deduplicated after loadMore: ${updated.length} -> ${deduplicated.length} (removed ${updated.length - deduplicated.length} duplicates)`);
          }
          console.log('After updating searchResults:', {
            prevCount: prev.length,
            updatedCount: deduplicated.length,
            firstUpdatedItem: deduplicated[0]
          });
          return deduplicated;
        });
        
        // Update metadata
        const updatedMetadata = {
          ...searchMetadata,
          currentPage: searchMetadata.currentPage + pagesToLoad,
          cursor: nextCursor, // This will be null if we've reached the end
          totalCount: paging?.total_count || searchMetadata.totalCount,
        };
        
        console.log('Updating metadata:', {
          oldCursor: searchMetadata.cursor,
          newCursor: nextCursor,
          oldPage: searchMetadata.currentPage,
          newPage: updatedMetadata.currentPage,
          totalCount: updatedMetadata.totalCount
        });
        
        setSearchMetadata(updatedMetadata);
        persistSearchMetadataToStorage(updatedMetadata, jobId, {
          accessToken: tokenPair?.accessToken?.token,
          results: searchResults,
        });

        console.log(`Successfully loaded ${pagesToLoad} more pages with ${uniqueNewResults.length} new candidates`);
        
        await showNotification({
          title: 'Load More Success',
          body: `Successfully loaded ${uniqueNewResults.length} more candidates`,
          icon: '/favicon.ico'
        });
      } catch (error) {
        console.error('Load more error:', error);
        await showNotification({
          title: 'Load More Failed',
          body: 'Failed to load more candidates. Please try again.',
          icon: '/favicon.ico'
        });
      } finally {
        setIsLoadingMore(false);
      }
    }, [searchMetadata.cursor, isLoadingMore, searchMetadata.searchType, searchMetadata.searchCategory, searchMetadata.searchParameters, searchResults, setSearchResults, setSearchMetadata, tokenPair, showNotification, deduplicateSearchResults]);

    // Check if there are more candidates to load
    const hasMoreCandidates = useMemo(() => {
      // If we have a cursor, there might be more results
      // If we don't have a cursor, we've reached the end
      // Also check if we've detected LinkedIn API issues (cursor is null but we have results)
      return !!searchMetadata.cursor && searchResults.length > 0;
    }, [searchMetadata.cursor, searchResults.length]);

    // Expose the refreshData method through the ref
    useImperativeHandle(ref, () => ({
      refreshData,
      removeFilter,
      clearAllFilters,
      clearAllFiltersAndSorts,
      toggleSortingControls: () => setIsSortingControlsVisible(prev => !prev),
      applyGeneratedSorts,
      loadMoreCandidates,
      hasMoreCandidates,
      isLoadingMore
    }));

    // Set the refresh function in global state so actions can access it
    // Use refs to store the latest functions to avoid recreating this effect
    const refreshDataRef = useRef(refreshData);
    const applyGeneratedSortsRef = useRef(applyGeneratedSorts);
    
    // Update refs when functions change
    useEffect(() => {
      refreshDataRef.current = refreshData;
      applyGeneratedSortsRef.current = applyGeneratedSorts;
    }, [refreshData, applyGeneratedSorts]);
    
    // Register functions only once on mount/unmount
    useEffect(() => {
      console.log('DataTable: Registering functions in global state');
      setDataTableRefreshFunction(() => (specificIds?: string[]) => refreshDataRef.current(specificIds));
      setDataTableApplySortsFunction((sorts: any) => applyGeneratedSortsRef.current(sorts));
      return () => {
        console.log('DataTable: Cleaning up global state functions');
        setDataTableRefreshFunction(null);
        setDataTableApplySortsFunction(null);
      };
    }, [setDataTableRefreshFunction, setDataTableApplySortsFunction]);

    const afterSelectionEndHandler = (row: number, column: number, row2: number, column2: number, selectionLayerLevel: number) => {
      console.log("row in afterSelectionEndHandler", row);
      afterSelectionEnd(
        tableRef,
        column,
        row,
        row2,
        column2,
        setTableState,
        setSelectedCandidateId,
        setUnreadMessagesCounts,
        setContextStoreNumberOfSelectedRecords,
        setContextStoreTargetedRecordsRule,
        openRightDrawer,
        tokenPair,
        tableState.rawData
      );
    }

    const loadData = useCallback(async () => {
      if (!jobId || jobId === "job-id" || jobId === '__search__') {
        // For virtual job IDs (assistant search), ensure we're not stuck in a
        // loading state left over from a previous real-job DataTable render.
        setTableState(prev => prev.isLoading ? { ...prev, isLoading: false } : prev);
        return;
      }
      
      try {
        setTableState(prev => ({ ...prev, isLoading: true }));
        const requestBody = { jobId };
        console.log("This is the request body in loadData::::", requestBody);
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-candidates-by-job-id`,
          requestBody,
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
        );
        
        // Verify the response is valid
        const rawData = Array.isArray(response.data) ? response.data : [];
        console.log("This is raw data::", rawData);

        // Process unread messages for each candidate
        const unreadMessagesCounts: Record<string, number> = {};
        rawData.forEach(candidate => {
          if (!candidate || typeof candidate !== 'object') return;
          
          const unreadCount = candidate?.whatsappMessages?.edges
            ?.filter((edge: any) => edge?.node?.whatsappDeliveryStatus === 'receivedFromCandidate')
            ?.length || 0;
          
          if (candidate.id) {
            unreadMessagesCounts[candidate.id] = unreadCount;
          }
        });
        
        setTableState(prev => ({
          ...prev,
          rawData,
          isLoading: false
        }));
        setUnreadMessagesCounts(unreadMessagesCounts);

        // Reapply multi-column sorting after initial data load
        setTimeout(() => {
          const hot = tableRef.current?.hotInstance;
          const currentSortConfig = sortConfigRef.current;
          if (hot && currentSortConfig.length > 0) {
            console.log("Reapplying multi-column sort after initial load:", currentSortConfig);
            const multiColumnSortingPlugin = hot.getPlugin('multiColumnSorting');
            if (multiColumnSortingPlugin) {
              const current = multiColumnSortingPlugin.getSortConfig();
              if (!areSortConfigsEqual(current as SortConfig[] | null, currentSortConfig)) {
                // Register custom sorting functions for enum columns
                const columns = hot.getSettings().columns;
                currentSortConfig.forEach(sortItem => {
                  const column = columns?.[sortItem.column];
                  if (column && needsCustomSorting(column.data)) {
                    const customSortFunction = getCustomSortFunction(column.data, sortItem.sortOrder);
                    if (customSortFunction) {
                      multiColumnSortingPlugin.setSortFunction(sortItem.column, customSortFunction);
                      console.log(`Registered custom sort function for column ${column.data} after initial load`);
                    }
                  }
                });
                
                isApplyingSortRef.current = true;
                multiColumnSortingPlugin.sort(currentSortConfig);
                setTimeout(() => { isApplyingSortRef.current = false; }, 50);
              }
            }
          }
        }, 100);
      } catch (error) {
        console.error('Failed to load candidate data:', error);
        setTableState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          rawData: [],
        }));
        setUnreadMessagesCounts({});
        setSelectedCandidateId(null);
      }
    }, [jobId, setTableState, tokenPair, setUnreadMessagesCounts, setSelectedCandidateId]);
  

    // Load persisted search results and metadata from backend cache on mount or when jobId changes
    useEffect(() => {
      // '__search__' is a virtual jobId used by the assistant for LinkedIn candidates;
      // searchResultsState is populated externally (by AssistantResultsPanel), so skip here.
      if (jobId === '__search__') return;
      if (!jobId || jobId === 'job-id') {
        setSearchResults([]);
        setSearchMetadata({ totalCount: 0, currentPage: 0, totalPages: 0 });
        return;
      }
      setSearchResults([]);
      setSearchMetadata({ totalCount: 0, currentPage: 0, totalPages: 0 });
      const accessToken = tokenPair?.accessToken?.token;
      let cancelled = false;
      fetchSearchResultsCache(jobId, accessToken).then((cached) => {
        if (cancelled || !jobId || jobId === 'job-id') return;
        if (!cached) {
          return;
        }
        const deduplicatedResults = deduplicateSearchResults(cached.results);
        setSearchResults(deduplicatedResults);
        setSearchMetadata(cached.metadata);
      });
      return () => { cancelled = true; };
    }, [jobId, setSearchResults, setSearchMetadata, deduplicateSearchResults, tokenPair?.accessToken?.token]);

    useEffect(() => {
      loadData();
    }, [loadData]);

    // Persist search results and metadata to backend cache whenever they change
    useEffect(() => {
      if (!jobId || jobId === 'job-id' || jobId === '__search__') return;
      const accessToken = tokenPair?.accessToken?.token;
      if (!accessToken) return;
      if (searchResults.length > 0) {
        const deduplicatedResults = deduplicateSearchResults(searchResults);
        if (deduplicatedResults.length !== searchResults.length) {
          setSearchResults(deduplicatedResults);
          persistSearchResultsToStorage(deduplicatedResults, jobId, {
            accessToken,
            metadata: searchMetadata,
          });
        } else {
          persistSearchResultsToStorage(searchResults, jobId, {
            accessToken,
            metadata: searchMetadata,
          });
        }
      }
    }, [searchResults, searchMetadata, jobId, deduplicateSearchResults, setSearchResults, tokenPair?.accessToken?.token]);

    // Reapply sorting when filtered data changes (due to search/status filters)
    useEffect(() => {
      const hot = tableRef.current?.hotInstance;
      const currentSortConfig = sortConfigRef.current;
      if (hot && currentSortConfig.length > 0) {
        console.log("Reapplying multi-column sort after filter data change:", currentSortConfig);
        const multiColumnSortingPlugin = hot.getPlugin('multiColumnSorting');
        if (multiColumnSortingPlugin) {
          const current = multiColumnSortingPlugin.getSortConfig();
          if (!areSortConfigsEqual(current as SortConfig[] | null, currentSortConfig)) {
            isApplyingSortRef.current = true;
            multiColumnSortingPlugin.sort(currentSortConfig);
            setTimeout(() => { isApplyingSortRef.current = false; }, 50);
          }
        }
      }
    }, [filteredData]);

    // Sync checkbox values with selectedRowIds when selection changes
    useEffect(() => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return;

      const checkboxColIndex = hot.propToCol('checkbox');
      if (checkboxColIndex === null || checkboxColIndex === undefined) return;

      const selectedIdsSet = new Set(tableState.selectedRowIds);
      const totalRows = hot.countRows();
      let needsRender = false;

      for (let visualRow = 0; visualRow < totalRows; visualRow++) {
        const physicalRow = hot.toPhysicalRow(visualRow);
        if (physicalRow === null || physicalRow === undefined) continue;

        const rowData = hot.getSourceDataAtRow(physicalRow);
        // Get permanent ID - check if LinkedIn candidate has been saved to database
        const candidateId = getPermanentId(rowData, tableState.rawData);

        if (candidateId) {
          const shouldBeChecked = selectedIdsSet.has(candidateId);
          const currentChecked = rowData?.checkbox || false;

          if (shouldBeChecked !== currentChecked) {
            hot.setDataAtCell(visualRow, checkboxColIndex, shouldBeChecked, 'external');
            needsRender = true;
          }
        }
      }

      if (needsRender) {
        hot.render();
      }
    }, [tableState.selectedRowIds]);

    const allVisibleIds = useMemo(() => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return [];
      
      return filteredData.map((row: any, index: number) => {
        const physicalRow = hot?.toPhysicalRow(index);
        const rowData = physicalRow !== undefined ? hot.getSourceDataAtRow(physicalRow) : row;
        // Get permanent ID - check if LinkedIn candidate has been saved to database
        return getPermanentId(rowData, tableState.rawData);
      }).filter((id): id is string => Boolean(id));
    }, [filteredData, tableState.rawData]);

    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id: string) => tableState.selectedRowIds.includes(id));
    const noneSelected = allVisibleIds.every((id: string) => !tableState.selectedRowIds.includes(id));
    const someSelected = !allSelected && !noneSelected;

    const handleSelectAll = (checked: boolean) => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return;
      const visibleIds = filteredData.map((row: any, index: number) => {
        const physicalRow = hot?.toPhysicalRow(index);
        const rowData = physicalRow !== undefined ? hot.getSourceDataAtRow(physicalRow) : row;
        // Get permanent ID - check if LinkedIn candidate has been saved to database
        return getPermanentId(rowData, tableState.rawData);
      }).filter((id): id is string => Boolean(id));

      setTableState(prev => ({
        ...prev,
        selectedRowIds: checked ? visibleIds : []
      }));
      setSelectedCandidateId(checked ? (visibleIds[0] ?? null) : null);

      // Update context store states
      setContextStoreNumberOfSelectedRecords(checked ? visibleIds.length : 0);
      setContextStoreTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: checked ? visibleIds : [],
      });
      
      // Note: Checkbox values will be automatically synced via mutatableData
      // which recalculates when selectedRowIds changes in state
    };

    // Custom colHeaders: first column is empty string, others use column title
    const colHeaders = (col: number) => {
      if (col === 0) return '';
      return columns[col]?.title || '';
    };

    // afterGetColHeader hook to inject select-all checkbox
    const afterGetColHeader = (col: number, TH: HTMLTableCellElement) => {
      if (col === 0) {
        // Prevent duplicate checkboxes
        if (TH.querySelector('input[type="checkbox"]')) return;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.marginTop = '8px';
        checkbox.checked = allSelected;
        checkbox.indeterminate = someSelected;
        checkbox.style.cursor = 'pointer';
        checkbox.onclick = (e) => {
          e.stopPropagation();
          handleSelectAll(!allSelected);
        };
        // Clear and append
        TH.innerHTML = '';
        TH.appendChild(checkbox);
      } else {
        // Add title attribute for tooltip on other columns
        const columnTitle = columns[col]?.title || '';
        TH.title = columnTitle;
        TH.style.cursor = 'help';
      }
    };

    // Add WebSocket event listener for WhatsApp message updates
    useWebSocketEvent<{
      candidateId: string;
      jobId: string;
      messageId: string;
    }>('whatsapp_message_updated', async (data) => {
      // Only refresh if the message is for the current job
      if (data.jobId === jobId) {
        await refreshData();
        
        // If chat drawer is open for this candidate, refresh messages
        const hot = tableRef.current?.hotInstance;
        if (hot) {
          const selectedIds = hot.getSelected();
          if (selectedIds?.length === 1) {
            const row = selectedIds[0][0];
            const selectedRow = hot.getSourceDataAtRow(row);
            if (selectedRow?.id === data.candidateId) {
              // Fetch and update messages for the open chat
              // Get permanent ID (UUID) - ensure we only send UUIDs, not LinkedIn IDs or tempIds
              const permanentId = getPermanentId(selectedRow, tableState.rawData || []);
              if (!permanentId || !isUUID(permanentId)) {
                console.log(`Skipping fetch messages for candidate ${data.candidateId} - no valid UUID found (permanentId: ${permanentId})`);
                return;
              }
              
              try {
                const response = await axios.post(
                  `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
                  { candidateId: permanentId },
                  { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
                );
                const unreadMessageIds = response.data
                  ?.filter((msg: any) => msg.whatsappDeliveryStatus === 'receivedFromCandidate')
                  ?.map((msg: any) => msg.id) || [];
                setUnreadMessagesCounts(prev => ({
                  ...prev,
                  [data.candidateId]: unreadMessageIds.length
                }));
                if (unreadMessageIds.length > 0) {
                  await updateUnreadMessagesStatus(unreadMessageIds, tokenPair);
                }
              } catch (error) {
                console.error('Error refreshing messages:', error);
              }
            }
          }
        }
      }
    }, [jobId, tokenPair, setUnreadMessagesCounts]);

    // Add WebSocket event handler for refresh_table_data
    useWebSocketEvent<{
      message: string;
    }>('refresh_table_data', async () => {
      console.log('Received refresh_table_data event, refreshing entire table');
      try {
        await refreshData();
        console.log('Table refresh completed successfully');
      } catch (error) {
        console.error('Error refreshing table data:', error);
      }
    }, [refreshData]);

    const createRenderer = (originalRenderer: ColumnRenderer | undefined): ColumnRenderer => {
      return (instance: Handsontable.Core, td: HTMLTableCellElement, row: number, column: number, prop: string | number, value: any, cellProperties: Handsontable.CellProperties) => {
        // Get the original renderer
        const defaultRenderer = (instance: Handsontable.Core, td: HTMLTableCellElement, row: number, column: number, prop: string | number, value: any, cellProperties: Handsontable.CellProperties) => {
          td.innerHTML = value !== null && value !== undefined ? String(value) : '';
          return td;
        };

        // Call the original renderer first
        const renderedTd = (originalRenderer || defaultRenderer)(instance, td, row, column, prop, value, cellProperties);

        // Apply row state border color (only on first column)
        if (column === 0 && mergedData[row]) {
          const candidate = mergedData[row];
          const borderColor = getRowBorderColor(candidate, getCandidateState);
          
          // Add left border to indicate persistence state
          Object.assign(renderedTd.style, {
            borderLeft: `4px solid ${borderColor}`,
            transition: 'border-color 150ms ease'
          });
        }

        // Apply enrichment styling if needed
        if (isAiFilterField(String(prop), allAiFilters)) {
          Object.assign(renderedTd.style, {
            backgroundColor: '#f0f7ff',
            fontStyle: 'italic',
            position: 'relative'
          });

          // // Add indicator dot
          // const indicator = document.createElement('div');
          // Object.assign(indicator.style, {
          //   position: 'absolute',
          //   top: '2px',
          //   right: '2px',
          //   width: '6px',
          //   height: '6px',
          //   borderRadius: '50%',
          //   backgroundColor: '#2563eb'
          // });
          // renderedTd.appendChild(indicator);
        }

        return renderedTd;
      };
    };

    if (tableState.isLoading) {
      return (
        <StyledLoadingContainer>
          <Loader />
          <span style={{ marginLeft: '8px' }}>Loading candidates data...</span>
        </StyledLoadingContainer>
      )
    }
    if (tableState.error) {
      return <StyledErrorContainer>Error: {tableState.error}</StyledErrorContainer>
    }

    if (!mergedData.length && !tableState.isLoading) {
      return (
        <StyledEmptyContainer>
          {onImportCandidatesClick ? (
            <StyledEmptyIconButton
              type="button"
              aria-label="Import candidates"
              onClick={onImportCandidatesClick}
            >
              <IconPlus size={24} />
            </StyledEmptyIconButton>
          ) : (
            <StyledEmptyIcon>
              <IconPlus size={24} />
            </StyledEmptyIcon>
          )}
          <StyledEmptyTitle>No candidates found</StyledEmptyTitle>
          <StyledEmptyDescription>
            There are no candidates available for this job.
            <br />
            Add candidates to get started.
          </StyledEmptyDescription>
        </StyledEmptyContainer>
      );
    }
    
    return (
      <StyledTableWrapper>
        <NaukriQueueStatusEffect />
        {selectedStatus && (
          <StyledFilterBadge>
            <span>Filtered by: {CANDIDATE_CONVERSATION_STATUS_LABELS[selectedStatus]}</span>
            <StyledClearButton onClick={() => setSelectedStatus(null)}>
              <IconX size={16} />
            </StyledClearButton>
          </StyledFilterBadge>
        )}
        
        <StyledControlsContainer>
          {isSortingControlsVisible && (
            <SortingControls
              columns={columns}
              sortConfig={tableState.sortConfig}
              onSortChange={handleSortChange}
              onClearSort={handleClearSort}
            />
          )}
        </StyledControlsContainer>
        
        <StyledTableContainer>
          <HotTable
            ref={tableRef}
            data={mutatableData}
            columns={columns.map(col => ({
              ...col,
              renderer: createRenderer(col.renderer as ColumnRenderer)
            }))}
            colHeaders={colHeaders}
            afterGetColHeader={afterGetColHeader}
            rowHeaders={true}
            height="100%"
            themeName="ht-theme-main"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            readOnly={false}
            className="htCenter"
            columnSorting={false}
            multiColumnSorting={true}
            copyPaste={true}
            selectionMode="range"
            autoWrapRow={false}
            fixedRowsTop={0}
            afterSelectionEnd={afterSelectionEndHandler}
            afterChange={afterChangeHandler}
            autoWrapCol={false}
            autoRowSize={false}
            rowHeights={30}
            manualRowResize={true}
            manualColumnResize={true}
            manualColumnMove={true}
            filters={true}
            dropdownMenu={['undo', 'redo','---------', 'filter_by_condition', 'filter_action_bar', 'filter_by_value']}
            fixedColumnsLeft={2}
            customBorders={true}
            outsideClickDeselects={false}
            enterBeginsEditing={true}
            enterMoves={{ row: 1, col: 0 }}
            fillHandle={true}
            persistentState={true}
            afterFilter={(conditionsStack) => {
              const hot = tableRef.current?.hotInstance;
              if (!hot) return;
              console.log("These are conditionsStack::", conditionsStack);
              
              // Update active filters in state
              const activeFilters: FilterCondition[] = (conditionsStack || []).map((condition: any) => ({
                column: condition.column,
                conditions: condition.conditions.map((cond: any) => ({
                  name: cond.name || 'unknown',
                  args: cond.args || []
                })),
                operation: condition.operation || 'conjunction'
              }));
              setTableState(prev => ({
                ...prev,
                activeFilters
              }));
              
              // If there are no conditions, show total count
              if (!conditionsStack || Object.keys(conditionsStack).length === 0) {
                setFilteredCount(hot.countRows());
              } else {
                // Count visible rows
                const visibleCount = hot.getData().length;
                setFilteredCount(visibleCount);
              }

              // Reapply multi-column sorting after filter changes (avoid loops)
              setTimeout(() => {
                const currentSortConfig = sortConfigRef.current;
                if (currentSortConfig.length > 0) {
                  console.log("Reapplying multi-column sort after filter change:", currentSortConfig);
                  const multiColumnSortingPlugin = hot.getPlugin('multiColumnSorting');
                  if (multiColumnSortingPlugin) {
                    const current = multiColumnSortingPlugin.getSortConfig();
                    if (!areSortConfigsEqual(current as SortConfig[] | null, currentSortConfig)) {
                      // Register custom sorting functions for enum columns
                      const columns = hot.getSettings().columns;
                      currentSortConfig.forEach(sortItem => {
                        const column = columns?.[sortItem.column];
                        if (column && needsCustomSorting(column.data)) {
                          const customSortFunction = getCustomSortFunction(column.data, sortItem.sortOrder);
                          if (customSortFunction) {
                            multiColumnSortingPlugin.setSortFunction(sortItem.column, customSortFunction);
                            console.log(`Registered custom sort function for column ${column.data} after filter change`);
                          }
                        }
                      });
                      
                      isApplyingSortRef.current = true;
                      multiColumnSortingPlugin.sort(currentSortConfig);
                      setTimeout(() => { isApplyingSortRef.current = false; }, 50);
                    }
                  }
                }
              }, 100);
            }}
            beforeKeyDown={(event: KeyboardEvent) => {
              // Handle Ctrl/Cmd + Z for undo
              if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
                event.preventDefault();
                performUndo(tableRef, setTableState);
              }
              // Handle Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
              if (((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) ||
                  ((event.ctrlKey || event.metaKey) && event.key === 'y')) {
                event.preventDefault();
                performRedo(tableRef, setTableState);
              }
            }}
            afterColumnSort={(currentSortConfig, destinationSortConfigs) => {
              console.log("afterColumnSort triggered:");
              console.log("currentSortConfig:", currentSortConfig);
              console.log("destinationSortConfigs:", destinationSortConfigs);
              
              // Sync the sorting state when columns are sorted via header clicks
              if (isApplyingSortRef.current) {
                // Ignore programmatic sorts
                isApplyingSortRef.current = false;
                return;
              }
              const newSortConfig = destinationSortConfigs || [];
              if (!areSortConfigsEqual(newSortConfig as SortConfig[] | null, sortConfigRef.current)) {
                sortConfigRef.current = newSortConfig;
                setTableState(prev => ({
                  ...prev,
                  sortConfig: newSortConfig
                }));
              }
            }}
          />
        </StyledTableContainer>
        
      </StyledTableWrapper>
      
    );
  });