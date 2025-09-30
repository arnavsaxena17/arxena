import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
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
  }).optional().describe('Salary range if mentioned'),
});

// Zod schema for LinkedIn Classic People Search parameters
const classicPeopleSearchSchema = z.object({
  keywords: z.string().optional(),
  industry: z.array(z.string()).optional(),
  location: z.array(z.string()).optional(),
  profile_language: z.array(z.string()).optional(),
  network_distance: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).optional(),
  company: z.array(z.string()).optional(),
  past_company: z.array(z.string()).optional(),
  school: z.array(z.string()).optional(),
  service: z.array(z.string()).optional(),
  connections_of: z.array(z.string()).optional(),
  followers_of: z.array(z.string()).optional(),
  open_to: z.array(z.union([z.literal('proBono'), z.literal('boardMember')])).optional(),
  advanced_keywords: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    school: z.string().optional(),
  }).optional(),
});

// Zod schema for LinkedIn Classic Companies Search parameters
const classicCompaniesSearchSchema = z.object({
  keywords: z.string().optional(),
  industry: z.array(z.string()).optional(),
  location: z.array(z.string()).optional(),
  has_job_offers: z.boolean().optional(),
  headcount: z.array(z.object({
    min: z.number(),
    max: z.number(),
  })).optional(),
  network_distance: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).optional(),
});

// Zod schema for LinkedIn Classic Jobs Search parameters
const classicJobsSearchSchema = z.object({
  keywords: z.string().optional(),
  sort_by: z.union([z.literal('relevance'), z.literal('date')]).optional(),
  date_posted: z.number().optional(),
  region: z.string().optional(),
  location: z.array(z.string()).optional(),
  location_within_area: z.number().optional(),
  industry: z.array(z.string()).optional(),
  seniority: z.array(z.string()).optional(),
  function: z.array(z.string()).optional(),
  role: z.array(z.string()).optional(),
  job_type: z.array(z.union([
    z.literal('full_time'),
    z.literal('part_time'),
    z.literal('contract'),
    z.literal('temporary'),
    z.literal('volunteer'),
    z.literal('internship'),
    z.literal('other'),
  ])).optional(),
  company: z.array(z.string()).optional(),
  presence: z.array(z.union([
    z.literal('on_site'),
    z.literal('hybrid'),
    z.literal('remote'),
  ])).optional(),
  easy_apply: z.boolean().optional(),
  has_verifications: z.boolean().optional(),
  under_10_applicants: z.boolean().optional(),
  in_your_network: z.boolean().optional(),
  fair_chance_employer: z.boolean().optional(),
  benefits: z.array(z.string()).optional(),
  commitments: z.array(z.string()).optional(),
  minimum_salary: z.object({
    currency: z.string(),
    value: z.number(),
  }).optional(),
});

@Injectable()
export class CandidateSearchService {
  private readonly logger = new Logger(CandidateSearchService.name);

  constructor(
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly promptService: CandidateSearchPromptService,
  ) {}

  /**
   * Parse job description using LLM
   */
  async parseJobDescription(
    request: JobDescriptionParseRequest,
    apiToken: string,
  ): Promise<ParsedJobDescription> {
    try {
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
      this.logger.error('Failed to parse job description', error);
      throw error;
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

      // Parse job description
      const parsedJobDescription = await this.parseJobDescription(
        {
          jobDescription: request.jobDescription,
          jobTitle: request.jobTitle,
          company: request.company,
          location: request.location,
          industry: request.industry,
        },
        apiToken,
      );

      // Generate search parameters
      const generatedSearchParameters = await this.generateSearchParameters(
        parsedJobDescription,
        request.searchType,
        request.searchCategory,
        apiToken,
      );

      // Perform LinkedIn search
      let searchResults: LinkedInSearchResponse | undefined = undefined;
      if (request.searchType === 'classic' && request.searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
        searchResults = await this.linkedInSearchService.searchPeople(
          generatedSearchParameters.classicPeopleSearch,
          request.accountId,
          request.options,
        );
      } else if (request.searchType === 'classic' && request.searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
        searchResults = await this.linkedInSearchService.searchCompanies(
          generatedSearchParameters.classicCompaniesSearch,
          request.accountId,
          request.options,
        );
      } else if (request.searchType === 'classic' && request.searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
        searchResults = await this.linkedInSearchService.searchJobs(
          generatedSearchParameters.classicJobsSearch,
          request.accountId,
          request.options,
        );
      } else if (request.searchType === 'sales_navigator' && request.searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
        searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
          generatedSearchParameters.salesNavigatorPeopleSearch,
          request.accountId,
          request.options,
        );
      } else if (request.searchType === 'sales_navigator' && request.searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
        searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
          generatedSearchParameters.salesNavigatorCompaniesSearch,
          request.accountId,
          request.options,
        );
      } else if (request.searchType === 'recruiter' && request.searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
        searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
          generatedSearchParameters.recruiterPeopleSearch,
          request.accountId,
          request.options,
        );
      }

      const processingTime = Date.now() - startTime;

      const response: CandidateSearchResponse = {
        parsedJobDescription,
        generatedSearchParameters,
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
    return content ? JSON.parse(content) : {};
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
      const response = await fetch(`${process.env.SERVER_BASE_URL}/workspace-modifications/api-keys`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch API keys: ${response.status}`);
      }

      const apiKeys = await response.json();
      const openaiKey = apiKeys.openaikey;

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
