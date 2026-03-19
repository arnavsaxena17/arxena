import { ParsedJobDescription } from '@/arx-jd-upload/hooks/useJobDescriptionParser';
import { useSearchParameters } from '@/arx-jd-upload/hooks/useSearchParameters';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { AiFiltersResponse, LinkedInSearchResult, SearchParametersResponse } from '@/candidate-search/types/candidate-search.types';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { FiltersResponse, SortsResponse } from 'twenty-shared';

export interface UseSearchPlanGenerationReturn {
  generateSearchParameters: (
    assistantThreadId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs'
  ) => Promise<SearchParametersResponse | null>;
  
  generateEnrichments: (
    assistantThreadId: string,
    sampleResults?: LinkedInSearchResult[],
    columnData?: Record<string, any[]>
  ) => Promise<AiFiltersResponse | null>;
  
  generateFilters: (
    assistantThreadId: string,
    aiFilters: AiFiltersResponse,
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ) => Promise<FiltersResponse | null>;
  
  generateSorts: (
    assistantThreadId: string,
    searchParameters: SearchParametersResponse,
    aiFilters: AiFiltersResponse,
    filters: FiltersResponse,
    sampleResults?: LinkedInSearchResult[]
  ) => Promise<SortsResponse | null>;
  
  generateCompletePlan: (
    assistantThreadId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs',
    sampleResults?: any[],
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ) => Promise<{
    parsedJD: ParsedJobDescription;
    searchParameters: SearchParametersResponse;
    aiFilters: AiFiltersResponse;
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
  const { generateSearchParameters: generateSearchParams } = useSearchParameters();

  // Helper function to create ParsedJobDescription from parsedJD
  const createParsedJobDescription = useCallback((): ParsedJobDescription => {
    return parsedJD?.parsedJobDescription || {
      jobTitle: parsedJD?.name || '',
      company: parsedJD?.companyName || '',
      location: parsedJD?.jobLocation || '',
      industry: '',
      requiredSkills: [],
      preferredSkills: [],
      experienceLevel: 'mid_level',
      education: [],
      keywords: [],
      responsibilities: [],
      qualifications: [],
      benefits: [],
      employmentType: 'full_time',
      remoteWork: false,
      salaryRange: null,
    };
  }, [parsedJD]);

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
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/${endpoint}`, {
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
    assistantThreadId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs'
  ): Promise<SearchParametersResponse | null> => {
    console.log('Generating search parameters');
    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }
    console.log("assistantThreadId", assistantThreadId);
    console.log("searchType", searchType);
    console.log("searchCategory", searchCategory);

    try {
      setIsGenerating(true);
      setError(null);

      const parsedJobDescription = createParsedJobDescription();
      console.log("parsedJobDescription", parsedJobDescription);
      const backendResponse = await generateSearchParams(
        parsedJobDescription,
        searchType,
        searchCategory,
        assistantThreadId
      );

      // The backend now returns both generated and resolved parameters
      const generatedParams = backendResponse.generatedSearchParameters || {};
      const resolvedParams = backendResponse.resolvedSearchParameters || {};
      
      // Transform the backend response to match SearchParametersResponse format
      // The backend returns raw search parameters, we need to create variations
      // Convert searchType to camelCase to match backend parameter key construction
      const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
      const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
      const searchParameters = generatedParams[parameterKey] || {};
      const resolvedSearchParameters = resolvedParams[parameterKey] || {};
      
      // Create a single variation with both generated and resolved parameters
      const variation = {
        id: `variation-${Date.now()}`,
        name: `${searchType.charAt(0).toUpperCase() + searchType.slice(1)} ${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)} Search`,
        type: 'targeted' as const,
        description: `AI-generated search parameters for ${searchType} ${searchCategory} search`,
        searchParameters: searchParameters, // Generated parameters (human-readable names)
        resolvedSearchParameters: resolvedSearchParameters, // Resolved parameters (LinkedIn IDs + display info)
        expectedResultSize: 'medium' as const,
        reasoning: `Generated based on job description analysis for ${searchType} ${searchCategory} search`,
      };

      const searchParametersResponse: SearchParametersResponse = {
        variations: [variation],
        overallStrategy: `Targeted ${searchType} ${searchCategory} search strategy based on job requirements`,
        complexity: 'simple',
        reasoning: `Generated search parameters for ${searchType} ${searchCategory} search using AI analysis of the job description`,
        metadata: {
          searchType,
          searchCategory,
          generatedAt: new Date().toISOString(),
        },
      };

      return searchParametersResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error generating search parameters:', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [parsedJD, createParsedJobDescription, generateSearchParams]);

  const generateEnrichments = useCallback(async (
    assistantThreadId: string,
    sampleResults?: LinkedInSearchResult[],
    columnData?: Record<string, any[]>
  ): Promise<AiFiltersResponse | null> => {
    console.log('Generating AI filters');
    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }

    const request = {
      assistantThreadId,
      parsedJD: createParsedJobDescription(),
      sampleResults,
      columnData,
    };

    return makeRequest<AiFiltersResponse>('generate-enrichments', request);
  }, [parsedJD, createParsedJobDescription, makeRequest]);

  const generateFilters = useCallback(async (
    assistantThreadId: string,
    aiFilters: AiFiltersResponse,
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ): Promise<FiltersResponse | null> => {
    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }

    const request = {
      assistantThreadId,
      parsedJD: createParsedJobDescription(),
      enrichments: aiFilters,
      dataDistribution,
    };

    return makeRequest<FiltersResponse>('generate-filters', request);
  }, [parsedJD, createParsedJobDescription, makeRequest]);

  const generateSorts = useCallback(async (
    assistantThreadId: string,
    searchParameters: SearchParametersResponse,
    aiFilters: AiFiltersResponse,
    filters: FiltersResponse,
    sampleResults?: LinkedInSearchResult[]
  ): Promise<SortsResponse | null> => {
    if (!parsedJD) {
      setError('No parsed job description available');
      return null;
    }

    const request = {
      assistantThreadId,
      parsedJD: createParsedJobDescription(),
      searchParameters,
      enrichments: aiFilters,
      filters,
      sampleResults,
    };

    return makeRequest<SortsResponse>('generate-sorts', request);
  }, [parsedJD, createParsedJobDescription, makeRequest]);

  const generateCompletePlan = useCallback(async (
    assistantThreadId: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs',
    sampleResults?: any[],
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ): Promise<{
    parsedJD: ParsedJobDescription;
    searchParameters: SearchParametersResponse;
    aiFilters: AiFiltersResponse;
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
      assistantThreadId,
      sampleResults,
      dataDistribution,
    };

    return makeRequest<{
      parsedJD: ParsedJobDescription;
      searchParameters: SearchParametersResponse;
      aiFilters: AiFiltersResponse;
      filters: FiltersResponse;
    }>('generate-complete-plan', request);
  }, [parsedJD, makeRequest]);

  return {
    generateSearchParameters,
    generateEnrichments,
    generateFilters,
    generateSorts,
    generateCompletePlan,
    isGenerating,
    error,
  };
};