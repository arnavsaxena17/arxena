import { Injectable, Logger } from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  CompanyDiscoveryResult,
  CompanyGroupExpansionResult,
  InstituteDiscoveryResult,
  JobTitleDiscoveryResult,
  companyDiscoverySchema,
  companyGroupExpansionSchema,
  instituteDiscoverySchema,
  jobTitleDiscoverySchema,
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

      const prompt = `Find all job title variations, synonyms, and related titles for "${role}".

Search the web for:
- Alternative job titles used for this role
- Regional variations (especially for Indian market)
- Industry-specific variations
- Hierarchical variations (e.g., if searching for "pulmonologist", find: chest physician, lungs specialist, Pneumologist, Respirologist, respiratory physician, respirologist, etc.)

Return a comprehensive list of all variations that recruiters might use when searching for this role.`;

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

      const parsed = JSON.parse(content);
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

  /**
   * Discover all companies that are part of a company group
   * Uses web search to find subsidiaries and group members
   */
  async discoverCompanyGroupMembers(
    groupName: string,
    apiToken: string,
  ): Promise<CompanyGroupExpansionResult> {
    const cacheKey = `companyGroup:${groupName.toLowerCase()}`;
    if (this.discoveryCache.has(cacheKey)) {
      this.logger.log(`Using cached company group expansion for: ${groupName}`);
      return this.discoveryCache.get(cacheKey);
    }

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const { openAIclient: openaiClient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);

      const prompt = `Find all companies that are part of the ${groupName} group.

Search the web for all subsidiaries, divisions, and companies that belong to the ${groupName} group. Return a comprehensive list of all companies in the group.

Examples:
- "Tata group" → Find all Tata companies (Tata Motors, Tata Steel, TCS, Tata Consultancy Services, etc.)
- "Birla group" → Find all Birla companies
- "Reliance group" → Find all Reliance companies

Return structured data with company names and their parent group. Include major subsidiaries and divisions.`;

      const systemPrompt = `You are an expert at discovering company group hierarchies through web search. Use web search to find all companies, subsidiaries, and divisions that belong to a given company group, especially for Indian conglomerates like Tata, Birla, Reliance, etc.`;

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-search-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(companyGroupExpansionSchema, 'companyGroupExpansion'),
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from company group expansion');
      }

      const parsed = JSON.parse(content);
      const result = companyGroupExpansionSchema.parse(parsed);

      // Cache the result
      this.discoveryCache.set(cacheKey, result);
      this.logger.log(`Discovered ${result.companies.length} companies in ${groupName} group`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to discover company group members: ${error}`);
      // Return empty result on error
      return {
        companies: [],
        groupName,
        totalCompanies: 0,
      };
    }
  }
}

