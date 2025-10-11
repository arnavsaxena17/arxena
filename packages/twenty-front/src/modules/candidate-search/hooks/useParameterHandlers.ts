import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { DefaultParameters } from '@/candidate-search/types/CandidateSearch';
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';

export const useParameterHandlers = (
  parameters: DefaultParameters,
  updateParameters: (newParams: any) => void
) => {
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);
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
      
      // Update parsedJD state with display information
      if (parsedJD) {
        setParsedJD(prev => {
          if (!prev) return null;
          
          let updatedSearchParameters = [...(prev.searchParameters || [])];
          
          // Find or create the appropriate search parameter entry
          let searchParamIndex = updatedSearchParameters.findIndex(
            param => param.resolvedSearchParameters && 
            Object.keys(param.resolvedSearchParameters).some(key => 
              key.includes('industry')
            )
          );
          
          if (searchParamIndex === -1) {
            updatedSearchParameters.push({
              generatedSearchParameters: {},
              resolvedSearchParameters: {}
            });
            searchParamIndex = updatedSearchParameters.length - 1;
          }
          
          updatedSearchParameters[searchParamIndex] = {
            ...updatedSearchParameters[searchParamIndex],
            resolvedSearchParameters: {
              ...updatedSearchParameters[searchParamIndex].resolvedSearchParameters,
              industry: ids,
              industry_display: display
            }
          };
          
          return {
            ...prev,
            searchParameters: updatedSearchParameters
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
    
    // Update parsedJD state with display information
    if (display && display.length > 0 && parsedJD) {
      setParsedJD(prev => {
        if (!prev) return null;
        
        let updatedSearchParameters = [...(prev.searchParameters || [])];
        
        // Find or create the appropriate search parameter entry
        let searchParamIndex = updatedSearchParameters.findIndex(
          param => param.resolvedSearchParameters && 
          Object.keys(param.resolvedSearchParameters).some(key => 
            key.includes('location')
          )
        );
        
        if (searchParamIndex === -1) {
          updatedSearchParameters.push({
            generatedSearchParameters: {},
            resolvedSearchParameters: {}
          });
          searchParamIndex = updatedSearchParameters.length - 1;
        }
        
        updatedSearchParameters[searchParamIndex] = {
          ...updatedSearchParameters[searchParamIndex],
          resolvedSearchParameters: {
            ...updatedSearchParameters[searchParamIndex].resolvedSearchParameters,
            location: ids,
            location_display: display
          }
        };
        
        return {
          ...prev,
          searchParameters: updatedSearchParameters
        };
      });
    }
  }, [updateParameters, parsedJD, setParsedJD]);

  const handleCompanyChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { company: ids, company_display: display } : { company: ids });
    
    // Update parsedJD state with display information
    if (display && display.length > 0 && parsedJD) {
      setParsedJD(prev => {
        if (!prev) return null;
        
        let updatedSearchParameters = [...(prev.searchParameters || [])];
        
        // Find or create the appropriate search parameter entry
        let searchParamIndex = updatedSearchParameters.findIndex(
          param => param.resolvedSearchParameters && 
          Object.keys(param.resolvedSearchParameters).some(key => 
            key.includes('company')
          )
        );
        
        if (searchParamIndex === -1) {
          updatedSearchParameters.push({
            generatedSearchParameters: {},
            resolvedSearchParameters: {}
          });
          searchParamIndex = updatedSearchParameters.length - 1;
        }
        
        updatedSearchParameters[searchParamIndex] = {
          ...updatedSearchParameters[searchParamIndex],
          resolvedSearchParameters: {
            ...updatedSearchParameters[searchParamIndex].resolvedSearchParameters,
            company: ids,
            company_display: display
          }
        };
        
        return {
          ...prev,
          searchParameters: updatedSearchParameters
        };
      });
    }
  }, [updateParameters, parsedJD, setParsedJD]);

  const handleSchoolChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { school: ids, school_display: display } : { school: ids });
    
    // Update parsedJD state with display information
    if (display && display.length > 0 && parsedJD) {
      setParsedJD(prev => {
        if (!prev) return null;
        
        let updatedSearchParameters = [...(prev.searchParameters || [])];
        
        // Find or create the appropriate search parameter entry
        let searchParamIndex = updatedSearchParameters.findIndex(
          param => param.resolvedSearchParameters && 
          Object.keys(param.resolvedSearchParameters).some(key => 
            key.includes('school')
          )
        );
        
        if (searchParamIndex === -1) {
          updatedSearchParameters.push({
            generatedSearchParameters: {},
            resolvedSearchParameters: {}
          });
          searchParamIndex = updatedSearchParameters.length - 1;
        }
        
        updatedSearchParameters[searchParamIndex] = {
          ...updatedSearchParameters[searchParamIndex],
          resolvedSearchParameters: {
            ...updatedSearchParameters[searchParamIndex].resolvedSearchParameters,
            school: ids,
            school_display: display
          }
        };
        
        return {
          ...prev,
          searchParameters: updatedSearchParameters
        };
      });
    }
  }, [updateParameters, parsedJD, setParsedJD]);

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
