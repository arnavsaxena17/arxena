import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { QueryUnderstanding } from 'src/engine/core-modules/candidate-search/schemas/query-understanding.schema';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  CompanyDiscoveryResult,
  IndustryDiscoveryResult,
  InstituteDiscoveryResult,
  JobTitleDiscoveryResult,
  ReportingStructureDiscoveryResult,
  companyDiscoverySchema,
  industryDiscoverySchema,
  instituteDiscoverySchema,
  jobTitleDiscoverySchema,
  reportingStructureDiscoverySchema
} from '../schemas/discovery.schemas';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  // Cache for common discoveries to avoid repeated web searches
  private discoveryCache: Map<string, any> = new Map();

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * Discover companies based on description and location
   * Uses web search to find companies matching the criteria
   */
  async discoverCompanies(
    description: string,
    apiToken: string,
    location?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<CompanyDiscoveryResult> {
    const cacheKey = `companies:${description}:${location || 'any'}`;
    if (this.discoveryCache.has(cacheKey)) {
      this.logger.log(`Using cached company discovery for: ${description}`);
      return this.discoveryCache.get(cacheKey);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const locationContext = location ? ` in ${location}` : '';
      
      const systemPrompt = `You are an expert at discovering companies and extracting company type intelligence. Use web search to find companies matching the description and extract comprehensive company type signals.

      TASK:
      1. Find companies that match the description
      2. Extract company type signals that will be used for intelligent boolean query generation

      COMPANY TYPE SIGNALS TO EXTRACT:
      - industryKeywords: Industry-specific terms that describe this type of company (e.g., "OEM", "telecom equipment vendor", "network solutions provider", "manufacturing", "B2B software")
      - productKeywords: Product/service keywords that these companies make or sell (e.g., "base stations", "switches", "routers", "telecom infrastructure", "network equipment")
      - businessModelKeywords: Business model terms (e.g., "B2B", "enterprise solutions", "channel sales", "direct sales", "OEM partnerships")
      - partnerProgramKeywords: Partner program terms if relevant (e.g., "Channel Partner Program", "VAR", "reseller program", "distributor network")
      - exclusionKeywords: Terms to exclude to avoid false positives (e.g., "consumer handsets", "retail", "B2C" if searching for B2B)
      - companyTypeDescription: A clear description of this company type (e.g., "Telecom equipment vendors that manufacture network infrastructure for B2B markets")

      Use web search to:
      1. Find actual company names matching the description
      2. Research the industry, products, and business models of these companies
      3. Extract keywords that candidates might use in their LinkedIn profiles when describing their companies
      4. Identify terms that would help in boolean query generation to find candidates from similar companies

      Return company names, locations, industries, AND the extracted company type signals.`;

      const prompt = `Find companies that ${description}${locationContext} and extract company type signals for intelligent boolean query generation.`;

      const companySearchPrompt = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt },
      ]

      this.logger.log(`Company search prompt: ${JSON.stringify(companySearchPrompt, null, 2)}`);

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        companySearchPrompt,
        zodResponseFormat(companyDiscoverySchema, 'companyDiscovery'),
        'gpt-4o-search-preview',
      );

      const { content } = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      if (!content) {
        throw new Error('Empty response from company discovery');
      }

      const parsed = JSON.parse(content);
      const result = companyDiscoverySchema.parse(parsed);  
      // Cache the result
      this.discoveryCache.set(cacheKey, result);
      this.logger.log(`Discovered ${result.companies.length} companies for: ${description}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to discover companies: ${error}`);
      // Return empty result on error
      return {
        companies: [],
        searchQuery: description,
      };
    }
  }

  /**
   * Discover job title variations and synonyms
   * Uses web search to find all variations of a job title
   */
  async discoverJobTitles(
    queryUnderstanding: QueryUnderstanding,
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<JobTitleDiscoveryResult> {
    const cacheKey = `jobTitles:${queryUnderstanding.primaryRole.toLowerCase()}`;
    if (this.discoveryCache.has(cacheKey)) {
      this.logger.log(`Using cached job title discovery for: ${queryUnderstanding.primaryRole}`);
      return this.discoveryCache.get(cacheKey);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const systemPrompt = `Use web search to find job title variations, synonyms, and related titles. Include:
      - Alternative titles used across companies
      - Regional and industry-specific variations
      - Keyword variations (e.g., pulmonologist → chest physician, respirologist)
      - Abbreviations (e.g., KAM, GM, VP)
      - Hierarchical variations (e.g., Head of Operations → VP Operations, GM Operations, Unit Head)

      For hierarchical roles, extract position levels (GM, VP, Head, Director, etc.) and domain terms (Operations, Sales, etc.), then combine them into common patterns. Return 10-20 commonly used variations that candidates actually use.`;

      const prompt = `Find job title variations, synonyms, and related titles for "${queryUnderstanding.primaryRole}".`;

      const jobTitleDiscoveryPrompt = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt },
      ]

      this.logger.log(`Job title discovery prompt: ${JSON.stringify(jobTitleDiscoveryPrompt, null, 2)}`);

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        jobTitleDiscoveryPrompt,
        zodResponseFormat(jobTitleDiscoverySchema, 'jobTitleDiscovery'),
        'gpt-5.1-chat-latest',
      );

      const { content } = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      if (!content) {
        throw new Error('Empty response from job title discovery');
      }

      // Validate JSON is complete before parsing
      let parsed;
      try {
        parsed = JSON.parse(content);
        this.logger.log(`Job title discovery result: ${JSON.stringify(parsed, null, 2)}`);  
      } catch (parseError) {
        this.logger.error(`Invalid JSON in job title discovery response for: ${queryUnderstanding.primaryRole}. Content length: ${content.length}`);
        throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      const result = jobTitleDiscoverySchema.parse(parsed);

      // Cache the result
      this.discoveryCache.set(cacheKey, result);

      return result;
    } catch (error) {
      this.logger.error(`Failed to discover job titles: ${error}`);
      // Return minimal result on error
      return {
        jobTitles: [{ title: queryUnderstanding.primaryRole, variations: [] }],
        searchQuery: queryUnderstanding.primaryRole,
      };
    }
  }

  /**
   * Discover educational institutes based on type, domain, and location
   * Uses web search to find institutes matching the criteria
   */
  async discoverInstitutes(
    type: string,
    apiToken: string,
    domain?: string,
    location?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<InstituteDiscoveryResult> {
    const cacheKey = `institutes:${type}:${domain || 'any'}:${location || 'any'}`;
    if (this.discoveryCache.has(cacheKey)) {
      this.logger.log(`Using cached institute discovery for: ${type}`);
      return this.discoveryCache.get(cacheKey);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const domainContext = domain ? ` specializing in ${domain}` : '';
      const locationContext = location ? ` in ${location}` : '';
      
      const systemPrompt = `Use web search to find educational institutes matching the criteria. Return institute names, types, locations, and domain specializations. Consider Indian market specifics (IIT, IIM, domain-specific institutes like IRMA, UDCT).`;

      const prompt = `Find ${type} educational institutes${domainContext}${locationContext}.`;

      const instituteDiscoveryPrompt = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt },
      ]

      this.logger.log(`Institute discovery prompt: ${JSON.stringify(instituteDiscoveryPrompt, null, 2)}`);

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        instituteDiscoveryPrompt,
        zodResponseFormat(instituteDiscoverySchema, 'instituteDiscovery'),
        'gpt-4o-search-preview',
      );

      const { content } = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      if (!content) {
        throw new Error('Empty response from institute discovery');
      }

      const parsed = JSON.parse(content);
      this.logger.log(`Institute discovery result: ${JSON.stringify(parsed, null, 2)}`);  
      const result = instituteDiscoverySchema.parse(parsed);

      // Cache the result
      this.discoveryCache.set(cacheKey, result);
      this.logger.log(`Discovered ${result.institutes.length} institutes for: ${type}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to discover institutes: ${error}`);
      // Return empty result on error
      return {
        institutes: [],
        searchQuery: type,
      };
    }
  }

  /**
   * Discover industries from query description
   * Uses LLM to match industry descriptions to exact LinkedIn industry names
   */
  async discoverIndustries(
    industryDescription: string,
    apiToken: string,
    userMessage?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<IndustryDiscoveryResult> {
    const cacheKey = `industries:${industryDescription.toLowerCase()}`;
    if (this.discoveryCache.has(cacheKey)) {
      this.logger.log(`Using cached industry discovery for: ${industryDescription}`);
      return this.discoveryCache.get(cacheKey);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);
      
      const systemPrompt = `Match the industry description to exact LinkedIn industry names. Return only exact matches (case-sensitive). Consider synonyms (e.g., "pharma" → "Pharmaceutical Manufacturing", "tech" → "Technology, Information and Internet"). Return all matching industries or an empty array if none match.`;

      const userPrompt = userMessage 
        ? `User query: "${userMessage}"\n\nIndustry description: "${industryDescription}"\n\nIdentify all matching industries.`
        : `Industry description: "${industryDescription}"\n\nIdentify all matching industries.`;

      const industryDiscoveryPrompt = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ]

      this.logger.log(`Industry discovery prompt: ${JSON.stringify(industryDiscoveryPrompt, null, 2)}`);

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        industryDiscoveryPrompt,
        zodResponseFormat(industryDiscoverySchema, 'industryDiscovery'),
        'gpt-5.1-chat-latest',
      );

      const { content } = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      if (!content) {
        throw new Error('Empty response from industry discovery');
      }

      const parsed = JSON.parse(content);
      const result = industryDiscoverySchema.parse(parsed);
      this.logger.log(`Industry discovery result: ${JSON.stringify(result, null, 2)}`);
      // Cache the result
      this.discoveryCache.set(cacheKey, result);
      this.logger.log(`Discovered ${result.industries.length} industries for: ${industryDescription}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to discover industries: ${error}`);
      // Return empty result on error
      return {
        industries: [],
        searchQuery: industryDescription,
      };
    }
  }

  /**
   * Discover reporting structure for a role within an organization
   * Uses web search to find typical reporting hierarchies, functional homes, and variations
   */
  async discoverReportingStructure(
    role: string,
    apiToken: string,
    industry?: string,
    domainContext?: string,
    location?: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<ReportingStructureDiscoveryResult> {
    const cacheKey = `reportingStructure:${role.toLowerCase()}:${industry || 'any'}:${domainContext || 'any'}:${location || 'any'}`;
    if (this.discoveryCache.has(cacheKey)) {
      this.logger.log(`Using cached reporting structure discovery for: ${role}`);
      return this.discoveryCache.get(cacheKey);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const industryContext = industry ? ` in ${industry} industry` : '';
      const domainContextStr = domainContext ? ` with ${domainContext} focus` : '';
      const locationContext = location ? ` in ${location}` : '';
      
      const systemPrompt = `Use web search to discover the typical reporting structure for a role within an organization. Focus ONLY on direct reporting relationships (not the entire hierarchy chain). Analyze:

      1. FUNCTIONAL HOME: Which department/function does this role typically sit in? (e.g., Sales, Channel Sales, Partner Sales, Enterprise Sales, Marketing, Operations, etc.)

      2. DIRECT REPORTING MANAGER: Identify the immediate manager (level 1 only):
        - Exact job title of the direct reporting manager
        - Common variations of that title
        - Brief description of the direct reporting relationship
        Note: Do NOT include the entire chain to C-level - only the direct manager.

      3. DUAL/MATRIX REPORTING (if applicable, especially in MNCs): Identify additional reporting managers in matrix/dual reporting structures:
        - Job titles of dual reporting managers (e.g., functional manager, geographic manager)
        - Type of dual reporting (functional, geographic, matrix, dotted line)
        - Common variations of these titles
        - Brief description of each dual reporting relationship
        Note: MNCs often have matrix structures where roles report to both functional and geographic managers.

      4. DIRECT REPORTS: Who directly reports to this role? (level 1 only):
        - Job titles that directly report to this position
        - Brief description of each direct reporting relationship
        Note: Do NOT include reports of reports - only direct reports.

      5. COMMON REPORTING MANAGER TITLES: List exact designations/titles to search for when looking for managers this role reports to (useful for LinkedIn searches). Include variations from directReportingManager and dualReportingManagers. Include regional variations.

      6. REGIONAL CONSIDERATIONS: Location-specific patterns (e.g., "In Gujarat, many report to Mumbai-based managers", "Territory: West India")

      7. RARELY REPORTS TO: Departments or functions this role rarely reports into (e.g., Marketing, Product, Operations)

      Focus on practical, recruiter-friendly information that helps identify:
      - Where to search for candidates (which functional area)
      - Who their direct managers might be (for targeting searches)
      - Matrix/dual reporting structures (common in MNCs)
      - Regional/territory patterns that affect reporting structures

      Remember: Only capture DIRECT relationships (level 1), not the entire hierarchy chain. For MNCs, include matrix/dual reporting structures.`;

      const prompt = `Find the typical reporting structure for "${role}"${industryContext}${domainContextStr}${locationContext}.

      Specifically identify (ONLY direct relationships, not the entire hierarchy):
      - Which functional department/area this role sits in
      - Direct reporting manager (immediate manager only, not the entire chain)
      - Dual/matrix reporting managers (if applicable, especially for MNCs)
      - Direct reports (who reports directly to this role, not reports of reports)
      - Common titles for reporting managers (for LinkedIn searches)
      - Regional considerations for ${location || 'the market'}
      - Functions this role rarely reports into`;

      const reportingStructureDiscoveryPrompt = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt },
      ]

      this.logger.log(`Reporting structure discovery prompt: ${JSON.stringify(reportingStructureDiscoveryPrompt, null, 2)}`);

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        reportingStructureDiscoveryPrompt,
        zodResponseFormat(reportingStructureDiscoverySchema, 'reportingStructureDiscovery'),
        'gpt-5.1-chat-latest',
      );

      const { content } = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      if (!content) {
        throw new Error('Empty response from reporting structure discovery');
      }

      const parsed = JSON.parse(content);

      this.logger.log(`Reporting structure discovery result: ${JSON.stringify(parsed, null, 2)}`);  
      const result = reportingStructureDiscoverySchema.parse(parsed);
      
      // Cache the result
      this.discoveryCache.set(cacheKey, result);

      return result;
    } catch (error) {
      this.logger.error(`Failed to discover reporting structure: ${error}`);
      // Return minimal result on error
      return {
        reportingStructure: {
          functionalHome: 'Unknown',
          directReportingManager: null,
          dualReportingManagers: null,
          directReports: null,
          commonReportingManagerTitles: [],
        },
        searchQuery: role,
      };
    }
  }

}

