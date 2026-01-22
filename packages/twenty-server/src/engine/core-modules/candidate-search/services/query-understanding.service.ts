import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import {
  QueryUnderstanding,
  queryUnderstandingSchema
} from '../schemas/query-understanding.schema';
import { TokenUsage } from '../utils/token-tracking.util';
import { DiscoveryService } from './discovery.service';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class QueryUnderstandingService {
  private readonly logger = new Logger(QueryUnderstandingService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly discoveryService: DiscoveryService,
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
        functionalRole: null,
        subFunctionalRole: null,
        roleVariations: [],
        industry: null,
        locationHierarchy: { primary: '', secondary: null, regional: null },
        companyPreferences: null,
        hierarchicalLevel: null,
        subHierarchicalLevel: null,
        domainContext: null,
        skills: null,
        experienceRequirements: null,
        explicitRequirements: [],
        preferredRequirements: [],
        needsClarification: true,
        clarificationQuestions: null,
        clarificationAnswers: null,
        ambiguityReasons: null,
        ambiguityReasoning: null,
        detectedIssues: null,
        certifications: null,
        companySizeRange: null,
        functionalRoleVariations: [],
        hierarchicalLevelVariations: [],
        fundingStage: null,
        ageConstraint: null,
        regulatoryExperience: null,
        companyGroupPreferences: null,
        targetCompanyProfile: null,
        patternIdentification: null,
        companyCulture: null,
        reportingStructureRequirements: null,
        locationFallbackStrategy: null,
        discoveredTitles: null,
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
        functionalRole: null,
        subFunctionalRole: null,
        hierarchicalLevel: null,
        subHierarchicalLevel: null,
        roleVariations: [],
        industry: null,
        locationHierarchy: { primary: '', secondary: null, regional: null },
        companyPreferences: null,
        domainContext: null,
        functionalRoleVariations: [],
        hierarchicalLevelVariations: [],
        skills: null,
        experienceRequirements: null,
        explicitRequirements: [],
        preferredRequirements: [],
        needsClarification: true,
        clarificationQuestions: ['Could you provide more details about the role and location?'],
        clarificationAnswers: null,
        ambiguityReasons: ['Insufficient information provided'],
        ambiguityReasoning: null,
        detectedIssues: null,
        certifications: null,
        companySizeRange: null,
        fundingStage: null,
        ageConstraint: null,
        regulatoryExperience: null,
        companyGroupPreferences: null,
        targetCompanyProfile: null,
        patternIdentification: null,
        companyCulture: null,
        reportingStructureRequirements: null,
        locationFallbackStrategy: null,
        discoveredTitles: null,
      } as QueryUnderstanding;
    }

    try {
      const parsedQueryUnderstanding = JSON.parse(queryUnderstandingResponse);
      const validated = queryUnderstandingSchema.parse(parsedQueryUnderstanding);
      this.logger.log(`Query understanding: ${JSON.stringify(validated, null, 2)}`);
      
      const validatedWithMapping = validated as any;
      let enhancedUnderstanding: QueryUnderstanding = {
        ...validated,
        clarificationAnswers: isClarificationResponse ? userMessage : validated.clarificationAnswers || null,
        subFunctionalRole: validatedWithMapping.subFunctionalRole ?? null,
      } as QueryUnderstanding;
      if (apiToken) {
        const queryUnderstandingWithDiscovery = await this.integrateDiscoveryIntoQueryUnderstanding(
          enhancedUnderstanding,
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

      console.log("enhancedUnderstanding: ", enhancedUnderstanding);
      
      return enhancedUnderstanding;
    } catch (error) {
      this.logger.error(`Failed to parse query understanding: ${error}`);
      // Return minimal understanding on error
      return {
        primaryRole: userMessage.split(' ').slice(0, 3).join(' '),
        functionalRole: null,
        subFunctionalRole: null,
        roleVariations: [],
        industry: null,
        locationHierarchy: { primary: '', secondary: null, regional: null },
        companyPreferences: null,
        hierarchicalLevel: null,
        subHierarchicalLevel: null,
        functionalRoleVariations: [],
        hierarchicalLevelVariations: [],
        domainContext: null,
        skills: null,
        experienceRequirements: null,
        explicitRequirements: [],
        preferredRequirements: [],
        needsClarification: true,
        clarificationQuestions: ['Could you provide more details about the role and location?'],
        clarificationAnswers: null,
        ambiguityReasons: ['Insufficient information provided'],
        ambiguityReasoning: null,
        detectedIssues: null,
        certifications: null,
        companySizeRange: null,
        fundingStage: null,
        ageConstraint: null,
        regulatoryExperience: null,
        companyGroupPreferences: null,
        targetCompanyProfile: null,
        patternIdentification: null,
        companyCulture: null,
        reportingStructureRequirements: null,
        locationFallbackStrategy: null,
        discoveredTitles: null,
      } as QueryUnderstanding;
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
      // Use pattern identification from query understanding (now included in the initial query understanding call)
      const validatedPatterns = queryUnderstanding.patternIdentification;
      
      if (!validatedPatterns) {
        this.logger.warn('Pattern identification not found in query understanding. Proceeding without discovery.');
        return enhanced;
      }

      // Perform discovery operations based on identified patterns
      const discoveryPromises: Promise<void>[] = [];
      
      const eventResult = sendEvent?.('status', { message: 'Performing discovery operations...' });
      if (eventResult === false) {
        this.logger.log('Stream aborted during discovery operations');
        return enhanced;
      }


      // Discover job title variations for all roles (not just specialized ones)
      // This ensures strategies can use discovered titles and hierarchical/domain terms
      let discoveredJobTitlesResult: any = null;
      // Always discover job titles to enrich roleVariations and provide hierarchical/domain terms for strategy generation
      discoveryPromises.push(
        this.discoveryService.discoverJobTitles(enhanced, apiToken, sendEvent)
          .then(result => {
            discoveredJobTitlesResult = result;
            // Store discovered job titles in query understanding for later use in boolean query generation
            enhanced.discoveredTitles = result;
            if (result.jobTitles.length > 0) {
              const allVariations = result.jobTitles.flatMap(jt => [jt.title, ...jt.variations]);
              // Merge discovered variations into roleVariations, avoiding duplicates
              const existingVariations = new Set(enhanced.roleVariations.map(v => v.toLowerCase()));
              allVariations.forEach(variation => {
                if (!existingVariations.has(variation.toLowerCase())) {
                  enhanced.roleVariations.push(variation);
                }
              });
              sendEvent?.('status', { message: `Discovered ${result.jobTitles.length} job title variations for ${enhanced.primaryRole}` });
            }
          })
          .catch(error => {
            this.logger.error(`Failed to discover job titles for ${enhanced.primaryRole}: ${error}`);
          })
      );

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
              // Store company type signals if available
              if (result.companyTypeSignals) {
                enhanced.companyTypeSignals = result.companyTypeSignals;
                this.logger.log(`Stored company type signals: ${JSON.stringify(result.companyTypeSignals, null, 2)}`);
                sendEvent?.('status', { message: 'Extracted company type signals for boolean query generation' });
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
                if (!enhanced.industry) {
                  enhanced.industry = [];
                }
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

      if (validatedPatterns.identifiedPatterns.reportingStructureRequirement?.detected && 
          validatedPatterns.identifiedPatterns.reportingStructureRequirement.confidence >= 0.5) {
        const industry = enhanced.industry && enhanced.industry.length > 0 ? enhanced.industry[0] : undefined;
        const domainContext = enhanced.domainContext || undefined;
        const location = enhanced.locationHierarchy?.primary || undefined;
        discoveryPromises.push(
          this.discoveryService.discoverReportingStructure(
            enhanced.primaryRole,
            apiToken,
            industry,
            domainContext,
            location,
            sendEvent
          )
            .then(result => {
              if (result.reportingStructure) {
                const reportingStructure = result.reportingStructure;
                const reportsToParts: string[] = [];
                if (reportingStructure.directReportingManager?.title) {
                  reportsToParts.push(reportingStructure.directReportingManager.title);
                }
                if (reportingStructure.dualReportingManagers && reportingStructure.dualReportingManagers.length > 0) {
                  const dualManagers = reportingStructure.dualReportingManagers
                    .map(m => `${m.title} (${m.type})`)
                    .join(', ');
                  if (dualManagers) {
                    reportsToParts.push(dualManagers);
                  }
                }
                const reportsToString = reportsToParts.length > 0 
                  ? reportsToParts.join(' / ')
                  : null;
                const managesArray = reportingStructure.directReports
                  ?.map(report => report.title) || [];
                enhanced.reportingStructureRequirements = {
                  reportsTo: reportsToString,
                  manages: managesArray.length > 0 ? managesArray : null,
                };                
                sendEvent?.('status', { message: `Discovered reporting structure for ${enhanced.primaryRole}` });
                this.logger.log(`Discovered reporting structure: ${JSON.stringify(reportingStructure, null, 2)}`);
              }
            })
            .catch(error => {
              this.logger.error(`Failed to discover reporting structure: ${error}`);
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

