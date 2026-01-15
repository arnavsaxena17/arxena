import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
  ambiguityDetectionSchema,
  patternIdentificationSchema,
  queryUnderstandingSchema
} from '../schemas/query-understanding.schema';
import { QueryUnderstanding } from '../types/candidate-search-request.type';
import { TokenUsage } from '../utils/token-tracking.util';
import { DiscoveryService } from './discovery.service';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class QueryUnderstandingService {
  private readonly logger = new Logger(QueryUnderstandingService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly discoveryService: DiscoveryService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  async understandQuery(
    openaiClient: OpenAI,
    userMessage: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    isClarificationResponse: boolean = false,
    apiToken?: string,
    searchType?: 'classic' | 'sales_navigator' | 'recruiter',
    onTokenUsage?: (usage: TokenUsage) => void,
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
    
    const queryUnderstandingSystemPrompt = this.searchParametersPrompts.getQueryUnderstandingSystemPrompt(
      isClarificationResponse,
    );

    const queryUnderstandingPrompt = this.searchParametersPrompts.getQueryUnderstandingUserPrompt(
      userMessage,
      rawJDText,
      isClarificationResponse,
    );

    const queryUnderstandingStream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { 
          role: 'system' as const, 
          content: queryUnderstandingSystemPrompt
        },
        { role: 'user' as const, content: queryUnderstandingPrompt },
      ],
      zodResponseFormat(queryUnderstandingSchema, 'queryUnderstanding'),
    );

    const queryUnderstandingResult = await this.streamProcessingService.processStreamChunks(queryUnderstandingStream, sendEvent);
    const queryUnderstandingResponse = typeof queryUnderstandingResult === 'string' 
      ? queryUnderstandingResult 
      : queryUnderstandingResult.content;
    
    // Accumulate token usage if available
    if (typeof queryUnderstandingResult !== 'string' && queryUnderstandingResult.usage && onTokenUsage) {
      onTokenUsage(queryUnderstandingResult.usage);
    }

    if (!queryUnderstandingResponse) {
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
      const parsedQueryUnderstanding = JSON.parse(queryUnderstandingResponse);
      const validated = queryUnderstandingSchema.parse(parsedQueryUnderstanding);
      this.logger.log(`Query understanding: ${JSON.stringify(validated, null, 2)}`);
      
      // Store clarification answers if provided
      let enhancedUnderstanding: QueryUnderstanding = {
        ...validated,
        clarificationAnswers: isClarificationResponse ? userMessage : validated.clarificationAnswers || null,
      };
      if (apiToken) {
        const queryUnderstandingWithDiscovery = await this.integrateDiscoveryIntoQueryUnderstanding(
          validated,
          userMessage,
          apiToken,
          sendEvent,
          searchType,
          onTokenUsage,
        );
        // Ensure needsClarification is always defined (required by schema)
        enhancedUnderstanding = {
          ...queryUnderstandingWithDiscovery,
          needsClarification: queryUnderstandingWithDiscovery.needsClarification ?? validated.needsClarification,
        };
      }
      
      // Programmatic ambiguity detection - enhance LLM-based detection
      // Be more lenient if this is a clarification response
      const queryUnderstandingWithAmbiguityCheck = await this.detectAmbiguity(
        openaiClient,
        enhancedUnderstanding, 
        userMessage,
        isClarificationResponse,
        sendEvent,
        onTokenUsage,
      );
      
      return queryUnderstandingWithAmbiguityCheck;
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
   * Detect ambiguity in query understanding using LLM
   * Analyzes the query for missing information, vague descriptions, and conflicting requirements
   */
  async detectAmbiguity(
    openaiClient: OpenAI,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    isClarificationResponse: boolean = false,
    sendEvent?: (event: string, data: any) => boolean | void,
    onTokenUsage?: (usage: TokenUsage) => void,
  ): Promise<QueryUnderstanding> {
    const eventResult = sendEvent?.('status', { message: 'Detecting query ambiguity...' });
    if (eventResult === false) {
      this.logger.log('Stream aborted during ambiguity detection');
      // Return query understanding as-is on abort
      return queryUnderstanding;
    }

    const ambiguityDetectionSystemPrompt = this.searchParametersPrompts.getAmbiguityDetectionSystemPrompt(
      isClarificationResponse,
    );
    const ambiguityDetectionPrompt = this.searchParametersPrompts.getAmbiguityDetectionUserPrompt(
      queryUnderstanding,
      userMessage,
      isClarificationResponse,
    );

    const ambiguityDetectionStream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { 
          role: 'system' as const, 
          content: ambiguityDetectionSystemPrompt
        },
        { role: 'user' as const, content: ambiguityDetectionPrompt },
      ],
      zodResponseFormat(ambiguityDetectionSchema, 'ambiguityDetection'),
    );

    const ambiguityDetectionResult = await this.streamProcessingService.processStreamChunks(ambiguityDetectionStream, sendEvent);
    const ambiguityDetectionResponse = typeof ambiguityDetectionResult === 'string'
      ? ambiguityDetectionResult
      : ambiguityDetectionResult.content;
    
    // Accumulate token usage if available
    if (typeof ambiguityDetectionResult !== 'string' && ambiguityDetectionResult.usage && onTokenUsage) {
      onTokenUsage(ambiguityDetectionResult.usage);
    }



    if (!ambiguityDetectionResponse) {
      this.logger.warn('Ambiguity detection returned empty content. Using original query understanding.');
      return queryUnderstanding;
    }

    try {
      const parsedAmbiguityDetection = JSON.parse(ambiguityDetectionResponse);
      const validated = ambiguityDetectionSchema.parse(parsedAmbiguityDetection);
      this.logger.log(`Ambiguity detection: needsClarification=${validated.needsClarification} - ${validated.reasoning}`);
      
      // Merge LLM-detected ambiguity with original query understanding
      return {
        ...queryUnderstanding,
        needsClarification: validated.needsClarification,
        clarificationQuestions: validated.clarificationQuestions,
        ambiguityReasons: validated.ambiguityReasons,
      };
    } catch (error) {
      this.logger.error(`Failed to parse ambiguity detection: ${error}`);
      // Return original query understanding on error
      return queryUnderstanding;
    }
  }

  /**
   * Integrate discovery results into query understanding
   * Uses LLM to identify patterns and determine discovery complexity, then performs discovery operations
   * For Sales Navigator and Recruiter, also generates sophisticated boolean queries
   */
  async integrateDiscoveryIntoQueryUnderstanding(
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    searchType?: 'classic' | 'sales_navigator' | 'recruiter',
    onTokenUsage?: (usage: TokenUsage) => void,
  ): Promise<QueryUnderstanding> {
    const enhanced: QueryUnderstanding = { 
      ...queryUnderstanding,
      needsClarification: queryUnderstanding.needsClarification ?? false,
    };

    try {
      // Get OpenAI client
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      // Step 1: Identify patterns using LLM
      const eventResult = sendEvent?.('status', { message: 'Identifying discovery patterns...' });
      if (eventResult === false) {
        this.logger.log('Stream aborted during pattern identification');
        return enhanced;
      }

      const patternSystemPrompt = this.searchParametersPrompts.getPatternIdentificationSystemPrompt();
      const patternPrompt = this.searchParametersPrompts.getPatternIdentificationUserPrompt(
        queryUnderstanding,
        userMessage,
      );

      const patternStream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: patternSystemPrompt
          },
          { role: 'user' as const, content: patternPrompt },
        ],
        zodResponseFormat(patternIdentificationSchema, 'patternIdentification'),
      );

      const patternIdentificationResult = await this.streamProcessingService.processStreamChunks(patternStream, sendEvent);
      const patternIdentificationResponse = typeof patternIdentificationResult === 'string'
        ? patternIdentificationResult
        : patternIdentificationResult.content;
      
      // Accumulate token usage if available
      if (typeof patternIdentificationResult !== 'string' && patternIdentificationResult.usage && onTokenUsage) {
        onTokenUsage(patternIdentificationResult.usage);
      }

      if (!patternIdentificationResponse) {
        this.logger.warn('Pattern identification returned empty content. Proceeding without discovery.');
        return enhanced;
      }

      const parsedPatternIdentification = JSON.parse(patternIdentificationResponse);
      const validatedPatterns = patternIdentificationSchema.parse(parsedPatternIdentification);
      this.logger.log(`Pattern identification: ${JSON.stringify(validatedPatterns, null, 2)}`);


      // Store pattern identification and complexity assessment in enhanced query understanding
      enhanced.patternIdentification = validatedPatterns;

      // Step 3: Perform discovery operations based on identified patterns
      const discoveryPromises: Promise<void>[] = [];


      // Discover job title variations if specialized role pattern detected
      let discoveredJobTitlesResult: any = null;
      if (validatedPatterns.identifiedPatterns.specializedRole.detected && 
          validatedPatterns.identifiedPatterns.specializedRole.confidence >= 0.5) {
        discoveryPromises.push(
          this.discoveryService.discoverJobTitles(enhanced.primaryRole, apiToken, sendEvent)
            .then(result => {
              discoveredJobTitlesResult = result;
              if (result.jobTitles.length > 0) {
                const allVariations = result.jobTitles.flatMap(jt => [jt.title, ...jt.variations]);
                // Merge discovered variations into roleVariations, avoiding duplicates
                const existingVariations = new Set(enhanced.roleVariations.map(v => v.toLowerCase()));
                allVariations.forEach(variation => {
                  if (!existingVariations.has(variation.toLowerCase())) {
                    enhanced.roleVariations.push(variation);
                  }
                });
                sendEvent?.('status', { message: `Discovered ${result.totalVariations} job title variations for ${enhanced.primaryRole}` });
              }
            })
            .catch(error => {
              this.logger.error(`Failed to discover job titles for ${enhanced.primaryRole}: ${error}`);
            })
        );
      }

      // Discover companies if company description pattern detected
      if (validatedPatterns.identifiedPatterns.companyDescription.detected && 
          validatedPatterns.identifiedPatterns.companyDescription.confidence >= 0.5 &&
          validatedPatterns.identifiedPatterns.companyDescription.description) {
        const companyDescription = validatedPatterns.identifiedPatterns.companyDescription.description;
        const location = enhanced.locationHierarchy?.primary;
        discoveryPromises.push(
          this.discoveryService.discoverCompanies(companyDescription, apiToken, location, sendEvent)
            .then(result => {
              if (result.companies.length > 0) {
                const discoveredCompanies = result.companies.map(c => c.name);
                if (!enhanced.companyPreferences) {
                  enhanced.companyPreferences = { current: [], past: null, types: null };
                }
                if (!enhanced.companyPreferences.current) {
                  enhanced.companyPreferences.current = [];
                }
                // Add discovered companies, avoiding duplicates
                const existingCompanies = new Set(enhanced.companyPreferences.current.map(c => c.toLowerCase()));
                discoveredCompanies.forEach(company => {
                  if (!existingCompanies.has(company.toLowerCase())) {
                    enhanced.companyPreferences!.current!.push(company);
                  }
                });
                sendEvent?.('status', { message: `Discovered ${result.companies.length} companies matching description` });
              }
            })
            .catch(error => {
              this.logger.error(`Failed to discover companies: ${error}`);
            })
        );
      }

      // Discover educational institutes if institute requirement pattern detected
      if (validatedPatterns.identifiedPatterns.instituteRequirement.detected && 
          validatedPatterns.identifiedPatterns.instituteRequirement.confidence >= 0.5 &&
          validatedPatterns.identifiedPatterns.instituteRequirement.instituteType) {
        const instituteType = validatedPatterns.identifiedPatterns.instituteRequirement.instituteType;
        const domain = enhanced.domainContext || undefined;
        const location = enhanced.locationHierarchy?.primary || undefined;
        discoveryPromises.push(
          this.discoveryService.discoverInstitutes(instituteType, apiToken, domain, location, sendEvent)
            .then(result => {
              if (result.institutes.length > 0) {
                // Store discovered institutes in a way that can be used for filtering/scoring
                // For now, we'll add them to preferredRequirements as they can be used in post-search filtering
                const instituteNames = result.institutes.map(i => i.name);
                enhanced.preferredRequirements = [
                  ...(enhanced.preferredRequirements || []),
                  ...instituteNames.map(name => `Education from ${name}`),
                ];
                sendEvent?.('status', { message: `Discovered ${result.institutes.length} educational institutes` });
              }
            })
            .catch(error => {
              this.logger.error(`Failed to discover institutes: ${error}`);
            })
        );
      }

      // Discover industries if industry requirement pattern detected
      let discoveredIndustriesResult: any = null;
      if (validatedPatterns.identifiedPatterns.industryRequirement.detected && 
          validatedPatterns.identifiedPatterns.industryRequirement.confidence >= 0.5 &&
          validatedPatterns.identifiedPatterns.industryRequirement.industryDescription) {
        const industryDescription = validatedPatterns.identifiedPatterns.industryRequirement.industryDescription;
        discoveryPromises.push(
          this.discoveryService.discoverIndustries(industryDescription, apiToken, userMessage, sendEvent)
            .then(result => {
              discoveredIndustriesResult = result;
              if (result.industries.length > 0) {
                // Store discovered industries in the query understanding
                // These will be used to populate the industry field and passed to the prompt
                if (!enhanced.industry) {
                  enhanced.industry = [];
                }
                // Add discovered industries, avoiding duplicates
                const existingIndustries = new Set(enhanced.industry.map(i => i.toLowerCase()));
                result.industries.forEach(industry => {
                  if (!existingIndustries.has(industry.toLowerCase())) {
                    enhanced.industry!.push(industry);
                  }
                });
                sendEvent?.('status', { message: `Discovered ${result.industries.length} industries matching description` });
              }
            })
            .catch(error => {
              this.logger.error(`Failed to discover industries: ${error}`);
            })
        );
      }

      // Wait for all discovery operations to complete
      await Promise.all(discoveryPromises);

      // Return enhanced query understanding with pattern identification and complexity assessment stored
      // These can now be used when generating search parameters
      // Note: Sophisticated boolean queries are generated on-demand during parameter generation,
      // not stored in QueryUnderstanding, as they are search-specific optimizations, not query understanding
      return enhanced;
    } catch (error) {
      this.logger.error(`Failed to integrate discovery: ${error}`);
      // Return enhanced query understanding without discovery on error
      return enhanced;
    }
  }
}

