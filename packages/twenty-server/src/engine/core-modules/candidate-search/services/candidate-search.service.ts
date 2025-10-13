import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
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
  classicCompaniesSearchSchema,
  classicJobsSearchSchema,
  classicPeopleSearchSchema,
  parsedJobDescriptionSchema,
  recruiterPeopleSearchSchema,
  salesNavigatorCompaniesSearchSchema,
  salesNavigatorPeopleSearchSchema,
} from '../schemas';
import {
  CandidateSearchRequest,
  CandidateSearchResponse,
  GeneratedSearchParameters,
  JobDescriptionParseRequest,
  ParsedJobDescription,
} from '../types/candidate-search-request.type';
import {
  FileUtils,
  LinkedinParameterResolver,
  ParameterSanitizer,
  replaceTemplateVariables,
} from '../utils';
import { CandidateSearchPromptService } from './candidate-search-prompt.service';


@Injectable()
export class CandidateSearchService {
  private readonly logger = new Logger(CandidateSearchService.name);

  constructor(
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly promptService: CandidateSearchPromptService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly jdParserService: JDParserService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly parameterSanitizer: ParameterSanitizer,
    private readonly fileUtils: FileUtils,
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
      // Skip file parsing for standalone searches
      if (request.filePath && request.filePath !== 'standalone_search') {
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
      const systemPrompt = replaceTemplateVariables(prompt.system, request);
      const userPrompt = replaceTemplateVariables(prompt.user, request);

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
        tempFilePath = await this.fileUtils.downloadFileFromUrl(filePath, apiToken);
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
      if (tempFilePath) {
        this.fileUtils.cleanupTempFile(tempFilePath);
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
      let resolvedSearchParameters = { ...generatedSearchParameters } as any;
      let resolvedParameters: any = {};
      
      if (request.searchType === 'classic' && request.searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
        resolvedParameters = await this.linkedinParameterResolver.resolveParameterIds(
          generatedSearchParameters.classicPeopleSearch,
          request.searchType,
          request.searchCategory,
          accountId,
        );
        resolvedSearchParameters.classicPeopleSearch = resolvedParameters;
      } else if (request.searchType === 'classic' && request.searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
        resolvedParameters = await this.linkedinParameterResolver.resolveParameterIds(
          generatedSearchParameters.classicCompaniesSearch,
          request.searchType,
          request.searchCategory,
          accountId,
        );
        resolvedSearchParameters.classicCompaniesSearch = resolvedParameters;
      } else if (request.searchType === 'classic' && request.searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
        resolvedParameters = await this.linkedinParameterResolver.resolveParameterIds(
          generatedSearchParameters.classicJobsSearch,
          request.searchType,
          request.searchCategory,
          accountId,
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
          resolvedSearchParameters.classicPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.classicPeopleSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'classic' && searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
          this.logger.log('Resolving parameters for classic companies search');
          resolvedSearchParameters.classicCompaniesSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.classicCompaniesSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'classic' && searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
          this.logger.log('Resolving parameters for classic jobs search');
          resolvedSearchParameters.classicJobsSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.classicJobsSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'sales_navigator' && searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
          this.logger.log('Resolving parameters for sales navigator people search');
          resolvedSearchParameters.salesNavigatorPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.salesNavigatorPeopleSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
          this.logger.log('Resolving parameters for sales navigator companies search');
          resolvedSearchParameters.salesNavigatorCompaniesSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.salesNavigatorCompaniesSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'recruiter' && searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
          this.logger.log('Resolving parameters for recruiter people search');
          resolvedSearchParameters.recruiterPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.recruiterPeopleSearch,
            searchType,
            searchCategory,
            accountId,
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
        // Clean display fields and convert flat format to nested format for sanitization
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const nestedParams = {
          keywords: cleanedParams.keywords,
          industry: cleanedParams.industry,
          location: cleanedParams.location,
          profile_language: cleanedParams.profile_language,
          network_distance: cleanedParams.network_distance,
          company: cleanedParams.company,
          past_company: cleanedParams.past_company,
          school: cleanedParams.school,
          service: cleanedParams.service,
          connections_of: cleanedParams.connections_of,
          followers_of: cleanedParams.followers_of,
          open_to: cleanedParams.open_to,
          advanced_keywords: cleanedParams.advanced_keywords,
        };
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicPeopleSearchRequest(nestedParams);
        searchResults = await this.linkedInSearchService.searchPeople(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'companies' && areParametersResolved && !resolvedSearchParameters.classicCompaniesSearch) {
        this.logger.log('Searching for companies with flat format resolved parameters');
        // Clean display fields and convert flat format to nested format for sanitization
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const nestedParams = {
          keywords: cleanedParams.keywords,
          industry: cleanedParams.industry,
          location: cleanedParams.location,
          has_job_offers: cleanedParams.has_job_offers,
          headcount: cleanedParams.headcount,
          network_distance: cleanedParams.network_distance,
        };
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicCompaniesSearchRequest(nestedParams);
        searchResults = await this.linkedInSearchService.searchCompanies(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'jobs' && areParametersResolved && !resolvedSearchParameters.classicJobsSearch) {
        this.logger.log('Searching for jobs with flat format resolved parameters');
        // Clean display fields and convert flat format to nested format for sanitization
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const nestedParams = {
          keywords: cleanedParams.keywords,
          location: cleanedParams.location,
          company: cleanedParams.company,
          job_type: cleanedParams.job_type,
          experience_level: cleanedParams.experience_level,
          date_posted: cleanedParams.date_posted,
          salary: cleanedParams.salary,
          job_function: cleanedParams.job_function,
          industries: cleanedParams.industries,
          seniority_level: cleanedParams.seniority_level,
          company_size: cleanedParams.company_size,
          when_hired: cleanedParams.when_hired,
          relevance: cleanedParams.relevance,
          remote: cleanedParams.remote,
        };
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicJobsSearchRequest(nestedParams);
        searchResults = await this.linkedInSearchService.searchJobs(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.salesNavigatorPeopleSearch) {
        this.logger.log('Searching for people with Sales Navigator flat format resolved parameters');
        // Clean display fields and sanitize parameters for Sales Navigator
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorPeopleSearchRequest(cleanedParams);
        this.logger.log('Sanitized Sales Navigator parameters:', sanitizedParams);
        searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && areParametersResolved && !resolvedSearchParameters.salesNavigatorCompaniesSearch) {
        this.logger.log('Searching for companies with Sales Navigator flat format resolved parameters');
        // Clean display fields and sanitize parameters for Sales Navigator Companies
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorCompaniesSearchRequest(cleanedParams);
        this.logger.log('Sanitized Sales Navigator Companies parameters:', sanitizedParams);
        searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'recruiter' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.recruiterPeopleSearch) {
        this.logger.log('Searching for people with Recruiter flat format resolved parameters');
        // Clean display fields and sanitize parameters for Recruiter People
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const sanitizedParams = this.parameterSanitizer.sanitizeRecruiterPeopleSearchRequest(cleanedParams);
        this.logger.log('Sanitized Recruiter People parameters:', sanitizedParams);
        searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'people' && resolvedSearchParameters.classicPeopleSearch) {
        this.logger.log('Searching for people with resolved parameters');
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicPeopleSearch);
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicPeopleSearchRequest(cleanedParams);
        searchResults = await this.linkedInSearchService.searchPeople(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'companies' && resolvedSearchParameters.classicCompaniesSearch) {
        this.logger.log('Searching for companies with resolved parameters');
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicCompaniesSearch);
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicCompaniesSearchRequest(cleanedParams);
        searchResults = await this.linkedInSearchService.searchCompanies(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'jobs' && resolvedSearchParameters.classicJobsSearch) {
        this.logger.log('Searching for jobs with resolved parameters');
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicJobsSearch);
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicJobsSearchRequest(cleanedParams);
        searchResults = await this.linkedInSearchService.searchJobs(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'people' && resolvedSearchParameters.salesNavigatorPeopleSearch) {
        this.logger.log('Searching for people with sales navigator resolved parameters');
        searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
          resolvedSearchParameters.salesNavigatorPeopleSearch,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && resolvedSearchParameters.salesNavigatorCompaniesSearch) {
        this.logger.log('Searching for companies with sales navigator resolved parameters');
        searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
          resolvedSearchParameters.salesNavigatorCompaniesSearch,
          accountId,
          options,
        );
      } else if (searchType === 'recruiter' && searchCategory === 'people' && resolvedSearchParameters.recruiterPeopleSearch) {
        this.logger.log('Searching for people with recruiter resolved parameters');
        searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
          resolvedSearchParameters.recruiterPeopleSearch,
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
    const userPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });

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
    const userPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });

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
    const userPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });

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
    console.log('parsedJobDescription:', parsedJobDescription);
    console.log('prompt:', prompt);
    console.log('prompt.user:', prompt.user);
    const userPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    console.log('User prompt:', userPrompt);
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(
        salesNavigatorPeopleSearchSchema,
        'salesNavigatorPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log('AI Generated Sales Navigator People Search Parameters:', result);
    return result;
  }

  /**
   * Generate LinkedIn Sales Navigator Companies Search parameters
   */
  private async generateSalesNavigatorCompaniesSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
  ): Promise<Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorCompaniesSearchPrompt();
    const userPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(
        salesNavigatorCompaniesSearchSchema,
        'salesNavigatorCompaniesSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log('AI Generated Sales Navigator Companies Search Parameters:', result);
    return result;
  }

  /**
   * Generate LinkedIn Recruiter People Search parameters
   */
  private async generateRecruiterPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
  ): Promise<Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getRecruiterPeopleSearchPrompt();
    const userPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(
        recruiterPeopleSearchSchema,
        'recruiterPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log('AI Generated Recruiter People Search Parameters:', result);
    return result;
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
  async getLinkedInAccountId(apiToken: string): Promise<string> {
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
   * Remove display fields from parameters to prevent API validation errors
   */
  private removeDisplayFields(params: any): any {
    const cleaned = { ...params };
    // Remove all display fields that are added by the parameter resolver
    delete cleaned.industry_display;
    delete cleaned.location_display;
    delete cleaned.company_display;
    delete cleaned.past_company_display;
    delete cleaned.school_display;
    delete cleaned.service_display;
    
    // Remove Sales Navigator and Recruiter specific display fields
    delete cleaned.role_display;
    delete cleaned.function_display;
    delete cleaned.past_role_display;
    delete cleaned.seniority_display;
    delete cleaned.skills_display;
    delete cleaned.groups_display;
    delete cleaned.spotlights_display;
    delete cleaned.current_companies_display;
    delete cleaned.past_companies_display;
    delete cleaned.spoken_languages_display;
    delete cleaned.recruiting_activity_display;
    delete cleaned.graduation_year_range_display;
    delete cleaned.tenure_range_display;
    delete cleaned.company_headcount_display;
    delete cleaned.experience_tenure_display;
    delete cleaned.tenure_at_company_display;
    delete cleaned.tenure_at_role_display;
    delete cleaned.time_at_current_company_display;
    delete cleaned.hide_previously_viewed_display;
    
    return cleaned;
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
    } else if (searchType === 'sales_navigator' && searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
      return this.areParametersResolved(generatedSearchParameters.salesNavigatorPeopleSearch);
    } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
      return this.areParametersResolved(generatedSearchParameters.salesNavigatorCompaniesSearch);
    } else if (searchType === 'recruiter' && searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
      return this.areParametersResolved(generatedSearchParameters.recruiterPeopleSearch);
    }
    
    // Check if parameters are in the flat format (directly containing resolved IDs)
    // This happens when resolvedSearchParameters are sent directly
    if (this.areParametersResolved(generatedSearchParameters)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if a specific parameter object contains resolved LinkedIn IDs or meaningful search criteria
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
    
    // Check for meaningful search criteria (keywords, text-based parameters)
    const hasMeaningfulCriteria = (params: any): boolean => {
      // Check for keywords (can be string or array)
      if (params.keywords) {
        if (typeof params.keywords === 'string' && params.keywords.trim().length > 0) {
          return true;
        }
        if (Array.isArray(params.keywords) && params.keywords.length > 0) {
          return true;
        }
      }
      
      // Check for other text-based parameters that don't need LinkedIn IDs
      if (params.profile_language && Array.isArray(params.profile_language) && params.profile_language.length > 0) {
        return true;
      }
      if (params.network_distance && Array.isArray(params.network_distance) && params.network_distance.length > 0) {
        return true;
      }
      
      // Check for Sales Navigator specific meaningful criteria
      if (params.role && (params.role.include?.length > 0 || params.role.exclude?.length > 0)) {
        return true;
      }
      if (params.function && (params.function.include?.length > 0 || params.function.exclude?.length > 0)) {
        return true;
      }
      if (params.past_role && (params.past_role.include?.length > 0 || params.past_role.exclude?.length > 0)) {
        return true;
      }
      
      // Check for boolean parameters that indicate meaningful search criteria
      if (params.changed_jobs === true || params.past_colleague === true || 
          params.past_applicants === true || params.messaged_recently === true ||
          params.posted_on_linkedin === true || params.shared_experiences === true ||
          params.include_saved_leads === true || params.military_background === true ||
          params.following_your_company === true || params.include_saved_accounts === true ||
          params.viewed_profile_recently === true || params.viewed_your_profile_recently === true) {
        return true;
      }
      
      return false;
    };
    
    // First check if we have meaningful search criteria
    if (hasMeaningfulCriteria(params)) {
      return true;
    }
    
    // Check for Classic search parameters with LinkedIn IDs
    if (params.industry || params.location || params.company || params.past_company || params.school) {
      return checkArray(params.industry) || 
             checkArray(params.location) || 
             checkArray(params.company) || 
             checkArray(params.past_company) ||
             checkArray(params.school);
    }
    
    // Check for Sales Navigator parameters (different structure)
    if (params.location?.include || params.industry?.include || params.company?.include || 
        params.past_company?.include || params.school?.include) {
      return checkArray(params.location?.include) ||
             checkArray(params.industry?.include) ||
             checkArray(params.company?.include) ||
             checkArray(params.past_company?.include) ||
             checkArray(params.school?.include);
    }
    
    // Check for Recruiter parameters (similar to Sales Navigator)
    if (params.location?.include || params.industry?.include || params.company?.include || 
        params.past_company?.include || params.school?.include) {
      return checkArray(params.location?.include) ||
             checkArray(params.industry?.include) ||
             checkArray(params.company?.include) ||
             checkArray(params.past_company?.include) ||
             checkArray(params.school?.include);
    }
    
    return false;
  }

}
