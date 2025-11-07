type TableState = {
  selectedRowIds: string[];
  rawData: Array<{ id: string; [key: string]: any }>;
};

type SearchResult = {
  id?: string | null;
  tempId?: string;
  [key: string]: any;
};

export const computeActualSelectedRecordsCount = (
  selectedRecordIds: string[],
  tableState: TableState | null | undefined,
  searchResults: SearchResult[] | null | undefined,
  isJobRoute: boolean,
): number => {
  // If we're on a job route and have table state with selected rows, use the new logic
  if (isJobRoute && tableState && tableState.selectedRowIds && tableState.selectedRowIds.length > 0) {
    const selectedIdsSet = new Set(tableState.selectedRowIds);
    
    // Filter database candidates (from rawData) - match by id
    const databaseCandidates = tableState.rawData.filter(record => 
      selectedIdsSet.has(record.id)
    );
    
    // Filter LinkedIn/search candidates (from searchResults) - match by tempId or id
    const searchCandidates = (searchResults || []).filter(record => {
      const candidateId = record?.tempId || record.id;
      return candidateId && selectedIdsSet.has(candidateId);
    });
    
    // Return the count of merged candidates
    return [...databaseCandidates, ...searchCandidates].length;
  }
  
  // Otherwise, use the selectedRecordIds count
  return selectedRecordIds.length;
};

