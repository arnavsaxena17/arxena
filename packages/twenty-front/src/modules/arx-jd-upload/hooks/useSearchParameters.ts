import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useCallback, useState } from 'react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type LinkedInSearchType = 'classic' | 'sales_navigator' | 'recruiter';
export type LinkedInSearchCategory = 'people' | 'companies' | 'posts' | 'jobs';

export interface SearchParametersResult {
  generatedParameters: any;
  resolvedParameters: any;
  chatMessage?: string;
}

export interface ParsedJobDescription {
  jobTitle: string;
  company: string;
  location: string;
  industry: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  education: string[];
  keywords: string[];
  responsibilities: string[];
  qualifications: string[];
  benefits: string[];
  employmentType: string;
  remoteWork: boolean;
  salaryRange: any;
}

export const useSearchParameters = () => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  /**
   * Generate search parameters for a specific search type and category
   */
  const generateSearchParameters = useCallback(async (
    parsedJobDescription: ParsedJobDescription,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    assistantThreadId: string,
  ): Promise<any> => {
    if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      throw new Error('No authentication token available');
    }

    setIsGenerating(true);
    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/candidate-search/pipeline/generate-unresolved-search-parameters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
          body: JSON.stringify({
            parsedJobDescription,
            searchType,
            searchCategory,
            assistantThreadId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to generate search parameters: ${response.statusText}`);
      }

      const generatedParams = await response.json();
      console.log(`Generated ${searchType} ${searchCategory} parameters:`, generatedParams);
      
      return generatedParams;
    } catch (error) {
      console.error('Failed to generate search parameters:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  /**
   * Resolve search parameters to LinkedIn IDs
   */
  const resolveSearchParameters = useCallback(async (
    searchParameters: any,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory
  ): Promise<any> => {
    if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      throw new Error('No authentication token available');
    }

    setIsResolving(true);
    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/candidate-search/resolve-parameters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
          body: JSON.stringify({
            searchParameters,
            searchType,
            searchCategory,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to resolve parameters: ${response.statusText}`);
      }

      const resolvedParams = await response.json();
      console.log(`Resolved ${searchType} ${searchCategory} parameters:`, resolvedParams);
      // resolvedParams may contain *_display arrays (with id and title) alongside id arrays
      // Keep structure as-is so UI can use titles for display and ids for backend queries
      
      return resolvedParams;
    } catch (error) {
      console.error('Failed to resolve parameters:', error);
      throw error;
    } finally {
      setIsResolving(false);
    }
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  /**
   * Generate and resolve search parameters in one operation
   */
  const generateResolvedSearchParameters = useCallback(async (
    parsedJobDescription: ParsedJobDescription,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    assistantThreadId: string,
  ): Promise<SearchParametersResult> => {
    try {
      // Generate parameters first
      const generatedParameters = await generateSearchParameters(
        parsedJobDescription,
        searchType,
        searchCategory,
        assistantThreadId,
      );

      // Extract the specific search parameters based on search type and category
      let searchParamsToResolve: any = {};
      
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          searchParamsToResolve = generatedParameters.classicPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          searchParamsToResolve = generatedParameters.classicCompaniesSearch || {};
        } else if (searchCategory === 'jobs') {
          searchParamsToResolve = generatedParameters.classicJobsSearch || {};
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          searchParamsToResolve = generatedParameters.salesNavigatorPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          searchParamsToResolve = generatedParameters.salesNavigatorCompaniesSearch || {};
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        searchParamsToResolve = generatedParameters.recruiterPeopleSearch || {};
      }

      // Resolve parameters to LinkedIn IDs
      const resolvedParameters = await resolveSearchParameters(
        searchParamsToResolve,
        searchType,
        searchCategory
      );

      // Structure the resolved parameters to match the expected format
      let structuredResolvedParameters: any = {};
      
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          structuredResolvedParameters = { classicPeopleSearch: resolvedParameters };
        } else if (searchCategory === 'companies') {
          structuredResolvedParameters = { classicCompaniesSearch: resolvedParameters };
        } else if (searchCategory === 'jobs') {
          structuredResolvedParameters = { classicJobsSearch: resolvedParameters };
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          structuredResolvedParameters = { salesNavigatorPeopleSearch: resolvedParameters };
        } else if (searchCategory === 'companies') {
          structuredResolvedParameters = { salesNavigatorCompaniesSearch: resolvedParameters };
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        structuredResolvedParameters = { recruiterPeopleSearch: resolvedParameters };
      }

      return {
        generatedParameters,
        resolvedParameters: structuredResolvedParameters,
      };
    } catch (error) {
      console.error('Failed to generate and resolve search parameters:', error);
      throw error;
    }
  }, [generateSearchParameters, resolveSearchParameters]);

  /**
   * Check if search parameters exist for a given search type and category
   */
  const hasSearchParameters = useCallback((
    generatedParameters: any,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    assistantThreadId: string
  ): boolean => {
    if (!generatedParameters) return false;
    
    if (searchType === 'classic') {
      if (searchCategory === 'people') return !!generatedParameters.classicPeopleSearch;
      if (searchCategory === 'companies') return !!generatedParameters.classicCompaniesSearch;
      if (searchCategory === 'jobs') return !!generatedParameters.classicJobsSearch;
    } else if (searchType === 'sales_navigator') {
      if (searchCategory === 'people') return !!generatedParameters.salesNavigatorPeopleSearch;
      if (searchCategory === 'companies') return !!generatedParameters.salesNavigatorCompaniesSearch;
    } else if (searchType === 'recruiter') {
      if (searchCategory === 'people') return !!generatedParameters.recruiterPeopleSearch;
    }
    
    return false;
  }, []);

  return {
    generateSearchParameters,
    resolveSearchParameters,
    generateResolvedSearchParameters,
    hasSearchParameters,
    isGenerating,
    isResolving,
  };
};
