import { DefaultParameters } from '@/candidate-search/CandidateSearch';
import { useCallback } from 'react';

export const useParameterHandlers = (
  parameters: DefaultParameters,
  updateParameters: (newParams: any) => void
) => {
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
    } else {
      updateParameters({ industry: ids });
    }
  }, [updateParameters]);

  const handleLocationChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { location: ids, location_display: display } : { location: ids });
  }, [updateParameters]);

  const handleCompanyChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { company: ids, company_display: display } : { company: ids });
  }, [updateParameters]);

  const handleSchoolChange = useCallback((values: string[], display?: Array<{ id: string; title: string }>) => {
    const ids = display && display.length > 0 ? display.map(item => item.id) : values.filter(v => /^\d+$/.test(v) || v.includes('urn:li:'));
    updateParameters(display && display.length ? { school: ids, school_display: display } : { school: ids });
  }, [updateParameters]);

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
