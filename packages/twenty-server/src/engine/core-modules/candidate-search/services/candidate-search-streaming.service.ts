import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { LinkedInSearchTransformerService } from '../../candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { ResumeReaderService } from '../../candidate-sourcing/services/resume-reader.service';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import {
  LinkedInClassicCompaniesSearchRequest,
  LinkedInClassicJobsSearchRequest,
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorCompaniesSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

import {
  candidateRelevanceScoringSchema,
  normalizeCandidateRelevanceScoring,
} from '../schemas/candidate-relevance-scoring.schema';
import { classicCompaniesSearchSchema } from '../schemas/classic-companies-search.schema';
import { classicJobsSearchSchema } from '../schemas/classic-jobs-search.schema';
import {
  ClassicPeopleParameterDecision,
  ClassicPeopleParameterName,
  ClassicPeopleParameterSelection,
  ClassicPeopleStrategyDefinition,
  ClassicPeopleStrategyPlan,
  classicPeopleSearchSchema,
  classicPeopleStrategyPlanSchema
} from '../schemas/classic-people-search.schema';
import {
  RecruiterPeopleParameterDecision,
  RecruiterPeopleParameterName,
  RecruiterPeopleParameterSelection,
  RecruiterPeopleStrategyDefinition,
  RecruiterPeopleStrategyPlan,
  recruiterPeopleSearchSchema,
  recruiterPeopleStrategyPlanSchema,
} from '../schemas/recruiter-people-search.schema';
import { salesNavigatorCompaniesSearchSchema } from '../schemas/sales-navigator-companies-search.schema';
import {
  SalesNavigatorPeopleParameterDecision,
  SalesNavigatorPeopleParameterName,
  SalesNavigatorPeopleParameterSelection,
  SalesNavigatorPeopleStrategyDefinition,
  SalesNavigatorPeopleStrategyPlan,
  salesNavigatorPeopleSearchSchema,
  salesNavigatorPeopleStrategyPlanSchema
} from '../schemas/sales-navigator-people-search.schema';

import { LinkedInSearchResponse } from '../../linkedin-search/types/linkedin-search-response.type';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { queryUnderstandingSchema } from '../schemas/query-understanding.schema';
import { resultValidationSchema } from '../schemas/result-validation.schema';
import {
  CandidateSearchResponse,
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  ParsedJobDescription,
  QueryUnderstanding,
  RecruiterPeopleSearchStrategyResult,
  ResultValidationResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';
import {
  FileUtils,
  LinkedinParameterResolver,
  ParameterSanitizer
} from '../utils';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import {
  assignClassicPeopleParameterValue,
  assignRecruiterPeopleParameterValue,
  assignSalesNavigatorPeopleParameterValue,
  buildDefaultParameterSelection,
  buildDefaultRecruiterPeopleParameterSelection,
  buildDefaultSalesNavigatorPeopleParameterSelection,
  classicPeopleParameterSchemaMap,
  createClassicPeopleBaseResult,
  createRecruiterPeopleBaseResult,
  createSalesNavigatorPeopleBaseResult,
  recruiterPeopleParameterSchemaMap,
  salesNavigatorPeopleParameterSchemaMap,
} from './candidate-search-utils';
import { JobDescriptionService } from './job-description.service';
import { QuerySimplificationService } from './query-simplification.service';

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type SearchExecutionPreview = {
  itemCount: number;
  searchResults: any;
  transformedCandidates?: any;
  searchMetadata?: any;
  validationResults?: Array<{
    page: number;
    validation: ResultValidationResult;
    timestamp: string;
  }>;
  overallValidation?: ResultValidationResult;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
};

type ClassicPeopleSearchGenerationResult = {
  primary: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
  strategies?: ClassicPeopleSearchStrategyResult[];
};

type SalesNavigatorPeopleSearchGenerationResult = {
  primary: Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
  strategies?: SalesNavigatorPeopleSearchStrategyResult[];
};

type RecruiterPeopleSearchGenerationResult = {
  primary: Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
  strategies?: RecruiterPeopleSearchStrategyResult[];
};

@Injectable()
export class CandidateSearchStreamingService extends CandidateSearchBaseService {
  constructor(
    linkedInSearchService: LinkedInSearchService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
    workspaceQueryService: WorkspaceQueryService,
    linkedinParameterResolver: LinkedinParameterResolver,
    parameterSanitizer: ParameterSanitizer,
    fileUtils: FileUtils,
    linkedinSearchResultTransformer: LinkedInSearchTransformerService,
    staticGraphQLService: StaticGraphQLService,
    resumeReaderService: ResumeReaderService,
    jobDescriptionService: JobDescriptionService,
    querySimplificationService: QuerySimplificationService,
  ) {
    super(
      linkedInSearchService,
      workspaceQueryService,
      linkedinParameterResolver,
      parameterSanitizer,
      fileUtils,
      linkedinSearchResultTransformer,
      staticGraphQLService,
      resumeReaderService,
      jobDescriptionService,
      querySimplificationService,
    );
  }

  /**
   * Generate LinkedIn search parameters with streaming support
   */
  async streamSearchParametersAndStrategies(
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    userMessage?: string,
    classificationReasoning?: string,
    jobId?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<GeneratedSearchParameters> {
    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );
      const generatedParameters: GeneratedSearchParameters = {};      
      this.logger.log(`Generating search parameters for ${searchType} ${searchCategory}`);
      if (userMessage)
        this.logger.log(`User message: ${userMessage}`);
      if (classificationReasoning)
        this.logger.log(`Classification reasoning in stream Search Parameters And Strategies: ${classificationReasoning}`);

      const rawJDText = includeJd && jobId
        ? await this.jobDescriptionService.getJDContentFromJobAttachments(jobId, apiToken)
        : '';
      
      if (rawJDText && includeJd) {
        this.logger.log(`Fetched raw JD text, length: ${rawJDText.length} characters`);
      } else if (!includeJd) {
        this.logger.log(`JD content excluded from prompts (includeJd=false)`);
      }

      const eventSent = sendEvent?.('status', { message: `Generating ${searchType} ${searchCategory} search parameters...` });
      if (eventSent === false) {
        this.logger.log('Stream aborted, stopping parameter generation');
        return generatedParameters;
      }

      // Handle people search (same logic for all search types)
      if (searchCategory === 'people') {
        const peopleResult = await this.streamPeopleSearchStrategiesParameters(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
          includeJd,
          queryUnderstanding, // Pass queryUnderstanding to avoid re-computation
        );

        if (searchType === 'classic') {
          const result = peopleResult as ClassicPeopleSearchGenerationResult;
          generatedParameters.classicPeopleSearch = result.primary;
          if (result.strategies?.length) {
            generatedParameters.classicPeopleSearchStrategies = result.strategies;
          }
        } else if (searchType === 'sales_navigator') {
          const result = peopleResult as SalesNavigatorPeopleSearchGenerationResult;
          generatedParameters.salesNavigatorPeopleSearch = result.primary;
          if (result.strategies?.length) {
            generatedParameters.salesNavigatorPeopleSearchStrategies = result.strategies;
          }
        } else if (searchType === 'recruiter') {
          const result = peopleResult as RecruiterPeopleSearchGenerationResult;
          generatedParameters.recruiterPeopleSearch = result.primary;
          if (result.strategies?.length) {
            generatedParameters.recruiterPeopleSearchStrategies = result.strategies;
          }
        }
        return generatedParameters;
      }

      // Handle companies search (classic and sales_navigator)
      if (searchCategory === 'companies' && (searchType === 'classic' || searchType === 'sales_navigator')) {
        const companiesResult = await this.streamCompaniesSearchParameters(
          parsedJobDescription,
          openaiClient,
          searchType,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
          includeJd,
        );

        if (searchType === 'classic') {
          generatedParameters.classicCompaniesSearch = companiesResult as Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>;
        } else {
          generatedParameters.salesNavigatorCompaniesSearch = companiesResult as Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>;
        }
        return generatedParameters;
      }

      // Handle jobs search (only classic)
      if (searchCategory === 'jobs' && searchType === 'classic') {
        generatedParameters.classicJobsSearch = await this.streamJobsSearchParameters(
          parsedJobDescription,
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText,
          sendEvent,
          includeJd,
        );
        return generatedParameters;
      }

      return generatedParameters;
    } catch (error) {
      this.logger.error(`Failed to generate search parameters for ${searchType} ${searchCategory}: ${error}`);
      throw error;
    }
  }


  /**
   * Create a streaming OpenAI chat completion
   */
  private async createStreamingCompletion(
    openaiClient: OpenAI,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    responseFormat: ReturnType<typeof zodResponseFormat>,
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    return openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      stream: true,
      response_format: responseFormat,
    });
  }

  /**
   * Process stream chunks and accumulate content
   */
  private async processStreamChunks(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    sendEvent?: (event: string, data: any) => boolean | void,
    timeoutMs: number = 60000, // 60 second timeout
  ): Promise<string> {
    let fullContent = '';
    
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Stream timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const streamPromise = (async () => {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          // Check if aborted after processing chunk
          const eventSent = sendEvent?.('chunk', { content: delta });
          if (eventSent === false) {
            this.logger.log('Stream aborted during chunk processing');
            break;
          }
        }
      }
      return fullContent;
    })();

    try {
      return await Promise.race([streamPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(`Stream processing error: ${error}`);
      // Return partial content if available, otherwise empty
      return fullContent || '';
    }
  }

  /**
   * Process stream chunks with candidate-specific context for parallel scoring display
   */
  private async processStreamChunksForCandidate(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    candidateIndex: number,
    totalCandidates: number,
    candidateName: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    timeoutMs: number = 30000, // 30 second timeout (reduced from 60s)
  ): Promise<string> {
    let fullContent = '';
    let consecutiveWhitespaceChunks = 0;
    const maxWhitespaceChunks = 50; // If we get 50 consecutive whitespace-only chunks, assume stuck
    let lastNonWhitespaceTime = Date.now();
    const maxIdleTime = 5000; // 5 seconds without non-whitespace content
    
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Stream timeout after ${timeoutMs}ms for candidate ${candidateName}`));
      }, timeoutMs);
    });

    const streamPromise = (async () => {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          const isWhitespaceOnly = /^\s*$/.test(delta);
          
          if (isWhitespaceOnly) {
            consecutiveWhitespaceChunks++;
            // If we have valid JSON already, stop on excessive whitespace
            if (consecutiveWhitespaceChunks > maxWhitespaceChunks && fullContent.trim().length > 0) {
              // Try to extract JSON - if we have valid JSON, return it
              const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  JSON.parse(jsonMatch[0]);
                  this.logger.log(`Stream appears complete (excessive whitespace) for candidate ${candidateName}, returning existing JSON`);
                  return fullContent;
                } catch {
                  // Not valid JSON yet, continue
                }
              }
            }
          } else {
            consecutiveWhitespaceChunks = 0;
            lastNonWhitespaceTime = Date.now();
          }
          
          fullContent += delta;
          
          // Check if we have complete JSON and can exit early
          if (fullContent.trim().length > 50) {
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const testJson = JSON.parse(jsonMatch[0]);
                // If JSON is complete and has all required fields, we can exit early
                if (testJson.relevanceScore !== undefined && testJson.relevanceLabel !== undefined) {
                  this.logger.log(`Complete JSON detected early for candidate ${candidateName}, exiting stream`);
                  return fullContent;
                }
              } catch {
                // Not complete JSON yet, continue
              }
            }
          }
          
          // Check for idle timeout (no non-whitespace content for too long)
          const idleTime = Date.now() - lastNonWhitespaceTime;
          if (idleTime > maxIdleTime && fullContent.trim().length > 0) {
            // Try to extract valid JSON before giving up
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                JSON.parse(jsonMatch[0]);
                this.logger.log(`Stream idle timeout for candidate ${candidateName}, but valid JSON found, returning`);
                return fullContent;
              } catch {
                // Not valid JSON, continue waiting
              }
            }
          }
          
          // Send candidate-specific chunk event so frontend can show reasoning per candidate
          const eventSent = sendEvent?.('candidateScoringChunk', {
            candidateIndex: candidateIndex + 1,
            totalCandidates,
            candidateName,
            content: delta,
            message: `Analyzing candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName}...`,
          });
          if (eventSent === false) {
            this.logger.log('Stream aborted during candidate chunk processing');
            break;
          }
        }
      }
      return fullContent;
    })();

    try {
      return await Promise.race([streamPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(`Stream processing error for candidate ${candidateName}: ${error}`);
      // Return partial content if available, otherwise empty
      return fullContent || '';
    }
  }

  /**
   * Understand and extract structured information from user query
   */
  async understandQuery(
    openaiClient: OpenAI,
    userMessage: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    isClarificationResponse: boolean = false,
  ): Promise<QueryUnderstanding> {
    const eventResult = sendEvent?.('status', { message: 'Analyzing query requirements...' });
    if (eventResult === false) {
      this.logger.log('Stream aborted during query understanding');
      // Return minimal understanding on abort
      return {
        primaryRole: userMessage.split(' ').slice(0, 3).join(' '),
        roleVariations: [],
        industry: undefined,
        locationHierarchy: { primary: '' },
        companyPreferences: undefined,
        seniorityLevel: undefined,
        domainContext: undefined,
        skills: undefined,
        experienceRequirements: undefined,
        explicitRequirements: [],
        preferredRequirements: [],
        needsClarification: true,
        clarificationQuestions: null,
        ambiguityReasons: null,
      } as QueryUnderstanding;
    }
    
    const prompt = this.searchParametersPrompts.getQueryUnderstandingPrompt(
      userMessage,
      rawJDText,
      isClarificationResponse,
    );

    const stream = await this.createStreamingCompletion(
      openaiClient,
      [
        { 
          role: 'system' as const, 
          content: 'You are an expert recruiter specializing in extracting structured information from candidate search queries. Analyze the query and extract all relevant details for building precise LinkedIn searches.' 
        },
        { role: 'user' as const, content: prompt },
      ],
      zodResponseFormat(queryUnderstandingSchema, 'queryUnderstanding'),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    if (!fullContent) {
      this.logger.warn('Query understanding returned empty content.');
      // Return minimal understanding with clarification needed
      return {
        primaryRole: userMessage.split(' ').slice(0, 3).join(' '),
        roleVariations: [],
        industry: undefined,
        locationHierarchy: { primary: '' },
        companyPreferences: undefined,
        seniorityLevel: undefined,
        domainContext: undefined,
        skills: undefined,
        experienceRequirements: undefined,
        explicitRequirements: [],
        preferredRequirements: [],
        needsClarification: true,
        clarificationQuestions: ['Could you provide more details about the role and location?'],
        ambiguityReasons: ['Insufficient information provided'],
      } as QueryUnderstanding;
    }

    try {
      const parsed = JSON.parse(fullContent);
      const validated = queryUnderstandingSchema.parse(parsed);
      this.logger.log(`Query understanding: ${JSON.stringify(validated, null, 2)}`);
      
      // Programmatic ambiguity detection - enhance LLM-based detection
      // Be more lenient if this is a clarification response
      const enhancedUnderstanding = this.detectAmbiguityProgrammatically(
        validated, 
        userMessage,
        isClarificationResponse,
      );
      
      return enhancedUnderstanding;
    } catch (error) {
      this.logger.error(`Failed to parse query understanding: ${error}`);
      // Return minimal understanding on error
      return {
        primaryRole: userMessage.split(' ').slice(0, 3).join(' '),
        roleVariations: [],
        industry: undefined,
        locationHierarchy: { primary: '' },
        companyPreferences: undefined,
        seniorityLevel: undefined,
        domainContext: undefined,
        skills: undefined,
        experienceRequirements: undefined,
        explicitRequirements: [],
        preferredRequirements: [],
        needsClarification: true,
        clarificationQuestions: ['Could you provide more details about the role and location?'],
        ambiguityReasons: ['Insufficient information provided'],
      } as QueryUnderstanding;
    }
  }

  /**
   * Programmatically detect ambiguity in query understanding
   * This complements LLM-based detection with rule-based checks
   */
  private detectAmbiguityProgrammatically(
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    isClarificationResponse: boolean = false,
  ): QueryUnderstanding {
    const ambiguityReasons: string[] = [];
    const clarificationQuestions: string[] = [];
    let needsClarification = queryUnderstanding.needsClarification || false;

    // If this is a clarification response, be more lenient - only flag truly critical missing info
    if (isClarificationResponse) {
      // Only require primary role - other fields can be inferred or are optional
      if (!queryUnderstanding.primaryRole || queryUnderstanding.primaryRole.trim() === '') {
        ambiguityReasons.push('Missing primary role - this is critical for search');
        clarificationQuestions.push('What is the specific job title or role you are looking for?');
        needsClarification = true;
      }
      // Don't require location if user hasn't specified it - we can search broadly
      // Don't require industry if domain context is available
      return {
        ...queryUnderstanding,
        needsClarification,
        clarificationQuestions: needsClarification ? clarificationQuestions : null,
        ambiguityReasons: needsClarification ? ambiguityReasons : null,
      };
    }

    // Original strict checks for initial queries
    // Check for missing critical information
    if (!queryUnderstanding.locationHierarchy?.primary || queryUnderstanding.locationHierarchy.primary.trim() === '') {
      ambiguityReasons.push('Missing location information');
      clarificationQuestions.push('Which specific location(s) should we focus on? (e.g., Bangalore, Mumbai, Delhi NCR)');
      needsClarification = true;
    }

    // Check for vague role description
    const vagueRoleKeywords = ['manager', 'executive', 'lead', 'head', 'director', 'officer'];
    const isVagueRole = vagueRoleKeywords.some(keyword => 
      queryUnderstanding.primaryRole.toLowerCase().includes(keyword) && 
      queryUnderstanding.primaryRole.split(' ').length <= 2
    );
    
    if (isVagueRole && queryUnderstanding.roleVariations.length < 3) {
      ambiguityReasons.push('Role description is too generic');
      if (!clarificationQuestions.some(q => q.includes('role'))) {
        clarificationQuestions.push('What specific role or job title are you looking for? Please provide more context about the function or department.');
      }
      needsClarification = true;
    }

    // Check for missing industry when it's likely needed
    const hasNoIndustry = !queryUnderstanding.industry || queryUnderstanding.industry.length === 0;
    const hasNoDomainContext = !queryUnderstanding.domainContext;
    
    if (hasNoIndustry && hasNoDomainContext && queryUnderstanding.primaryRole.length > 0) {
      // Only flag if role suggests industry-specific requirements
      const industrySpecificRoles = ['pharma', 'healthcare', 'banking', 'finance', 'retail', 'fmcg', 'saas', 'tech'];
      const roleLower = queryUnderstanding.primaryRole.toLowerCase();
      const messageLower = userMessage.toLowerCase();
      
      if (industrySpecificRoles.some(term => roleLower.includes(term) || messageLower.includes(term))) {
        ambiguityReasons.push('Missing industry or sector information');
        if (!clarificationQuestions.some(q => q.includes('industry'))) {
          clarificationQuestions.push('What industry or sector should candidates come from? (e.g., SaaS, FMCG, BFSI, Pharma)');
        }
        needsClarification = true;
      }
    }

    // Check for conflicting requirements (e.g., entry level with executive experience)
    if (queryUnderstanding.seniorityLevel === 'entry' && 
        (queryUnderstanding.experienceRequirements?.toLowerCase().includes('years') || 
         queryUnderstanding.experienceRequirements?.toLowerCase().includes('experience'))) {
      const yearsMatch = queryUnderstanding.experienceRequirements.match(/(\d+)\+?\s*years?/i);
      if (yearsMatch && parseInt(yearsMatch[1]) > 2) {
        ambiguityReasons.push('Conflicting requirements: entry level with significant experience');
        clarificationQuestions.push('What level of seniority are you looking for? The role seems to require experience but is marked as entry level.');
        needsClarification = true;
      }
    }

    // If we detected additional ambiguity, merge with LLM-detected reasons
    if (needsClarification && ambiguityReasons.length > 0) {
      const existingReasons = queryUnderstanding.ambiguityReasons || [];
      const existingQuestions = queryUnderstanding.clarificationQuestions || [];
      
      // Merge reasons, avoiding duplicates
      const mergedReasons = [...new Set([...existingReasons, ...ambiguityReasons])];
      
      // Merge questions, prioritizing programmatic ones for missing critical info
      const mergedQuestions = [
        ...clarificationQuestions.filter(q => q.includes('location') || q.includes('industry') || q.includes('role')),
        ...existingQuestions.filter(q => !q.includes('location') && !q.includes('industry') && !q.includes('role')),
      ];
      
      // Limit to 4 questions max
      const finalQuestions = mergedQuestions.slice(0, 4);
      
      return {
        ...queryUnderstanding,
        needsClarification: true,
        clarificationQuestions: finalQuestions.length > 0 ? finalQuestions : existingQuestions,
        ambiguityReasons: mergedReasons,
      };
    }

    return queryUnderstanding;
  }

  /**
   * Assess query complexity to determine if multiple strategies are needed
   */
  assessQueryComplexity(
    queryUnderstanding: QueryUnderstanding,
  ): 'simple' | 'moderate' | 'complex' {
    // If clarification is needed, consider it complex until clarified
    if (queryUnderstanding.needsClarification) {
      return 'complex';
    }

    // Regional is not a separate location - it's a refinement of the primary location
    // Only secondary locations count as multiple locations
    const hasMultipleLocations = 
      (queryUnderstanding.locationHierarchy.secondary?.length ?? 0) > 0;
    
    const hasMultipleIndustries = (queryUnderstanding.industry?.length ?? 0) > 1;
    
    const hasManyRoleVariations = queryUnderstanding.roleVariations.length > 5;
    
    const hasAmbiguousRequirements = 
      queryUnderstanding.explicitRequirements.length === 0 &&
      !queryUnderstanding.locationHierarchy.primary &&
      (queryUnderstanding.industry?.length ?? 0) === 0;
    
    const hasMultipleCompanyPreferences = 
      (queryUnderstanding.companyPreferences?.current?.length ?? 0) > 3 ||
      (queryUnderstanding.companyPreferences?.past?.length ?? 0) > 3;

    // Check for highly specific queries: single location, specific domain, explicit requirements
    // Company is preferred but not required - if location, domain, and role are very specific,
    // it should use a single focused strategy even if they have many role variations
    const hasSpecificLocation = queryUnderstanding.locationHierarchy.primary && !hasMultipleLocations;
    const hasSpecificDomain = queryUnderstanding.domainContext && queryUnderstanding.domainContext.length > 0;
    const hasExplicitRequirements = queryUnderstanding.explicitRequirements.length > 0;
    const hasSingleCompany = (queryUnderstanding.companyPreferences?.current?.length ?? 0) === 1;
    
    // Highly specific: location + domain + explicit requirements (company is bonus but not required)
    const isHighlySpecific = 
      hasSpecificLocation &&
      hasSpecificDomain &&
      hasExplicitRequirements &&
      !hasMultipleIndustries &&
      !hasAmbiguousRequirements;

    // If highly specific, return simple to generate single focused strategy
    if (isHighlySpecific) {
      const specificityDetails = [
        hasSingleCompany ? 'single company' : null,
        'single location',
        'specific domain',
        'explicit requirements'
      ].filter(Boolean).join(', ');
      this.logger.log(`Query is highly specific (${specificityDetails}) - using simple strategy`);
      return 'simple';
    }
    
    const hasBroadScope = 
      hasManyRoleVariations &&
      (hasMultipleLocations || hasMultipleIndustries);

    // Simple: Clear role, single location, specific industry, no ambiguity
    // Also allow if it has many role variations but is otherwise specific
    if (
      !hasMultipleLocations &&
      !hasMultipleIndustries &&
      !hasAmbiguousRequirements &&
      !hasMultipleCompanyPreferences &&
      queryUnderstanding.locationHierarchy.primary &&
      (queryUnderstanding.industry?.length ?? 0) > 0
    ) {
      // Even with many role variations, if other criteria are specific, it's simple
      return 'simple';
    }

    // Complex: Many variations, ambiguous requirements, broad scope
    if (
      hasBroadScope ||
      hasAmbiguousRequirements ||
      (hasMultipleLocations && hasMultipleIndustries) ||
      (queryUnderstanding.roleVariations.length > 8 && hasMultipleCompanyPreferences)
    ) {
      return 'complex';
    }

    // Moderate: Some complexity but manageable
    return 'moderate';
  }

  /**
   * Generic function to stream people search strategies parameters
   */
  /**
   * Main entry point for generating people search parameters with strategies
   * Handles both multi-strategy (with user message) and standard (without user message) approaches
   * Uses adaptive strategy generation based on query complexity
   */
  private async streamPeopleSearchStrategiesParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding, // Accept queryUnderstanding to avoid re-computation
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
  > {
    // Only call understandQuery if not provided (to avoid duplicate calls)
    if (!queryUnderstanding && userMessage && classificationReasoning) {
      // Step 1: Understand the query
      queryUnderstanding = await this.understandQuery(
        openaiClient,
        userMessage,
        rawJDText || '',
        sendEvent,
      );
    }
    
    if (queryUnderstanding && userMessage && classificationReasoning) {
      // Step 2: Assess query complexity
      const complexity = this.assessQueryComplexity(queryUnderstanding);
      this.logger.log(`Query complexity assessed as: ${complexity}`);

      // Step 3: Generate parameters based on complexity
      if (complexity === 'simple') {
        // Simple query: single optimized search with independent parameter generation
        // This provides better explainability and error handling than single-prompt generation
        const eventResult = sendEvent?.('status', { message: 'Generating optimized search parameters...' });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping optimized search generation');
          // Return empty result matching the function return type
          if (searchType === 'classic') {
            return { primary: {} as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> };
          } else if (searchType === 'sales_navigator') {
            return { primary: {} as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> };
          } else {
            return { primary: {} as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> };
          }
        }
        const optimizedParams = await this.generateFocusedSearchWithIndependentParameters(
          openaiClient,
          parsedJobDescription,
          queryUnderstanding,
          userMessage,
          classificationReasoning,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
        );
        return this.wrapParametersAsResult(optimizedParams, searchType);
      } else if (complexity === 'moderate') {
        // Moderate complexity: primary search + 1 alternative
        const primaryParams = await this.generateFocusedSearchWithIndependentParameters(
          openaiClient,
          parsedJobDescription,
          queryUnderstanding,
          userMessage,
          classificationReasoning,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
        );
        
        const eventResult = sendEvent?.('status', { message: 'Generating primary search with one alternative...' });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping moderate complexity search');
          return this.wrapParametersAsResult(primaryParams, searchType);
        }
        
        // Generate one alternative with slightly different approach
        // For alternative, we can use a slightly broader strategy definition
        const alternativeStrategy = this.buildAlternativeStrategyFromQueryUnderstanding(
          queryUnderstanding,
          searchType,
        );
        const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
        const alternativeResult = await this.streamPeopleParametersForStrategy(
          openaiClient,
          parameterGenerationSystemPrompt,
          alternativeStrategy,
          userMessage,
          classificationReasoning,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
          queryUnderstanding,
        );
        const alternativeParams = alternativeResult?.parameters || await this.generateAlternativeSearch(
          openaiClient,
          parsedJobDescription,
          queryUnderstanding,
          userMessage,
          classificationReasoning,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
        );

        // Return primary with alternative as strategy
        if (searchType === 'classic') {
          return {
            primary: primaryParams as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
            strategies: [{
              id: 'alternative-1',
              label: 'Alternative Approach',
              goal: 'Alternative search strategy with different filter balance',
              aggressiveness: 'balanced' as const,
              description: 'Alternative parameter set with adjusted filters',
              whenToUse: 'Use if primary search yields insufficient results',
              estimatedCandidateCount: { minimum: 40, maximum: 80 },
              filterFocus: 'Alternative filter combination',
              parameterRationales: {},
              parameters: alternativeParams as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
            }] as ClassicPeopleSearchStrategyResult[],
          };
        } else if (searchType === 'sales_navigator') {
          return {
            primary: primaryParams as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
            strategies: [{
              id: 'alternative-1',
              label: 'Alternative Approach',
              goal: 'Alternative search strategy with different filter balance',
              aggressiveness: 'balanced' as const,
              description: 'Alternative parameter set with adjusted filters',
              whenToUse: 'Use if primary search yields insufficient results',
              estimatedCandidateCount: { minimum: 40, maximum: 80 },
              filterFocus: 'Alternative filter combination',
              parameterRationales: {},
              parameters: alternativeParams as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
            }] as SalesNavigatorPeopleSearchStrategyResult[],
          };
        } else {
          return {
            primary: primaryParams as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
            strategies: [{
              id: 'alternative-1',
              label: 'Alternative Approach',
              goal: 'Alternative search strategy with different filter balance',
              aggressiveness: 'balanced' as const,
              description: 'Alternative parameter set with adjusted filters',
              whenToUse: 'Use if primary search yields insufficient results',
              estimatedCandidateCount: { minimum: 40, maximum: 80 },
              filterFocus: 'Alternative filter combination',
              parameterRationales: {},
              parameters: alternativeParams as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
            }] as RecruiterPeopleSearchStrategyResult[],
          };
        }
      } else {
        // Complex query: use full multi-strategy approach
        const multiStrategyResult = await this.tryMultiStrategyApproach(
          openaiClient,
          userMessage,
          classificationReasoning,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
          queryUnderstanding,
        );

        if (multiStrategyResult) {
          return multiStrategyResult;
        }

        // Fallback to single-call with user-prioritized prompt
        this.logger.warn(`Multi-strategy ${searchType} people parameter generation returned no usable result. Falling back to single-call prompt.`);
        const fallbackParameters = await this.generateFallbackParameters(
          openaiClient,
          parsedJobDescription,
          userMessage,
          classificationReasoning,
          rawJDText || '',
          searchType,
          sendEvent,
          includeJd,
        );

        return this.wrapParametersAsResult(fallbackParameters, searchType);
      }
    }

    // No user message - use standard prompt generation
    const standardParameters = await this.generateStandardParameters(
      openaiClient,
      parsedJobDescription,
      rawJDText,
      searchType,
      sendEvent,
      includeJd,
    );

    return this.wrapParametersAsResult(standardParameters, searchType);
  }

  /**
   * Generate a focused search using independent parameter generation
   * This provides better explainability and error handling than single-prompt generation
   */
  private async generateFocusedSearchWithIndependentParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    // Create a focused strategy definition based on query understanding
    const focusedStrategy = this.buildFocusedStrategyFromQueryUnderstanding(
      queryUnderstanding,
      searchType,
    );

    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
    // Use the same independent parameter generation approach as multi-strategy
    const result = await this.streamPeopleParametersForStrategy(
      openaiClient,
      parameterGenerationSystemPrompt,
      focusedStrategy,
      userMessage,
      classificationReasoning,
      rawJDText,
      searchType,
      sendEvent,
      includeJd,
      queryUnderstanding,
    );

    if (!result || !result.parameters) {
      this.logger.warn('Independent parameter generation failed, falling back to single-prompt approach');
      return await this.generateSingleOptimizedSearch(
        openaiClient,
        parsedJobDescription,
        queryUnderstanding,
        userMessage,
        classificationReasoning,
        rawJDText,
        searchType,
        sendEvent,
        includeJd,
      );
    }

    // Post-process to remove redundant filters
    this.removeRedundantFilters(result.parameters, searchType);

    return result.parameters;
  }

  /**
   * Build a focused strategy definition from query understanding
   * This determines which parameters should be generated based on available information
   */
  private buildFocusedStrategyFromQueryUnderstanding(
    queryUnderstanding: QueryUnderstanding,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition {
    // Determine which parameters to generate based on query understanding
    const shouldGenerateKeywords = true; // Always required
    const shouldGenerateLocation = !!queryUnderstanding.locationHierarchy?.primary;
    const shouldGenerateIndustry = (queryUnderstanding.industry?.length ?? 0) > 0;
    const shouldGenerateCompany = (queryUnderstanding.companyPreferences?.current?.length ?? 0) > 0;
    const shouldGeneratePastCompany = (queryUnderstanding.companyPreferences?.past?.length ?? 0) > 0;
    const shouldGenerateSchool = false; // Rarely needed for focused searches
    const shouldGenerateAdvancedKeywords = false; // Usually not needed for focused searches

    // Build parameter selection based on search type
    if (searchType === 'classic') {
      return {
        id: 'focused-primary',
        label: 'Focused Search',
        goal: 'Generate precise search parameters matching the query requirements',
        aggressiveness: 'focused' as const,
        description: 'Optimized search with only necessary parameters',
        whenToUse: 'Use for well-defined queries with clear requirements',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
        filterFocus: 'Precision-focused filters',
        parameterSelection: {
          keywords: {
            shouldGenerate: shouldGenerateKeywords,
            reasoning: 'Keywords are required to anchor the search',
          },
          location: {
            shouldGenerate: shouldGenerateLocation,
            reasoning: shouldGenerateLocation 
              ? `Location specified: ${queryUnderstanding.locationHierarchy.primary}`
              : 'No specific location provided in query',
          },
          industry: {
            shouldGenerate: shouldGenerateIndustry,
            reasoning: shouldGenerateIndustry
              ? `Industry specified: ${queryUnderstanding.industry?.join(', ')}`
              : 'No specific industry provided in query',
          },
          company: {
            shouldGenerate: shouldGenerateCompany,
            reasoning: shouldGenerateCompany
              ? `Company preference specified: ${queryUnderstanding.companyPreferences?.current?.join(', ')}`
              : 'No company preference provided in query',
          },
          past_company: {
            shouldGenerate: shouldGeneratePastCompany,
            reasoning: shouldGeneratePastCompany
              ? `Past company preference specified: ${queryUnderstanding.companyPreferences?.past?.join(', ')}`
              : 'No past company preference provided in query',
          },
          school: {
            shouldGenerate: shouldGenerateSchool,
            reasoning: 'School filter not typically needed for focused searches',
          },
          advanced_keywords: {
            shouldGenerate: shouldGenerateAdvancedKeywords,
            reasoning: 'Advanced keywords not typically needed for focused searches',
          },
        },
      } as ClassicPeopleStrategyDefinition;
    } else if (searchType === 'sales_navigator') {
      return {
        id: 'focused-primary',
        label: 'Focused Search',
        goal: 'Generate precise search parameters matching the query requirements',
        aggressiveness: 'focused' as const,
        description: 'Optimized search with only necessary parameters',
        whenToUse: 'Use for well-defined queries with clear requirements',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
        filterFocus: 'Precision-focused filters',
        parameterSelection: {
          keywords: {
            shouldGenerate: shouldGenerateKeywords,
            reasoning: 'Keywords are required to anchor the search',
          },
          location: {
            shouldGenerate: shouldGenerateLocation,
            reasoning: shouldGenerateLocation 
              ? `Location specified: ${queryUnderstanding.locationHierarchy.primary}`
              : 'No specific location provided in query',
          },
          industry: {
            shouldGenerate: shouldGenerateIndustry,
            reasoning: shouldGenerateIndustry
              ? `Industry specified: ${queryUnderstanding.industry?.join(', ')}`
              : 'No specific industry provided in query',
          },
          company: {
            shouldGenerate: shouldGenerateCompany,
            reasoning: shouldGenerateCompany
              ? `Company preference specified: ${queryUnderstanding.companyPreferences?.current?.join(', ')}`
              : 'No company preference provided in query',
          },
          past_company: {
            shouldGenerate: shouldGeneratePastCompany,
            reasoning: shouldGeneratePastCompany
              ? `Past company preference specified: ${queryUnderstanding.companyPreferences?.past?.join(', ')}`
              : 'No past company preference provided in query',
          },
          role: {
            shouldGenerate: !!queryUnderstanding.primaryRole,
            reasoning: queryUnderstanding.primaryRole
              ? `Role specified: ${queryUnderstanding.primaryRole}`
              : 'No specific role provided in query',
          },
          function: {
            shouldGenerate: false,
            reasoning: 'Function filter not typically needed for focused searches',
          },
          seniority: {
            shouldGenerate: !!queryUnderstanding.seniorityLevel,
            reasoning: queryUnderstanding.seniorityLevel
              ? `Seniority specified: ${queryUnderstanding.seniorityLevel}`
              : 'No seniority level provided in query',
          },
          school: {
            shouldGenerate: shouldGenerateSchool,
            reasoning: 'School filter not typically needed for focused searches',
          },
        },
      } as SalesNavigatorPeopleStrategyDefinition;
    } else {
      // recruiter
      return {
        id: 'focused-primary',
        label: 'Focused Search',
        goal: 'Generate precise search parameters matching the query requirements',
        aggressiveness: 'focused' as const,
        description: 'Optimized search with only necessary parameters',
        whenToUse: 'Use for well-defined queries with clear requirements',
        estimatedCandidateCount: { minimum: 40, maximum: 80 },
        filterFocus: 'Precision-focused filters',
        parameterSelection: {
          keywords: {
            shouldGenerate: shouldGenerateKeywords,
            reasoning: 'Keywords are required to anchor the search',
          },
          location: {
            shouldGenerate: shouldGenerateLocation,
            reasoning: shouldGenerateLocation 
              ? `Location specified: ${queryUnderstanding.locationHierarchy.primary}`
              : 'No specific location provided in query',
          },
          industry: {
            shouldGenerate: shouldGenerateIndustry,
            reasoning: shouldGenerateIndustry
              ? `Industry specified: ${queryUnderstanding.industry?.join(', ')}`
              : 'No specific industry provided in query',
          },
          role: {
            shouldGenerate: !!queryUnderstanding.primaryRole,
            reasoning: queryUnderstanding.primaryRole
              ? `Role specified: ${queryUnderstanding.primaryRole}`
              : 'No specific role provided in query',
          },
          company: {
            shouldGenerate: shouldGenerateCompany,
            reasoning: shouldGenerateCompany
              ? `Company preference specified: ${queryUnderstanding.companyPreferences?.current?.join(', ')}`
              : 'No company preference provided in query',
          },
          past_company: {
            shouldGenerate: shouldGeneratePastCompany,
            reasoning: shouldGeneratePastCompany
              ? `Past company preference specified: ${queryUnderstanding.companyPreferences?.past?.join(', ')}`
              : 'No past company preference provided in query',
          },
          school: {
            shouldGenerate: shouldGenerateSchool,
            reasoning: 'School filter not typically needed for focused searches',
          },
          skills: {
            shouldGenerate: (queryUnderstanding.skills?.length ?? 0) > 0,
            reasoning: (queryUnderstanding.skills?.length ?? 0) > 0
              ? `Skills specified: ${queryUnderstanding.skills?.join(', ')}`
              : 'No specific skills provided in query',
          },
          seniority: {
            shouldGenerate: !!queryUnderstanding.seniorityLevel,
            reasoning: queryUnderstanding.seniorityLevel
              ? `Seniority specified: ${queryUnderstanding.seniorityLevel}`
              : 'No seniority level provided in query',
          },
        },
      } as RecruiterPeopleStrategyDefinition;
    }
  }

  /**
   * Build an alternative strategy definition with slightly broader parameters
   * Used for moderate complexity queries to provide a complementary search
   */
  private buildAlternativeStrategyFromQueryUnderstanding(
    queryUnderstanding: QueryUnderstanding,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition {
    // Alternative strategy is slightly broader - include more optional parameters
    const focusedStrategy = this.buildFocusedStrategyFromQueryUnderstanding(queryUnderstanding, searchType);
    
    // Make it "balanced" instead of "focused" and adjust parameter selection to be slightly broader
    if (searchType === 'classic') {
      const strategy = focusedStrategy as ClassicPeopleStrategyDefinition;
      return {
        ...strategy,
        id: 'alternative-1',
        label: 'Alternative Approach',
        aggressiveness: 'balanced' as const,
        goal: 'Alternative search strategy with different filter balance',
        description: 'Alternative parameter set with adjusted filters',
        whenToUse: 'Use if primary search yields insufficient results',
        parameterSelection: {
          ...strategy.parameterSelection,
          // Include location even if not explicitly specified (broader)
          location: {
            shouldGenerate: true, // Always include for broader alternative
            reasoning: strategy.parameterSelection.location.shouldGenerate 
              ? 'Location included for alternative search approach'
              : 'Including location for broader alternative search',
          },
          // Include industry even if not explicitly specified (broader)
          industry: {
            shouldGenerate: true, // Always include for broader alternative
            reasoning: strategy.parameterSelection.industry.shouldGenerate
              ? 'Industry included for alternative search approach'
              : 'Including industry for broader alternative search',
          },
        },
      };
    } else if (searchType === 'sales_navigator') {
      const strategy = focusedStrategy as SalesNavigatorPeopleStrategyDefinition;
      return {
        ...strategy,
        id: 'alternative-1',
        label: 'Alternative Approach',
        aggressiveness: 'balanced' as const,
        goal: 'Alternative search strategy with different filter balance',
        description: 'Alternative parameter set with adjusted filters',
        whenToUse: 'Use if primary search yields insufficient results',
        parameterSelection: {
          ...strategy.parameterSelection,
          location: {
            shouldGenerate: strategy.parameterSelection.location.shouldGenerate || true,
            reasoning: 'Including location for broader alternative search',
          },
          industry: {
            shouldGenerate: strategy.parameterSelection.industry.shouldGenerate || true,
            reasoning: 'Including industry for broader alternative search',
          },
        },
      };
    } else {
      const strategy = focusedStrategy as RecruiterPeopleStrategyDefinition;
      return {
        ...strategy,
        id: 'alternative-1',
        label: 'Alternative Approach',
        aggressiveness: 'balanced' as const,
        goal: 'Alternative search strategy with different filter balance',
        description: 'Alternative parameter set with adjusted filters',
        whenToUse: 'Use if primary search yields insufficient results',
        parameterSelection: {
          ...strategy.parameterSelection,
          location: {
            shouldGenerate: strategy.parameterSelection.location.shouldGenerate || true,
            reasoning: 'Including location for broader alternative search',
          },
          industry: {
            shouldGenerate: strategy.parameterSelection.industry.shouldGenerate || true,
            reasoning: 'Including industry for broader alternative search',
          },
        },
      };
    }
  }

  /**
   * Generate a single optimized search without strategy overhead (fallback method)
   * @deprecated Use generateFocusedSearchWithIndependentParameters instead for better explainability
   */
  private async generateSingleOptimizedSearch(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const userPrioritizedPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
      userMessage,
      classificationReasoning,
      includeJd ? rawJDText : '',
      'people',
      searchType
    );
    
    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      parameterGenerationSystemPrompt,
      userPrioritizedPrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    );
  }

  /**
   * Generate an alternative search with slightly different approach
   */
  private async generateAlternativeSearch(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    // Create alternative prompt that adjusts filter balance
    const alternativePrompt = `${this.searchParametersPrompts.buildUserPrioritizedPrompt(
      userMessage,
      classificationReasoning,
      includeJd ? rawJDText : '',
      'people',
      searchType
    )}

ALTERNATIVE APPROACH:
Generate an alternative parameter set with a different filter balance. If the primary search is focused, make this one broader. If the primary is broad, make this one more focused. Adjust filters to provide a complementary search strategy.`;

    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      parameterGenerationSystemPrompt,
      alternativePrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    );
  }

  /**
   * Attempts to generate parameters using multi-strategy approach
   */
  private async tryMultiStrategyApproach(
    openaiClient: OpenAI,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
    | null
  > {
    const strategyPlanningSystemPrompt = this.searchParametersPrompts.getPeopleSearchStrategySystemPrompt(searchType);
    const strategyPlanningUserPrompt = this.searchParametersPrompts.decidingWhichParametersToCreateForPeopleSearch(
      userMessage,
      classificationReasoning,
      includeJd ? rawJDText : '',
      'people',
      searchType,
      queryUnderstanding,
    );

    this.logger.log(`Strategy planning user prompt: ${strategyPlanningUserPrompt}`);

      const multiStrategyResult = await this.streamPeopleSearchParametersWithStrategies(
        openaiClient,
        strategyPlanningSystemPrompt,
        strategyPlanningUserPrompt,
        userMessage,
        classificationReasoning,
        rawJDText,
        searchType,
        sendEvent,
        includeJd,
        queryUnderstanding,
      );

    if (multiStrategyResult) {
      this.logger.log(`Multi-strategy ${searchType} people parameter generation returned usable result: ${JSON.stringify(multiStrategyResult, null, 2)}`);
      return multiStrategyResult;
    }

    this.logger.warn(`Multi-strategy ${searchType} people parameter generation returned no usable result.`);
    return null;
  }

  /**
   * Generates parameters using fallback single-call approach with user-prioritized prompt
   */
  private async generateFallbackParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const userPrioritizedPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
      userMessage,
      classificationReasoning,
      includeJd ? rawJDText : '',
      'people',
      searchType
    );
    
    const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      parameterGenerationSystemPrompt,
      userPrioritizedPrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    );
  }

  /**
   * Generates parameters using standard prompt (no user message)
   */
  private async generateStandardParameters(
    openaiClient: OpenAI,
    parsedJobDescription: ParsedJobDescription,
    rawJDText: string | undefined,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const prompt = this.searchParametersPrompts.getPeopleSearchPrompt(
      searchType,
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
      false, // Generate user prompt
    );
    
    this.logger.log(`Prompt after template replacement for ${searchType} people search: ${prompt.user.substring(0, 500)}...`);
    
    return await this.generateSingleCallParameters(
      openaiClient,
      prompt.system,
      prompt.user,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    );
  }

  /**
   * Generates parameters using a single prompt call
   */
  private async generateSingleCallParameters(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    return await this.streamPeopleSearchParametersWithSinglePrompt(
      openaiClient,
      systemPrompt,
      userPrompt,
      parsedJobDescription,
      searchType,
      sendEvent,
      includeJd,
    ) as any;
  }

  /**
   * Wraps generated parameters in the appropriate result type
   */
  private wrapParametersAsResult(
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): 
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
  {
    if (searchType === 'classic') {
      return { primary: parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> };
    } else if (searchType === 'sales_navigator') {
      return { primary: parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> };
    } else {
      return { primary: parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'> };
    }
  }

  /**
   * Generic function to stream people search parameters with a single prompt
   */
  private async streamPeopleSearchParametersWithSinglePrompt(
    openaiClient: OpenAI,
    systemPrompt: string,
    userPrompt: string,
    parsedJobDescription: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];
    
    if (searchType === 'classic') {
    console.log(`Messages for classic people search: ${JSON.stringify(messages, null, 2)} ${userPrompt} }`);
    }
    
    sendEvent?.('status', { message: 'Analyzing job requirements and generating search parameters...' });
    
    let schema: any;
    let schemaName: string;
    
    switch (searchType) {
      case 'classic':
        schema = classicPeopleSearchSchema;
        schemaName = 'classicPeopleSearch';
        break;
      case 'sales_navigator':
        schema = salesNavigatorPeopleSearchSchema;
        schemaName = 'salesNavigatorPeopleSearch';
        break;
      case 'recruiter':
        schema = recruiterPeopleSearchSchema;
        schemaName = 'recruiterPeopleSearch';
        break;
    }
    
    const stream = await this.createStreamingCompletion(
      openaiClient,
      messages,
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} People Search Parameters: ${JSON.stringify(result, null, 2)}`);

    // Post-process to remove redundant filters
    if (result && typeof result === 'object' && Object.keys(result).length > 0) {
      this.removeRedundantFilters(result as any, searchType);
    }

    // Fallback: if the model returned an empty object, synthesize minimal parameters from the JD (only for classic)
    if (searchType === 'classic' && (!result || (typeof result === 'object' && Object.keys(result).length === 0))) {
      sendEvent?.('status', { message: 'Using fallback parameters...' });
      const synthesized = {
        keywords:
          (Array.isArray(parsedJobDescription.keywords) && parsedJobDescription.keywords.length > 0
            ? parsedJobDescription.keywords.join(' ')
            : parsedJobDescription.jobTitle) || null,
        industry: parsedJobDescription.industry ? [parsedJobDescription.industry] : null,
        location: parsedJobDescription.location ? [parsedJobDescription.location] : null,
        profile_language: null,
        network_distance: null,
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

  /**
   * Generic function to stream people search parameters with strategies
   */
  private async streamPeopleSearchParametersWithStrategies(
    openaiClient: OpenAI,
    strategyPlanningSystemPrompt: string,
    strategyPlanningUserPrompt: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<
    | ClassicPeopleSearchGenerationResult
    | SalesNavigatorPeopleSearchGenerationResult
    | RecruiterPeopleSearchGenerationResult
    | null
  > {
    try {
      sendEvent?.('status', { message: 'Planning search strategy...' });
      
      let strategyPlanSchema: any;
      let schemaName: string;
      
      switch (searchType) {
        case 'classic':
          strategyPlanSchema = classicPeopleStrategyPlanSchema;
          schemaName = 'classicPeopleStrategyPlan';
          break;
        case 'sales_navigator':
          strategyPlanSchema = salesNavigatorPeopleStrategyPlanSchema;
          schemaName = 'salesNavigatorPeopleStrategyPlan';
          break;
        case 'recruiter':
          strategyPlanSchema = recruiterPeopleStrategyPlanSchema;
          schemaName = 'recruiterPeopleStrategyPlan';
          break;
      }
      
      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: strategyPlanningSystemPrompt },
          { role: 'user' as const, content: strategyPlanningUserPrompt },
        ],
        zodResponseFormat(strategyPlanSchema, schemaName),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Strategy planning call returned empty content.');
        return null;
      }

      let strategyPlan: ClassicPeopleStrategyPlan | SalesNavigatorPeopleStrategyPlan | RecruiterPeopleStrategyPlan | null = null;
      try {
        const parsed = JSON.parse(fullContent);
        switch (searchType) {
          case 'classic':
            strategyPlan = parsed as ClassicPeopleStrategyPlan;
            break;
          case 'sales_navigator':
            strategyPlan = parsed as SalesNavigatorPeopleStrategyPlan;
            break;
          case 'recruiter':
            strategyPlan = parsed as RecruiterPeopleStrategyPlan;
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to parse ${searchType} people strategy plan: ${error}`);
      }

      if (!strategyPlan || !strategyPlan.strategies || strategyPlan.strategies.length === 0) {
        this.logger.warn('Strategy plan did not include any strategies.');
        return null;
      }

      let strategyResults: ClassicPeopleSearchStrategyResult[] | SalesNavigatorPeopleSearchStrategyResult[] | RecruiterPeopleSearchStrategyResult[];

      switch (searchType) {
        case 'classic':
          strategyResults = [] as ClassicPeopleSearchStrategyResult[];
          break;
        case 'sales_navigator':
          strategyResults = [] as SalesNavigatorPeopleSearchStrategyResult[];
          break;
        case 'recruiter':
          strategyResults = [] as RecruiterPeopleSearchStrategyResult[];
          break;
      }

      // Use parameter generation system prompt (not strategy system prompt) for individual parameter generation
      const parameterGenerationSystemPrompt = this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType);

      for (const strategy of strategyPlan.strategies) {
        const eventResult = sendEvent?.('status', { message: `Generating parameters for strategy: ${strategy.label}...` });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping strategy parameter generation');
          break;
        }
        
        if (!queryUnderstanding) {
          this.logger.warn('Query understanding not available, skipping validation steps.');
        }
        
        let strategyOutcome = await this.streamPeopleParametersForStrategy(
          openaiClient,
          parameterGenerationSystemPrompt,
          strategy,
          userMessage,
          classificationReasoning,
          rawJDText,
          searchType,
          sendEvent,
          includeJd,
          queryUnderstanding,
        );

        if (!strategyOutcome || !strategyOutcome.parameters) {
          this.logger.warn(`Skipping strategy "${strategy.label}" because no parameters were generated.`);
          continue;
        }

        // Validate and optimize parameters if query understanding is available
        if (queryUnderstanding) {
          const validationResult = await this.validateParameterCoherence(
            openaiClient,
            strategyOutcome.parameters,
            queryUnderstanding,
            strategy,
            searchType,
            sendEvent,
          );

          if (!validationResult.isCoherent || validationResult.estimatedResultCount === 'low') {
            const eventResult = sendEvent?.('status', { message: `Optimizing parameters for strategy: ${strategy.label}...` });
            if (eventResult === false) {
              this.logger.log('Stream aborted, skipping parameter optimization');
              break;
            }
            const optimizedParameters = await this.optimizeParameters(
              openaiClient,
              strategyOutcome.parameters,
              queryUnderstanding,
              strategy,
              validationResult,
              searchType,
              sendEvent,
            );
            strategyOutcome.parameters = optimizedParameters;
          }
        }

        const strategyResult = {
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
        };

        if (searchType === 'classic') {
          (strategyResults as ClassicPeopleSearchStrategyResult[]).push(strategyResult as ClassicPeopleSearchStrategyResult);
        } else if (searchType === 'sales_navigator') {
          (strategyResults as SalesNavigatorPeopleSearchStrategyResult[]).push(strategyResult as SalesNavigatorPeopleSearchStrategyResult);
        } else {
          (strategyResults as RecruiterPeopleSearchStrategyResult[]).push(strategyResult as RecruiterPeopleSearchStrategyResult);
        }
      }

      if (strategyResults.length === 0) {
        this.logger.warn('All strategy parameter generations failed.');
        return null;
      }

      const primaryStrategy =
        strategyResults.find((strategy) => strategy.aggressiveness === 'balanced') ||
        strategyResults[0];

      if (searchType === 'classic') {
      return {
          primary: primaryStrategy.parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as ClassicPeopleSearchStrategyResult[],
        };
      } else if (searchType === 'sales_navigator') {
        return {
          primary: primaryStrategy.parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as SalesNavigatorPeopleSearchStrategyResult[],
        };
      } else {
        return {
          primary: primaryStrategy.parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
          strategies: strategyResults as RecruiterPeopleSearchStrategyResult[],
        };
      }
    } catch (error) {
      this.logger.error(`Multi-strategy ${searchType} people parameter generation failed: ${error}`);
      return null;
    }
  }

  /**
   * Validate parameter coherence
   */
  private async validateParameterCoherence(
    openaiClient: OpenAI,
    generatedParameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    queryUnderstanding: QueryUnderstanding,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<{
    isCoherent: boolean;
    issues: string[];
    suggestedRefinements: string[];
    estimatedResultCount: 'low' | 'medium' | 'high';
    reasoning?: string | null;
  }> {
    sendEvent?.('status', { message: 'Validating parameter coherence...' });
    
    const validationPrompt = this.searchParametersPrompts.buildParameterValidationPrompt(
      generatedParameters,
      queryUnderstanding,
      {
        label: strategy.label,
        goal: strategy.goal,
        aggressiveness: strategy.aggressiveness,
        estimatedCandidateCount: strategy.estimatedCandidateCount,
      },
      searchType,
    );

    const validationSchema = z.object({
      isCoherent: z.boolean(),
      issues: z.array(z.string()),
      suggestedRefinements: z.array(z.string()),
      estimatedResultCount: z.enum(['low', 'medium', 'high']),
      reasoning: z.string().nullable().optional(),
    });

    try {
      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: 'You are an expert at validating LinkedIn search parameters. Analyze parameters for coherence, effectiveness, and potential issues.' 
          },
          { role: 'user' as const, content: validationPrompt },
        ],
        zodResponseFormat(validationSchema, 'parameterValidation'),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Parameter validation returned empty content.');
        return {
          isCoherent: true, // Default to true if validation fails
          issues: [],
          suggestedRefinements: [],
          estimatedResultCount: 'medium',
        };
      }

      const parsed = JSON.parse(fullContent);
      const validated = validationSchema.parse(parsed);
      this.logger.log(`Parameter validation: ${JSON.stringify(validated, null, 2)}`);
      return validated;
    } catch (error) {
      this.logger.error(`Failed to validate parameters: ${error}`);
      return {
        isCoherent: true, // Default to true on error
        issues: [],
        suggestedRefinements: [],
        estimatedResultCount: 'medium',
      };
    }
  }

  /**
   * Optimize parameters based on validation results
   */
  private async optimizeParameters(
    openaiClient: OpenAI,
    generatedParameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    queryUnderstanding: QueryUnderstanding,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    validationResult: {
      issues: string[];
      suggestedRefinements: string[];
      estimatedResultCount: 'low' | 'medium' | 'high';
    },
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<
    | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
    | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
  > {
    if (validationResult.issues.length === 0 && validationResult.estimatedResultCount !== 'low') {
      // No optimization needed
      return generatedParameters;
    }

    sendEvent?.('status', { message: 'Optimizing parameters...' });
    
    const targetCount = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const optimizationPrompt = `Optimize these LinkedIn search parameters to better match the target candidate count of ${targetCount.minimum}-${targetCount.maximum}:

CURRENT PARAMETERS:
${JSON.stringify(generatedParameters, null, 2)}

QUERY UNDERSTANDING:
Primary Role: ${queryUnderstanding.primaryRole}
Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
Location: ${queryUnderstanding.locationHierarchy.primary}
Domain: ${queryUnderstanding.domainContext || 'Not specified'}

VALIDATION ISSUES:
${validationResult.issues.join('\n')}

SUGGESTED REFINEMENTS:
${validationResult.suggestedRefinements.join('\n')}

ESTIMATED RESULT COUNT: ${validationResult.estimatedResultCount}

STRATEGY: ${strategy.label} (${strategy.aggressiveness})

OPTIMIZATION GOALS:
1. Adjust filters to target ${targetCount.minimum}-${targetCount.maximum} candidates
2. Address validation issues
3. Implement suggested refinements
4. Maintain coherence with query understanding
5. Preserve strategy aggressiveness level

Return optimized parameters in the same format as the current parameters.`;

    let schema: any;
    let schemaName: string;
    
    switch (searchType) {
      case 'classic':
        schema = classicPeopleSearchSchema;
        schemaName = 'classicPeopleSearch';
        break;
      case 'sales_navigator':
        schema = salesNavigatorPeopleSearchSchema;
        schemaName = 'salesNavigatorPeopleSearch';
        break;
      case 'recruiter':
        schema = recruiterPeopleSearchSchema;
        schemaName = 'recruiterPeopleSearch';
        break;
    }

    try {
      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: this.searchParametersPrompts.getPeopleSearchSystemPrompt(searchType)
          },
          { role: 'user' as const, content: optimizationPrompt },
        ],
        zodResponseFormat(schema, schemaName),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Parameter optimization returned empty content, using original parameters.');
        return generatedParameters;
      }

      const parsed = JSON.parse(fullContent);
      this.logger.log(`Optimized parameters: ${JSON.stringify(parsed, null, 2)}`);
      return parsed;
    } catch (error) {
      this.logger.error(`Failed to optimize parameters: ${error}`);
      return generatedParameters; // Return original on error
    }
  }

  /**
   * Generate refined keywords using domain-aware approach
   */
  private async generateRefinedKeywords(
    openaiClient: OpenAI,
    queryUnderstanding: QueryUnderstanding,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<string> {
    sendEvent?.('status', { message: 'Generating refined keywords...' });
    
    const keywordPrompt = this.searchParametersPrompts.buildEnhancedKeywordPrompt(
      queryUnderstanding,
      {
        label: strategy.label,
        aggressiveness: strategy.aggressiveness,
        goal: strategy.goal,
      },
      searchType,
    );

    const keywordSchema = searchType === 'classic'
      ? z.object({ keywords: classicPeopleSearchSchema.shape.keywords })
      : searchType === 'sales_navigator'
        ? z.object({ keywords: salesNavigatorPeopleSearchSchema.shape.keywords })
        : z.object({ keywords: recruiterPeopleSearchSchema.shape.keywords });

    try {
      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: 'You are an expert at generating precise LinkedIn search keywords that avoid false positives and match domain-specific terminology.' 
          },
          { role: 'user' as const, content: keywordPrompt },
        ],
        zodResponseFormat(keywordSchema, 'refinedKeywords'),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Keyword generation returned empty content.');
        return queryUnderstanding.primaryRole; // Fallback
      }

      const parsed = JSON.parse(fullContent);
      return parsed.keywords || queryUnderstanding.primaryRole;
    } catch (error) {
      this.logger.error(`Failed to generate refined keywords: ${error}`);
      return queryUnderstanding.primaryRole; // Fallback
    }
  }

  /**
   * Post-process parameters to remove redundant filters
   * Removes industry filter when company filter is present (company is more precise)
   */
  private removeRedundantFilters(
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): void {
    // Remove industry filter if company filter is present (company is more precise)
    if (searchType === 'classic') {
      const classicParams = parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = classicParams.company && Array.isArray(classicParams.company) && classicParams.company.length > 0;
      const hasPastCompany = classicParams.past_company && Array.isArray(classicParams.past_company) && classicParams.past_company.length > 0;
      
      if ((hasCompany || hasPastCompany) && classicParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present (company: ${hasCompany ? classicParams.company?.join(', ') : 'none'}, past_company: ${hasPastCompany ? classicParams.past_company?.join(', ') : 'none'})`);
        classicParams.industry = undefined;
      }
    } else if (searchType === 'sales_navigator') {
      const salesNavParams = parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = salesNavParams.company && 
        ((salesNavParams.company.include && salesNavParams.company.include.length > 0) || 
         (salesNavParams.company.exclude && salesNavParams.company.exclude.length > 0));
      const hasPastCompany = salesNavParams.past_company && 
        ((salesNavParams.past_company.include && salesNavParams.past_company.include.length > 0) || 
         (salesNavParams.past_company.exclude && salesNavParams.past_company.exclude.length > 0));
      
      if ((hasCompany || hasPastCompany) && salesNavParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present`);
        salesNavParams.industry = undefined;
      }
    } else {
      // recruiter
      const recruiterParams = parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
      const hasCompany = recruiterParams.company && Array.isArray(recruiterParams.company) && recruiterParams.company.length > 0;
      const hasPastCompany = recruiterParams.past_company && Array.isArray(recruiterParams.past_company) && recruiterParams.past_company.length > 0;
      
      if ((hasCompany || hasPastCompany) && recruiterParams.industry) {
        this.logger.log(`Removing redundant industry filter because company filter is present`);
        recruiterParams.industry = undefined;
      }
    }
  }

  /**
   * Generic function to stream people parameters for a specific strategy
   */
  private async streamPeopleParametersForStrategy(
    openaiClient: OpenAI,
    systemPrompt: string,
    strategy: ClassicPeopleStrategyDefinition | SalesNavigatorPeopleStrategyDefinition | RecruiterPeopleStrategyDefinition,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
    queryUnderstanding?: QueryUnderstanding,
  ): Promise<{
    parameters: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>
      | null;
    parameterRationales: Record<string, string>;
  } | null> {
    let aggregatedResult: 
      | Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>
      | Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>;
    let parameterDecisions: ClassicPeopleParameterSelection | SalesNavigatorPeopleParameterSelection | RecruiterPeopleParameterSelection;
    let parameterRationales: Record<ClassicPeopleParameterName, string> | Record<SalesNavigatorPeopleParameterName, string> | Record<RecruiterPeopleParameterName, string>;
    let parameterSchemaMap: Record<string, any>;
    let assignParameterValue: (target: any, param: string, value: unknown) => void;

    switch (searchType) {
      case 'classic': {
        aggregatedResult = createClassicPeopleBaseResult();
        parameterDecisions = (strategy as ClassicPeopleStrategyDefinition).parameterSelection ?? buildDefaultParameterSelection();
        parameterSchemaMap = classicPeopleParameterSchemaMap;
        assignParameterValue = assignClassicPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as ClassicPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<ClassicPeopleParameterName, string>,
        );
        break;
      }
      case 'sales_navigator': {
        aggregatedResult = createSalesNavigatorPeopleBaseResult();
        parameterDecisions = (strategy as SalesNavigatorPeopleStrategyDefinition).parameterSelection ?? buildDefaultSalesNavigatorPeopleParameterSelection();
        parameterSchemaMap = salesNavigatorPeopleParameterSchemaMap;
        assignParameterValue = assignSalesNavigatorPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as SalesNavigatorPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<SalesNavigatorPeopleParameterName, string>,
        );
        break;
      }
      case 'recruiter': {
        aggregatedResult = createRecruiterPeopleBaseResult();
        parameterDecisions = (strategy as RecruiterPeopleStrategyDefinition).parameterSelection ?? buildDefaultRecruiterPeopleParameterSelection();
        parameterSchemaMap = recruiterPeopleParameterSchemaMap;
        assignParameterValue = assignRecruiterPeopleParameterValue;
        parameterRationales = Object.keys(parameterDecisions).reduce(
          (acc, key) => ({
            ...acc,
            [key]: parameterDecisions[key as RecruiterPeopleParameterName]?.reasoning || '',
          }),
          {} as Record<RecruiterPeopleParameterName, string>,
        );
        break;
      }
    }

    const candidateRange = strategy.estimatedCandidateCount || { minimum: 40, maximum: 80 };
    const parametersToGenerate = Object.entries(parameterDecisions).filter(
      ([, decision]) => (decision as ClassicPeopleParameterDecision | SalesNavigatorPeopleParameterDecision | RecruiterPeopleParameterDecision).shouldGenerate
    ) as Array<[string, ClassicPeopleParameterDecision | SalesNavigatorPeopleParameterDecision | RecruiterPeopleParameterDecision]>;

    if (parametersToGenerate.length === 0) {
      this.logger.warn(`Strategy "${strategy.label}" requested no parameters.`);
      return null;
    }

    let generatedAny = false;

    for (const [parameterName, decision] of parametersToGenerate) {
      const eventResult = sendEvent?.('status', { message: `Generating ${parameterName} parameter...: ` });
      if (eventResult === false) {
        this.logger.log('Stream aborted, stopping parameter generation');
        break;
      }
      
      const generationPrompt = this.searchParametersPrompts.buildPeopleParameterGenerationPrompt(
        parameterName as ClassicPeopleParameterName | SalesNavigatorPeopleParameterName | RecruiterPeopleParameterName,
        searchType,
        {
          userMessage,
          classificationReasoning,
          rawJDText: includeJd ? rawJDText : '',
          selectionReasoning: decision.reasoning,
          strategyLabel: strategy.label,
          strategyGoal: strategy.goal,
          strategyAggressiveness: strategy.aggressiveness,
          estimatedCandidateRange: candidateRange,
        },
      );

      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: generationPrompt },
        ],
        zodResponseFormat(
          parameterSchemaMap[parameterName],
          `${searchType === 'classic' ? 'classic' : searchType === 'sales_navigator' ? 'salesNavigator' : 'recruiter'}People${parameterName}Parameter`,
        ),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn(`Parameter generation for ${parameterName} returned empty content.`);
        continue;
      }

      try {
        const parsedParameter = JSON.parse(fullContent) as Record<string, unknown>;
        assignParameterValue(
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

    // Post-process to remove redundant filters
    this.removeRedundantFilters(aggregatedResult, searchType);

    return {
      parameters: aggregatedResult,
      parameterRationales,
    };
  }

  /**
   * Generic function to stream companies search parameters
   */
  private async streamCompaniesSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    searchType: 'classic' | 'sales_navigator',
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<
    | Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>
    | Omit<LinkedInSalesNavigatorCompaniesSearchRequest, 'api' | 'category'>
  > {
    let prompt: { system: string; user: string };
    let schema: any;
    let schemaName: string;
    
    prompt = this.searchParametersPrompts.getCompaniesSearchPrompt(
      searchType,
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
    ) as { system: string; user: string };
    switch (searchType) {
      case 'classic':
        schema = classicCompaniesSearchSchema;
        schemaName = 'classicCompaniesSearch';
        break;
      case 'sales_navigator':
        schema = salesNavigatorCompaniesSearchSchema;
        schemaName = 'salesNavigatorCompaniesSearch';
        break;
    }
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
        enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        includeJd ? (rawJDText || '') : '',
        'companies',
        searchType
      );
    } else {
      // Template variables are already replaced in getCompaniesSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating company search parameters...' });

    const stream = await this.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(schema, schemaName),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    const result = fullContent ? JSON.parse(fullContent) : {};
    this.logger.log(`AI Generated ${searchType} Companies Search Parameters: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Stream generation of LinkedIn Classic Jobs Search parameters
   */
  private async streamJobsSearchParameters(
    parsedJobDescription: ParsedJobDescription,
    openaiClient: OpenAI,
    userMessage?: string,
    classificationReasoning?: string,
    rawJDText?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    includeJd: boolean = true,
  ): Promise<Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>> {
    const prompt = this.searchParametersPrompts.getJobsSearchPrompt(
      includeJd ? parsedJobDescription : undefined,
      includeJd ? rawJDText : undefined,
    );
    
    let enhancedUserPrompt: string;
    
    if (userMessage && classificationReasoning) {
      enhancedUserPrompt = this.searchParametersPrompts.buildUserPrioritizedPrompt(
        userMessage,
        classificationReasoning,
        includeJd ? (rawJDText || '') : '',
        'jobs',
        'classic'
      );
    } else {
      // Template variables are already replaced in getJobsSearchPrompt
      enhancedUserPrompt = prompt.user;
    }

    sendEvent?.('status', { message: 'Generating job search parameters...' });

    const stream = await this.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: enhancedUserPrompt },
      ],
      zodResponseFormat(
        classicJobsSearchSchema,
        'classicJobsSearch',
      ),
    );

    const fullContent = await this.processStreamChunks(stream, sendEvent);

    return fullContent ? JSON.parse(fullContent) : {};
  }

  /**
   * Score individual candidate relevance against query understanding
   */
  async scoreCandidateRelevance(
    candidate: any,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    parsedJobDescription?: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => boolean | void,
    candidateIndex?: number,
    totalCandidates?: number,
  ): Promise<{
    relevanceScore: number;
    relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
    matchReasons: string[];
    mismatchReasons?: string[];
    roleMatch: boolean;
    companyMatch: boolean;
    locationMatch: boolean;
    educationMatch?: boolean | null;
    reasoning: string;
  }> {
    const candidateName = candidate.name || candidate.first_name || 'Unknown';
    const candidateTitle = candidate.headline || candidate.current_positions?.[0]?.role || 'N/A';
    const candidateCompany = candidate.current_positions?.[0]?.company || 'N/A';
    
    try {
      // Send progress event for candidate being scored
      if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
        sendEvent('candidateScoring', {
          candidateIndex: candidateIndex + 1,
          totalCandidates,
          candidateName,
          candidateTitle,
          candidateCompany,
          status: 'analyzing',
          message: `Analyzing candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName}`,
        });
      }

      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );

      const scoringPrompt = this.searchParametersPrompts.buildCandidateRelevanceScoringPrompt(
        candidate,
        queryUnderstanding,
        userMessage,
        parsedJobDescription,
      );

      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: 'You are an expert at scoring candidate relevance for LinkedIn search results. Provide accurate relevance scores and detailed reasoning.' 
          },
          { role: 'user' as const, content: scoringPrompt },
        ],
        zodResponseFormat(candidateRelevanceScoringSchema, 'candidateRelevanceScoring'),
      );

      // Use candidate-specific streaming to show reasoning per candidate in parallel
      // Reduced timeout to 30s to prevent long hangs
      const fullContent = candidateIndex !== undefined && totalCandidates !== undefined && sendEvent
        ? await this.processStreamChunksForCandidate(stream, candidateIndex, totalCandidates, candidateName, sendEvent, 30000)
        : await this.processStreamChunks(stream, sendEvent, 30000);

      if (!fullContent || fullContent.trim().length === 0) {
        this.logger.warn('Candidate scoring returned empty content, using default score.');
        const defaultScore = {
          relevanceScore: 0.5,
          relevanceLabel: 'somewhat_relevant' as const,
          matchReasons: [],
          roleMatch: false,
          companyMatch: false,
          locationMatch: false,
          educationMatch: null,
          reasoning: 'Scoring failed, defaulting to medium relevance',
        };
        
        // Send completion event with default score
        if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
          sendEvent('candidateScoring', {
            candidateIndex: candidateIndex + 1,
            totalCandidates,
            candidateName,
            candidateTitle,
            candidateCompany,
            status: 'completed',
            score: defaultScore,
            message: `Scored candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName} (${(defaultScore.relevanceScore * 100).toFixed(0)}% relevant)`,
          });
        }
        
        return defaultScore;
      }

      // Clean up the content - extract JSON if embedded in text
      let cleanedContent = fullContent.trim();
      
      // Try to extract JSON if it's embedded in text
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleanedContent);
      } catch (parseError) {
        this.logger.error(`Failed to parse candidate scoring JSON for ${candidateName}: ${parseError}. Content preview: ${cleanedContent.substring(0, 500)}`);
        // Schema will handle this with .catch() and return defaults
        parsed = {};
      }

      // Parse with schema (which is now simple and JSON Schema compatible)
      let parsedResult: any;
      try {
        parsedResult = candidateRelevanceScoringSchema.parse(parsed);
      } catch (validationError) {
        // If validation fails, use safeParse
        const safeResult = candidateRelevanceScoringSchema.safeParse(parsed);
        if (safeResult.success) {
          parsedResult = safeResult.data;
        } else {
          // If both fail, parsedResult will be undefined and normalization will use defaults
          this.logger.warn(`Schema validation failed for candidate ${candidateName}, using normalization defaults`);
          parsedResult = undefined;
        }
      }

      // Normalize the result to ensure all fields have proper values and handle edge cases
      const result = normalizeCandidateRelevanceScoring(parsedResult);
      
      // Send completion event with score
      if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
        sendEvent('candidateScoring', {
          candidateIndex: candidateIndex + 1,
          totalCandidates,
          candidateName,
          candidateTitle,
          candidateCompany,
          status: 'completed',
          score: result,
          message: `Scored candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName} (${(result.relevanceScore * 100).toFixed(0)}% relevant)`,
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to score candidate relevance: ${error}`);
      const errorScore = {
        relevanceScore: 0.5,
        relevanceLabel: 'somewhat_relevant' as const,
        matchReasons: [],
        roleMatch: false,
        companyMatch: false,
        locationMatch: false,
        educationMatch: null,
        reasoning: 'Scoring error, defaulting to medium relevance',
      };
      
      // Send error event
      if (sendEvent && candidateIndex !== undefined && totalCandidates !== undefined) {
        sendEvent('candidateScoring', {
          candidateIndex: candidateIndex + 1,
          totalCandidates,
          candidateName,
          candidateTitle,
          candidateCompany,
          status: 'error',
          score: errorScore,
          message: `Error scoring candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName}`,
        });
      }
      
      return errorScore;
    }
  }

  /**
   * Score multiple candidates in batch (more efficient than individual calls)
   * All requests are sent in parallel for maximum efficiency
   */
  async scoreCandidatesBatch(
    candidates: any[],
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    parsedJobDescription?: ParsedJobDescription,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<Map<string, {
    relevanceScore: number;
    relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
    matchReasons: string[];
    mismatchReasons?: string[];
    roleMatch: boolean;
    companyMatch: boolean;
    locationMatch: boolean;
    educationMatch?: boolean | null;
    reasoning: string;
  }>> {
    const scores = new Map();
    
    if (candidates.length === 0) {
      return scores;
    }

    // Send initial batch scoring event
    if (sendEvent) {
      sendEvent('candidateScoringBatch', {
        totalCandidates: candidates.length,
        status: 'started',
        message: `Starting to score ${candidates.length} candidates...`,
      });
    }

    // Score all candidates in parallel (no batching - all requests go out simultaneously)
    // This maximizes efficiency and minimizes wait time for the user
    const allPromises = candidates.map(async (candidate, index) => {
      try {
        // Use id, urn, or a combination of name and index as unique identifier
        const candidateId = candidate.id || candidate.urn || `${candidate.name || 'unknown'}-${index}`;
        const score = await this.scoreCandidateRelevance(
          candidate,
          queryUnderstanding,
          userMessage,
          apiToken,
          parsedJobDescription,
          sendEvent,
          index,
          candidates.length,
        );
        return { candidateId, score, candidate };
      } catch (error) {
        this.logger.error(`Failed to score candidate ${index}: ${error}`);
        // Return default score on error
        const candidateId = candidate.id || candidate.urn || `${candidate.name || 'unknown'}-${index}`;
        const candidateName = candidate.name || candidate.first_name || 'Unknown';
        const errorScore = {
          relevanceScore: 0.5,
          relevanceLabel: 'somewhat_relevant' as const,
          matchReasons: [],
          roleMatch: false,
          companyMatch: false,
          locationMatch: false,
          educationMatch: null,
          reasoning: 'Scoring failed, defaulting to medium relevance',
        };
        
        // Send error event
        if (sendEvent) {
          sendEvent('candidateScoring', {
            candidateIndex: index + 1,
            totalCandidates: candidates.length,
            candidateName,
            status: 'error',
            score: errorScore,
            message: `Error scoring candidate ${index + 1}/${candidates.length}: ${candidateName}`,
          });
        }
        
        return {
          candidateId,
          score: errorScore,
          candidate,
        };
      }
    });
    
    // Wait for all scoring requests to complete in parallel
    const allResults = await Promise.all(allPromises);
    
    // Store all scores with multiple keys for flexible lookup
    allResults.forEach(({ candidateId, score, candidate }) => {
      // Store score with primary ID
      scores.set(candidateId, score);
      // Also store by urn if available
      if (candidate.urn) {
        scores.set(candidate.urn, score);
      }
      // Store by name as fallback
      if (candidate.name) {
        scores.set(candidate.name, score);
      }
    });
    
    // Send batch completion event
    if (sendEvent) {
      const completedCount = allResults.length;
      const avgScore = completedCount > 0
        ? Array.from(scores.values()).reduce((sum, s) => sum + s.relevanceScore, 0) / completedCount
        : 0;
      
      sendEvent('candidateScoringBatch', {
        totalCandidates: candidates.length,
        completedCount,
        status: 'completed',
        averageScore: avgScore,
        message: `Completed scoring ${completedCount} candidates (average relevance: ${(avgScore * 100).toFixed(0)}%)`,
      });
    }
    
    return scores;
  }

  /**
   * Validate results against query understanding
   */
  async validateResultsAgainstQuery(
    searchResults: any[],
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<ResultValidationResult> {
    if (searchResults.length === 0) {
      return {
        isRelevant: false,
        relevanceScore: 0,
        falsePositives: [],
        qualityAssessment: 'low',
        shouldContinuePagination: false,
        reasoning: 'No results to validate',
      };
    }

    try {
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken)
      );

      const validationPrompt = this.searchParametersPrompts.buildResultValidationPrompt(
        searchResults,
        queryUnderstanding,
        userMessage,
      );

      const stream = await this.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: 'You are an expert at validating LinkedIn search results. Assess relevance, quality, and determine if pagination should continue.' 
          },
          { role: 'user' as const, content: validationPrompt },
        ],
        zodResponseFormat(resultValidationSchema, 'resultValidation'),
      );

      const fullContent = await this.processStreamChunks(stream, sendEvent);

      if (!fullContent) {
        this.logger.warn('Result validation returned empty content.');
        return {
          isRelevant: true, // Default to true
          relevanceScore: 0.7,
          falsePositives: [],
          qualityAssessment: 'medium',
          shouldContinuePagination: true,
          reasoning: 'Validation failed, defaulting to continue',
        } as ResultValidationResult;
      }

      const parsed = JSON.parse(fullContent);
      const validated = resultValidationSchema.parse(parsed);
      this.logger.log(`Result validation: ${JSON.stringify(validated, null, 2)}`);
      return validated;
    } catch (error) {
      this.logger.error(`Failed to validate results: ${error}`);
      return {
        isRelevant: true, // Default to true on error
        relevanceScore: 0.7,
        falsePositives: [],
        qualityAssessment: 'medium',
        shouldContinuePagination: true,
        reasoning: 'Validation error, defaulting to continue',
      } as ResultValidationResult;
    }
  }

  /**
   * Decide whether to continue pagination based on validation
   */
  shouldContinuePagination(
    validationResult: ResultValidationResult,
    currentCount: number,
    targetMin: number = 40,
    targetMax: number = 80,
    maxPages: number = 5,
    currentPage: number = 1,
  ): boolean {
    // Don't continue if we've reached max pages
    if (currentPage >= maxPages) {
      return false;
    }

    // Don't continue if results are not relevant
    if (!validationResult.isRelevant) {
      return false;
    }

    // Don't continue if quality is low
    if (validationResult.qualityAssessment === 'low') {
      return false;
    }

    // Don't continue if relevance score is too low
    const minRelevanceScore = Number(process.env.MIN_RELEVANCE_SCORE ?? 0.6);
    if (validationResult.relevanceScore < minRelevanceScore) {
      return false;
    }

    // Don't continue if we've reached target max
    if (currentCount >= targetMax) {
      return false;
    }

    // Continue if we haven't reached target min and quality is acceptable
    if (currentCount < targetMin && (validationResult.qualityAssessment === 'high' || validationResult.qualityAssessment === 'medium')) {
      return true;
    }

    // Use the validation result's recommendation
    return validationResult.shouldContinuePagination;
  }

  /**
   * Execute a single page search (public wrapper for testing)
   */
  async executeSinglePageSearch(
    parsedJobDescription: ParsedJobDescription,
    searchParameters: GeneratedSearchParameters,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    apiToken: string,
    options?: { cursor?: string; limit?: number },
    queryUnderstanding?: QueryUnderstanding,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<CandidateSearchResponse> {
    return await this.searchCandidatesWithParameters(
      parsedJobDescription,
      searchParameters,
      searchType,
      searchCategory,
      apiToken,
      options,
      queryUnderstanding,
      userMessage,
      sendEvent,
    );
  }

  /**
   * Execute multi-page search with validation-based pagination
   */
  async executeMultiPageStrategySearch(
    parsedJobDescription: ParsedJobDescription,
    strategy: PeopleSearchStrategyResult,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    parameterKey: string,
    apiToken: string,
    queryUnderstanding: QueryUnderstanding | undefined,
    userMessage: string | undefined,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<SearchExecutionPreview | null> {
    const maxPages = Number(process.env.MAX_PAGES_PER_STRATEGY ?? 5);
    const targetMin = Number(process.env.TARGET_CANDIDATE_COUNT_MIN ?? 40);
    const targetMax = Number(process.env.TARGET_CANDIDATE_COUNT_MAX ?? 80);
    const pageLimit = 25; // LinkedIn default page size

    try {
      if (!strategy.parameters) {
        this.logger.warn(
          `Strategy ${strategy.id} has no parameters, skipping search`,
        );
        return null;
      }

      const strategyResolvedParams: GeneratedSearchParameters = {
        [parameterKey]: strategy.parameters,
      } as GeneratedSearchParameters;

      let allItems: any[] = [];
      let allTransformedCandidates: any[] = [];
      let currentCursor: string | undefined;
      let currentPage = 1;
      let hasMore = true;
      let firstPageConfig: any = {};
      const validationResults: Array<{
        page: number;
        validation: ResultValidationResult;
        timestamp: string;
      }> = [];
      const candidateScores = new Map<string, {
        relevanceScore: number;
        relevanceLabel: 'highly_relevant' | 'somewhat_relevant' | 'less_relevant';
        matchReasons: string[];
        mismatchReasons?: string[];
        roleMatch: boolean;
        companyMatch: boolean;
        locationMatch: boolean;
        reasoning: string;
      }>();

      this.logger.log(
        `Executing multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'})`,
      );

      while (hasMore && currentPage <= maxPages) {
        const eventResult = sendEvent?.('status', { 
          message: `Fetching page ${currentPage} for strategy: ${strategy.label}...` 
        });
        if (eventResult === false) {
          this.logger.log('Stream aborted, stopping multi-page search');
          hasMore = false;
          break;
        }

        const response = await this.searchCandidatesWithParameters(
          parsedJobDescription,
          strategyResolvedParams,
          searchType,
          searchCategory,
          apiToken,
          { 
            cursor: currentCursor,
            limit: pageLimit,
          },
          queryUnderstanding,
          userMessage,
          sendEvent,
        );

        const pageItems = response.searchResults?.items || [];
        const pageTransformed = response.transformedCandidates || [];
        
        // Store config from first page
        if (currentPage === 1 && response.searchResults?.config) {
          firstPageConfig = response.searchResults.config;
        }
        
        if (pageItems.length === 0) {
          hasMore = false;
          break;
        }

        // Send event with page results count to frontend
        sendEvent?.('pageResults', {
          page: currentPage,
          candidatesReceived: pageItems.length,
          totalCandidates: allItems.length + pageItems.length,
          strategyId: strategy.id,
          strategyLabel: strategy.label,
        });

        allItems = [...allItems, ...pageItems];
        allTransformedCandidates = [...allTransformedCandidates, ...pageTransformed];
        currentCursor = response.searchResults?.cursor || undefined;

        this.logger.log(
          `Strategy ${strategy.id} page ${currentPage}: ${pageItems.length} candidates (total: ${allItems.length})`,
        );

        // Validate results for each page if query understanding is available
        if (queryUnderstanding && userMessage) {
          const eventResult = sendEvent?.('status', { 
            message: `Validating page ${currentPage} results for strategy: ${strategy.label}...` 
          });
          if (eventResult === false) {
            this.logger.log('Stream aborted, stopping validation');
            hasMore = false;
            break;
          }

          // Validate this page's results
          const validationResult = await this.validateResultsAgainstQuery(
            pageItems,
            queryUnderstanding,
            userMessage,
            apiToken,
            sendEvent,
          );

          validationResults.push({
            page: currentPage,
            validation: validationResult,
            timestamp: new Date().toISOString(),
          });

          // Send validation result to frontend
          const falsePositivesText = validationResult.falsePositives && validationResult.falsePositives.length > 0
            ? `\nFalse positives: ${validationResult.falsePositives.slice(0, 3).join(', ')}${validationResult.falsePositives.length > 3 ? '...' : ''}`
            : '';
          const reasoningText = validationResult.reasoning ? `\n${validationResult.reasoning}` : '';
          sendEvent?.('validation', {
            page: currentPage,
            validation: validationResult,
            message: `Page ${currentPage} validation: ${validationResult.qualityAssessment} quality, ${(validationResult.relevanceScore * 100).toFixed(0)}% relevance${falsePositivesText}${reasoningText}`,
          });

          // Score candidates from this page
          if (pageItems.length > 0) {
            sendEvent?.('status', { 
              message: `Scoring ${pageItems.length} candidates from page ${currentPage}...` 
            });
            
            const pageScores = await this.scoreCandidatesBatch(
              pageItems,
              queryUnderstanding,
              userMessage,
              apiToken,
              parsedJobDescription,
              sendEvent,
            );
            
            // Merge scores into main map (use id, urn, or name as key)
            pageScores.forEach((score, candidateId) => {
              candidateScores.set(candidateId, score);
            });
          }

          // Decide whether to continue pagination
          // Check on every page to make dynamic decisions based on current results
          hasMore = this.shouldContinuePagination(
            validationResult,
            allItems.length,
            targetMin,
            targetMax,
            maxPages,
            currentPage,
          );

          if (!hasMore) {
            this.logger.log(
              `Stopping pagination for strategy ${strategy.id} at page ${currentPage}: ${validationResult.reasoning || 'Validation determined no more pages needed'}`,
            );
            // Send status update about stopping pagination
            sendEvent?.('status', {
              message: `Stopping pagination after page ${currentPage}. ${validationResult.reasoning || 'Target candidate count reached or quality threshold met.'}`,
            });
          } else if (currentPage < maxPages) {
            // Log that we're continuing to next page
            this.logger.log(
              `Continuing pagination for strategy ${strategy.id}: page ${currentPage} validation passed, continuing to page ${currentPage + 1}`,
            );
          }
        } else if (!currentCursor) {
          // No more pages available
          hasMore = false;
        } else if (allItems.length >= targetMax) {
          // Reached target maximum
          hasMore = false;
        }

        currentPage++;
      }

      // Score all candidates if we have query understanding but haven't scored them yet
      if (queryUnderstanding && userMessage && candidateScores.size === 0 && allItems.length > 0) {
        sendEvent?.('status', { 
          message: `Scoring all ${allItems.length} candidates...` 
        });
        const allScores = await this.scoreCandidatesBatch(
          allItems,
          queryUnderstanding,
          userMessage,
          apiToken,
          parsedJobDescription,
          sendEvent,
        );
        allScores.forEach((score, candidateId) => {
          candidateScores.set(candidateId, score);
        });
      }

      // Attach relevance scores to transformed candidates
      if (candidateScores.size > 0) {
        allTransformedCandidates = allTransformedCandidates.map((candidate) => {
          // Try multiple ID fields to match with scores
          const candidateId = candidate.tempId || candidate.id || candidate.peopleId || '';
          const candidateName = candidate.name || '';
          
          // Try to find score by ID first, then by name
          const score = candidateScores.get(candidateId) || 
                       candidateScores.get(candidateName) ||
                       (candidateId ? candidateScores.get(candidateId) : null);
          
          if (score) {
            return {
              ...candidate,
              relevanceScore: score.relevanceScore,
              relevanceLabel: score.relevanceLabel,
              matchReasons: score.matchReasons,
              mismatchReasons: score.mismatchReasons,
            };
          }
          return candidate;
        });

        // Sort candidates by relevance score (highest first)
        allTransformedCandidates.sort((a, b) => {
          const scoreA = a.relevanceScore ?? 0;
          const scoreB = b.relevanceScore ?? 0;
          return scoreB - scoreA;
        });

        // Also sort raw items by relevance (for consistency)
        allItems.sort((a, b) => {
          const idA = a.id || a.urn || '';
          const idB = b.id || b.urn || '';
          const scoreA = candidateScores.get(idA)?.relevanceScore ?? 0;
          const scoreB = candidateScores.get(idB)?.relevanceScore ?? 0;
          return scoreB - scoreA;
        });
      }

      // Perform final validation on all results
      let overallValidation: ResultValidationResult | undefined;
      if (queryUnderstanding && userMessage && allItems.length > 0) {
        sendEvent?.('status', { 
          message: `Performing final validation on all results...` 
        });
        overallValidation = await this.validateResultsAgainstQuery(
          allItems,
          queryUnderstanding,
          userMessage,
          apiToken,
          sendEvent,
        );
        
        const falsePositivesText = overallValidation.falsePositives && overallValidation.falsePositives.length > 0
          ? `\nFalse positives: ${overallValidation.falsePositives.slice(0, 3).join(', ')}${overallValidation.falsePositives.length > 3 ? '...' : ''}`
          : '';
        const reasoningText = overallValidation.reasoning ? `\n${overallValidation.reasoning}` : '';
        sendEvent?.('validation', {
          page: 'all',
          validation: overallValidation,
          message: `Overall validation: ${overallValidation.qualityAssessment} quality, ${(overallValidation.relevanceScore * 100).toFixed(0)}% relevance${falsePositivesText}${reasoningText}`,
        });
      }

      // Construct final response
      const finalResponse: LinkedInSearchResponse = {
        object: 'LinkedinSearch',
        items: allItems,
        config: firstPageConfig,
        paging: {
          start: 0,
          page_count: currentPage - 1,
          total_count: allItems.length,
        },
        cursor: currentCursor || null,
      };

      this.logger.log(
        `Strategy ${strategy.id} multi-page search completed: ${allItems.length} total candidates across ${currentPage - 1} pages`,
      );

      return {
        itemCount: allItems.length,
        searchResults: finalResponse,
        transformedCandidates: allTransformedCandidates.length > 0 ? allTransformedCandidates : undefined,
        searchMetadata: {
          searchType,
          searchCategory,
          timestamp: new Date().toISOString(),
          processingTime: 0, // Will be calculated by caller
        },
        validationResults: validationResults.length > 0 ? validationResults : undefined,
        overallValidation: overallValidation,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined;
      
      this.logger.error(
        `Failed to execute multi-page search for strategy ${strategy.id} (${strategy.label || 'unnamed'}):`,
        error,
      );
      
      let errorDetails: string | undefined;
      if (errorMessage.includes('Content too large')) {
        errorDetails = 'The search parameters are too complex. Try simplifying the search criteria.';
      } else if (errorMessage.includes('LinkedIn search failed')) {
        errorDetails = errorMessage.replace('LinkedIn search failed: ', '');
      }
      
      return {
        itemCount: 0,
        searchResults: null,
        transformedCandidates: undefined,
        searchMetadata: undefined,
        error: {
          message: errorMessage,
          code: errorCode,
          details: errorDetails || errorMessage,
        },
      };
    }
  }

}

