import { Injectable, Logger } from '@nestjs/common';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import { linkedinIndustryOptions } from '../schemas/classic-people-search.schema';

type ParameterCacheKey = string;
type ParameterCacheValue = {
  id: string;
  title: string;
};

type ParameterType = 'LOCATION' | 'INDUSTRY' | 'COMPANY' | 'SCHOOL';

type ParameterConfig = {
  type: ParameterType;
  serviceMethod: 'getLocationParameters' | 'getIndustryParameters' | 'getCompanyParameters' | 'getSchoolParameters';
  findMatchMethod: 'findBestLocationMatch' | 'findBestMatch';
  defaultSearchLimit: number;
  knownOptionsCheck?: (name: string) => boolean;
  broaderSearchLimit?: number;
};

type ResolvedParameterItem = {
  id: string;
  title: string;
};

@Injectable()
export class LinkedinParameterResolver {
  private readonly logger = new Logger(LinkedinParameterResolver.name);
  
  // In-memory cache for resolved parameters: {type}_{name} -> {id, title}
  // Note: LinkedIn parameter IDs are the same across accounts, so accountId is not needed
  private readonly parameterCache = new Map<ParameterCacheKey, ParameterCacheValue>();

  private readonly parameterConfigs: Record<string, ParameterConfig> = {
    industry: {
      type: 'INDUSTRY',
      serviceMethod: 'getIndustryParameters',
      findMatchMethod: 'findBestMatch',
      defaultSearchLimit: 20,
      knownOptionsCheck: (name: string) => 
        linkedinIndustryOptions.some(opt => opt.toLowerCase() === name.toLowerCase()),
      broaderSearchLimit: 100,
    },
    location: {
      type: 'LOCATION',
      serviceMethod: 'getLocationParameters',
      findMatchMethod: 'findBestLocationMatch',
      defaultSearchLimit: 20,
    },
    company: {
      type: 'COMPANY',
      serviceMethod: 'getCompanyParameters',
      findMatchMethod: 'findBestMatch',
      defaultSearchLimit: 20,
    },
    school: {
      type: 'SCHOOL',
      serviceMethod: 'getSchoolParameters',
      findMatchMethod: 'findBestMatch',
      defaultSearchLimit: 20,
    },
  };

  constructor(private readonly linkedInSearchService: LinkedInSearchService) {}

  /**
   * Check if a parameter value is already a LinkedIn ID (numeric string or URN)
   */
  private isAlreadyResolvedId(value: any): boolean {
    return typeof value === 'string' && 
           (!!value.match(/^\d+$/) || value.includes('urn:li:'));
  }

  /**
   * Generate cache key for parameter resolution
   * Note: LinkedIn parameter IDs are the same across accounts, so accountId is not needed in the cache key
   */
  private getCacheKey(type: ParameterType, name: string): ParameterCacheKey {
    return `${type}_${name.toLowerCase().trim()}`;
  }

  /**
   * Get cached parameter resolution if available
   */
  private getCachedParameter(type: ParameterType, name: string): ParameterCacheValue | null {
    const cacheKey = this.getCacheKey(type, name);
    return this.parameterCache.get(cacheKey) || null;
  }

  /**
   * Cache parameter resolution
   */
  private cacheParameter(type: ParameterType, name: string, value: ParameterCacheValue): void {
    const cacheKey = this.getCacheKey(type, name);
    this.parameterCache.set(cacheKey, value);
  }

  /**
   * Get existing display information for a parameter ID
   */
  private getExistingDisplay(
    searchParameters: any,
    parameterKey: string,
    id: string,
  ): { id: string; title: string } | null {
    const displayKey = `${parameterKey}_display`;
    const displayArray = searchParameters[displayKey];
    if (Array.isArray(displayArray)) {
      return displayArray.find((d: { id: string }) => d.id === id) || null;
    }
    return null;
  }

  /**
   * Call the appropriate LinkedIn service method based on config
   */
  private async callServiceMethod(
    config: ParameterConfig,
    accountId: string,
    searchTerm: string,
    limit: number,
  ): Promise<{ items: Array<{ id: string; title: string }> }> {
    switch (config.serviceMethod) {
      case 'getLocationParameters':
        return await this.linkedInSearchService.getLocationParameters(accountId, searchTerm, limit);
      case 'getIndustryParameters':
        return await this.linkedInSearchService.getIndustryParameters(accountId, searchTerm, limit);
      case 'getCompanyParameters':
        return await this.linkedInSearchService.getCompanyParameters(accountId, searchTerm, limit);
      case 'getSchoolParameters':
        return await this.linkedInSearchService.getSchoolParameters(accountId, searchTerm, limit);
      default:
        throw new Error(`Unknown service method: ${config.serviceMethod}`);
    }
  }

  /**
   * Call the appropriate find match method based on config
   */
  private callFindMatchMethod(
    config: ParameterConfig,
    items: Array<{ id: string; title: string }>,
    searchTerm: string,
  ): { id: string; title: string } | null {
    switch (config.findMatchMethod) {
      case 'findBestLocationMatch':
        return this.findBestLocationMatch(items, searchTerm);
      case 'findBestMatch':
        return this.findBestMatch(items, searchTerm);
      default:
        throw new Error(`Unknown find match method: ${config.findMatchMethod}`);
    }
  }

  /**
   * Resolve a single parameter item to its LinkedIn ID
   */
  private async resolveParameterItem(
    item: string,
    config: ParameterConfig,
    accountId: string,
    strategyId: string | undefined,
    searchParameters: any,
    parameterKey: string,
    includeDisplay: boolean = true,
  ): Promise<ResolvedParameterItem | null> {
    // Skip if already an ID
    if (this.isAlreadyResolvedId(item)) {
      const existingDisplay = includeDisplay 
        ? this.getExistingDisplay(searchParameters, parameterKey, item)
        : null;
      return {
        id: item,
        title: existingDisplay?.title || item,
      };
    }

    try {
      // Check cache first
      const cached = this.getCachedParameter(config.type, item);
      if (cached) {
        this.logger.log(
          `[Strategy: ${strategyId}] Resolved ${parameterKey} "${item}" to "${cached.title}" (${cached.id}) [CACHED]`,
        );
        return cached;
      }

      // Determine search limit
      const isKnown = config.knownOptionsCheck?.(item) ?? false;
      const searchLimit = isKnown ? (config.broaderSearchLimit ?? 100) : config.defaultSearchLimit;

      // Fetch parameters from LinkedIn API
      const params = await this.callServiceMethod(config, accountId, item, searchLimit);
      
      // Find best match
      let matchingItem = this.callFindMatchMethod(config, params.items, item);

      // If it's a known option but not found, try broader search
      if (!matchingItem && isKnown && config.broaderSearchLimit) {
        this.logger.log(
          `[Strategy: ${strategyId}] Known ${parameterKey} "${item}" not found in search results, trying broader search`,
        );
        const allParams = await this.callServiceMethod(config, accountId, '', config.broaderSearchLimit);
        matchingItem = allParams.items.find(
          (paramItem) => paramItem.title.toLowerCase() === item.toLowerCase(),
        ) || null;
        if (matchingItem) {
          this.logger.log(
            `[Strategy: ${strategyId}] Resolved ${parameterKey} "${item}" to "${matchingItem.title}" (${matchingItem.id}) via broader search`,
          );
        } else {
          this.logger.warn(
            `[Strategy: ${strategyId}] Known ${parameterKey} "${item}" not found even in broader search`,
          );
        }
      }

      if (matchingItem) {
        const resolved = {
          id: matchingItem.id,
          title: matchingItem.title,
        };
        // Cache the result
        this.cacheParameter(config.type, item, resolved);
        this.logger.log(
          `[Strategy: ${strategyId}] Resolved ${parameterKey} "${item}" to "${matchingItem.title}" (${matchingItem.id})`,
        );
        return resolved;
      }

      this.logger.warn(`[Strategy: ${strategyId}] No match found for ${parameterKey}: ${item}`);
      return null;
    } catch (error) {
      this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve ${parameterKey}: ${item}`, error);
      return null;
    }
  }

  /**
   * Resolve an array of parameters (Classic format)
   */
  private async resolveParameterArray(
    items: string[],
    config: ParameterConfig,
    accountId: string,
    strategyId: string | undefined,
    searchParameters: any,
    parameterKey: string,
  ): Promise<{ ids: string[]; display: Array<{ id: string; title: string }> }> {
    const ids: string[] = [];
    const display: Array<{ id: string; title: string }> = [];

    for (const item of items) {
      const resolved = await this.resolveParameterItem(
        item,
        config,
        accountId,
        strategyId,
        searchParameters,
        parameterKey,
        true,
      );
      if (resolved) {
        ids.push(resolved.id);
        display.push({ id: resolved.id, title: resolved.title });
      }
    }

    return { ids, display };
  }

  /**
   * Resolve include/exclude format parameters (Sales Navigator/Recruiter format)
   */
  private async resolveIncludeExcludeParameter(
    parameter: { include?: string[]; exclude?: string[] },
    config: ParameterConfig,
    accountId: string,
    strategyId: string | undefined,
    searchParameters: any,
    parameterKey: string,
  ): Promise<{ include: string[] | null; exclude: string[] | null; display?: Array<{ id: string; title: string }> }> {
    const result: {
      include: string[] | null;
      exclude: string[] | null;
      display?: Array<{ id: string; title: string }>;
    } = {
      include: null,
      exclude: null,
    };

    // Resolve include array
    if (Array.isArray(parameter.include) && parameter.include.length > 0) {
      const includeResolved = await this.resolveParameterArray(
        parameter.include,
        config,
        accountId,
        strategyId,
        searchParameters,
        parameterKey,
      );
      result.include = includeResolved.ids.length > 0 ? includeResolved.ids : null;
      result.display = includeResolved.display.length > 0 ? includeResolved.display : undefined;
    }

    // Resolve exclude array (no display needed for exclude)
    if (Array.isArray(parameter.exclude) && parameter.exclude.length > 0) {
      const excludeIds: string[] = [];
      for (const item of parameter.exclude) {
        const resolved = await this.resolveParameterItem(
          item,
          config,
          accountId,
          strategyId,
          searchParameters,
          parameterKey,
          false,
        );
        if (resolved) {
          excludeIds.push(resolved.id);
        }
      }
      result.exclude = excludeIds.length > 0 ? excludeIds : null;
    }

    return result;
  }

  /**
   * Resolve parameter names to LinkedIn IDs for search parameters
   */
  async resolveParameterIds(
    searchParameters: any,
    accountId: string,
    strategyId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`[Strategy: ${strategyId}] Resolving parameter IDs for search parameters`);
      
      if (!searchParameters) {
        this.logger.warn(`[Strategy: ${strategyId}] Search parameters are null or undefined, returning empty object`);
        return {};
      }
      
      const resolvedParameters = { ...searchParameters } as any;
      
      // Check if parameters are already resolved (contain LinkedIn IDs)
      const areParametersResolved = this.checkIfParametersResolved(searchParameters);
      
      if (areParametersResolved) {
        this.logger.log(`[Strategy: ${strategyId}] Parameters are already resolved, preserving display information`);
        return this.preserveDisplayInformation(searchParameters, accountId);
      }

      // Resolve each parameter type
      const parameterKeys = ['industry', 'location', 'company', 'school', 'past_company'];
      
      for (const parameterKey of parameterKeys) {
        const parameterValue = searchParameters[parameterKey];
        if (!parameterValue) continue;

        // Determine config (past_company uses COMPANY config)
        const configKey = parameterKey === 'past_company' ? 'company' : parameterKey;
        const config = this.parameterConfigs[configKey];
        if (!config) continue;

        // Handle Classic format (flat array)
        if (Array.isArray(parameterValue)) {
          const resolved = await this.resolveParameterArray(
            parameterValue,
            config,
            accountId,
            strategyId,
            searchParameters,
            parameterKey,
          );
          resolvedParameters[parameterKey] = resolved.ids.length > 0 ? resolved.ids : undefined;
          const displayKey = `${parameterKey}_display`;
          resolvedParameters[displayKey] = resolved.display.length > 0 ? resolved.display : undefined;
        }
        // Handle Sales Navigator/Recruiter format (include/exclude objects)
        else if (parameterValue.include || parameterValue.exclude) {
          const resolved = await this.resolveIncludeExcludeParameter(
            parameterValue,
            config,
            accountId,
            strategyId,
            searchParameters,
            parameterKey,
          );
          resolvedParameters[parameterKey] = {
            ...parameterValue,
            include: resolved.include,
            exclude: resolved.exclude,
          };
          if (resolved.display) {
            const displayKey = `${parameterKey}_display`;
            resolvedParameters[displayKey] = resolved.display;
          }
        }
      }

      this.logger.log(`[Strategy: ${strategyId}] Completed resolving parameter IDs`);
      return resolvedParameters;
    } catch (error) {
      this.logger.error(`[Strategy: ${strategyId}] Failed to resolve parameter IDs`, error);
      throw error;
    }
  }

  /**
   * Check if parameters are already resolved (contain LinkedIn IDs)
   */
  private checkIfParametersResolved(params: any): boolean {
    if (!params) return false;
    
    // Check if any parameter arrays contain LinkedIn IDs (typically numeric strings)
    const checkArray = (arr: any[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(item => 
        typeof item === 'string' && 
        (item.match(/^\d+$/) || item.includes('urn:li:'))
      );
    };
    
    // Check Classic format (flat arrays)
    const classicResolved = checkArray(params.industry) || 
                           checkArray(params.location) || 
                           checkArray(params.company) || 
                           checkArray(params.school) ||
                           checkArray(params.past_company);
    
    if (classicResolved) return true;
    
    // Check Sales Navigator/Recruiter format (include/exclude objects)
    const checkIncludeExclude = (param: any): boolean => {
      if (!param || typeof param !== 'object') return false;
      return checkArray(param.include) || checkArray(param.exclude);
    };
    
    const salesNavigatorResolved = checkIncludeExclude(params.industry) ||
                                  checkIncludeExclude(params.location) ||
                                  checkIncludeExclude(params.company) ||
                                  checkIncludeExclude(params.school) ||
                                  checkIncludeExclude(params.past_company);
    
    return salesNavigatorResolved;
  }

  /**
   * Preserve display information for already-resolved parameters
   */
  private async preserveDisplayInformation(params: any, accountId: string): Promise<any> {
    const preservedParams = { ...params };
    
    // If display information is missing, try to fetch it
    if (params.industry && Array.isArray(params.industry) && !params.industry_display) {
      const industryDisplay: Array<{ id: string; title: string }> = [];
      for (const industryId of params.industry) {
        try {
          // Try to get the industry name from LinkedIn API
          // Note: LinkedIn API has a maximum limit of 100
          const industryParams = await this.linkedInSearchService.getIndustryParameters(
            accountId,
            '', // Empty search to get all industries
            10 // Maximum allowed limit
          );
          const matchingIndustry = industryParams.items.find(item => item.id === industryId);
          if (matchingIndustry) {
            industryDisplay.push({ id: matchingIndustry.id, title: matchingIndustry.title });
          } else {
            // Fallback to using the ID as title
            industryDisplay.push({ id: industryId, title: industryId });
          }
        } catch (error) {
          this.logger.warn(`Failed to get industry display for ID ${industryId}:`, error);
          industryDisplay.push({ id: industryId, title: industryId });
        }
      }
      preservedParams.industry_display = industryDisplay;
    }
    
    // Similar logic for other parameter types...
    // For now, just preserve existing display information or use IDs as fallback
    if (params.location && Array.isArray(params.location) && !params.location_display) {
      preservedParams.location_display = params.location.map((id: string) => ({ id, title: id }));
    }
    if (params.company && Array.isArray(params.company) && !params.company_display) {
      preservedParams.company_display = params.company.map((id: string) => ({ id, title: id }));
    }
    if (params.school && Array.isArray(params.school) && !params.school_display) {
      preservedParams.school_display = params.school.map((id: string) => ({ id, title: id }));
    }
    
    return preservedParams;
  }

  /**
   * Find the best matching location from a list of LinkedIn location parameters
   * Prioritizes locations that include "region" or "area" in their name
   */
  private findBestLocationMatch(items: any[], searchTerm: string): any | null {
    if (!items || items.length === 0) {
      return null;
    }

    const regionOrAreaLocations = items.filter(item => {
      const title = item.title?.toLowerCase() || '';
      return title.includes('region') || title.includes('area');
    });

    if (regionOrAreaLocations.length > 0) {
      return this.findBestMatch(regionOrAreaLocations, searchTerm);
    }
    return this.findBestMatch(items, searchTerm);
  }

  /**
   * Find the best matching parameter from a list of LinkedIn parameters
   */
  private findBestMatch(items: any[], searchTerm: string): any | null {
    if (!items || items.length === 0) {
      return null;
    }

    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    
    // First, try exact match
    let exactMatch = items.find(item => 
      item.title.toLowerCase() === normalizedSearchTerm
    );
    if (exactMatch) {
      return exactMatch;
    }

    // Then try starts with match
    let startsWithMatch = items.find(item => 
      item.title.toLowerCase().startsWith(normalizedSearchTerm) ||
      normalizedSearchTerm.startsWith(item.title.toLowerCase())
    );
    if (startsWithMatch) {
      return startsWithMatch;
    }

    // Then try contains match
    let containsMatch = items.find(item => 
      item.title.toLowerCase().includes(normalizedSearchTerm) ||
      normalizedSearchTerm.includes(item.title.toLowerCase())
    );
    if (containsMatch) {
      return containsMatch;
    }

    // Finally, try fuzzy matching with word boundaries
    const searchWords = normalizedSearchTerm.split(/\s+/);
    let bestMatch = null;
    let bestScore = 0;

    for (const item of items) {
      const itemWords = item.title.toLowerCase().split(/\s+/);
      let score = 0;
      
      for (const searchWord of searchWords) {
        for (const itemWord of itemWords) {
          if (itemWord.includes(searchWord) || searchWord.includes(itemWord)) {
            score += 1;
          }
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    // Only return if we have a reasonable match (at least 1 word match)
    return bestScore > 0 ? bestMatch : null;
  }
}
