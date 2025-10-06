import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { JDParserService } from '../../candidate-sourcing/services/jd-parser.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  CandidateSearchRequest,
  CandidateSearchResponse,
  GeneratedSearchParameters,
  JobDescriptionParseRequest,
  ParsedJobDescription,
} from '../types/candidate-search-request.type';
import { CandidateSearchPromptService } from './candidate-search-prompt.service';

// Zod schema for job description parsing
const parsedJobDescriptionSchema = z.object({
  jobTitle: z.string().describe('The primary job title'),
  company: z.string().describe('The company name'),
  location: z.string().describe('The job location'),
  industry: z.string().describe('The industry or sector'),
  requiredSkills: z.array(z.string()).describe('Required skills and technologies'),
  preferredSkills: z.array(z.string()).describe('Preferred skills and technologies'),
  experienceLevel: z.enum(['entry_level', 'mid_level', 'senior_level', 'executive']).describe('Experience level required'),
  education: z.array(z.string()).describe('Education requirements'),
  keywords: z.array(z.string()).describe('Key terms and keywords from the job description'),
  responsibilities: z.array(z.string()).describe('Key responsibilities and duties'),
  qualifications: z.array(z.string()).describe('Required qualifications'),
  benefits: z.array(z.string()).describe('Benefits and perks mentioned'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'temporary', 'internship']).describe('Type of employment'),
  remoteWork: z.boolean().describe('Whether remote work is allowed'),
  salaryRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
  }).nullable().describe('Salary range if mentioned'),
});

// Zod schema for LinkedIn Classic People Search parameters
const classicPeopleSearchSchema = z.object({
  keywords: z.string().nullable(),
  industry: z.array(z.string()).nullable(),
  location: z.array(z.string()).nullable(),
  profile_language: z.array(z.string()).nullable(),
  network_distance: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).nullable(),
  company: z.array(z.string()).nullable(),
  past_company: z.array(z.string()).nullable(),
  school: z.array(z.string()).nullable(),
  service: z.array(z.string()).nullable(),
  connections_of: z.array(z.string()).nullable(),
  followers_of: z.array(z.string()).nullable(),
  open_to: z.array(z.union([z.literal('proBono'), z.literal('boardMember')])).nullable(),
  advanced_keywords: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    title: z.string().nullable(),
    company: z.string().nullable(),
    school: z.string().nullable(),
  }).nullable(),
});

// Zod schema for LinkedIn Classic Companies Search parameters
const classicCompaniesSearchSchema = z.object({
  keywords: z.string().nullable(),
  industry: z.array(z.string()).nullable(),
  location: z.array(z.string()).nullable(),
  has_job_offers: z.boolean().nullable(),
  headcount: z.array(z.object({
    min: z.number(),
    max: z.number(),
  })).nullable(),
  network_distance: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).nullable(),
});

// Zod schema for LinkedIn Classic Jobs Search parameters
const classicJobsSearchSchema = z.object({
  keywords: z.string().nullable(),
  sort_by: z.union([z.literal('relevance'), z.literal('date')]).nullable(),
  date_posted: z.number().nullable(),
  region: z.string().nullable(),
  location: z.array(z.string()).nullable(),
  location_within_area: z.number().nullable(),
  industry: z.array(z.string()).nullable(),
  seniority: z.array(z.string()).nullable(),
  function: z.array(z.string()).nullable(),
  role: z.array(z.string()).nullable(),
  job_type: z.array(z.union([
    z.literal('full_time'),
    z.literal('part_time'),
    z.literal('contract'),
    z.literal('temporary'),
    z.literal('volunteer'),
    z.literal('internship'),
    z.literal('other'),
  ])).nullable(),
  company: z.array(z.string()).nullable(),
  presence: z.array(z.union([
    z.literal('on_site'),
    z.literal('hybrid'),
    z.literal('remote'),
  ])).nullable(),
  easy_apply: z.boolean().nullable(),
  has_verifications: z.boolean().nullable(),
  under_10_applicants: z.boolean().nullable(),
  in_your_network: z.boolean().nullable(),
  fair_chance_employer: z.boolean().nullable(),
  benefits: z.array(z.string()).nullable(),
  commitments: z.array(z.string()).nullable(),
  minimum_salary: z.object({
    currency: z.string(),
    value: z.number(),
  }).nullable(),
});

@Injectable()
export class CandidateSearchService {
  private readonly logger = new Logger(CandidateSearchService.name);

  constructor(
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly promptService: CandidateSearchPromptService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly jdParserService: JDParserService,
  ) {}

  /**
   * Parse job description using LLM
   */
  async parseJobDescription(
    request: JobDescriptionParseRequest,
    apiToken: string,
  ): Promise<ParsedJobDescription> {
    try {
      // First try to parse using JD parser service if we have a file path
      if (request.filePath) {
        return await this.parseJobDescriptionFromFile(request.filePath, apiToken);
      }

      // For text-based job descriptions, use the new jd-parser service
      if (request.jobDescription) {
        return await this.jdParserService.processJDFromTextToParsedJobDescription(request.jobDescription);
      }

      // Fallback to LLM parsing for text-based job descriptions
      const openaiClient = await this.getOpenAIClient(apiToken);
      const prompt = this.promptService.getJobDescriptionParsingPrompt();

      // Replace template variables
      const systemPrompt = this.replaceTemplateVariables(prompt.system, request);
      const userPrompt = this.replaceTemplateVariables(prompt.user, request);

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(
          parsedJobDescriptionSchema,
          'parsedJobDescription',
        ),
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content returned from LLM');
      }

      const parsedData = JSON.parse(content) as ParsedJobDescription;
      this.logger.log('Successfully parsed job description');
      
      return parsedData;
    } catch (error) {
      this.logger.error('Failed to parse job description in parseJobDescriptionFromFile', error);
      throw error;
    }
  }

  /**
   * Parse job description from file using JD parser service
   */
  async parseJobDescriptionFromFile(
    filePath: string,
    apiToken: string,
  ): Promise<ParsedJobDescription> {
    let tempFilePath: string | null = null;
    
    try {
      this.logger.log(`Parsing job description from file: ${filePath}`);
      
      // Check if filePath is a URL
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        this.logger.log('File path is a URL, downloading file first');
        tempFilePath = await this.downloadFileFromUrl(filePath, apiToken);
        filePath = tempFilePath;
      }
      
      // Use the new JD parser service method that returns ParsedJobDescription directly
      const parsedJobDescription = await this.jdParserService.processJDFromFileToParsedJobDescription(filePath);

      this.logger.log('Successfully parsed job description from file');
      return parsedJobDescription;
    } catch (error) {
      this.logger.error('Failed to parse job description from file', error);
      throw error;
    } finally {
      // Clean up temporary file if it was downloaded
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          this.logger.log(`Cleaned up temporary file: ${tempFilePath}`);
        } catch (cleanupError) {
          this.logger.warn(`Failed to clean up temporary file: ${cleanupError.message}`);
        }
      }
    }
  }

  /**
   * Generate LinkedIn search parameters based on parsed job description
   */
  async generateSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
  ): Promise<GeneratedSearchParameters> {
    try {
      const openaiClient = await this.getOpenAIClient(apiToken);
      const generatedParameters: GeneratedSearchParameters = {};

      // Generate parameters based on search type and category
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          generatedParameters.classicPeopleSearch = await this.generateClassicPeopleSearch(
            parsedJobDescription,
            openaiClient,
          );
        } else if (searchCategory === 'companies') {
          generatedParameters.classicCompaniesSearch = await this.generateClassicCompaniesSearch(
            parsedJobDescription,
            openaiClient,
          );
        } else if (searchCategory === 'jobs') {
          generatedParameters.classicJobsSearch = await this.generateClassicJobsSearch(
            parsedJobDescription,
            openaiClient,
          );
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          generatedParameters.salesNavigatorPeopleSearch = await this.generateSalesNavigatorPeopleSearch(
            parsedJobDescription,
            openaiClient,
          );
        } else if (searchCategory === 'companies') {
          generatedParameters.salesNavigatorCompaniesSearch = await this.generateSalesNavigatorCompaniesSearch(
            parsedJobDescription,
            openaiClient,
          );
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        generatedParameters.recruiterPeopleSearch = await this.generateRecruiterPeopleSearch(
          parsedJobDescription,
          openaiClient,
        );
      }

      this.logger.log(`Generated search parameters for ${searchType} ${searchCategory}`);
      this.logger.log('These are the Generated search parameters:', generatedParameters);
      return generatedParameters;
    } catch (error) {
      this.logger.error('Failed to generate search parameters', error);
      throw error;
    }
  }

  /**
   * Perform complete candidate search
   */
  async searchCandidates(
    request: CandidateSearchRequest,
    apiToken: string,
  ): Promise<CandidateSearchResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Starting candidate search for ${request.searchType} ${request.searchCategory}`);

      // Get LinkedIn account ID from workspace
      const accountId = request.accountId || await this.getLinkedInAccountId(apiToken);
      this.logger.log('Account ID:', accountId);
      // Parse job description
      const parsedJobDescription = await this.parseJobDescription(
        {
          jobDescription: request.jobDescription,
          jobTitle: request.jobTitle,
          company: request.company,
          location: request.location,
          industry: request.industry,
          filePath: request.filePath,
        },
        apiToken,
      );
      this.logger.log('Parsed job description:', parsedJobDescription);
      // Generate search parameters
      const generatedSearchParameters = await this.generateSearchParameters(
        parsedJobDescription,
        request.searchType,
        request.searchCategory,
        apiToken,
      );
      this.logger.log('Generated search parameters:', generatedSearchParameters);
      // Resolve parameter IDs for LinkedIn search
      let resolvedSearchParameters = { ...generatedSearchParameters };
      let resolvedParameters: any = {};
      
      if (request.searchType === 'classic' && request.searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
        resolvedParameters = await this.resolveParameterIds(
          generatedSearchParameters.classicPeopleSearch,
          request.searchType,
          request.searchCategory,
          apiToken,
        );
        resolvedSearchParameters.classicPeopleSearch = resolvedParameters;
      } else if (request.searchType === 'classic' && request.searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
        resolvedParameters = await this.resolveParameterIds(
          generatedSearchParameters.classicCompaniesSearch,
          request.searchType,
          request.searchCategory,
          apiToken,
        );
        resolvedSearchParameters.classicCompaniesSearch = resolvedParameters;
      } else if (request.searchType === 'classic' && request.searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
        resolvedParameters = await this.resolveParameterIds(
          generatedSearchParameters.classicJobsSearch,
          request.searchType,
          request.searchCategory,
          apiToken,
        );
        resolvedSearchParameters.classicJobsSearch = resolvedParameters;
      }

      // Perform LinkedIn search
      let searchResults: LinkedInSearchResponse | undefined = undefined;
      if (request.searchType === 'classic' && request.searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
        searchResults = await this.linkedInSearchService.searchPeople(
          resolvedParameters,
          accountId,
          request.options,
        );
      } else if (request.searchType === 'classic' && request.searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
        searchResults = await this.linkedInSearchService.searchCompanies(
          resolvedParameters,
          accountId,
          request.options,
        );
      } else if (request.searchType === 'classic' && request.searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
        searchResults = await this.linkedInSearchService.searchJobs(
          resolvedParameters,
          accountId,
          request.options,
        );
      } else if (request.searchType === 'sales_navigator' && request.searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
        searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
          generatedSearchParameters.salesNavigatorPeopleSearch,
          accountId,
          request.options,
        );
      } else if (request.searchType === 'sales_navigator' && request.searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
        searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
          generatedSearchParameters.salesNavigatorCompaniesSearch,
          accountId,
          request.options,
        );
      } else if (request.searchType === 'recruiter' && request.searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
        searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
          generatedSearchParameters.recruiterPeopleSearch,
          accountId,
          request.options,
        );
      }

      const processingTime = Date.now() - startTime;

      const response: CandidateSearchResponse = {
        parsedJobDescription,
        generatedSearchParameters: resolvedSearchParameters,
        searchResults,
        searchMetadata: {
          searchType: request.searchType,
          searchCategory: request.searchCategory,
          timestamp: new Date().toISOString(),
          processingTime,
        },
      };

      this.logger.log(`Candidate search completed in ${processingTime}ms`);
      return response;
    } catch (error) {
      this.logger.error('Candidate search failed', error);
      throw error;
    }
  }

  /**
   * Perform candidate search using pre-generated search parameters
   * This method skips JD parsing and parameter generation since they are provided
   */
  async searchCandidatesWithParameters(
    parsedJobDescription: ParsedJobDescription,
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    options?: { cursor?: string; limit?: number },
  ): Promise<CandidateSearchResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Starting candidate search with pre-generated parameters for ${searchType} ${searchCategory}`);
      this.logger.log('Parsed job description:', parsedJobDescription);
      this.logger.log('Generated search parameters:', generatedSearchParameters);
      
      // Get LinkedIn account ID from workspace
      const accountId = await this.getLinkedInAccountId(apiToken);
      this.logger.log('Account ID:', accountId);

      // Check if parameters are already resolved (contain LinkedIn IDs)
      const areParametersResolved = this.checkIfParametersResolved(generatedSearchParameters, searchType, searchCategory);
      
      let resolvedSearchParameters = { ...generatedSearchParameters };
      
      if (areParametersResolved) {
        this.logger.log('Parameters are already resolved, using them directly');
      } else {
        this.logger.log('Parameters are not resolved, resolving parameter names to LinkedIn IDs');
        
        if (searchType === 'classic' && searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
          this.logger.log('Resolving parameters for classic people search');
          resolvedSearchParameters.classicPeopleSearch = await this.resolveParameterIds(
            generatedSearchParameters.classicPeopleSearch,
            searchType,
            searchCategory,
            apiToken,
          );
        } else if (searchType === 'classic' && searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
          this.logger.log('Resolving parameters for classic companies search');
          resolvedSearchParameters.classicCompaniesSearch = await this.resolveParameterIds(
            generatedSearchParameters.classicCompaniesSearch,
            searchType,
            searchCategory,
            apiToken,
          );
        } else if (searchType === 'classic' && searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
          this.logger.log('Resolving parameters for classic jobs search');
          resolvedSearchParameters.classicJobsSearch = await this.resolveParameterIds(
            generatedSearchParameters.classicJobsSearch,
            searchType,
            searchCategory,
            apiToken,
          );
        }
      }

      this.logger.log('Resolved search parameters:', resolvedSearchParameters);

      // Perform LinkedIn search using resolved parameters
      let searchResults: LinkedInSearchResponse | undefined = undefined;
      console.log('Resolved search parameters:', resolvedSearchParameters);
      console.log('Generated searchCategory:', searchCategory);
      console.log('Generated searchType:', searchType);

      // Handle flat format resolved parameters (when resolvedSearchParameters are sent directly)
      if (searchType === 'classic' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.classicPeopleSearch) {
        this.logger.log('Searching for people with flat format resolved parameters');
        // Convert flat format to nested format for sanitization
        const flatParams = resolvedSearchParameters as any;
        const nestedParams = {
          keywords: flatParams.keywords,
          industry: flatParams.industry,
          location: flatParams.location,
          profile_language: flatParams.profile_language,
          network_distance: flatParams.network_distance,
          company: flatParams.company,
          past_company: flatParams.past_company,
          school: flatParams.school,
          service: flatParams.service,
          connections_of: flatParams.connections_of,
          followers_of: flatParams.followers_of,
          open_to: flatParams.open_to,
          advanced_keywords: flatParams.advanced_keywords,
        };
        const sanitizedParams = this.sanitizeClassicPeopleSearchRequest(nestedParams);
        searchResults = await this.linkedInSearchService.searchPeople(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'companies' && areParametersResolved && !resolvedSearchParameters.classicCompaniesSearch) {
        this.logger.log('Searching for companies with flat format resolved parameters');
        // Convert flat format to nested format for sanitization
        const flatParams = resolvedSearchParameters as any;
        const nestedParams = {
          keywords: flatParams.keywords,
          industry: flatParams.industry,
          location: flatParams.location,
          has_job_offers: flatParams.has_job_offers,
          headcount: flatParams.headcount,
          network_distance: flatParams.network_distance,
        };
        const sanitizedParams = this.sanitizeClassicCompaniesSearchRequest(nestedParams);
        searchResults = await this.linkedInSearchService.searchCompanies(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'jobs' && areParametersResolved && !resolvedSearchParameters.classicJobsSearch) {
        this.logger.log('Searching for jobs with flat format resolved parameters');
        // Convert flat format to nested format for sanitization
        const flatParams = resolvedSearchParameters as any;
        const nestedParams = {
          keywords: flatParams.keywords,
          location: flatParams.location,
          company: flatParams.company,
          job_type: flatParams.job_type,
          experience_level: flatParams.experience_level,
          date_posted: flatParams.date_posted,
          salary: flatParams.salary,
          job_function: flatParams.job_function,
          industries: flatParams.industries,
          seniority_level: flatParams.seniority_level,
          company_size: flatParams.company_size,
          when_hired: flatParams.when_hired,
          relevance: flatParams.relevance,
          remote: flatParams.remote,
        };
        const sanitizedParams = this.sanitizeClassicJobsSearchRequest(nestedParams);
        searchResults = await this.linkedInSearchService.searchJobs(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'people' && resolvedSearchParameters.classicPeopleSearch) {
        this.logger.log('Searching for people with resolved parameters');
        const sanitizedParams = this.sanitizeClassicPeopleSearchRequest(resolvedSearchParameters.classicPeopleSearch);
        searchResults = await this.linkedInSearchService.searchPeople(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'companies' && resolvedSearchParameters.classicCompaniesSearch) {
        this.logger.log('Searching for companies with resolved parameters');
        const sanitizedParams = this.sanitizeClassicCompaniesSearchRequest(resolvedSearchParameters.classicCompaniesSearch);
        searchResults = await this.linkedInSearchService.searchCompanies(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'jobs' && resolvedSearchParameters.classicJobsSearch) {
        this.logger.log('Searching for jobs with resolved parameters');
        const sanitizedParams = this.sanitizeClassicJobsSearchRequest(resolvedSearchParameters.classicJobsSearch);
        searchResults = await this.linkedInSearchService.searchJobs(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
        this.logger.log('Searching for people with sales navigator pre-generated parameters');
        searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
          generatedSearchParameters.salesNavigatorPeopleSearch,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
        this.logger.log('Searching for companies with sales navigator pre-generated parameters');
        searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
          generatedSearchParameters.salesNavigatorCompaniesSearch,
          accountId,
          options,
        );
      } else if (searchType === 'recruiter' && searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
        this.logger.log('Searching for people with recruiter pre-generated parameters');
        searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
          generatedSearchParameters.recruiterPeopleSearch,
          accountId,
          options,
        );
      }

      const processingTime = Date.now() - startTime;
      this.logger.log('Search results:', searchResults);
      const response: CandidateSearchResponse = {
        parsedJobDescription,
        generatedSearchParameters,
        resolvedSearchParameters,
        searchResults,
        searchMetadata: {
          searchType,
          searchCategory,
          timestamp: new Date().toISOString(),
          processingTime,
        },
      };
      this.logger.log('Response:', response);
      this.logger.log(`Candidate search with resolved parameters completed in ${processingTime}ms`);
      return response;
    } catch (error) {
      this.logger.error('Candidate search with pre-generated parameters failed', error);
      throw error;
    }
  }

  /**
   * Generate LinkedIn Classic People Search parameters
   */
  private async generateClassicPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
  ): Promise<Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicPeopleSearchPrompt();
    const userPrompt = this.replaceTemplateVariables(prompt.user, { parsedJobDescription });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(
        classicPeopleSearchSchema,
        'classicPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log('AI Generated Classic People Search Parameters:', result);
    return result;
  }

  /**
   * Generate LinkedIn Classic Companies Search parameters
   */
  private async generateClassicCompaniesSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
  ): Promise<Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicCompaniesSearchPrompt();
    const userPrompt = this.replaceTemplateVariables(prompt.user, { parsedJobDescription });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(
        classicCompaniesSearchSchema,
        'classicCompaniesSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Generate LinkedIn Classic Jobs Search parameters
   */
  private async generateClassicJobsSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
  ): Promise<Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicJobsSearchPrompt();
    const userPrompt = this.replaceTemplateVariables(prompt.user, { parsedJobDescription });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(
        classicJobsSearchSchema,
        'classicJobsSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Generate LinkedIn Sales Navigator People Search parameters
   */
  private async generateSalesNavigatorPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
  ): Promise<Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorPeopleSearchPrompt();
    const userPrompt = this.replaceTemplateVariables(prompt.user, { parsedJobDescription });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Generate LinkedIn Sales Navigator Companies Search parameters
   */
  private async generateSalesNavigatorCompaniesSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
  ): Promise<Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorCompaniesSearchPrompt();
    const userPrompt = this.replaceTemplateVariables(prompt.user, { parsedJobDescription });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Generate LinkedIn Recruiter People Search parameters
   */
  private async generateRecruiterPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
  ): Promise<Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getRecruiterPeopleSearchPrompt();
    const userPrompt = this.replaceTemplateVariables(prompt.user, { parsedJobDescription });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0].message.content;
    return content ? JSON.parse(content) : {};
  }

  /**
   * Get OpenAI client using workspace API key
   */
  private async getOpenAIClient(apiToken: string): Promise<OpenAI> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const openaiKey = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'openaikey');

      if (!openaiKey) {
        throw new Error('OpenAI API key not found in workspace API keys');
      }

      return new OpenAI({
        apiKey: openaiKey,
      });
    } catch (error) {
      this.logger.error('Error getting OpenAI client:', error);
      throw new Error('Failed to initialize OpenAI client');
    }
  }

  /**
   * Get LinkedIn account ID from workspace
   */
  private async getLinkedInAccountId(apiToken: string): Promise<string> {
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const linkedinAccountId = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'linkedin_unipile_account_id');

      if (!linkedinAccountId) {
        throw new Error('LinkedIn account ID not found in workspace API keys');
      }

      return linkedinAccountId;
    } catch (error) {
      this.logger.error('Error getting LinkedIn account ID:', error);
      throw new Error('Failed to get LinkedIn account ID');
    }
  }


  /**
   * Download file from URL to temporary location
   */
  private async downloadFileFromUrl(url: string, apiToken: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: '*/*',
        },
        timeout: 30000, // 30 seconds timeout
        responseType: 'stream',
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download file: ${response.status}`);
      }

      // Get original filename from URL or Content-Disposition header
      let originalFilename = this.extractFilenameFromResponse(response, url);
      
      if (!originalFilename || !originalFilename.includes('.')) {
        originalFilename = `temp_jd_${Date.now()}.pdf`;
      }

      // Ensure filename is safe
      originalFilename = this.sanitizeFilename(originalFilename);

      // Create temp directory
      const tempDir = path.join(os.tmpdir(), 'jd_uploads');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, originalFilename);

      // Write file to disk
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          this.logger.log(`Successfully downloaded file to: ${tempFilePath}`);
          resolve(tempFilePath);
        });
        writer.on('error', (error) => {
          this.logger.error('Error writing file:', error);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error('Error downloading file from URL:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Extract filename from response headers or URL
   */
  private extractFilenameFromResponse(response: any, url: string): string {
    // Try to get from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition && contentDisposition.includes('filename=')) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        return filenameMatch[1];
      }
    }

    // Try to get from URL, removing query parameters
    const urlPath = url.split('?')[0];
    const filename = path.basename(urlPath);
    
    return filename || '';
  }

  /**
   * Sanitize filename to be safe for filesystem
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace unsafe characters
    let sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    // Limit length
    if (sanitized.length > 100) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.basename(sanitized, ext);
      sanitized = nameWithoutExt.substring(0, 100 - ext.length) + ext;
      sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');
    }

    return sanitized;
  }

  /**
   * Sanitize LinkedIn Classic People Search request to remove parameters that require numeric IDs
   */
  private sanitizeClassicPeopleSearchRequest(
    request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> {
    const sanitized: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> = {};

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      // sanitized.keywords = request.keywords;
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Always include network_distance if present and is a non-empty array
    if (Array.isArray(request.network_distance) && request.network_distance.length > 0) {
      sanitized.network_distance = request.network_distance;
    }

    // Only include company if present and contains valid numeric IDs
    if (Array.isArray(request.company) && request.company.length > 0) {
      const validCompanyIds = request.company.filter(id => /^\d+$/.test(id));
      if (validCompanyIds.length > 0) {
        sanitized.company = validCompanyIds;
      }
    }

    // Only include past_company if present and contains valid numeric IDs
    if (Array.isArray(request.past_company) && request.past_company.length > 0) {
      const validPastCompanyIds = request.past_company.filter(id => /^\d+$/.test(id));
      if (validPastCompanyIds.length > 0) {
        sanitized.past_company = validPastCompanyIds;
      }
    }

    // Only include school if present and contains valid numeric IDs
    if (Array.isArray(request.school) && request.school.length > 0) {
      const validSchoolIds = request.school.filter(id => /^\d+$/.test(id));
      if (validSchoolIds.length > 0) {
        sanitized.school = validSchoolIds;
      }
    }

    // Only include service if present and contains valid numeric IDs
    if (Array.isArray(request.service) && request.service.length > 0) {
      const validServiceIds = request.service.filter(id => /^\d+$/.test(id));
      if (validServiceIds.length > 0) {
        sanitized.service = validServiceIds;
      }
    }

    // Always include advanced_keywords if present
    if (request.advanced_keywords) {
      // sanitized.advanced_keywords = request.advanced_keywords;
    }

    // Only include profile_language if present and non-empty
    if (request.profile_language) {
      // sanitized.profile_language = request.profile_language;
    }

    // Only include connections_of if present and non-empty
    if (request.connections_of) {
      // sanitized.connections_of = request.connections_of;
    }

    // Only include followers_of if present and non-empty
    if (request.followers_of) {
      sanitized.followers_of = request.followers_of;
    }

    // Only include open_to if present and non-empty
    if (request.open_to) {
      sanitized.open_to = request.open_to;
    }
    
    this.logger.log('Sanitized LinkedIn Classic People Search request:', sanitized);
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Classic Companies Search request to remove parameters that require numeric IDs
   */
  private sanitizeClassicCompaniesSearchRequest(
    request: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'> {
    const sanitized: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'> = {};

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = request.keywords;
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Only include non-null parameters
    if (request.has_job_offers !== undefined && request.has_job_offers !== null) {
      sanitized.has_job_offers = request.has_job_offers;
    }
    if (request.headcount) {
      sanitized.headcount = request.headcount;
    }
    if (request.network_distance) {
      sanitized.network_distance = request.network_distance;
    }
    
    this.logger.log('Sanitized LinkedIn Classic Companies Search request:', sanitized);
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Classic Jobs Search request to remove parameters that require numeric IDs
   */
  private sanitizeClassicJobsSearchRequest(
    request: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'> {
    const sanitized: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'> = {};

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = request.keywords;
    }

    // Only include region if present and is a valid numeric ID
    if (typeof request.region === 'string' && /^\d+$/.test(request.region)) {
      sanitized.region = request.region;
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include function if present and contains valid IDs (alphanumeric pattern)
    if (Array.isArray(request.function) && request.function.length > 0) {
      const validFunctionIds = request.function.filter(id => /^[a-z]+$/.test(id));
      if (validFunctionIds.length > 0) {
        sanitized.function = validFunctionIds;
      }
    }

    // Only include role if present and contains valid numeric IDs
    if (Array.isArray(request.role) && request.role.length > 0) {
      const validRoleIds = request.role.filter(id => /^\d+$/.test(id));
      if (validRoleIds.length > 0) {
        sanitized.role = validRoleIds;
      }
    }

    // Only include company if present and contains valid numeric IDs
    if (Array.isArray(request.company) && request.company.length > 0) {
      const validCompanyIds = request.company.filter(id => /^\d+$/.test(id));
      if (validCompanyIds.length > 0) {
        sanitized.company = validCompanyIds;
      }
    }

    // Only include non-null parameters
    if (request.sort_by) {
      sanitized.sort_by = request.sort_by;
    }
    if (request.date_posted !== undefined && request.date_posted !== null) {
      sanitized.date_posted = request.date_posted;
    }
    if (request.location_within_area !== undefined && request.location_within_area !== null) {
      sanitized.location_within_area = request.location_within_area;
    }
    if (request.seniority) {
      sanitized.seniority = request.seniority;
    }
    if (request.job_type) {
      sanitized.job_type = request.job_type;
    }
    if (request.presence) {
      sanitized.presence = request.presence;
    }
    if (request.easy_apply !== undefined && request.easy_apply !== null) {
      sanitized.easy_apply = request.easy_apply;
    }
    if (request.has_verifications !== undefined && request.has_verifications !== null) {
      sanitized.has_verifications = request.has_verifications;
    }
    if (request.under_10_applicants !== undefined && request.under_10_applicants !== null) {
      sanitized.under_10_applicants = request.under_10_applicants;
    }
    if (request.in_your_network !== undefined && request.in_your_network !== null) {
      sanitized.in_your_network = request.in_your_network;
    }
    if (request.fair_chance_employer !== undefined && request.fair_chance_employer !== null) {
      sanitized.fair_chance_employer = request.fair_chance_employer;
    }
    if (request.benefits) {
      sanitized.benefits = request.benefits;
    }
    if (request.commitments) {
      sanitized.commitments = request.commitments;
    }
    if (request.minimum_salary) {
      sanitized.minimum_salary = request.minimum_salary;
    }
    
    this.logger.log('Sanitized LinkedIn Classic Jobs Search request:', sanitized);
    return sanitized;
  }

  /**
   * Fetch LinkedIn search parameters for a specific type
   */
  async fetchLinkedInParameters(
    parameterType: string,
    keywords?: string,
    limit?: number,
    apiToken?: string,
  ): Promise<any> {
    try {
      const accountId = await this.getLinkedInAccountId(apiToken || '');
      
      const result = await this.linkedInSearchService.getSearchParameters(
        parameterType as any,
        accountId,
        { keywords, limit }
      );

      this.logger.log(`Fetched ${result.items.length} LinkedIn parameters for type: ${parameterType}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch LinkedIn parameters for type: ${parameterType}`, error);
      throw error;
    }
  }

  /**
   * Check if search parameters are already resolved (contain LinkedIn IDs)
   */
  private checkIfParametersResolved(
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): boolean {
    // Check if parameters are in the nested format (e.g., { classicPeopleSearch: { ... } })
    if (searchType === 'classic' && searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
      return this.areParametersResolved(generatedSearchParameters.classicPeopleSearch);
    } else if (searchType === 'classic' && searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
      return this.areParametersResolved(generatedSearchParameters.classicCompaniesSearch);
    } else if (searchType === 'classic' && searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
      return this.areParametersResolved(generatedSearchParameters.classicJobsSearch);
    }
    
    // Check if parameters are in the flat format (directly containing resolved IDs)
    // This happens when resolvedSearchParameters are sent directly
    if (this.areParametersResolved(generatedSearchParameters)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if a specific parameter object contains resolved LinkedIn IDs
   */
  private areParametersResolved(params: any): boolean {
    if (!params) return false;
    
    // Check if any parameter arrays contain LinkedIn IDs (typically numeric strings)
    const checkArray = (arr: any[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(item => 
        typeof item === 'string' && 
        (item.match(/^\d+$/) || item.includes('urn:li:'))
      );
    };
    
    return checkArray(params.industry) || 
           checkArray(params.location) || 
           checkArray(params.company) || 
           checkArray(params.past_company) ||
           checkArray(params.school);
  }

  /**
   * Resolve parameter names to LinkedIn IDs for search parameters
   */
  async resolveParameterIds(
    searchParameters: any,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
  ): Promise<any> {
    try {
      this.logger.log('Resolving parameter IDs for search parameters:', searchParameters);
      
      const resolvedParameters = { ...searchParameters };
      const accountId = await this.getLinkedInAccountId(apiToken);

      // Resolve industry parameters
      if (searchParameters.industry && Array.isArray(searchParameters.industry)) {
        const industryIds: string[] = [];
        for (const industryName of searchParameters.industry) {
          try {
            const industryParams = await this.linkedInSearchService.getIndustryParameters(
              accountId,
              industryName,
              20
            );
            const matchingIndustry = this.findBestMatch(industryParams.items, industryName);
            if (matchingIndustry) {
              industryIds.push(matchingIndustry.id);
              this.logger.log(`Resolved industry "${industryName}" to "${matchingIndustry.title}" (${matchingIndustry.id})`);
            } else {
              this.logger.warn(`No match found for industry: ${industryName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve industry: ${industryName}`, error);
          }
        }
        resolvedParameters.industry = industryIds.length > 0 ? industryIds : undefined;
      }

      // Resolve location parameters
      if (searchParameters.location && Array.isArray(searchParameters.location)) {
        const locationIds: string[] = [];
        for (const locationName of searchParameters.location) {
          try {
            const locationParams = await this.linkedInSearchService.getLocationParameters(
              accountId,
              locationName,
              20
            );
            const matchingLocation = this.findBestMatch(locationParams.items, locationName);
            if (matchingLocation) {
              locationIds.push(matchingLocation.id);
              this.logger.log(`Resolved location "${locationName}" to "${matchingLocation.title}" (${matchingLocation.id})`);
            } else {
              this.logger.warn(`No match found for location: ${locationName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve location: ${locationName}`, error);
          }
        }
        resolvedParameters.location = locationIds.length > 0 ? locationIds : undefined;
      }

      // Resolve company parameters
      if (searchParameters.company && Array.isArray(searchParameters.company)) {
        const companyIds: string[] = [];
        for (const companyName of searchParameters.company) {
          try {
            const companyParams = await this.linkedInSearchService.getCompanyParameters(
              accountId,
              companyName,
              20
            );
            const matchingCompany = this.findBestMatch(companyParams.items, companyName);
            if (matchingCompany) {
              companyIds.push(matchingCompany.id);
              this.logger.log(`Resolved company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
            } else {
              this.logger.warn(`No match found for company: ${companyName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve company: ${companyName}`, error);
          }
        }
        resolvedParameters.company = companyIds.length > 0 ? companyIds : undefined;
      }

      // Resolve school parameters
      if (searchParameters.school && Array.isArray(searchParameters.school)) {
        const schoolIds: string[] = [];
        for (const schoolName of searchParameters.school) {
          try {
            const schoolParams = await this.linkedInSearchService.getSchoolParameters(
              accountId,
              schoolName,
              20
            );
            const matchingSchool = this.findBestMatch(schoolParams.items, schoolName);
            if (matchingSchool) {
              schoolIds.push(matchingSchool.id);
              this.logger.log(`Resolved school "${schoolName}" to "${matchingSchool.title}" (${matchingSchool.id})`);
            } else {
              this.logger.warn(`No match found for school: ${schoolName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve school: ${schoolName}`, error);
          }
        }
        resolvedParameters.school = schoolIds.length > 0 ? schoolIds : undefined;
      }

      // Resolve past_company parameters
      if (searchParameters.past_company && Array.isArray(searchParameters.past_company)) {
        const pastCompanyIds: string[] = [];
        for (const companyName of searchParameters.past_company) {
          try {
            const companyParams = await this.linkedInSearchService.getCompanyParameters(
              accountId,
              companyName,
              20
            );
            const matchingCompany = this.findBestMatch(companyParams.items, companyName);
            if (matchingCompany) {
              pastCompanyIds.push(matchingCompany.id);
              this.logger.log(`Resolved past company "${companyName}" to "${matchingCompany.title}" (${matchingCompany.id})`);
            } else {
              this.logger.warn(`No match found for past company: ${companyName}`);
            }
          } catch (error) {
            this.logger.warn(`Failed to resolve past company: ${companyName}`, error);
          }
        }
        resolvedParameters.past_company = pastCompanyIds.length > 0 ? pastCompanyIds : undefined;
      }

      this.logger.log('Resolved search parameters:', resolvedParameters);
      return resolvedParameters;
    } catch (error) {
      this.logger.error('Failed to resolve parameter IDs', error);
      throw error;
    }
  }

  /**
   * Find the best matching parameter from a list of LinkedIn parameters
   */
  private findBestMatch(items: any[], searchTerm: string): any | null {
    if (!items || items.length === 0) {
      return null;
    }

    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    
    // First, try exact match
    let exactMatch = items.find(item => 
      item.title.toLowerCase() === normalizedSearchTerm
    );
    if (exactMatch) {
      return exactMatch;
    }

    // Then try starts with match
    let startsWithMatch = items.find(item => 
      item.title.toLowerCase().startsWith(normalizedSearchTerm) ||
      normalizedSearchTerm.startsWith(item.title.toLowerCase())
    );
    if (startsWithMatch) {
      return startsWithMatch;
    }

    // Then try contains match
    let containsMatch = items.find(item => 
      item.title.toLowerCase().includes(normalizedSearchTerm) ||
      normalizedSearchTerm.includes(item.title.toLowerCase())
    );
    if (containsMatch) {
      return containsMatch;
    }

    // Finally, try fuzzy matching with word boundaries
    const searchWords = normalizedSearchTerm.split(/\s+/);
    let bestMatch = null;
    let bestScore = 0;

    for (const item of items) {
      const itemWords = item.title.toLowerCase().split(/\s+/);
      let score = 0;
      
      for (const searchWord of searchWords) {
        for (const itemWord of itemWords) {
          if (itemWord.includes(searchWord) || searchWord.includes(itemWord)) {
            score += 1;
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    // Only return if we have a reasonable match (at least 1 word match)
    return bestScore > 0 ? bestMatch : null;
  }

  /**
   * Replace template variables in prompt strings
   */
  private replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    // Replace {{variable}} patterns
    Object.keys(variables).forEach(key => {
      const value = variables[key];
      if (value !== undefined && value !== null) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    });

    // Replace {{#if variable}}...{{/if}} patterns
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
      return variables[variable] ? content : '';
    });

    return result;
  }
}
