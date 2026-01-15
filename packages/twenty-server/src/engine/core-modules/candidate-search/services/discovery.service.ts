import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { linkedinIndustryOptions } from '../schemas/classic-people-search.schema';
import {
  CompanyDiscoveryResult,
  IndustryDiscoveryResult,
  InstituteDiscoveryResult,
  JobTitleDiscoveryResult,
  companyDiscoverySchema,
  industryDiscoverySchema,
  instituteDiscoverySchema,
  jobTitleDiscoverySchema
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
      
      const systemPrompt = `You are an expert at discovering companies through web search. Your task is to use web search to find companies matching descriptions and return structured results with company names, locations, and industries.

When given a company description, you should:
- Search the web for companies matching the description
- Return a comprehensive list of company names with their locations and industries when available
- Consider regional variations and industry-specific terminology

Examples of what to find:
- "textile machinery manufacturing companies in Mumbai" → Find companies that manufacture textile machinery in Mumbai
- "ceramics insulators manufacturing companies" → Find companies that manufacture ceramics insulators
- "SaaS companies in Bangalore" → Find SaaS companies in Bangalore

Always return structured data with company names, locations, and industries.`;

      const prompt = `Find companies that ${description}${locationContext}.`;

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        zodResponseFormat(companyDiscoverySchema, 'companyDiscovery'),
        'gpt-4o-search-preview',
      );

      const { content } = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      if (!content) {
        throw new Error('Empty response from company discovery');
      }

      const parsed = JSON.parse(content);
      const result = companyDiscoverySchema.parse(parsed);
      this.logger.log(`Company discovery result: ${JSON.stringify(result, null, 2)}`);
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
        totalFound: 0,
      };
    }
  }

  /**
   * Discover job title variations and synonyms
   * Uses web search to find all variations of a job title
   */
  async discoverJobTitles(
    role: string,
    apiToken: string,
    sendEvent?: (event: string, data: any) => boolean | void,
  ): Promise<JobTitleDiscoveryResult> {
    const cacheKey = `jobTitles:${role.toLowerCase()}`;
    if (this.discoveryCache.has(cacheKey)) {
      this.logger.log(`Using cached job title discovery for: ${role}`);
      return this.discoveryCache.get(cacheKey);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const systemPrompt = `You are an expert at discovering job title variations through web search. Your task is to use web search to find all synonyms, variations, and related titles for a given role, especially considering regional and industry-specific terminology.

When searching for job title variations, you should find:
- Alternative job titles used for this role - how people would call themselves when they are in the role in different companies
- Regional variations (as per the geography of the role)
- Industry-specific variations
- Keyword variations (e.g., if searching for "pulmonologist", find: chest physician, lungs specialist, Pneumologist, Respirologist, respiratory physician, respirologist, etc.)
- Abbreviated variations (e.g., if key account manager, candidates will write KAM, if Head Operations, candidates might write GM Operations, General Manager Operations, VP Operations, Vice President Operations, etc.)
- Hierarchical variations (e.g., if searching for "head of operations", people in different sized companies will write VP Operations, Vice President Operations, President Operations, Head - Works, Head Ops, GM Operations, DGM Operations)

CRITICAL: For roles with hierarchical and domain components, extract:
1. HIERARCHICAL TERMS: Position level terms used across companies (e.g., GM, VP, President, AGM, Head, Director, Manager, DGM, AVP, SVP, EVP, Chief, C-level, Unit Head, Plant Head, Works Head, Site Head, HOD)
2. DOMAIN TERMS: Functional/domain terms (e.g., Operations, Sales, Marketing, Plant, Unit, Works, Site, Manufacturing, Production, Supply Chain)
3. NOMENCLATURE PATTERNS: Common ways companies combine hierarchical + domain terms (e.g., "GM Operations", "VP Operations", "Head - Operations", "President Operations", "General Manager Operations", "Unit Head", "Plant Head", "Works Head", "Site Head", "HOD - Operations")

For example, for "Head of Operations":
- Hierarchical terms: GM, VP, President, AGM, Head, Unit Head, Plant Head, Works Head, Site Head, HOD
- Domain terms: Operations, Ops, Plant, Unit, Works, Site
- Patterns: "GM Operations", "VP Operations", "President Operations", "Head - Operations", "Unit Head", "Plant Head", "Works Head", "Site Head", "HOD - Operations"

Return the most important and commonly used variations (limit to 10-20 unique variations to ensure completeness). Focus on variations that candidates actually write to describe their role in the company.`;

      const prompt = `Find job title variations, synonyms, and related titles for "${role}".`;

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        zodResponseFormat(jobTitleDiscoverySchema, 'jobTitleDiscovery'),
        'gpt-4o-search-preview',
      );

      const { content } = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      if (!content) {
        throw new Error('Empty response from job title discovery');
      }

      // Validate JSON is complete before parsing
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        this.logger.error(`Invalid JSON in job title discovery response for: ${role}. Content length: ${content.length}`);
        throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      this.logger.log('parsed created from job title discovery: ', JSON.stringify(parsed, null, 2));

      const result = jobTitleDiscoverySchema.parse(parsed);

      // Cache the result
      this.discoveryCache.set(cacheKey, result);
      this.logger.log(`Discovered ${result.totalVariations} job title variations for: ${role}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to discover job titles: ${error}`);
      // Return minimal result on error
      return {
        jobTitles: [{ title: role, variations: [] }],
        searchQuery: role,
        totalVariations: 0,
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
      
      const systemPrompt = `You are an expert at discovering educational institutes through web search. Your task is to use web search to find institutes matching the type, domain, and location criteria, especially for Indian market (IIT, IIM, domain-specific institutes like IRMA for dairy, UDCT for chemical, etc.).

When searching for educational institutes, you should:
- Search the web for educational institutes matching the description
- Return a comprehensive list with institute names, types, locations, and domain specializations
- Consider Indian market specifics (IIT, IIM, domain-specific institutes)

Examples of what to find:
- "tier-1 engineering institutes in India" → Find IITs, NITs, etc.
- "dairy management institutes" → Find IRMA (Anand), etc.
- "chemical engineering institutes" → Find UDCT, etc.
- "MBBS colleges" → Find medical colleges
- "tier-1 business schools in India" → Find IIMs, etc.

Always return structured data with institute names, types, locations, and domain specializations.`;

      const prompt = `Find ${type} educational institutes${domainContext}${locationContext}.`;

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        zodResponseFormat(instituteDiscoverySchema, 'instituteDiscovery'),
        'gpt-4o-search-preview',
      );

      const { content } = await this.streamProcessingService.processStreamChunks(stream, sendEvent);
      console.log('content created from institute discovery: ', JSON.stringify(content, null, 2));
      if (!content) {
        throw new Error('Empty response from institute discovery');
      }

      const parsed = JSON.parse(content);
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
        totalFound: 0,
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

      const industryList = linkedinIndustryOptions.join('\n');
      
      const systemPrompt = `You are an expert at matching industry descriptions to exact LinkedIn industry names. Your task is to identify which industries from the provided list match the user's query.

You have access to the complete list of ${linkedinIndustryOptions.length} valid LinkedIn industry names. You must return ONLY the exact industry names that match the user's query description.

CRITICAL RULES:
- Return ONLY exact industry names from the provided list
- Match industry descriptions to the most relevant industries (e.g., "pharma" → "Pharmaceutical Manufacturing", "tech" → "Technology, Information and Internet" or "IT Services and IT Consulting")
- Consider synonyms and related terms (e.g., "software" → "Software Development" or "IT Services and IT Consulting")
- If multiple industries match, return all of them
- If no industries match, return an empty array
- Industry names MUST match exactly as they appear in the list (case-sensitive)

Examples:
- "pharmaceutical" → ["Pharmaceutical Manufacturing"]
- "technology" or "tech" → ["Technology, Information and Internet", "IT Services and IT Consulting", "Computer Software"]
- "manufacturing" → ["Manufacturing", "Food and Beverage Manufacturing", "Chemical Manufacturing", etc.]
- "financial services" → ["Financial Services", "Banking", "Capital Markets"]

Here is the complete list of valid LinkedIn industries:
${industryList}`;

      const userPrompt = userMessage 
        ? `User query: "${userMessage}"\n\nIndustry description: "${industryDescription}"\n\nIdentify all industries from the list that match this description.`
        : `Industry description: "${industryDescription}"\n\nIdentify all industries from the list that match this description.`;

      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
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
        totalFound: 0,
      };
    }
  }

}

