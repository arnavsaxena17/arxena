import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import { ParsedJobDescription, QueryUnderstanding } from '../types/candidate-search-request.type';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { CandidateScoringService } from './candidate-scoring.service';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import { CompanyCultureService } from './company-culture.service';
import { CompetitorClassificationService } from './competitor-classification.service';
import { DiscoveryService } from './discovery.service';
import { ExecutiveValidationService } from './executive-validation.service';
import { JobDescriptionService } from './job-description.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { LocationClusterService } from './location-cluster.service';
import { OrgChartMappingService } from './org-chart-mapping.service';
import { QuerySimplificationService } from './query-simplification.service';
import { QueryUnderstandingService } from './query-understanding.service';
import { ResultValidationService } from './result-validation.service';
import { SearchParameterGenerationService } from './search-parameter-generation.service';
import { StrategyEvolutionService } from './strategy-evolution.service';

export type ToolContext = {
  apiToken: string;
  searchFilterId: string;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
  sendEvent?: (event: string, data: any) => boolean | void;
  openaiClient?: OpenAI;
  workspaceId?: string;
  accountId?: string;
  parsedJobDescription?: ParsedJobDescription;
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  searchCategory?: 'people' | 'companies' | 'posts' | 'jobs';
  userMessage?: string;
};

export type ToolResult = {
  success: boolean;
  data?: any;
  error?: string;
};

export type ToolFunction = (args: Record<string, any>, context: ToolContext) => Promise<ToolResult>;

@Injectable()
export class CandidateSearchToolRegistryService {
  private readonly logger = new Logger(CandidateSearchToolRegistryService.name);
  private readonly toolRegistry: Map<string, { description: string; parameters: z.ZodSchema; execute: ToolFunction }> = new Map();

  constructor(
    private readonly queryUnderstandingService: QueryUnderstandingService,
    private readonly discoveryService: DiscoveryService,
    private readonly searchParameterGenerationService: SearchParameterGenerationService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly resultValidationService: ResultValidationService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly strategyEvolutionService: StrategyEvolutionService,
    private readonly candidateScoringService: CandidateScoringService,
    private readonly companyCultureService: CompanyCultureService,
    private readonly competitorClassificationService: CompetitorClassificationService,
    private readonly orgChartMappingService: OrgChartMappingService,
    private readonly executiveValidationService: ExecutiveValidationService,
    private readonly locationClusterService: LocationClusterService,
    private readonly jobDescriptionService: JobDescriptionService,
    private readonly querySimplificationService: QuerySimplificationService,
  ) {
    this.registerAllTools();
  }

  /**
   * Register all tools in the registry
   */
  private registerAllTools(): void {
    // Core Query & Discovery Tools
    this.registerTool('understand_query', {
      description: 'Extract structured information from user query including role, company, location, industry, and other search criteria',
      parameters: z.object({
        userMessage: z.string().describe('The user\'s search query message'),
        rawJDText: z.string().optional().describe('Raw job description text if available'),
        isClarificationResponse: z.boolean().optional().default(false).describe('Whether this is a response to clarification questions'),
      }),
      execute: this.executeUnderstandQuery.bind(this),
    });

    this.registerTool('identify_patterns', {
      description: 'Identify patterns in the query that require discovery operations (companies, job titles, institutes, company groups)',
      parameters: z.object({
        queryUnderstanding: z.any().describe('The query understanding object from understand_query'),
        userMessage: z.string().describe('The original user message'),
      }),
      execute: this.executeIdentifyPatterns.bind(this),
    });

    this.registerTool('assess_discovery_complexity', {
      description: 'Assess the complexity of discovery operations needed for the query',
      parameters: z.object({
        queryUnderstanding: z.any().describe('The query understanding object'),
        userMessage: z.string().describe('The original user message'),
      }),
      execute: this.executeAssessDiscoveryComplexity.bind(this),
    });

    this.registerTool('discover_job_titles', {
      description: 'Discover job title variations, synonyms, and related titles for a given role',
      parameters: z.object({
        role: z.string().describe('The job role to discover variations for'),
      }),
      execute: this.executeDiscoverJobTitles.bind(this),
    });

    this.registerTool('discover_companies', {
      description: 'Discover companies matching a description, optionally filtered by location',
      parameters: z.object({
        description: z.string().describe('Description of companies to find'),
        location: z.string().optional().describe('Location filter for companies'),
      }),
      execute: this.executeDiscoverCompanies.bind(this),
    });

    this.registerTool('discover_institutes', {
      description: 'Discover educational institutes matching criteria',
      parameters: z.object({
        type: z.string().describe('Type of institute to find (e.g., "IIT", "IIM", "medical college")'),
        domain: z.string().optional().describe('Domain or field of study'),
        location: z.string().optional().describe('Location filter'),
      }),
      execute: this.executeDiscoverInstitutes.bind(this),
    });

    this.registerTool('discover_company_group_members', {
      description: 'Discover all members/subsidiaries of a company group',
      parameters: z.object({
        groupName: z.string().describe('Name of the company group'),
      }),
      execute: this.executeDiscoverCompanyGroupMembers.bind(this),
    });

    this.registerTool('detect_ambiguity', {
      description: 'Detect if the query is ambiguous and needs clarification from the user',
      parameters: z.object({
        queryUnderstanding: z.any().describe('The query understanding object'),
        userMessage: z.string().describe('The original user message'),
        isClarificationResponse: z.boolean().optional().default(false).describe('Whether this is a clarification response'),
      }),
      execute: this.executeDetectAmbiguity.bind(this),
    });

    // Search Parameter & Execution Tools
    this.registerTool('generate_search_parameters', {
      description: 'Generate LinkedIn search parameters and strategies based on parsed job description and query understanding',
      parameters: z.object({
        parsedJobDescription: z.any().describe('The parsed job description'),
        queryUnderstanding: z.any().optional().describe('Query understanding if available'),
        userMessage: z.string().optional().describe('Original user message'),
        classificationReasoning: z.string().optional().describe('Classification reasoning if available'),
        includeJd: z.boolean().optional().default(true).describe('Whether to include JD content'),
      }),
      execute: this.executeGenerateSearchParameters.bind(this),
    });

    this.registerTool('resolve_parameters', {
      description: 'Resolve human-readable parameter names to LinkedIn IDs',
      parameters: z.object({
        searchParameters: z.any().describe('Search parameters with human-readable names'),
        searchType: z.enum(['classic', 'sales_navigator', 'recruiter']).describe('Type of LinkedIn search'),
        searchCategory: z.enum(['people', 'companies', 'posts', 'jobs']).describe('Category of search'),
      }),
      execute: this.executeResolveParameters.bind(this),
    });

    this.registerTool('execute_search', {
      description: 'Execute LinkedIn search with resolved parameters and return candidates',
      parameters: z.object({
        parsedJobDescription: z.any().describe('Parsed job description'),
        generatedSearchParameters: z.any().describe('Generated search parameters'),
        resolvedSearchParameters: z.any().optional().describe('Resolved parameters with LinkedIn IDs (if not provided, will be resolved)'),
        searchType: z.enum(['classic', 'sales_navigator', 'recruiter']).describe('Type of LinkedIn search'),
        searchCategory: z.enum(['people', 'companies', 'posts', 'jobs']).describe('Category of search'),
        queryUnderstanding: z.any().optional().describe('Query understanding for context'),
        userMessage: z.string().optional().describe('Original user message'),
        options: z.object({
          cursor: z.string().optional(),
          limit: z.number().optional(),
        }).optional().describe('Search pagination options'),
      }),
      execute: this.executeSearch.bind(this),
    });

    this.registerTool('validate_results', {
      description: 'Validate search results against the query to assess quality and relevance',
      parameters: z.object({
        searchResults: z.array(z.any()).describe('Array of search result items'),
        queryUnderstanding: z.any().describe('Query understanding to validate against'),
        userMessage: z.string().describe('Original user message'),
      }),
      execute: this.executeValidateResults.bind(this),
    });

    this.registerTool('simplify_query', {
      description: 'Simplify a search query that is too complex (e.g., "Content too large" error)',
      parameters: z.object({
        failedParameters: z.any().describe('The parameters that caused the error'),
        searchType: z.enum(['classic', 'sales_navigator', 'recruiter']).describe('Type of search'),
        searchCategory: z.enum(['people', 'companies', 'posts', 'jobs']).describe('Category of search'),
        attemptNumber: z.number().optional().default(1).describe('Simplification attempt number (1-3)'),
        previousAttempts: z.array(z.any()).optional().default([]).describe('Previous simplification attempts'),
        queryUnderstanding: z.any().optional().describe('Query understanding for context'),
        userMessage: z.string().optional().describe('Original user message'),
        parsedJobDescription: z.any().optional().describe('Parsed job description'),
      }),
      execute: this.executeSimplifyQuery.bind(this),
    });

    // Knowledge & Strategy Tools
    this.registerTool('store_knowledge', {
      description: 'Store search performance knowledge as raw text description for future learning',
      parameters: z.object({
        queryUnderstanding: z.any().describe('Query understanding from the search'),
        strategyResults: z.array(z.any()).describe('Results from executed strategies'),
        rawTextDescription: z.string().describe('Raw text description of what worked/didn\'t work, generated by LLM'),
      }),
      execute: this.executeStoreKnowledge.bind(this),
    });

    this.registerTool('retrieve_knowledge', {
      description: 'Retrieve similar past searches with raw text descriptions of what worked',
      parameters: z.object({
        queryUnderstanding: z.any().describe('Current query understanding to find similar searches for'),
        limit: z.number().optional().default(5).describe('Maximum number of similar searches to return'),
      }),
      execute: this.executeRetrieveKnowledge.bind(this),
    });

    this.registerTool('analyze_strategy_failures', {
      description: 'Analyze why search strategies failed and generate failure analysis',
      parameters: z.object({
        queryUnderstanding: z.any().describe('Query understanding from the search'),
        strategyResults: z.array(z.any()).describe('Strategy execution results that failed'),
      }),
      execute: this.executeAnalyzeStrategyFailures.bind(this),
    });

    this.registerTool('generate_alternative_strategies', {
      description: 'Generate alternative search strategies based on failure analysis and past knowledge',
      parameters: z.object({
        queryUnderstanding: z.any().describe('Query understanding from the search'),
        failureAnalysis: z.any().describe('Failure analysis from analyze_strategy_failures'),
        previousStrategies: z.array(z.any()).describe('Previous strategies that failed'),
      }),
      execute: this.executeGenerateAlternativeStrategies.bind(this),
    });

    // Candidate Scoring & Validation Tools
    this.registerTool('score_candidate_relevance', {
      description: 'Score individual candidate relevance against query understanding',
      parameters: z.object({
        candidate: z.any().describe('Candidate profile object'),
        queryUnderstanding: z.any().describe('Query understanding to score against'),
        userMessage: z.string().describe('Original user message'),
        parsedJobDescription: z.any().optional().describe('Parsed job description'),
        candidateIndex: z.number().optional().describe('Index of candidate in batch (for progress tracking)'),
        totalCandidates: z.number().optional().describe('Total number of candidates (for progress tracking)'),
      }),
      execute: this.executeScoreCandidateRelevance.bind(this),
    });

    this.registerTool('score_candidates_batch', {
      description: 'Score multiple candidates in batch (more efficient than individual calls)',
      parameters: z.object({
        candidates: z.array(z.any()).describe('Array of candidate profile objects'),
        queryUnderstanding: z.any().describe('Query understanding to score against'),
        userMessage: z.string().describe('Original user message'),
        parsedJobDescription: z.any().optional().describe('Parsed job description'),
      }),
      execute: this.executeScoreCandidatesBatch.bind(this),
    });

    // Company & Culture Tools
    this.registerTool('classify_company_culture', {
      description: 'Classify company culture type (promoter-driven, family-run, MNC, startup, etc.)',
      parameters: z.object({
        companyName: z.string().describe('Name of the company to classify'),
        industry: z.string().optional().describe('Industry the company operates in'),
        context: z.string().optional().describe('Additional context about the company'),
      }),
      execute: this.executeClassifyCompanyCulture.bind(this),
    });

    this.registerTool('find_similar_culture_companies', {
      description: 'Find companies with similar culture type in a given industry',
      parameters: z.object({
        cultureType: z.enum(['promoter_driven', 'family_run', 'mnc', 'startup', 'psu', 'pe_backed', 'listed']).describe('Culture type to find'),
        industry: z.string().describe('Industry to search in'),
        location: z.string().optional().describe('Location filter'),
      }),
      execute: this.executeFindSimilarCultureCompanies.bind(this),
    });

    this.registerTool('match_culture_fitment', {
      description: 'Match culture fitment between candidate company culture and target culture',
      parameters: z.object({
        candidateCompanyCulture: z.any().describe('Candidate\'s company culture classification'),
        targetCulture: z.enum(['promoter_driven', 'family_run', 'mnc', 'startup', 'psu', 'pe_backed', 'listed']).describe('Target culture type'),
      }),
      execute: this.executeMatchCultureFitment.bind(this),
    });

    this.registerTool('classify_competitor_tier', {
      description: 'Classify competitor tier (Tier 1, Tier 2, Tier 3) for a company',
      parameters: z.object({
        companyName: z.string().describe('Name of the company to classify'),
        industry: z.string().describe('Industry the company operates in'),
      }),
      execute: this.executeClassifyCompetitorTier.bind(this),
    });

    this.registerTool('get_competitor_tiers', {
      description: 'Get competitor tiers for an entire industry',
      parameters: z.object({
        industry: z.string().describe('Industry to get competitor tiers for'),
        companyType: z.string().optional().describe('Type of company (optional filter)'),
      }),
      execute: this.executeGetCompetitorTiers.bind(this),
    });

    this.registerTool('expand_company_group', {
      description: 'Expand a company group name to all its subsidiaries/members',
      parameters: z.object({
        groupName: z.string().describe('Name of the company group'),
      }),
      execute: this.executeExpandCompanyGroup.bind(this),
    });

    this.registerTool('prioritize_competitors', {
      description: 'Prioritize a list of companies by competitor tier',
      parameters: z.object({
        companies: z.array(z.string()).describe('List of company names to prioritize'),
        industry: z.string().describe('Industry context'),
      }),
      execute: this.executePrioritizeCompetitors.bind(this),
    });

    // Organizational Structure Tools
    this.registerTool('extract_reporting_structure', {
      description: 'Extract reporting structure (who reports to whom, hierarchy level) from a candidate profile',
      parameters: z.object({
        profile: z.any().describe('Candidate profile object'),
      }),
      execute: this.executeExtractReportingStructure.bind(this),
    });

    this.registerTool('map_role_equivalence', {
      description: 'Map role equivalence between different company sizes',
      parameters: z.object({
        role: z.string().describe('Role name'),
        sourceCompanySize: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
        }).describe('Source company size'),
        targetCompanySize: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
        }).describe('Target company size'),
        industry: z.string().describe('Industry context'),
      }),
      execute: this.executeMapRoleEquivalence.bind(this),
    });

    this.registerTool('find_org_structure_matches', {
      description: 'Find organizational structure matches between candidate and target requirements',
      parameters: z.object({
        candidate: z.object({
          role: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }),
        }).describe('Candidate role and company size'),
        target: z.object({
          role: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }),
          industry: z.string(),
        }).describe('Target role, company size, and industry'),
      }),
      execute: this.executeFindOrgStructureMatches.bind(this),
    });

    this.registerTool('get_reporting_level', {
      description: 'Get reporting level (hierarchy level) for a role at a given company size',
      parameters: z.object({
        role: z.string().describe('Role name'),
        companySize: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
        }).describe('Company size'),
        industry: z.string().describe('Industry context'),
      }),
      execute: this.executeGetReportingLevel.bind(this),
    });

    this.registerTool('get_org_structure_pattern', {
      description: 'Get organizational structure pattern for a role',
      parameters: z.object({
        role: z.string().describe('Role name'),
        companySize: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
        }).describe('Company size'),
        industry: z.string().describe('Industry context'),
      }),
      execute: this.executeGetOrgStructurePattern.bind(this),
    });

    // Executive Validation Tools
    this.registerTool('validate_executive_candidate', {
      description: 'Validate if a candidate matches executive search requirements',
      parameters: z.object({
        candidate: z.object({
          role: z.string(),
          company: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }).optional(),
          industry: z.string().optional(),
        }).describe('Candidate profile'),
        targetRequirements: z.object({
          role: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }).optional(),
          industry: z.string().optional(),
          companyCulture: z.enum(['promoter_driven', 'family_run', 'mnc', 'startup', 'psu', 'pe_backed', 'listed']).optional(),
          reportingTo: z.string().optional(),
          manages: z.array(z.string()).optional(),
        }).describe('Target requirements'),
      }),
      execute: this.executeValidateExecutiveCandidate.bind(this),
    });

    this.registerTool('validate_org_structure_fitment', {
      description: 'Validate organizational structure fitment between candidate and target',
      parameters: z.object({
        candidate: z.object({
          role: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }).optional(),
          industry: z.string().optional(),
        }).describe('Candidate profile'),
        targetRequirements: z.object({
          role: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }).optional(),
          industry: z.string().optional(),
          reportingTo: z.string().optional(),
          manages: z.array(z.string()).optional(),
        }).describe('Target requirements'),
      }),
      execute: this.executeValidateOrgStructureFitment.bind(this),
    });

    this.registerTool('validate_culture_match', {
      description: 'Validate culture match between candidate company and target culture',
      parameters: z.object({
        candidate: z.object({
          role: z.string(),
          company: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }).optional(),
          industry: z.string().optional(),
        }).describe('Candidate profile'),
        targetCulture: z.enum(['promoter_driven', 'family_run', 'mnc', 'startup', 'psu', 'pe_backed', 'listed']).describe('Target culture type'),
      }),
      execute: this.executeValidateCultureMatch.bind(this),
    });

    this.registerTool('validate_reporting_equivalence', {
      description: 'Validate reporting equivalence between candidate and target',
      parameters: z.object({
        candidate: z.object({
          role: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }).optional(),
          industry: z.string().optional(),
        }).describe('Candidate profile'),
        targetRequirements: z.object({
          role: z.string(),
          companySize: z.object({
            min: z.number().optional(),
            max: z.number().optional(),
          }).optional(),
          industry: z.string().optional(),
          reportingTo: z.string().optional(),
          manages: z.array(z.string()).optional(),
        }).describe('Target requirements'),
      }),
      execute: this.executeValidateReportingEquivalence.bind(this),
    });

    // Location Tools
    this.registerTool('get_location_clusters', {
      description: 'Get location clusters (related locations) for a given location and industry',
      parameters: z.object({
        location: z.string().describe('Location name'),
        industry: z.string().optional().describe('Industry context'),
      }),
      execute: this.executeGetLocationClusters.bind(this),
    });

    this.registerTool('get_location_fallback_strategy', {
      description: 'Get location fallback strategy when primary location search fails',
      parameters: z.object({
        location: z.string().describe('Primary location'),
        industry: z.string().optional().describe('Industry context'),
        priority: z.array(z.number()).optional().describe('Priority levels for fallback'),
      }),
      execute: this.executeGetLocationFallbackStrategy.bind(this),
    });

    this.registerTool('get_proximity_locations', {
      description: 'Get locations within a radius of a given location',
      parameters: z.object({
        location: z.string().describe('Center location'),
        radiusKm: z.number().optional().default(100).describe('Radius in kilometers'),
      }),
      execute: this.executeGetProximityLocations.bind(this),
    });

    // Job Description Tools
    this.registerTool('parse_job_description', {
      description: 'Parse a job description from text or file into structured format',
      parameters: z.object({
        jobDescription: z.string().optional().describe('Job description text'),
        filePath: z.string().optional().describe('Path to job description file'),
        jobTitle: z.string().optional().describe('Job title if known'),
        company: z.string().optional().describe('Company name if known'),
        location: z.string().optional().describe('Location if known'),
        industry: z.string().optional().describe('Industry if known'),
      }),
      execute: this.executeParseJobDescription.bind(this),
    });

    this.registerTool('get_jd_content', {
      description: 'Get job description content from job attachments',
      parameters: z.object({
        jobId: z.string().describe('Job ID to get JD content for'),
      }),
      execute: this.executeGetJDContent.bind(this),
    });

    this.logger.log(`Registered ${this.toolRegistry.size} tools`);
  }

  /**
   * Register a single tool
   */
  private registerTool(
    name: string,
    tool: { description: string; parameters: z.ZodSchema; execute: ToolFunction },
  ): void {
    this.toolRegistry.set(name, tool);
  }

  /**
   * Get all tools as OpenAI ChatCompletionTool format
   */
  getTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];

    for (const [name, tool] of this.toolRegistry.entries()) {
      // Convert Zod schema to JSON Schema for OpenAI
      const jsonSchema = this.zodToJsonSchema(tool.parameters);

      tools.push({
        type: 'function',
        function: {
          name,
          description: tool.description,
          parameters: jsonSchema as any,
        },
      });
    }

    return tools;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const tool = this.toolRegistry.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found in registry`,
      };
    }

    try {
      // Validate arguments against schema
      const validatedArgs = tool.parameters.parse(args);
      return await tool.execute(validatedArgs, context);
    } catch (error) {
      this.logger.error(`Error executing tool "${name}": ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Convert Zod schema to JSON Schema (simplified version)
   */
  private zodToJsonSchema(schema: z.ZodSchema): Record<string, any> {
    // This is a simplified conversion - for production, consider using zod-to-json-schema library
    const shape = (schema as any)._def?.shape?.() || {};
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodTypeAny;
      const def = zodType._def;

      if (def.typeName === 'ZodString') {
        properties[key] = {
          type: 'string',
          description: def.description || '',
        };
      } else if (def.typeName === 'ZodNumber') {
        properties[key] = {
          type: 'number',
          description: def.description || '',
        };
      } else if (def.typeName === 'ZodBoolean') {
        properties[key] = {
          type: 'boolean',
          description: def.description || '',
        };
      } else if (def.typeName === 'ZodArray') {
        properties[key] = {
          type: 'array',
          items: { type: 'object' }, // Simplified - could be more specific
          description: def.description || '',
        };
      } else if (def.typeName === 'ZodObject') {
        properties[key] = {
          type: 'object',
          properties: this.zodToJsonSchema(zodType).properties,
          description: def.description || '',
        };
      } else if (def.typeName === 'ZodEnum') {
        properties[key] = {
          type: 'string',
          enum: def.values,
          description: def.description || '',
        };
      } else if (def.typeName === 'ZodOptional') {
        // Handle optional - don't add to required
        const innerType = def.innerType;
        if (innerType._def.typeName === 'ZodString') {
          properties[key] = {
            type: 'string',
            description: innerType._def.description || '',
          };
        } else if (innerType._def.typeName === 'ZodNumber') {
          properties[key] = {
            type: 'number',
            description: innerType._def.description || '',
          };
        } else if (innerType._def.typeName === 'ZodBoolean') {
          properties[key] = {
            type: 'boolean',
            description: innerType._def.description || '',
          };
        } else if (innerType._def.typeName === 'ZodArray') {
          properties[key] = {
            type: 'array',
            items: { type: 'object' },
            description: innerType._def.description || '',
          };
        } else if (innerType._def.typeName === 'ZodObject') {
          properties[key] = {
            type: 'object',
            properties: this.zodToJsonSchema(innerType).properties,
            description: innerType._def.description || '',
          };
        } else if (innerType._def.typeName === 'ZodEnum') {
          properties[key] = {
            type: 'string',
            enum: innerType._def.values,
            description: innerType._def.description || '',
          };
        } else {
          properties[key] = {
            type: 'object',
            description: innerType._def.description || '',
          };
        }
        continue; // Skip adding to required
      } else {
        properties[key] = {
          type: 'object',
          description: def.description || '',
        };
      }

      // Check if field is required (not optional)
      if (def.typeName !== 'ZodOptional' && def.typeName !== 'ZodDefault') {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  // ========== Tool Execution Methods ==========

  // Core Query & Discovery Tools
  private async executeUnderstandQuery(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      if (!context.openaiClient) {
        return { success: false, error: 'OpenAI client not available in context' };
      }

      const result = await this.queryUnderstandingService.understandQuery(
        context.openaiClient,
        args.userMessage,
        args.rawJDText || '',
        context.sendEvent,
        args.isClarificationResponse || false,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in understand_query: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeIdentifyPatterns(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      // identify_patterns is part of integrateDiscoveryIntoQueryUnderstanding
      const result = await this.queryUnderstandingService.integrateDiscoveryIntoQueryUnderstanding(
        args.queryUnderstanding as QueryUnderstanding,
        args.userMessage,
        context.apiToken,
        context.sendEvent,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in identify_patterns: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeAssessDiscoveryComplexity(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      // assess_discovery_complexity is also part of integrateDiscoveryIntoQueryUnderstanding
      // It returns the enhanced query understanding with discovery complexity assessed
      const result = await this.queryUnderstandingService.integrateDiscoveryIntoQueryUnderstanding(
        args.queryUnderstanding as QueryUnderstanding,
        args.userMessage,
        context.apiToken,
        context.sendEvent,
      );

      return { success: true, data: { discoveryComplexity: result.discoveryComplexity } };
    } catch (error) {
      this.logger.error(`Error in assess_discovery_complexity: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeDiscoverJobTitles(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.discoveryService.discoverJobTitles(args.role, context.apiToken);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in discover_job_titles: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeDiscoverCompanies(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.discoveryService.discoverCompanies(
        args.description,
        context.apiToken,
        args.location,
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in discover_companies: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeDiscoverInstitutes(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.discoveryService.discoverInstitutes(
        args.type,
        context.apiToken,
        args.domain,
        args.location,
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in discover_institutes: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeDiscoverCompanyGroupMembers(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.discoveryService.discoverCompanyGroupMembers(
        args.groupName,
        context.apiToken,
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in discover_company_group_members: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeDetectAmbiguity(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      if (!context.openaiClient) {
        return { success: false, error: 'OpenAI client not available in context' };
      }

      const result = await this.queryUnderstandingService.detectAmbiguityProgrammatically(
        context.openaiClient,
        args.queryUnderstanding as QueryUnderstanding,
        args.userMessage,
        args.isClarificationResponse || false,
        context.sendEvent,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in detect_ambiguity: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Search Parameter & Execution Tools
  private async executeGenerateSearchParameters(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      if (!context.openaiClient) {
        return { success: false, error: 'OpenAI client not available in context' };
      }

      if (!context.searchType || !context.searchCategory) {
        return { success: false, error: 'searchType and searchCategory required in context' };
      }

      const result = await this.searchParameterGenerationService.streamPeopleSearchStrategiesParameters(
        args.parsedJobDescription as ParsedJobDescription,
        context.openaiClient,
        context.searchType,
        args.userMessage || context.userMessage,
        args.classificationReasoning,
        undefined, // rawJDText - could be extracted from parsedJobDescription
        context.sendEvent,
        args.includeJd !== false,
        args.queryUnderstanding as QueryUnderstanding | undefined,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in generate_search_parameters: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeResolveParameters(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      if (!context.accountId) {
        return { success: false, error: 'accountId required in context' };
      }

      const result = await this.linkedinParameterResolver.resolveParameterIds(
        args.searchParameters,
        args.searchType,
        args.searchCategory,
        context.accountId,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in resolve_parameters: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeSearch(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      // Resolve parameters if not already resolved
      let resolvedParams = args.resolvedSearchParameters;
      if (!resolvedParams) {
        if (!context.accountId) {
          return { success: false, error: 'accountId required in context for parameter resolution' };
        }
        const resolved = await this.linkedinParameterResolver.resolveParameterIds(
          args.generatedSearchParameters,
          args.searchType,
          args.searchCategory,
          context.accountId,
        );
        resolvedParams = resolved;
      }

      const result = await this.candidateSearchBaseService.searchCandidatesWithParameters(
        args.parsedJobDescription as ParsedJobDescription,
        resolvedParams,
        args.searchType,
        args.searchCategory,
        context.apiToken,
        args.options,
        args.queryUnderstanding as QueryUnderstanding | undefined,
        args.userMessage || context.userMessage,
        context.sendEvent,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in execute_search: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeValidateResults(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.resultValidationService.validateResultsAgainstQuery(
        args.searchResults,
        args.queryUnderstanding as QueryUnderstanding,
        args.userMessage,
        context.apiToken,
        context.sendEvent,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in validate_results: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeSimplifyQuery(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.querySimplificationService.simplifyQuery(
        args.failedParameters,
        args.searchType,
        args.searchCategory,
        context.apiToken,
        args.attemptNumber || 1,
        args.previousAttempts || [],
        args.queryUnderstanding as QueryUnderstanding | undefined,
        args.userMessage || context.userMessage,
        args.parsedJobDescription as ParsedJobDescription | undefined,
        context.sendEvent,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in simplify_query: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Knowledge & Strategy Tools
  private async executeStoreKnowledge(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      // Convert strategyResults to the format expected by storeSearchPerformance
      const strategyResultsForStorage = args.strategyResults.map((sr: any) => ({
        strategy: {
          id: sr.id || sr.strategyId || 'unknown',
          label: sr.label || sr.strategyLabel || 'Unknown Strategy',
        },
        preview: {
          itemCount: sr.candidateCount || sr.itemCount || 0,
          validation: sr.validation || sr.validationResult,
        },
      }));

      // Store with raw text description
      this.knowledgeBaseService.storeSearchPerformance(
        args.queryUnderstanding as QueryUnderstanding,
        strategyResultsForStorage,
      );

      return { success: true, data: { stored: true, rawTextDescription: args.rawTextDescription } };
    } catch (error) {
      this.logger.error(`Error in store_knowledge: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeRetrieveKnowledge(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const results = this.knowledgeBaseService.findSimilarSearches(
        args.queryUnderstanding as QueryUnderstanding,
        args.limit || 5,
      );

      // TODO: Format as raw text descriptions when knowledge base is refactored
      return { success: true, data: results };
    } catch (error) {
      this.logger.error(`Error in retrieve_knowledge: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeAnalyzeStrategyFailures(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.strategyEvolutionService.analyzeStrategyFailures(
        args.queryUnderstanding as QueryUnderstanding,
        args.strategyResults,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in analyze_strategy_failures: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeGenerateAlternativeStrategies(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.strategyEvolutionService.generateAlternativeStrategies(
        args.queryUnderstanding as QueryUnderstanding,
        args.failureAnalysis,
        args.previousStrategies,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in generate_alternative_strategies: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Candidate Scoring & Validation Tools
  private async executeScoreCandidateRelevance(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.candidateScoringService.scoreCandidateRelevance(
        args.candidate,
        args.queryUnderstanding as QueryUnderstanding,
        args.userMessage,
        context.apiToken,
        args.parsedJobDescription as ParsedJobDescription | undefined,
        context.sendEvent,
        args.candidateIndex,
        args.totalCandidates,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in score_candidate_relevance: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeScoreCandidatesBatch(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.candidateScoringService.scoreCandidatesBatch(
        args.candidates,
        args.queryUnderstanding as QueryUnderstanding,
        args.userMessage,
        context.apiToken,
        args.parsedJobDescription as ParsedJobDescription | undefined,
        context.sendEvent,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in score_candidates_batch: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Company & Culture Tools
  private async executeClassifyCompanyCulture(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.companyCultureService.classifyCompanyCulture(
        args.companyName,
        args.industry,
        args.context,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in classify_company_culture: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeFindSimilarCultureCompanies(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.companyCultureService.findSimilarCultureCompanies(
        args.cultureType,
        args.industry,
        args.location,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in find_similar_culture_companies: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeMatchCultureFitment(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = this.companyCultureService.matchCultureFitment(
        args.candidateCompanyCulture,
        args.targetCulture,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in match_culture_fitment: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeClassifyCompetitorTier(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.competitorClassificationService.classifyCompetitorTier(
        args.companyName,
        args.industry,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in classify_competitor_tier: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeGetCompetitorTiers(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.competitorClassificationService.getCompetitorTiers(
        args.industry,
        args.companyType,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in get_competitor_tiers: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeExpandCompanyGroup(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.competitorClassificationService.expandCompanyGroup(
        args.groupName,
        context.apiToken,
      );

      return { success: true, data: { companies: result } };
    } catch (error) {
      this.logger.error(`Error in expand_company_group: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executePrioritizeCompetitors(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = this.competitorClassificationService.prioritizeCompetitors(
        args.companies,
        args.industry,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in prioritize_competitors: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Organizational Structure Tools
  private async executeExtractReportingStructure(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.orgChartMappingService.extractReportingStructure(
        args.profile,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in extract_reporting_structure: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeMapRoleEquivalence(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.orgChartMappingService.mapRoleEquivalence(
        args.role,
        args.sourceCompanySize,
        args.targetCompanySize,
        args.industry,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in map_role_equivalence: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeFindOrgStructureMatches(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.orgChartMappingService.findOrgStructureMatches(
        args.candidate,
        args.target,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in find_org_structure_matches: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeGetReportingLevel(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.orgChartMappingService.getReportingLevel(
        args.role,
        args.companySize,
        args.industry,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in get_reporting_level: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeGetOrgStructurePattern(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.orgChartMappingService.getOrgStructurePattern(
        args.role,
        args.companySize,
        args.industry,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in get_org_structure_pattern: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Executive Validation Tools
  private async executeValidateExecutiveCandidate(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.executiveValidationService.validateExecutiveCandidate(
        args.candidate,
        args.targetRequirements,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in validate_executive_candidate: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeValidateOrgStructureFitment(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.executiveValidationService.validateOrgStructureFitment(
        args.candidate,
        args.targetRequirements,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in validate_org_structure_fitment: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeValidateCultureMatch(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.executiveValidationService.validateCultureMatch(
        args.candidate,
        args.targetCulture,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in validate_culture_match: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeValidateReportingEquivalence(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.executiveValidationService.validateReportingEquivalence(
        args.candidate,
        args.targetRequirements,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in validate_reporting_equivalence: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Location Tools
  private async executeGetLocationClusters(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.locationClusterService.getLocationClusters(
        args.location,
        args.industry,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in get_location_clusters: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeGetLocationFallbackStrategy(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.locationClusterService.getLocationFallbackStrategy(
        args.location,
        args.industry,
        args.priority,
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in get_location_fallback_strategy: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeGetProximityLocations(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = this.locationClusterService.getProximityLocations(
        args.location,
        args.radiusKm || 100,
      );

      return { success: true, data: { locations: result } };
    } catch (error) {
      this.logger.error(`Error in get_proximity_locations: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Job Description Tools
  private async executeParseJobDescription(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.jobDescriptionService.parseJobDescription(
        {
          jobDescription: args.jobDescription,
          filePath: args.filePath,
          jobTitle: args.jobTitle,
          company: args.company,
          location: args.location,
          industry: args.industry,
        },
        context.apiToken,
      );

      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Error in parse_job_description: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeGetJDContent(args: any, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.jobDescriptionService.getJDContentFromJobAttachments(
        args.jobId,
        context.apiToken,
      );

      return { success: true, data: { content: result } };
    } catch (error) {
      this.logger.error(`Error in get_jd_content: ${error}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

