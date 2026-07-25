import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { cleanSearchParameters, updateSearchParameterEntry } from '@/arx-jd-upload/utils/searchParametersUtils';
import { DefaultParameters } from '@/candidate-search/types/candidate-search.types';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useCallback } from 'react';

export const useParameterHandlers = (
  parameters: DefaultParameters,
  updateParameters: (newParams: any) => void,
  searchType: string = 'classic',
  searchCategory: string = 'people'
) => {
  const [parsedJD, setParsedJD] = useAtomState(parsedJDSelector);
  const handleKeywordsChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateParameters({ keywords: e.target.value });
  }, [updateParameters]);

  const handleKeywordsInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateParameters({ keywords: e.target.value });
  }, [updateParameters]);

  const handleNetworkDistanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    const distances = e.target.checked
      ? [...parameters.network_distance, value]
      : parameters.network_distance.filter((d: number) => d !== value);
    updateParameters({ network_distance: distances });
  }, [parameters.network_distance, updateParameters]);

  const handleIndustryChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    // Always store only IDs in core arrays; keep titles in parallel *_display for UI
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    if (display && display.length > 0) {
      updateParameters({ industry: ids, industry_display: display });
      
      // Update parsedJD state with display information using utility functions
      if (parsedJD) {
        setParsedJD(prev => {
          if (!prev) return null;
          
          // Use utility function to update search parameters properly
          const updatedSearchParameters = updateSearchParameterEntry(
            prev.searchParameters || [],
            searchType,
            searchCategory,
            {}, // No generated parameters to update
            { industry: ids, industry_display: display } // Resolved parameters with display info
          );
          
          // Clean up any empty entries
          const cleanedSearchParameters = cleanSearchParameters(updatedSearchParameters);
          
          return {
            ...prev,
            searchParameters: cleanedSearchParameters
          };
        });
      }
    } else {
      updateParameters({ industry: ids });
    }
  }, [updateParameters, parsedJD, setParsedJD]);

  const handleLocationChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { location: ids, location_display: display } : { location: ids });
    
    // Update parsedJD state with display information using utility functions
    if (display && display.length > 0 && parsedJD) {
      setParsedJD(prev => {
        if (!prev) return null;
        
        // Use utility function to update search parameters properly
        const updatedSearchParameters = updateSearchParameterEntry(
          prev.searchParameters || [],
          searchType,
          searchCategory,
          {}, // No generated parameters to update
          { location: ids, location_display: display } // Resolved parameters with display info
        );
        
        // Clean up any empty entries
        const cleanedSearchParameters = cleanSearchParameters(updatedSearchParameters);
        
        return {
          ...prev,
          searchParameters: cleanedSearchParameters
        };
      });
    }
  }, [updateParameters, parsedJD, setParsedJD, searchType, searchCategory]);

  const handleCompanyChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { company: ids, company_display: display } : { company: ids });
    
    // Update parsedJD state with display information using utility functions
    if (display && display.length > 0 && parsedJD) {
      setParsedJD(prev => {
        if (!prev) return null;
        
        // Use utility function to update search parameters properly
        const updatedSearchParameters = updateSearchParameterEntry(
          prev.searchParameters || [],
          searchType,
          searchCategory,
          {}, // No generated parameters to update
          { company: ids, company_display: display } // Resolved parameters with display info
        );
        
        // Clean up any empty entries
        const cleanedSearchParameters = cleanSearchParameters(updatedSearchParameters);
        
        return {
          ...prev,
          searchParameters: cleanedSearchParameters
        };
      });
    }
  }, [updateParameters, parsedJD, setParsedJD, searchType, searchCategory]);

  const handleSchoolChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { school: ids, school_display: display } : { school: ids });
    
    // Update parsedJD state with display information using utility functions
    if (display && display.length > 0 && parsedJD) {
      setParsedJD(prev => {
        if (!prev) return null;
        
        // Use utility function to update search parameters properly
        const updatedSearchParameters = updateSearchParameterEntry(
          prev.searchParameters || [],
          searchType,
          searchCategory,
          {}, // No generated parameters to update
          { school: ids, school_display: display } // Resolved parameters with display info
        );
        
        // Clean up any empty entries
        const cleanedSearchParameters = cleanSearchParameters(updatedSearchParameters);
        
        return {
          ...prev,
          searchParameters: cleanedSearchParameters
        };
      });
    }
  }, [updateParameters, parsedJD, setParsedJD, searchType, searchCategory]);

  const handleSeniorityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ seniority: values });
  }, [updateParameters]);

  const handleJobTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ job_type: values });
  }, [updateParameters]);

  const handlePresenceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ presence: values });
  }, [updateParameters]);

  const handleParameterChange = useCallback((key: string, value: any) => {
    updateParameters({ [key]: value });
  }, [updateParameters]);

  const handleHeadcountMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateParameters({
      headcount: {
        ...parameters.headcount,
        min: parseInt(e.target.value) || 0,
      },
    });
  }, [parameters.headcount, updateParameters]);

  const handleHeadcountMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateParameters({
      headcount: {
        ...parameters.headcount,
        max: parseInt(e.target.value) || 10000,
      },
    });
  }, [parameters.headcount, updateParameters]);

  return {
    handleKeywordsChange,
    handleKeywordsInputChange,
    handleNetworkDistanceChange,
    handleIndustryChange,
    handleLocationChange,
    handleCompanyChange,
    handleSchoolChange,
    handleSeniorityChange,
    handleJobTypeChange,
    handlePresenceChange,
    handleParameterChange,
    handleHeadcountMinChange,
    handleHeadcountMaxChange,
  };
};
