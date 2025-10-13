import { ParsedJobDescription } from '@/arx-jd-upload/hooks/useJobDescriptionParser';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { LinkedInSearchResult } from '@/candidate-search/types/CandidateSearch';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  EnrichmentsResponse,
  FiltersResponse,
  SearchParametersResponse
} from '../types/search-plan.types';

export interface UseSearchPlanGenerationReturn {
  generateSearchParameters: (
    searchFilterId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs'
  ) => Promise<SearchParametersResponse | null>;
  
  generateEnrichments: (
    searchFilterId: string,
    sampleResults?: LinkedInSearchResult[],
    columnData?: Record<string, any[]>
  ) => Promise<EnrichmentsResponse | null>;
  
  generateFilters: (
    searchFilterId: string,
    enrichments: EnrichmentsResponse,
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ) => Promise<FiltersResponse | null>;
  
  generateCompletePlan: (
    searchFilterId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs',
    sampleResults?: any[],
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ) => Promise<{
    parsedJD: ParsedJobDescription;
    searchParameters: SearchParametersResponse;
    enrichments: EnrichmentsResponse;
    filters: FiltersResponse;
  } | null>;
  
  isGenerating: boolean;
  error: string | null;
}

export const useSearchPlanGeneration = (): UseSearchPlanGenerationReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenPair = useRecoilValue(tokenPairState);
  const parsedJD = useRecoilValue(parsedJDSelector);

  const makeRequest = useCallback(async <T>(
    endpoint: string,
    body: any
  ): Promise<T | null> => {
    if (!tokenPair?.accessToken?.token) {
      setError('No authentication token available');
      return null;
    }

    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-generation/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPair.accessToken.token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred');
      }

      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error(`Error calling ${endpoint}:`, err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [tokenPair?.accessToken?.token, parsedJD]);

  const generateSearchParameters = useCallback(async (
    searchFilterId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs'
  ): Promise<SearchParametersResponse | null> => {
    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }

    const request = {
      searchFilterId,
      parsedJD: parsedJD.parsedJobDescription,
      searchType,
      searchCategory,
    };

    return makeRequest<SearchParametersResponse>('generate-search-parameters', request);
  }, [parsedJD, makeRequest]);

  const generateEnrichments = useCallback(async (
    searchFilterId: string,
    sampleResults?: LinkedInSearchResult[],
    columnData?: Record<string, any[]>
  ): Promise<EnrichmentsResponse | null> => {
    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }

    const request = {
      searchFilterId,
      parsedJD: parsedJD.parsedJobDescription,
      sampleResults,
      columnData,
    };

    return makeRequest<EnrichmentsResponse>('generate-enrichments', request);
  }, [parsedJD, makeRequest]);

  const generateFilters = useCallback(async (
    searchFilterId: string,
    enrichments: EnrichmentsResponse,
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ): Promise<FiltersResponse | null> => {
    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }

    const request = {
      searchFilterId,
      parsedJD: parsedJD.parsedJobDescription,
      enrichments,
      dataDistribution,
    };

    return makeRequest<FiltersResponse>('generate-filters', request);
  }, [parsedJD, makeRequest]);

  const generateCompletePlan = useCallback(async (
    searchFilterId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs',
    sampleResults?: any[],
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ): Promise<{
    parsedJD: ParsedJobDescription;
    searchParameters: SearchParametersResponse;
    enrichments: EnrichmentsResponse;
    filters: FiltersResponse;
  } | null> => {
    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }

    const request = {
      jdText: parsedJD.parsedJobDescription?.jobTitle || parsedJD.name || '',
      searchType,
      searchCategory,
      searchFilterId,
      sampleResults,
      dataDistribution,
    };

    return makeRequest<{
      parsedJD: ParsedJobDescription;
      searchParameters: SearchParametersResponse;
      enrichments: EnrichmentsResponse;
      filters: FiltersResponse;
    }>('generate-complete-plan', request);
  }, [parsedJD, makeRequest]);

  return {
    generateSearchParameters,
    generateEnrichments,
    generateFilters,
    generateCompletePlan,
    isGenerating,
    error,
  };
};