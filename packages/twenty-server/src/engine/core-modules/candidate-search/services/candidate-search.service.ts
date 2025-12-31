import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import * as path from 'path';
import { findManyAttachmentsQuery } from 'twenty-shared';
import { z } from 'zod';
import { LinkedInSearchTransformerService, TransformedCandidateForTable } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { JDParserService } from '../../candidate-sourcing/services/jd-parser.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import {
  LinkedInAdvancedKeywordsFilter,
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

import { classicCompaniesSearchSchema } from '../schemas/classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/classic-jobs-search.schema';
import {
  ClassicPeopleParameterName,
  ClassicPeopleParameterSelection,
  ClassicPeopleStrategyDefinition,
  ClassicPeopleStrategyPlan,
  classicPeopleSearchSchema,
  classicPeopleStrategyPlanSchema
} from '../schemas/classic-people-search.schema';
import { parsedJobDescriptionSchema } from '../schemas/job-description.schema';
import { recruiterPeopleSearchSchema } from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import { salesNavigatorPeopleSearchSchema } from '../schemas/sales-navigator-people-search.schema';

import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
  CandidateSearchRequest,
  CandidateSearchResponse,
  ClassicPeopleSearchStrategyResult,
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

const sanitizeStringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const cleanedValues = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  return cleanedValues.length > 0 ? cleanedValues : undefined;
};

const createClassicPeopleBaseResult = (): Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> => ({
  keywords: undefined,
  industry: undefined,
  location: undefined,
  profile_language: undefined,
  network_distance: [2] as Array<1 | 2 | 3>,
  company: undefined,
  past_company: undefined,
  school: undefined,
  service: undefined,
  connections_of: undefined,
  followers_of: undefined,
  open_to: undefined,
  advanced_keywords: undefined,
});

const assignClassicPeopleParameterValue = (
  target: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
  parameter: ClassicPeopleParameterName,
  value: unknown,
): void => {
  switch (parameter) {
    case 'keywords': {
      target.keywords = sanitizeStringValue(value);
      break;
    }
    case 'industry': {
      target.industry = sanitizeStringArray(value);
      break;
    }
    case 'location': {
      target.location = sanitizeStringArray(value);
      break;
    }
    case 'company': {
      target.company = sanitizeStringArray(value);
      break;
    }
    case 'past_company': {
      target.past_company = sanitizeStringArray(value);
      break;
    }
    case 'school': {
      target.school = sanitizeStringArray(value);
      break;
    }
    case 'advanced_keywords': {
      if (value && typeof value === 'object') {
        const advancedValue = value as LinkedInAdvancedKeywordsFilter;
        const normalizedAdvancedKeywords = {
          first_name: sanitizeStringValue(advancedValue.first_name),
          last_name: sanitizeStringValue(advancedValue.last_name),
          title: sanitizeStringValue(advancedValue.title),
          company: sanitizeStringValue(advancedValue.company),
          school: sanitizeStringValue(advancedValue.school),
        };
        const hasAnyValue = Object.values(normalizedAdvancedKeywords).some((entry) => !!entry);
        target.advanced_keywords = hasAnyValue ? normalizedAdvancedKeywords : undefined;
      } else {
        target.advanced_keywords = undefined;
      }
      break;
    }
  }
};

const buildDefaultParameterSelection = (): ClassicPeopleParameterSelection => ({
  keywords: {
    shouldGenerate: true,
    reasoning: 'Default fallback when selection fails: keywords are always required to anchor the search.',
  },
  industry: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  location: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  company: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  past_company: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  school: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
  advanced_keywords: {
    shouldGenerate: false,
    reasoning: 'No explicit instruction available. Defaulting to false.',
  },
});

const classicPeopleParameterSchemaMap: Record<ClassicPeopleParameterName, z.ZodTypeAny> = {
  keywords: z.object({
    keywords: classicPeopleSearchSchema.shape.keywords,
  }),
  industry: z.object({
    industry: classicPeopleSearchSchema.shape.industry,
  }),
  location: z.object({
    location: classicPeopleSearchSchema.shape.location,
  }),
  company: z.object({
    company: classicPeopleSearchSchema.shape.company,
  }),
  past_company: z.object({
    past_company: classicPeopleSearchSchema.shape.past_company,
  }),
  school: z.object({
    school: classicPeopleSearchSchema.shape.school,
  }),
  advanced_keywords: z.object({
    advanced_keywords: classicPeopleSearchSchema.shape.advanced_keywords,
  }),
};

type ClassicPeopleSearchGenerationResult = {
  primary: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
  strategies?: ClassicPeopleSearchStrategyResult[];
};

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
    private readonly linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly resumeReaderService: ResumeReaderService,
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
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const prompt = this.promptService.getJobDescriptionParsingPrompt();

      // Replace template variables
      const systemPrompt = replaceTemplateVariables(prompt.system, request);
      const userPrompt = replaceTemplateVariables(prompt.user, request);

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
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
      this.logger.log(`Parsed job description from text: ${JSON.stringify(parsedData, null, 2)}`);
      
      return parsedData;
    } catch (error) {
      this.logger.error(`Failed to parse job description in parseJobDescription: ${error}`);
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
      this.logger.log(`Parsing job description from file: ${filePath} with JD parser service`);
      
      // Check if filePath is a URL
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        this.logger.log('File path is a URL, downloading file first');
        tempFilePath = await this.fileUtils.downloadFileFromUrl(filePath, apiToken);
        filePath = tempFilePath;
      }
      
      // Use the new JD parser service method that returns ParsedJobDescription directly
      const parsedJobDescription = await this.jdParserService.processJDFromFileToParsedJobDescription(filePath);

      this.logger.log(`Parsed job description from file: ${JSON.stringify(parsedJobDescription, null, 2)}`);
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
   * Fetch and extract raw JD text from job attachments
   */
  private async getJDContentFromJobAttachments(
    jobId: string,
    apiToken: string,
  ): Promise<string> {
    try {
      this.logger.log(`Fetching JD content from job attachments for jobId: ${jobId}`);

      // Fetch job attachments
      const response = await this.staticGraphQLService.executeGraphQL(
        findManyAttachmentsQuery,
        {
          filter: { jobId: { eq: jobId } },
          orderBy: [{ createdAt: 'DescNullsFirst' }],
        },
        apiToken,
      );

      const attachments = response?.data?.data?.attachments?.edges || [];
      
      if (attachments.length === 0) {
        this.logger.log(`No attachments found for jobId: ${jobId}`);
        return '';
      }

      // Get the first attachment (assuming it's the JD file)
      const attachment = attachments[0].node;
      if (!attachment.fullPath) {
        this.logger.log(`No valid attachment path for jobId: ${jobId}`);
        return '';
      }

      // Download and process the JD file
      const jdContent = await this.downloadAndProcessJD(
        attachment.fullPath,
        attachment.name,
        jobId,
        apiToken,
      );

      return jdContent;
    } catch (error) {
      this.logger.error(`Error fetching JD content for jobId ${jobId}:`, error);
      return '';
    }
  }

  /**
   * Download and process JD file from fullPath
   */
  private async downloadAndProcessJD(
    fullPath: string,
    fileName: string,
    jobId: string,
    apiToken: string,
  ): Promise<string> {
    try {
      // Download the JD file
      const response = await fetch(fullPath, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch JD: ${fileName}`);
      }

      const fileBuffer = await response.arrayBuffer();
      
      // Create a temporary file to store the downloaded JD
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `${jobId}_${fileName}`);
      fs.writeFileSync(tempFilePath, new Uint8Array(fileBuffer));
      
      this.logger.log(`Downloaded JD file: ${fileName} for jobId: ${jobId}`);
      
      // Check if the file format is supported
      if (!this.resumeReaderService.isSupportedResumeFormat(fileName)) {
        this.logger.log(`Unsupported JD format: ${fileName} for jobId: ${jobId}`);
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        return `[Unsupported JD format: ${fileName}]`;
      }
      
      // Use ResumeReaderService to extract text content
      const jdContent = await this.resumeReaderService.readResumeFile(tempFilePath);
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      this.logger.log(`Successfully processed JD: ${fileName} for jobId: ${jobId}`);
      return jdContent.text;
    } catch (error) {
      this.logger.error(`Error downloading and processing JD for jobId ${jobId}:`, error);
      
      // Clean up temp file if it exists
      try {
        const tempFilePath = path.join(process.cwd(), 'temp', `${jobId}_${fileName}`);
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        this.logger.error('Error cleaning up temp file:', cleanupError);
      }
      
      return '';
    }
  }

  /**
   * Generate LinkedIn search parameters with streaming support
   */
  async generateSearchParametersFromLLMStream(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    jobId?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<GeneratedSearchParameters> {
    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const generatedParameters: GeneratedSearchParameters = {};      
      this.logger.log(`Generating search parameters for ${searchType} ${searchCategory}`);
      if (userMessage) {
        this.logger.log(`User message: ${userMessage}`);
      }
      if (classificationReasoning) {
        this.logger.log(`Classification reasoning: ${classificationReasoning}`);
      }

      // Fetch raw JD text from job attachments if jobId is provided
      let rawJDText = '';
      if (jobId) {
        rawJDText = await this.getJDContentFromJobAttachments(jobId, apiToken);
        this.logger.log(`Fetched raw JD text, length: ${rawJDText.length} characters`);
      }

      sendEvent?.('status', { message: `Generating ${searchType} ${searchCategory} search parameters...:` });

      // Generate parameters based on search type and category with streaming
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          const classicPeopleResult = await this.generateClassicPeopleSearchStream(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
          generatedParameters.classicPeopleSearch = classicPeopleResult.primary;
          if (classicPeopleResult.strategies && classicPeopleResult.strategies.length > 0) {
            generatedParameters.classicPeopleSearchStrategies = classicPeopleResult.strategies;
          }
        } else if (searchCategory === 'companies') {
          generatedParameters.classicCompaniesSearch = await this.generateClassicCompaniesSearchStream(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        } else if (searchCategory === 'jobs') {
          generatedParameters.classicJobsSearch = await this.generateClassicJobsSearchStream(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          generatedParameters.salesNavigatorPeopleSearch = await this.generateSalesNavigatorPeopleSearchStream(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        } else if (searchCategory === 'companies') {
          generatedParameters.salesNavigatorCompaniesSearch = await this.generateSalesNavigatorCompaniesSearchStream(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
            sendEvent,
          );
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        generatedParameters.recruiterPeopleSearch = await this.generateRecruiterPeopleSearchStream(
          parsedJobDescription,
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );
      }

      return generatedParameters;
    } catch (error) {
      this.logger.error(`Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`);
      throw error;
    }
  }

  /**
   * Generate LinkedIn search parameters based on parsed job description
   */
  async generateSearchParametersFromLLM(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    jobId?: string,
  ): Promise<GeneratedSearchParameters> {
    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const generatedParameters: GeneratedSearchParameters = {};      
      this.logger.log(`Generating search parameters for ${searchType} ${searchCategory}`);
      if (userMessage) {
        this.logger.log(`User message: ${userMessage}`);
      }
      if (classificationReasoning) {
        this.logger.log(`Classification reasoning: ${classificationReasoning}`);
      }

      // Fetch raw JD text from job attachments if jobId is provided
      let rawJDText = '';
      if (jobId) {
        rawJDText = await this.getJDContentFromJobAttachments(jobId, apiToken);
        this.logger.log(`Fetched raw JD text, length: ${rawJDText.length} characters`);
      }

      // Generate parameters based on search type and category
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          const classicPeopleResult = await this.generateClassicPeopleSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
          generatedParameters.classicPeopleSearch = classicPeopleResult.primary;
          if (classicPeopleResult.strategies && classicPeopleResult.strategies.length > 0) {
            generatedParameters.classicPeopleSearchStrategies = classicPeopleResult.strategies;
          }
        } else if (searchCategory === 'companies') {
          generatedParameters.classicCompaniesSearch = await this.generateClassicCompaniesSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
        } else if (searchCategory === 'jobs') {
          generatedParameters.classicJobsSearch = await this.generateClassicJobsSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          generatedParameters.salesNavigatorPeopleSearch = await this.generateSalesNavigatorPeopleSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
        } else if (searchCategory === 'companies') {
          generatedParameters.salesNavigatorCompaniesSearch = await this.generateSalesNavigatorCompaniesSearch(
            parsedJobDescription,
            openaiClient,
            userMessage,
            classificationReasoning,
            rawJDText,
          );
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        generatedParameters.recruiterPeopleSearch = await this.generateRecruiterPeopleSearch(
          parsedJobDescription,
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText,
        );
      }

      return generatedParameters;
    } catch (error) {
      this.logger.error(`Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`);
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
      this.logger.log(`Request: ${JSON.stringify(request, null, 2)}`);

      // Get LinkedIn account ID from workspace
      const accountId = request?.accountId ? request.accountId : await this.getLinkedInAccountId(apiToken);
      this.logger.log(`Account ID: ${accountId}`);
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
      // Generate search parameters
      const generatedSearchParameters = await this.generateSearchParametersFromLLM(
        parsedJobDescription,
        request.searchType,
        request.searchCategory,
        apiToken,
      );
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

      // Transform search results for DataTable if we have people results
      let transformedCandidates: TransformedCandidateForTable[] = [];
      if (searchResults?.items && request.searchCategory === 'people') {
        this.logger.log(`Transforming ${searchResults.items.length} LinkedIn search results for DataTable`);
        transformedCandidates = this.linkedinSearchResultTransformer.transformSearchResultsToTableFormat(
          searchResults.items,
          'linkedin_search_job', // Default job ID for search results
          `${request.searchType} ${request.searchCategory} search results`
        );
        
        // Add search metadata to candidates
        transformedCandidates = this.linkedinSearchResultTransformer.addMetadataToCandidates(
          transformedCandidates,
          {
            searchType: request.searchType,
            searchCategory: request.searchCategory,
            timestamp: new Date().toISOString(),
            processingTime,
          }
        );
        
        this.logger.log(`Transformed ${transformedCandidates.length} candidates for DataTable`);
      }

      const response: CandidateSearchResponse = {
        parsedJobDescription,
        generatedSearchParameters: resolvedSearchParameters,
        searchResults,
        transformedCandidates: transformedCandidates.length > 0 ? transformedCandidates : undefined,
        searchMetadata: {
          searchType: request.searchType,
          searchCategory: request.searchCategory,
          timestamp: new Date().toISOString(),
          processingTime,
        },
      };

      this.logger.log(`Candidate search completed in ${processingTime}ms with ${transformedCandidates.length} transformed candidates`);
      return response;
    } catch (error) {
      this.logger.error(`Candidate search failed: ${error}`);
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
      // Get LinkedIn account ID from workspace
      const accountId = await this.getLinkedInAccountId(apiToken);
      this.logger.log(`Account ID: ${accountId}`);

      // Check if parameters are already resolved (contain LinkedIn IDs)
      const areParametersResolved = this.checkIfParametersResolved(generatedSearchParameters, searchType, searchCategory);
      
      let resolvedSearchParameters = { ...generatedSearchParameters };
      
      if (areParametersResolved) {
        this.logger.log(`Parameters are already resolved, using them directly for ${searchType} ${searchCategory}`);
      } else {
        this.logger.log(`Parameters are not resolved, resolving parameter names to LinkedIn IDs for ${searchType} ${searchCategory}`);
        
        if (searchType === 'classic' && searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
          this.logger.log(`Resolving parameters for classic people search for ${searchType} ${searchCategory}`);
          resolvedSearchParameters.classicPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.classicPeopleSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'classic' && searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
          this.logger.log(`Resolving parameters for classic companies search for ${searchType} ${searchCategory}`);
          resolvedSearchParameters.classicCompaniesSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.classicCompaniesSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'classic' && searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
          this.logger.log(`Resolving parameters for classic jobs search for ${searchType} ${searchCategory}`);
          resolvedSearchParameters.classicJobsSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.classicJobsSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'sales_navigator' && searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
          this.logger.log(`Resolving parameters for sales navigator people search for ${searchType} ${searchCategory}`);
          resolvedSearchParameters.salesNavigatorPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.salesNavigatorPeopleSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
          this.logger.log(`Resolving parameters for sales navigator companies search for ${searchType} ${searchCategory}`);
          resolvedSearchParameters.salesNavigatorCompaniesSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.salesNavigatorCompaniesSearch,
            searchType,
            searchCategory,
            accountId,
          );
        } else if (searchType === 'recruiter' && searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
          this.logger.log(`Resolving parameters for recruiter people search for ${searchType} ${searchCategory}`);
          resolvedSearchParameters.recruiterPeopleSearch = await this.linkedinParameterResolver.resolveParameterIds(
            generatedSearchParameters.recruiterPeopleSearch,
            searchType,
            searchCategory,
            accountId,
          );
        }
      }

      this.logger.log(`Resolved search parameters for ${searchType} ${searchCategory}: ${JSON.stringify(resolvedSearchParameters, null, 2)}`);
      let searchResults: LinkedInSearchResponse | undefined = undefined;
      this.logger.log(`Generated searchCategory: ${searchCategory}`);
      this.logger.log(`Generated searchType: ${searchType}`);
      this.logger.log(`Options passed to LinkedIn search: ${JSON.stringify(options, null, 2)}`);

      // Handle flat format resolved parameters (when resolvedSearchParameters are sent directly)
      if (searchType === 'classic' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.classicPeopleSearch) {
        this.logger.log(`Searching for people with flat format resolved parameters for ${searchType} ${searchCategory}`);
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
        this.logger.log(`Searching for companies with flat format resolved parameters for ${searchType} ${searchCategory}`);
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
        this.logger.log(`Searching for jobs with flat format resolved parameters for ${searchType} ${searchCategory}`);
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
        this.logger.log(`Searching for people with Sales Navigator flat format resolved parameters for ${searchType} ${searchCategory}`);
        // Clean display fields and sanitize parameters for Sales Navigator
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorPeopleSearchRequest(cleanedParams);
        this.logger.log(`Sanitized Sales Navigator parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
        searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && areParametersResolved && !resolvedSearchParameters.salesNavigatorCompaniesSearch) {
        this.logger.log(`Searching for companies with Sales Navigator flat format resolved parameters for ${searchType} ${searchCategory}`);
        // Clean display fields and sanitize parameters for Sales Navigator Companies
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const sanitizedParams = this.parameterSanitizer.sanitizeSalesNavigatorCompaniesSearchRequest(cleanedParams);
        this.logger.log(`Sanitized Sales Navigator Companies parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
        searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'recruiter' && searchCategory === 'people' && areParametersResolved && !resolvedSearchParameters.recruiterPeopleSearch) {
        this.logger.log(`Searching for people with Recruiter flat format resolved parameters for ${searchType} ${searchCategory}`);
        // Clean display fields and sanitize parameters for Recruiter People
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters);
        const sanitizedParams = this.parameterSanitizer.sanitizeRecruiterPeopleSearchRequest(cleanedParams);
        this.logger.log(`Sanitized Recruiter People parameters for ${searchType} ${searchCategory}: ${JSON.stringify(sanitizedParams, null, 2)}`);
        searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'people' && resolvedSearchParameters.classicPeopleSearch) {
        this.logger.log(`Searching for people with resolved parameters for ${searchType} ${searchCategory}`);
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicPeopleSearch);
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicPeopleSearchRequest(cleanedParams);
        searchResults = await this.linkedInSearchService.searchPeople(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'companies' && resolvedSearchParameters.classicCompaniesSearch) {
        this.logger.log(`Searching for companies with resolved parameters for ${searchType} ${searchCategory}`);
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicCompaniesSearch);
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicCompaniesSearchRequest(cleanedParams);
        searchResults = await this.linkedInSearchService.searchCompanies(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'classic' && searchCategory === 'jobs' && resolvedSearchParameters.classicJobsSearch) {
        this.logger.log(`Searching for jobs with resolved parameters for ${searchType} ${searchCategory}`);
        const cleanedParams = this.removeDisplayFields(resolvedSearchParameters.classicJobsSearch);
        const sanitizedParams = this.parameterSanitizer.sanitizeClassicJobsSearchRequest(cleanedParams);
        searchResults = await this.linkedInSearchService.searchJobs(
          sanitizedParams,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'people' && resolvedSearchParameters.salesNavigatorPeopleSearch) {
        this.logger.log(`Searching for people with sales navigator resolved parameters for ${searchType} ${searchCategory}`);
        searchResults = await this.linkedInSearchService.searchPeopleSalesNavigator(
          resolvedSearchParameters.salesNavigatorPeopleSearch,
          accountId,
          options,
        );
      } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && resolvedSearchParameters.salesNavigatorCompaniesSearch) {
        this.logger.log(`Searching for companies with sales navigator resolved parameters for ${searchType} ${searchCategory}`);
        searchResults = await this.linkedInSearchService.searchCompaniesSalesNavigator(
          resolvedSearchParameters.salesNavigatorCompaniesSearch,
          accountId,
          options,
        );
      } else if (searchType === 'recruiter' && searchCategory === 'people' && resolvedSearchParameters.recruiterPeopleSearch) {
        this.logger.log(`Searching for people with recruiter resolved parameters for ${searchType} ${searchCategory}`);
        searchResults = await this.linkedInSearchService.searchPeopleRecruiter(
          resolvedSearchParameters.recruiterPeopleSearch,
          accountId,
          options,
        );
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Search results for ${searchType} ${searchCategory}: ${JSON.stringify(searchResults, null, 2)}`);
      this.logger.log(`LinkedIn API returned ${searchResults?.items?.length || 0} items with cursor: ${searchResults?.cursor || 'null'}`);
      
      // Transform search results for DataTable if we have people results
      let transformedCandidates: TransformedCandidateForTable[] = [];
      if (searchResults?.items && searchCategory === 'people') {
        this.logger.log(`Transforming ${searchResults.items.length} LinkedIn search results for DataTable`);
        transformedCandidates = this.linkedinSearchResultTransformer.transformSearchResultsToTableFormat(
          searchResults.items,
          'linkedin_search_job', // Default job ID for search results
          `${searchType} ${searchCategory} search results`
        );
        
        // Add search metadata to candidates
        transformedCandidates = this.linkedinSearchResultTransformer.addMetadataToCandidates(
          transformedCandidates,
          {
            searchType,
            searchCategory,
            timestamp: new Date().toISOString(),
            processingTime,
          }
        );
        
        this.logger.log(`Transformed ${transformedCandidates.length} candidates for DataTable`);
      }
      
      const response: CandidateSearchResponse = {
        parsedJobDescription,
        generatedSearchParameters,
        resolvedSearchParameters,
        searchResults,
        transformedCandidates: transformedCandidates.length > 0 ? transformedCandidates : undefined,
        searchMetadata: {
          searchType,
          searchCategory,
          timestamp: new Date().toISOString(),
          processingTime,
        },
      };
      this.logger.log(`Response for ${searchType} ${searchCategory} includes ${transformedCandidates.length} transformed candidates`);
      this.logger.log(`Candidate search with resolved parameters completed in ${processingTime}ms`);
      return response;
    } catch (error) {
      this.logger.error(`Candidate search with pre-generated parameters failed for ${searchType} ${searchCategory}: ${error}`);
      throw error;
    }
  }

  /**
   * Generate LinkedIn Classic People Search parameters with streaming
   */
  private async generateClassicPeopleSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<ClassicPeopleSearchGenerationResult> {
    const prompt = this.promptService.getClassicPeopleSearchPrompt();

    if (userMessage && classificationReasoning) {
      const strategyPrompt = SearchParametersPrompts.decidingWhichParametersToCreateForClassicPeopleSearch(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'classic'
      );

      const multiStrategyResult = await this.generateClassicPeopleSearchWithStrategiesStream(
        openaiClient,
        prompt.system,
        strategyPrompt,
        userMessage,
        classificationReasoning,
        rawJDText || '',
        sendEvent,
      );

      if (multiStrategyResult) {
        this.logger.log(`Multi-strategy classic people parameter generation returned usable result: ${JSON.stringify(multiStrategyResult, null, 2)}`);
        return multiStrategyResult;
      }

      this.logger.warn('Multi-strategy classic people parameter generation returned no usable result. Falling back to single-call prompt.');
      const userPrioritizedPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'classic'
      );
      const fallbackParameters = await this.generateClassicPeopleSearchWithSinglePromptStream(
        openaiClient,
        prompt.system,
        userPrioritizedPrompt,
        parsedJobDescription,
        sendEvent,
      );
      return { primary: fallbackParameters };
    }

    const fallbackPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    const fallbackParameters = await this.generateClassicPeopleSearchWithSinglePromptStream(
      openaiClient,
      prompt.system,
      fallbackPrompt,
      parsedJobDescription,
      sendEvent,
    );
    return { primary: fallbackParameters };
  }

  /**
   * Generate LinkedIn Classic People Search parameters
   */
  private async generateClassicPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
  ): Promise<ClassicPeopleSearchGenerationResult> {
    const prompt = this.promptService.getClassicPeopleSearchPrompt();

    if (userMessage && classificationReasoning) {
      const strategyPrompt = SearchParametersPrompts.decidingWhichParametersToCreateForClassicPeopleSearch(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'classic'
      );

      const multiStrategyResult = await this.generateClassicPeopleSearchWithStrategies(
        openaiClient,
        prompt.system,
        strategyPrompt,
        userMessage,
        classificationReasoning,
        rawJDText || '',
      );

      if (multiStrategyResult) {
        this.logger.log(`Multi-strategy classic people parameter generation returned usable result: ${JSON.stringify(multiStrategyResult, null, 2)}`);
        return multiStrategyResult;
      }

      this.logger.warn('Multi-strategy classic people parameter generation returned no usable result. Falling back to single-call prompt.');
      const userPrioritizedPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'classic'
      );
      const fallbackParameters = await this.generateClassicPeopleSearchWithSinglePrompt(
        openaiClient,
        prompt.system,
        userPrioritizedPrompt,
        parsedJobDescription,
      );
      return { primary: fallbackParameters };
    }

    const fallbackPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    const fallbackParameters = await this.generateClassicPeopleSearchWithSinglePrompt(
      openaiClient,
      prompt.system,
      fallbackPrompt,
      parsedJobDescription,
    );
    return { primary: fallbackParameters };
  }

  private async generateClassicPeopleSearchWithSinglePromptStream(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    console.log(`Messages for classic people search: ${JSON.stringify(messages, null, 2)} ${userPrompt} }`);
    
    sendEvent?.('status', { message: 'Analyzing job requirements and generating search parameters...' });
    
    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      stream: true,
      response_format: zodResponseFormat(
        classicPeopleSearchSchema,
        'classicPeopleSearch',
      ),
    });

    let fullContent = '';
    let streamedText = '';
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        streamedText += delta;
        fullContent += delta;
        // Send incremental updates to frontend
        sendEvent?.('chunk', { content: delta });
      }
    }

    // For structured outputs, we need to parse the full JSON
    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Classic People Search Parameters: ${JSON.stringify(result, null, 2)}`);

    // Fallback: if the model returned an empty object, synthesize minimal parameters from the JD
    if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
      sendEvent?.('status', { message: 'Using fallback parameters...' });
      const synthesized = {
        keywords:
          (Array.isArray(parsedJobDescription.keywords) && parsedJobDescription.keywords.length > 0
            ? parsedJobDescription.keywords.join(' ')
            : parsedJobDescription.jobTitle) || null,
        industry: parsedJobDescription.industry ? [parsedJobDescription.industry] : null,
        location: parsedJobDescription.location ? [parsedJobDescription.location] : null,
        profile_language: null,
        network_distance: [2] as Array<1 | 2 | 3>,
        company: null,
        past_company: null,
        school: null,
        service: null,
        connections_of: null,
        followers_of: null,
        open_to: null,
        advanced_keywords: {
          first_name: null,
          last_name: null,
          title: null,
          company: null,
          school: null,
        },
      } as any;
      this.logger.warn('LLM returned empty classic people search parameters. Using synthesized fallback.');
      return synthesized;
    }

    return result;
  }

  private async generateClassicPeopleSearchWithSinglePrompt(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
  ): Promise<Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    console.log(`Messages for classic people search: ${JSON.stringify(messages, null, 2)} ${userPrompt} }`);
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      response_format: zodResponseFormat(
        classicPeopleSearchSchema,
        'classicPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log(`AI Generated Classic People Search Parameters: ${JSON.stringify(result, null, 2)}`);

    // Fallback: if the model returned an empty object, synthesize minimal parameters from the JD
    if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
      const synthesized = {
        keywords:
          (Array.isArray(parsedJobDescription.keywords) && parsedJobDescription.keywords.length > 0
            ? parsedJobDescription.keywords.join(' ')
            : parsedJobDescription.jobTitle) || null,
        industry: parsedJobDescription.industry ? [parsedJobDescription.industry] : null,
        location: parsedJobDescription.location ? [parsedJobDescription.location] : null,
        profile_language: null,
        network_distance: [2] as Array<1 | 2 | 3>,
        company: null,
        past_company: null,
        school: null,
        service: null,
        connections_of: null,
        followers_of: null,
        open_to: null,
        advanced_keywords: {
          first_name: null,
          last_name: null,
          title: null,
          company: null,
          school: null,
        },
      } as any;
      this.logger.warn('LLM returned empty classic people search parameters. Using synthesized fallback.');
      return synthesized;
    }

    return result;
  }

  private async generateClassicPeopleSearchWithStrategiesStream(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategyPrompt: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<ClassicPeopleSearchGenerationResult | null> {
    try {
      sendEvent?.('status', { message: 'Planning search strategy...' });
      
      const stream = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: strategyPrompt },
        ],
        stream: true,
        response_format: zodResponseFormat(
          classicPeopleStrategyPlanSchema,
          'classicPeopleStrategyPlan',
        ),
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          sendEvent?.('chunk', { content: delta });
        }
      }

      if (!fullContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: ClassicPeopleStrategyPlan | null = null;
      try {
        strategyPlan = JSON.parse(fullContent) as ClassicPeopleStrategyPlan;
      } catch (error) {
        this.logger.error(`Failed to parse classic people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      const strategyResults: ClassicPeopleSearchStrategyResult[] = [];

      for (const strategy of strategyPlan.strategies) {
        sendEvent?.('status', { message: `Generating parameters for strategy: ${strategy.label}...` });
        
        const strategyOutcome = await this.generateClassicPeopleParametersForStrategyStream(
          openaiClient,
          systemPrompt,
          strategy,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
        );

        if (!strategyOutcome || !strategyOutcome.parameters) {
          this.logger.warn(`Skipping strategy "${strategy.label}" because no parameters were generated.`);
          continue;
        }

        strategyResults.push({
          id: strategy.id,
          label: strategy.label,
          goal: strategy.goal,
          aggressiveness: strategy.aggressiveness,
          description: strategy.description,
          whenToUse: strategy.whenToUse,
          estimatedCandidateCount: strategy.estimatedCandidateCount,
          filterFocus: strategy.filterFocus,
          parameterRationales: strategyOutcome.parameterRationales,
          parameters: strategyOutcome.parameters,
        });
      }

      if (strategyResults.length === 0) {
        this.logger.warn('All strategy parameter generations failed.');
        return null;
      }

      const primaryStrategy =
        strategyResults.find((strategy) => strategy.aggressiveness === 'balanced') ||
        strategyResults[0];

      return {
        primary: primaryStrategy.parameters,
        strategies: strategyResults,
      };
    } catch (error) {
      this.logger.error(`Multi-strategy classic people parameter generation failed: ${error}`);
      return null;
    }
  }

  private async generateClassicPeopleSearchWithStrategies(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategyPrompt: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
  ): Promise<ClassicPeopleSearchGenerationResult | null> {
    try {
      const strategyCompletion = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: strategyPrompt },
        ],
        response_format: zodResponseFormat(
          classicPeopleStrategyPlanSchema,
          'classicPeopleStrategyPlan',
        ),
      });

      const planContent = strategyCompletion.choices[0].message.content;
      if (!planContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: ClassicPeopleStrategyPlan | null = null;
      try {
        strategyPlan = JSON.parse(planContent) as ClassicPeopleStrategyPlan;
      } catch (error) {
        this.logger.error(`Failed to parse classic people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      const strategyResults: ClassicPeopleSearchStrategyResult[] = [];

      for (const strategy of strategyPlan.strategies) {
        const strategyOutcome = await this.generateClassicPeopleParametersForStrategy(
          openaiClient,
          systemPrompt,
          strategy,
          userMessage,
          classificationReasoning,
          rawJDText,
        );

        if (!strategyOutcome || !strategyOutcome.parameters) {
          this.logger.warn(`Skipping strategy "${strategy.label}" because no parameters were generated.`);
          continue;
        }

        strategyResults.push({
          id: strategy.id,
          label: strategy.label,
          goal: strategy.goal,
          aggressiveness: strategy.aggressiveness,
          description: strategy.description,
          whenToUse: strategy.whenToUse,
          estimatedCandidateCount: strategy.estimatedCandidateCount,
          filterFocus: strategy.filterFocus,
          parameterRationales: strategyOutcome.parameterRationales,
          parameters: strategyOutcome.parameters,
        });
      }

      if (strategyResults.length === 0) {
        this.logger.warn('All strategy parameter generations failed.');
        return null;
      }

      const primaryStrategy =
        strategyResults.find((strategy) => strategy.aggressiveness === 'balanced') ||
        strategyResults[0];

      return {
        primary: primaryStrategy.parameters,
        strategies: strategyResults,
      };
    } catch (error) {
      this.logger.error(`Multi-strategy classic people parameter generation failed: ${error}`);
      return null;
    }
  }

  private async generateClassicPeopleParametersForStrategyStream(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: ClassicPeopleStrategyDefinition,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<{
    parameters: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> | null;
    parameterRationales: Record<ClassicPeopleParameterName, string>;
  } | null> {
    const aggregatedResult = createClassicPeopleBaseResult();
    const candidateRange = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const parameterDecisions: ClassicPeopleParameterSelection =
      strategy.parameterSelection ?? buildDefaultParameterSelection();
    const parameterRationales = Object.keys(parameterDecisions).reduce(
      (acc, key) => ({
        ...acc,
        [key as ClassicPeopleParameterName]: parameterDecisions[key as ClassicPeopleParameterName]
          ?.reasoning || '',
      }),
      {} as Record<ClassicPeopleParameterName, string>,
    );

    const parametersToGenerate = (Object.entries(parameterDecisions) as Array<
      [ClassicPeopleParameterName, { shouldGenerate: boolean; reasoning: string }]
    >).filter(([, decision]) => decision.shouldGenerate);

    if (parametersToGenerate.length === 0) {
      this.logger.warn(`Strategy "${strategy.label}" requested no parameters.`);
      return null;
    }

    let generatedAny = false;

    for (const [parameterName, decision] of parametersToGenerate) {
      sendEvent?.('status', { message: `Generating ${parameterName} parameter...: ` });
      
      const generationPrompt = SearchParametersPrompts.buildClassicPeopleParameterGenerationPrompt(
        parameterName,
        {
          userMessage,
          classificationReasoning,
          rawJDText,
          selectionReasoning: decision.reasoning,
          strategyLabel: strategy.label,
          strategyGoal: strategy.goal,
          strategyAggressiveness: strategy.aggressiveness,
          estimatedCandidateRange: candidateRange,
        },
      );

      const stream = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: generationPrompt },
        ],
        stream: true,
        response_format: zodResponseFormat(
          classicPeopleParameterSchemaMap[parameterName],
          `classicPeople${parameterName}Parameter`,
        ),
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          sendEvent?.('chunk', { content: delta });
        }
      }

      if (!fullContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(fullContent) as Record<string, unknown>;
        assignClassicPeopleParameterValue(
          aggregatedResult,
          parameterName,
          parsedParameter[parameterName],
        );
        generatedAny = true;
      } catch (error) {
        this.logger.error(`Failed to parse generated ${parameterName} parameter: ${error}`);
      }
    }

    if (!generatedAny || !aggregatedResult.keywords) {
      this.logger.warn(`Strategy "${strategy.label}" did not produce usable parameter values.`);
      return null;
    }

    return {
      parameters: aggregatedResult,
      parameterRationales,
    };
  }

  private async generateClassicPeopleParametersForStrategy(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: ClassicPeopleStrategyDefinition,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
  ): Promise<{
    parameters: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> | null;
    parameterRationales: Record<ClassicPeopleParameterName, string>;
  } | null> {
    const aggregatedResult = createClassicPeopleBaseResult();
    const candidateRange = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const parameterDecisions: ClassicPeopleParameterSelection =
      strategy.parameterSelection ?? buildDefaultParameterSelection();
    const parameterRationales = Object.keys(parameterDecisions).reduce(
      (acc, key) => ({
        ...acc,
        [key as ClassicPeopleParameterName]: parameterDecisions[key as ClassicPeopleParameterName]
          ?.reasoning || '',
      }),
      {} as Record<ClassicPeopleParameterName, string>,
    );

    const parametersToGenerate = (Object.entries(parameterDecisions) as Array<
      [ClassicPeopleParameterName, { shouldGenerate: boolean; reasoning: string }]
    >).filter(([, decision]) => decision.shouldGenerate);

    if (parametersToGenerate.length === 0) {
      this.logger.warn(`Strategy "${strategy.label}" requested no parameters.`);
      return null;
    }

    let generatedAny = false;

    for (const [parameterName, decision] of parametersToGenerate) {
      const generationPrompt = SearchParametersPrompts.buildClassicPeopleParameterGenerationPrompt(
        parameterName,
        {
          userMessage,
          classificationReasoning,
          rawJDText,
          selectionReasoning: decision.reasoning,
          strategyLabel: strategy.label,
          strategyGoal: strategy.goal,
          strategyAggressiveness: strategy.aggressiveness,
          estimatedCandidateRange: candidateRange,
        },
      );

      const parameterCompletion = await openaiClient.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: generationPrompt },
        ],
        response_format: zodResponseFormat(
          classicPeopleParameterSchemaMap[parameterName],
          `classicPeople${parameterName}Parameter`,
        ),
      });

      const parameterContent = parameterCompletion.choices[0].message.content;
      if (!parameterContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(parameterContent) as Record<string, unknown>;
        assignClassicPeopleParameterValue(
          aggregatedResult,
          parameterName,
          parsedParameter[parameterName],
        );
        generatedAny = true;
      } catch (error) {
        this.logger.error(`Failed to parse generated ${parameterName} parameter: ${error}`);
      }
    }

    if (!generatedAny || !aggregatedResult.keywords) {
      this.logger.warn(`Strategy "${strategy.label}" did not produce usable parameter values.`);
      return null;
    }

    return {
      parameters: aggregatedResult,
      parameterRationales,
    };
  }

  /**
   * Generate LinkedIn Classic Companies Search parameters with streaming
   */
  private async generateClassicCompaniesSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicCompaniesSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'companies',
        'classic'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    sendEvent?.('status', { message: 'Generating company search parameters...' });

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        classicCompaniesSearchSchema,
        'classicCompaniesSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    return fullContent ? JSON.parse(fullContent) : {};
  }

  /**
   * Generate LinkedIn Classic Companies Search parameters
   */
  private async generateClassicCompaniesSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
  ): Promise<Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicCompaniesSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'companies',
        'classic'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
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
   * Generate LinkedIn Classic Jobs Search parameters with streaming
   */
  private async generateClassicJobsSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicJobsSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'jobs',
        'classic'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    sendEvent?.('status', { message: 'Generating job search parameters...' });

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        classicJobsSearchSchema,
        'classicJobsSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    return fullContent ? JSON.parse(fullContent) : {};
  }

  /**
   * Generate LinkedIn Classic Jobs Search parameters
   */
  private async generateClassicJobsSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
  ): Promise<Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getClassicJobsSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'jobs',
        'classic'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
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
   * Generate LinkedIn Sales Navigator People Search parameters with streaming
   */
  private async generateSalesNavigatorPeopleSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorPeopleSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'sales_navigator'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }
    
    this.logger.log(`User prompt: ${JSON.stringify(enhancedUserPrompt, null, 2)}`);
    
    sendEvent?.('status', { message: 'Generating Sales Navigator search parameters...' });

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        salesNavigatorPeopleSearchSchema,
        'salesNavigatorPeopleSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Sales Navigator People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Sales Navigator People Search parameters
   */
  private async generateSalesNavigatorPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
  ): Promise<Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorPeopleSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'sales_navigator'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }
    
    this.logger.log(`User prompt: ${JSON.stringify(enhancedUserPrompt, null, 2)}`);
    
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      response_format: zodResponseFormat(
        salesNavigatorPeopleSearchSchema,
        'salesNavigatorPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log(`AI Generated Sales Navigator People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Sales Navigator Companies Search parameters with streaming
   */
  private async generateSalesNavigatorCompaniesSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorCompaniesSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'companies',
        'sales_navigator'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    sendEvent?.('status', { message: 'Generating Sales Navigator company search parameters...' });

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        salesNavigatorCompaniesSearchSchema,
        'salesNavigatorCompaniesSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Sales Navigator Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Sales Navigator Companies Search parameters
   */
  private async generateSalesNavigatorCompaniesSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
  ): Promise<Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getSalesNavigatorCompaniesSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'companies',
        'sales_navigator'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      response_format: zodResponseFormat(
        salesNavigatorCompaniesSearchSchema,
        'salesNavigatorCompaniesSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log(`AI Generated Sales Navigator Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Recruiter People Search parameters with streaming
   */
  private async generateRecruiterPeopleSearchStream(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => void,
  ): Promise<Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getRecruiterPeopleSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'recruiter'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    sendEvent?.('status', { message: 'Generating Recruiter search parameters...' });

    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      stream: true,
      response_format: zodResponseFormat(
        recruiterPeopleSearchSchema,
        'recruiterPeopleSearch',
      ),
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        sendEvent?.('chunk', { content: delta });
      }
    }

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated Recruiter People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Generate LinkedIn Recruiter People Search parameters
   */
  private async generateRecruiterPeopleSearch(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
  ): Promise<Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>> {
    const prompt = this.promptService.getRecruiterPeopleSearchPrompt();
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = SearchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        rawJDText || '',
        'people',
        'recruiter'
      );
    } else {
      enhancedUserPrompt = replaceTemplateVariables(prompt.user, { parsedJobDescription });
    }

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      response_format: zodResponseFormat(
        recruiterPeopleSearchSchema,
        'recruiterPeopleSearch',
      ),
    });

    const content = completion.choices[0].message.content;
    const result = content ? JSON.parse(content) : {};
    this.logger.log(`AI Generated Recruiter People Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
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
      this.logger.error(`Error getting LinkedIn account ID: ${error}`);
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
    
    // If we have any meaningful parameters (even if not LinkedIn IDs), consider them resolved
    // This handles cases where frontend sends user-modified parameters with text values
    if (this.hasMeaningfulSearchCriteria(generatedSearchParameters, searchType, searchCategory)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if search parameters contain meaningful search criteria (even if not LinkedIn IDs)
   * This handles cases where frontend sends user-modified parameters with text values
   */
  private hasMeaningfulSearchCriteria(
    generatedSearchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): boolean {
    let params: any = null;
    
    // Get the appropriate parameters based on search type and category
    if (searchType === 'classic' && searchCategory === 'people' && generatedSearchParameters.classicPeopleSearch) {
      params = generatedSearchParameters.classicPeopleSearch;
    } else if (searchType === 'classic' && searchCategory === 'companies' && generatedSearchParameters.classicCompaniesSearch) {
      params = generatedSearchParameters.classicCompaniesSearch;
    } else if (searchType === 'classic' && searchCategory === 'jobs' && generatedSearchParameters.classicJobsSearch) {
      params = generatedSearchParameters.classicJobsSearch;
    } else if (searchType === 'sales_navigator' && searchCategory === 'people' && generatedSearchParameters.salesNavigatorPeopleSearch) {
      params = generatedSearchParameters.salesNavigatorPeopleSearch;
    } else if (searchType === 'sales_navigator' && searchCategory === 'companies' && generatedSearchParameters.salesNavigatorCompaniesSearch) {
      params = generatedSearchParameters.salesNavigatorCompaniesSearch;
    } else if (searchType === 'recruiter' && searchCategory === 'people' && generatedSearchParameters.recruiterPeopleSearch) {
      params = generatedSearchParameters.recruiterPeopleSearch;
    }
    
    if (!params) return false;
    
    // Check for meaningful search criteria
    return this.checkHasMeaningfulCriteria(params);
  }

  /**
   * Check if parameters contain meaningful search criteria
   */
  private checkHasMeaningfulCriteria(params: any): boolean {
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
    
    
    // First check if we have meaningful search criteria
    if (this.checkHasMeaningfulCriteria(params)) {
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
