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

  /**
   * Understand and extract structured information from user query
   */
  async understandQuery(
    openaiClient: OpenAI,
    userMessage: string,
    rawJDText: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    isClarificationResponse: boolean = false,
    apiToken?: string,
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
    
    const queryUnderstandingPrompt = this.searchParametersPrompts.getQueryUnderstandingPrompt(
      userMessage,
      rawJDText,
      isClarificationResponse,
    );

    const queryUnderstandingStream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { 
          role: 'system' as const, 
          content: 'You are an expert recruiter specializing in extracting structured information from candidate search queries. Analyze the query and extract all relevant details for building precise LinkedIn searches.' 
        },
        { role: 'user' as const, content: queryUnderstandingPrompt },
      ],
      zodResponseFormat(queryUnderstandingSchema, 'queryUnderstanding'),
    );

    const queryUnderstandingResponse = await this.streamProcessingService.processStreamChunks(queryUnderstandingStream, sendEvent);

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
  ): Promise<QueryUnderstanding> {
    const eventResult = sendEvent?.('status', { message: 'Detecting query ambiguity...' });
    if (eventResult === false) {
      this.logger.log('Stream aborted during ambiguity detection');
      // Return query understanding as-is on abort
      return queryUnderstanding;
    }

    const ambiguityDetectionPrompt = this.searchParametersPrompts.getAmbiguityDetectionPrompt(
      queryUnderstanding,
      userMessage,
      isClarificationResponse,
    );

    const ambiguityDetectionStream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { 
          role: 'system' as const, 
          content: 'You are an expert recruiter specializing in detecting ambiguity and missing information in candidate search queries. Analyze queries to determine if clarification is needed before generating search parameters.' 
        },
        { role: 'user' as const, content: ambiguityDetectionPrompt },
      ],
      zodResponseFormat(ambiguityDetectionSchema, 'ambiguityDetection'),
    );

    const ambiguityDetectionResponse = await this.streamProcessingService.processStreamChunks(ambiguityDetectionStream, sendEvent);

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
   */
  async integrateDiscoveryIntoQueryUnderstanding(
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
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

      const patternPrompt = this.searchParametersPrompts.getPatternIdentificationPrompt(
        queryUnderstanding,
        userMessage,
      );

      const patternStream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { 
            role: 'system' as const, 
            content: 'You are an expert recruiter specializing in identifying patterns in candidate search queries that require discovery operations. Analyze queries to detect patterns that indicate the need for discovering companies, job titles, institutes.' 
          },
          { role: 'user' as const, content: patternPrompt },
        ],
        zodResponseFormat(patternIdentificationSchema, 'patternIdentification'),
      );

      const patternIdentificationResponse = await this.streamProcessingService.processStreamChunks(patternStream, sendEvent);

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
      if (validatedPatterns.identifiedPatterns.specializedRole.detected && 
          validatedPatterns.identifiedPatterns.specializedRole.confidence >= 0.5) {
        discoveryPromises.push(
          this.discoveryService.discoverJobTitles(enhanced.primaryRole, apiToken)
            .then(result => {
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
          this.discoveryService.discoverCompanies(companyDescription, apiToken, location)
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
          this.discoveryService.discoverInstitutes(instituteType, apiToken, domain, location)
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

      // Wait for all discovery operations to complete
      await Promise.all(discoveryPromises);

      // Return enhanced query understanding with pattern identification and complexity assessment stored
      // These can now be used when generating search parameters
      return enhanced;
    } catch (error) {
      this.logger.error(`Failed to integrate discovery: ${error}`);
      // Return enhanced query understanding without discovery on error
      return enhanced;
    }
  }
}

