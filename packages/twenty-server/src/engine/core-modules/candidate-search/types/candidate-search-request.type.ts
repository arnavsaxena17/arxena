import {
    LinkedInClassicCompaniesSearchRequest,
    LinkedInClassicJobsSearchRequest,
    LinkedInClassicPeopleSearchRequest,
    LinkedInRecruiterPeopleSearchRequest,
    LinkedInSalesNavigatorCompaniesSearchRequest,
    LinkedInSalesNavigatorPeopleSearchRequest
} from '../../linkedin-search/types/linkedin-search-request.type';
import { LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';

export interface JobDescriptionParseRequest {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  industry?: string;
}

export interface CandidateSearchRequest {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  industry?: string;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
  accountId: string;
  options?: {
    cursor?: string;
    limit?: number;
  };
}

export interface ParsedJobDescription {
  jobTitle: string;
  company: string;
  location: string;
  industry: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: 'entry_level' | 'mid_level' | 'senior_level' | 'executive';
  education: string[];
  keywords: string[];
  responsibilities: string[];
  qualifications: string[];
  benefits: string[];
  employmentType: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship';
  remoteWork: boolean;
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface GeneratedSearchParameters {
  classicPeopleSearch?: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
  classicCompaniesSearch?: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>;
  classicJobsSearch?: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>;
  salesNavigatorPeopleSearch?: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
  salesNavigatorCompaniesSearch?: Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>;
  recruiterPeopleSearch?: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
}

export interface CandidateSearchResponse {
  parsedJobDescription: ParsedJobDescription;
  generatedSearchParameters: GeneratedSearchParameters;
  searchResults?: LinkedInSearchResponse;
  searchMetadata: {
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    timestamp: string;
    processingTime: number;
  };
}
