import { TableState, tableStateAtom } from '@/candidate-table/states/states';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';
import { SearchPlan } from './useSearchPlanManager';

export interface SearchPlanFilters {
  searchPlan: SearchPlan | null;
  appliedFilters: Record<string, any>;
  isActive: boolean;
}

export interface SearchPlanFiltersManager {
  filters: SearchPlanFilters;
  applySearchPlanFilters: (searchPlan: SearchPlan) => void;
  clearSearchPlanFilters: () => void;
  updateFilter: (key: string, value: any) => void;
  getFilteredData: (data: any[]) => any[];
}

export const useSearchPlanFilters = (): SearchPlanFiltersManager => {
  const [filters, setFilters] = useState<SearchPlanFilters>({
    searchPlan: null,
    appliedFilters: {},
    isActive: false,
  });
  
  const [tableState, setTableState] = useRecoilState(tableStateAtom);

  const applySearchPlanFilters = useCallback((searchPlan: SearchPlan) => {
    const appliedFilters: Record<string, any> = {};
    
    // Apply basic filters from search plan
    if (searchPlan.filters.keywords.length > 0) {
      appliedFilters.keywords = searchPlan.filters.keywords;
    }
    
    if (searchPlan.filters.jobTitle) {
      appliedFilters.jobTitle = searchPlan.filters.jobTitle;
    }
    
    if (searchPlan.filters.location) {
      appliedFilters.location = searchPlan.filters.location;
    }
    
    if (searchPlan.filters.industry) {
      appliedFilters.industry = searchPlan.filters.industry;
    }
    
    if (searchPlan.filters.seniority) {
      appliedFilters.seniority = searchPlan.filters.seniority;
    }

    setFilters({
      searchPlan,
      appliedFilters,
      isActive: true,
    });

    // Update table state to reflect the applied filters
    setTableState((prev: TableState) => ({
      ...prev,
      searchPlanFilters: {
        searchPlan,
        appliedFilters,
        isActive: true,
      }
    }));
  }, [setTableState]);

  const clearSearchPlanFilters = useCallback(() => {
    setFilters({
      searchPlan: null,
      appliedFilters: {},
      isActive: false,
    });

    // Clear search plan filters from table state
    setTableState((prev: TableState) => ({
      ...prev,
      searchPlanFilters: null
    }));
  }, [setTableState]);

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      appliedFilters: {
        ...prev.appliedFilters,
        [key]: value,
      }
    }));

    // Update table state
    setTableState((prev: TableState) => ({
      ...prev,
      searchPlanFilters: prev.searchPlanFilters ? {
        ...prev.searchPlanFilters,
        appliedFilters: {
          ...prev.searchPlanFilters.appliedFilters,
          [key]: value,
        }
      } : null
    }));
  }, [setTableState]);

  const getFilteredData = useCallback((data: any[]) => {
    if (!filters.isActive || !filters.searchPlan) {
      return data;
    }

    return data.filter(candidate => {
      // Apply keyword filter
      if (filters.appliedFilters.keywords && filters.appliedFilters.keywords.length > 0) {
        const candidateText = [
          candidate.name,
          candidate.headline,
          candidate.location,
          candidate.industry,
          candidate.current_positions?.[0]?.role,
          candidate.current_positions?.[0]?.company,
        ].join(' ').toLowerCase();
        
        const hasKeyword = filters.appliedFilters.keywords.some((keyword: string) =>
          candidateText.includes(keyword.toLowerCase())
        );
        
        if (!hasKeyword) return false;
      }

      // Apply job title filter
      if (filters.appliedFilters.jobTitle) {
        const candidateTitle = candidate.current_positions?.[0]?.role || '';
        if (!candidateTitle.toLowerCase().includes(filters.appliedFilters.jobTitle.toLowerCase())) {
          return false;
        }
      }

      // Apply location filter
      if (filters.appliedFilters.location) {
        const candidateLocation = candidate.location || '';
        if (!candidateLocation.toLowerCase().includes(filters.appliedFilters.location.toLowerCase())) {
          return false;
        }
      }

      // Apply industry filter
      if (filters.appliedFilters.industry) {
        const candidateIndustry = candidate.industry || '';
        if (!candidateIndustry.toLowerCase().includes(filters.appliedFilters.industry.toLowerCase())) {
          return false;
        }
      }

      // Apply seniority filter (this would need to be enriched data)
      if (filters.appliedFilters.seniority) {
        // This would check enriched seniority data
        // For now, we'll skip this filter
      }

      return true;
    });
  }, [filters]);

  return {
    filters,
    applySearchPlanFilters,
    clearSearchPlanFilters,
    updateFilter,
    getFilteredData,
  };
};
