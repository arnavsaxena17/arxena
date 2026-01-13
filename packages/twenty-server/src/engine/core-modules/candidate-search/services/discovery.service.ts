import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  CompanyDiscoveryResult,
  InstituteDiscoveryResult,
  JobTitleDiscoveryResult,
  companyDiscoverySchema,
  instituteDiscoverySchema,
  jobTitleDiscoverySchema
} from '../schemas/discovery.schemas';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  // Cache for common discoveries to avoid repeated web searches
  private discoveryCache: Map<string, any> = new Map();

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  /**
   * Discover companies based on description and location
   * Uses web search to find companies matching the criteria
   */
  async discoverCompanies(
    description: string,
    apiToken: string,
    location?: string,
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
      const prompt = `Find companies that ${description}${locationContext}.

Search the web for companies matching this description. Return a comprehensive list of company names with their locations and industries when available.

Examples:
- "textile machinery manufacturing companies in Mumbai" → Find companies that manufacture textile machinery in Mumbai
- "ceramics insulators manufacturing companies" → Find companies that manufacture ceramics insulators
- "SaaS companies in Bangalore" → Find SaaS companies in Bangalore

Return structured data with company names, locations, and industries.`;

      const systemPrompt = `You are an expert at discovering companies through web search. Use web search to find companies matching the description and return structured results with company names, locations, and industries.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-search-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(companyDiscoverySchema, 'companyDiscovery'),
      });

      const content = completion.choices[0]?.message?.content;
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
  ): Promise<JobTitleDiscoveryResult> {
    const cacheKey = `jobTitles:${role.toLowerCase()}`;
    if (this.discoveryCache.has(cacheKey)) {
      this.logger.log(`Using cached job title discovery for: ${role}`);
      return this.discoveryCache.get(cacheKey);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const prompt = `Find job title variations, synonyms, and related titles for "${role}".

Search the web for:
- Alternative job titles used for this role
- Regional variations (especially for Indian market)
- Industry-specific variations
- Hierarchical variations (e.g., if searching for "pulmonologist", find: chest physician, lungs specialist, Pneumologist, Respirologist, respiratory physician, respirologist, etc.)

Return the most important and commonly used variations (limit to 10-20 unique variations to ensure completeness). Focus on variations that recruiters actually use when searching for this role.`;

      const systemPrompt = `You are an expert at discovering job title variations through web search. Use web search to find all synonyms, variations, and related titles for a given role, especially considering regional and industry-specific terminology.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-search-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(jobTitleDiscoverySchema, 'jobTitleDiscovery'),
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from job title discovery');
      }

      // Check if response was truncated
      const finishReason = completion.choices[0]?.finish_reason;
      if (finishReason === 'length') {
        this.logger.warn(`Job title discovery response was truncated for: ${role}`);
        throw new Error('Response truncated - too many variations generated');
      }

      // Validate JSON is complete before parsing
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        this.logger.error(`Invalid JSON in job title discovery response for: ${role}. Content length: ${content.length}`);
        throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

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
      const prompt = `Find ${type} educational institutes${domainContext}${locationContext}.

Search the web for educational institutes matching this description. Return a comprehensive list with institute names, types, locations, and domain specializations.

Examples:
- "tier-1 engineering institutes in India" → Find IITs, NITs, etc.
- "dairy management institutes" → Find IRMA (Anand), etc.
- "chemical engineering institutes" → Find UDCT, etc.
- "MBBS colleges" → Find medical colleges
- "tier-1 business schools in India" → Find IIMs, etc.

Return structured data with institute names, types, locations, and domain specializations.`;

      const systemPrompt = `You are an expert at discovering educational institutes through web search. Use web search to find institutes matching the type, domain, and location criteria, especially for Indian market (IIT, IIM, domain-specific institutes like IRMA for dairy, UDCT for chemical, etc.).`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-search-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(instituteDiscoverySchema, 'instituteDiscovery'),
      });

      const content = completion.choices[0]?.message?.content;
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


}

