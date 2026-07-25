import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useCallback, useState } from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

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

export interface JobDescriptionParseInput {
  jobDescription?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  industry?: string;
  filePath?: string;
}

export const useProjectDescriptionParser = () => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const [isParsing, setIsParsing] = useState(false);

  /**
   * Parse job description from file path or job details
   */
  const parseJobDescription = useCallback(async (
    input: JobDescriptionParseInput
  ): Promise<ParsedJobDescription | null> => {
    if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      throw new Error('No authentication token available');
    }

    setIsParsing(true);
    try {
      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/parse-job-description`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to parse job description: ${response.statusText}`);
      }

      const parsedJobDescription = await response.json();
      
      return parsedJobDescription;
    } catch (error) {
      console.error('Failed to parse job description:', error);
      throw error;
    } finally {
      setIsParsing(false);
    }
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  /**
   * Parse job description from file path only
   */
  const parseJobDescriptionFromFile = useCallback(async (
    filePath: string
  ): Promise<ParsedJobDescription | null> => {
    return parseJobDescription({ filePath });
  }, [parseJobDescription]);

  /**
   * Parse job description from job details (without file)
   */
  const parseJobDescriptionFromDetails = useCallback(async (
    jobDescription: string,
    jobTitle: string,
    company: string,
    location: string,
    industry: string
  ): Promise<ParsedJobDescription | null> => {
    return parseJobDescription({
      jobDescription,
      jobTitle,
      company,
      location,
      industry,
    });
  }, [parseJobDescription]);

  return {
    parseJobDescription,
    parseJobDescriptionFromFile,
    parseJobDescriptionFromDetails,
    isParsing,
  };
};
