import { TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest
} from '../../linkedin-search/types/linkedin-search-request.type';
import { LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';
import { ClassicPeopleParameterName } from '../schemas/classic-people-search.schema';

export interface JobDescriptionParseRequest {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  industry?: string;
  filePath?: string; // Optional file path for file-based parsing
}

export interface CandidateSearchRequest {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  industry?: string;
  filePath?: string; // Optional file path for file-based parsing
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
  salaryRange: {
    min: number;
    max: number;
    currency: string;
  } | null;
}

export interface ClassicPeopleSearchStrategyResult {
  id: string;
  label: string;
  goal: string;
  description: string;
  whenToUse: string;
  filterFocus: string;
  parameterRationales: Record<ClassicPeopleParameterName, string>;
  parameters: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
}

export interface SalesNavigatorPeopleSearchStrategyResult {
  id: string;
  label: string;
  goal: string;
  description: string;
  whenToUse: string;
  filterFocus: string;
  parameterRationales: Record<string, string>;
  parameters: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
}

export interface RecruiterPeopleSearchStrategyResult {
  id: string;
  label: string;
  goal: string;
  description: string;
  whenToUse: string;
  filterFocus: string;
  parameterRationales: Record<string, string>;
  parameters: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
}

export interface GeneratedSearchParameters {
  classicPeopleSearch?: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
  classicPeopleSearchStrategies?: ClassicPeopleSearchStrategyResult[];
  classicCompaniesSearch?: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>;
  classicJobsSearch?: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>;
  salesNavigatorPeopleSearch?: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
  salesNavigatorPeopleSearchStrategies?: SalesNavigatorPeopleSearchStrategyResult[];
  salesNavigatorCompaniesSearch?: Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>;
  recruiterPeopleSearch?: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
  recruiterPeopleSearchStrategies?: RecruiterPeopleSearchStrategyResult[];
}

export interface Certification {
  name: string;
  type?: string | null;
  required: boolean;
}

export interface CompanySizeRange {
  min?: number | null;
  max?: number | null;
  description?: string | null;
}

export interface AgeConstraint {
  maxAge?: number | null;
  minAge?: number | null;
  graduationYearRange?: {
    min?: number | null;
    max?: number | null;
  } | null;
}

export interface TargetCompanyProfile {
  industry?: string | null;
  companySize?: CompanySizeRange | null;
  companyType?: string | null;
  similarCompetitors?: string[] | null;
}

export interface QueryUnderstanding {
  needsClarification?: boolean;
  clarificationQuestions?: string[] | null;
  clarificationAnswers?: string | null;
  ambiguityReasons?: string[] | null;
  primaryRole: string;
  roleVariations: string[];
  industry?: string[] | null;
  locationHierarchy: {
    primary: string;
    secondary?: string[] | null;
    regional?: string | null;
  };
  companyPreferences?: {
    current?: string[] | null;
    past?: string[] | null;
    types?: string[] | null;
  } | null;
  seniorityLevel?: 'entry' | 'mid' | 'senior' | 'executive' | 'c_level' | null;
  domainContext?: string | null;
  skills?: string[] | null;
  experienceRequirements?: string | null;
  explicitRequirements: string[];
  preferredRequirements: string[];
  // Enhanced fields
  companySizeRange?: CompanySizeRange | null;
  fundingStage?: string[] | null;
  ageConstraint?: AgeConstraint | null;
  certifications?: Certification[] | null;
  regulatoryExperience?: string[] | null;
  companyGroupPreferences?: string[] | null;
  hierarchicalSearchRequired?: boolean | null;
  targetCompanyProfile?: TargetCompanyProfile | null;
  // Discovery analysis fields - populated by LLM during discovery integration
  discoveryComplexity?: {
    complexity: 'simple' | 'moderate' | 'complex';
    reasoning: string;
    discoveryNeeds: {
      needsJobTitleDiscovery: boolean;
      needsCompanyDiscovery: boolean;
      needsCompanyGroupDiscovery: boolean;
      needsInstituteDiscovery: boolean;
    };
  } | null;
  patternIdentification?: {
    identifiedPatterns: {
      specializedRole: {
        detected: boolean;
        confidence: number;
        reasoning: string | null;
      };
      companyDescription: {
        detected: boolean;
        confidence: number;
        description: string | null;
        reasoning: string | null;
      };
      instituteRequirement: {
        detected: boolean;
        confidence: number;
        instituteType: string | null;
        reasoning: string | null;
      };
    };
  } | null;
}

export interface ResultValidationResult {
  isRelevant: boolean;
  relevanceScore: number; // 0-1
  falsePositives: string[];
  qualityAssessment: 'high' | 'medium' | 'low';
  shouldContinuePagination: boolean;
  reasoning?: string | null;
}

export interface CandidateSearchResponse {
  parsedJobDescription: ParsedJobDescription;
  generatedSearchParameters: GeneratedSearchParameters;
  resolvedSearchParameters?: GeneratedSearchParameters;
  searchResults?: LinkedInSearchResponse;
  transformedCandidates?: TransformedCandidateForTable[];
  searchMetadata: {
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    timestamp: string;
    processingTime: number;
  };
}
