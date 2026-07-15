import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LinkedInSearchService } from '../../linkedin-search/services/linkedin-search.service';
import { linkedinIndustryOptions } from '../schemas/linkedin-classic-people-search.schema';
import { normalizeLlmNullishString } from '../schemas/org-chart.schema';

type ParameterCacheKey = string;
type ParameterCacheValue = {
  id: string;
  title: string;
} | null; // null represents "not found" to cache negative results

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

type LinkedinParameterMatchItem = {
  id: string;
  title: string;
};

const normalizeParameterMatchText = (value: string): string =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const findBestLinkedinParameterMatch = (
  items: LinkedinParameterMatchItem[],
  searchTerm: string,
): LinkedinParameterMatchItem | null => {
  if (items.length === 0) {
    return null;
  }

  const normalizedSearchTerm = normalizeParameterMatchText(searchTerm);
  if (!normalizedSearchTerm) {
    return null;
  }

  const normalizedItems = items.map((item) => ({
    item,
    normalizedTitle: normalizeParameterMatchText(item.title),
  }));
  const exactMatch = normalizedItems.find(
    ({ normalizedTitle }) => normalizedTitle === normalizedSearchTerm,
  );
  if (exactMatch) {
    return exactMatch.item;
  }

  const searchWords = new Set(
    normalizedSearchTerm.split(' ').filter((word) => word.length > 1),
  );
  if (searchWords.size === 0) {
    return null;
  }

  let bestMatch: LinkedinParameterMatchItem | null = null;
  let bestMatchedWordCount = 0;
  let bestPrecision = 0;

  for (const { item, normalizedTitle } of normalizedItems) {
    const itemWords = new Set(
      normalizedTitle.split(' ').filter((word) => word.length > 1),
    );
    const matchedWordCount = [...searchWords].filter((word) =>
      itemWords.has(word),
    ).length;
    const precision =
      itemWords.size > 0 ? matchedWordCount / itemWords.size : 0;

    if (
      matchedWordCount > bestMatchedWordCount ||
      (matchedWordCount === bestMatchedWordCount && precision > bestPrecision)
    ) {
      bestMatch = item;
      bestMatchedWordCount = matchedWordCount;
      bestPrecision = precision;
    }
  }

  return bestMatchedWordCount > 0 ? bestMatch : null;
};

@Injectable()
export class LinkedinParameterResolver implements OnModuleDestroy {
  private readonly logger = new Logger(LinkedinParameterResolver.name);
  
  // In-memory cache for resolved parameters: {type}_{name} -> {id, title}
  // Note: LinkedIn parameter IDs are the same across accounts, so accountId is not needed
  private readonly parameterCache = new Map<ParameterCacheKey, ParameterCacheValue>();
  
  // Cache file path for persistence
  private readonly cacheFilePath: string;
  
  // Debounce timer for saving cache to disk
  private saveCacheTimer: NodeJS.Timeout | null = null;
  private readonly saveCacheDelayMs = 5000; // Save 5 seconds after last update

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

  constructor(private readonly linkedInSearchService: LinkedInSearchService) {
    // Set cache file path in a cache directory
    const cacheDir = path.join(process.cwd(), '.cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    this.cacheFilePath = path.join(cacheDir, 'linkedin-parameter-cache.json');
    
    // Load cache from disk on initialization
    this.loadCacheFromDisk();
  }

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
   * Returns the cached value (which may be null for "not found" results)
   */
  private getCachedParameter(type: ParameterType, name: string): ParameterCacheValue | undefined {
    const cacheKey = this.getCacheKey(type, name);
    return this.parameterCache.get(cacheKey);
  }

  /**
   * Cache parameter resolution (including null for "not found" results)
   */
  private cacheParameter(type: ParameterType, name: string, value: ParameterCacheValue): void {
    const cacheKey = this.getCacheKey(type, name);
    this.parameterCache.set(cacheKey, value);
    // Schedule saving cache to disk (debounced)
    this.scheduleCacheSave();
  }
  
  /**
   * Load cache from disk file
   */
  private loadCacheFromDisk(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const fileContent = fs.readFileSync(this.cacheFilePath, 'utf-8');
        const cacheData: Record<string, ParameterCacheValue> = JSON.parse(fileContent);
        
        // Restore cache entries
        let loadedCount = 0;
        for (const [key, value] of Object.entries(cacheData)) {
          // Handle null values (negative cache entries)
          this.parameterCache.set(key, value === null ? null : value);
          loadedCount++;
        }
        
        this.logger.log(`Loaded ${loadedCount} parameter cache entries from disk`);
      } else {
        this.logger.log('No existing parameter cache file found, starting with empty cache');
      }
    } catch (error) {
      this.logger.warn(`Failed to load parameter cache from disk: ${error.message}`);
      // Continue with empty cache if loading fails
    }
  }
  
  /**
   * Save cache to disk file (debounced)
   */
  private scheduleCacheSave(): void {
    // Clear existing timer
    if (this.saveCacheTimer) {
      clearTimeout(this.saveCacheTimer);
    }
    
    // Schedule save after delay
    this.saveCacheTimer = setTimeout(() => {
      this.saveCacheToDisk();
    }, this.saveCacheDelayMs);
  }
  
  /**
   * Save cache to disk file
   */
  private saveCacheToDisk(): void {
    try {
      // Convert Map to plain object for JSON serialization
      const cacheData: Record<string, ParameterCacheValue> = {};
      for (const [key, value] of this.parameterCache.entries()) {
        cacheData[key] = value;
      }
      
      // Write to file atomically (write to temp file then rename)
      const tempFilePath = `${this.cacheFilePath}.tmp`;
      fs.writeFileSync(tempFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
      fs.renameSync(tempFilePath, this.cacheFilePath);
      
      this.logger.log(`Saved ${this.parameterCache.size} parameter cache entries to disk`);
    } catch (error) {
      this.logger.warn(`Failed to save parameter cache to disk: ${error.message}`);
    }
  }
  
  /**
   * Save cache on module destruction
   */
  onModuleDestroy(): void {
    // Clear any pending save timer
    if (this.saveCacheTimer) {
      clearTimeout(this.saveCacheTimer);
      this.saveCacheTimer = null;
    }
    
    // Save cache immediately on shutdown
    this.saveCacheToDisk();
    this.logger.log('Parameter cache saved to disk on module destruction');
  }

  listCacheEntries(): Array<{
    cacheKey: string;
    parameterType: string;
    searchTerm: string;
    linkedinId: string | null;
    linkedinTitle: string | null;
    notFound: boolean;
  }> {
    const entries: Array<{
      cacheKey: string;
      parameterType: string;
      searchTerm: string;
      linkedinId: string | null;
      linkedinTitle: string | null;
      notFound: boolean;
    }> = [];

    for (const [cacheKey, value] of this.parameterCache.entries()) {
      const parsed = this.parseCacheKey(cacheKey);
      entries.push({
        cacheKey,
        parameterType: parsed.parameterType,
        searchTerm: parsed.searchTerm,
        linkedinId: value?.id ?? null,
        linkedinTitle: value?.title ?? null,
        notFound: value === null,
      });
    }

    return entries.sort((left, right) =>
      left.cacheKey.localeCompare(right.cacheKey),
    );
  }

  deleteCacheEntry(cacheKey: string): boolean {
    const normalizedKey = cacheKey.trim();
    if (!normalizedKey || !this.parameterCache.has(normalizedKey)) {
      return false;
    }

    this.parameterCache.delete(normalizedKey);
    this.saveCacheToDisk();
    this.logger.log(`Deleted LinkedIn parameter cache entry: ${normalizedKey}`);
    return true;
  }

  clearCache(): number {
    const deletedCount = this.parameterCache.size;
    this.parameterCache.clear();
    this.saveCacheToDisk();
    this.logger.log(`Cleared ${deletedCount} LinkedIn parameter cache entries`);
    return deletedCount;
  }

  private parseCacheKey(cacheKey: string): {
    parameterType: string;
    searchTerm: string;
  } {
    const knownTypes: ParameterType[] = [
      'LOCATION',
      'INDUSTRY',
      'COMPANY',
      'SCHOOL',
    ];

    for (const parameterType of knownTypes) {
      const prefix = `${parameterType}_`;
      if (cacheKey.startsWith(prefix)) {
        return {
          parameterType,
          searchTerm: cacheKey.slice(prefix.length),
        };
      }
    }

    return {
      parameterType: 'UNKNOWN',
      searchTerm: cacheKey,
    };
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
      // Check cache first (including negative results)
      const cached = this.getCachedParameter(config.type, item);
      if (cached !== undefined) {
        if (cached === null) {
          // Cached negative result - location was not found before
          this.logger.log(
            `[Strategy: ${strategyId}] ${parameterKey} "${item}" not found [CACHED - no match]`,
          );
          return null;
        }
        // Cached positive result
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
        // Cache the positive result
        this.cacheParameter(config.type, item, resolved);
        this.logger.log(
          `[Strategy: ${strategyId}] Resolved ${parameterKey} "${item}" to "${matchingItem.title}" (${matchingItem.id})`,
        );
        return resolved;
      }

      // Cache the negative result (null) to avoid repeated API calls
      this.cacheParameter(config.type, item, null);
      this.logger.warn(`[Strategy: ${strategyId}] No match found for ${parameterKey}: ${item} [CACHED]`);
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
      if (normalizeLlmNullishString(item) === null) {
        continue;
      }
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
   * Resolve recruiter location format (array of objects with id, priority, scope, title)
   */
  private async resolveRecruiterLocationArray(
    items: Array<{ id?: string; priority?: string; scope?: string; title?: string }>,
    config: ParameterConfig,
    accountId: string,
    strategyId: string | undefined,
    searchParameters: any,
    parameterKey: string,
  ): Promise<Array<{ id: string; priority: string; scope: string; title?: string }>> {
    const resolved: Array<{ id: string; priority: string; scope: string; title?: string }> = [];

    for (const item of items) {
      // If id is already a LinkedIn ID (numeric string), use it directly
      if (item.id && this.isAlreadyResolvedId(item.id)) {
        resolved.push({
          id: item.id,
          priority: item.priority || 'CAN_HAVE',
          scope: item.scope || 'CURRENT',
          title: item.title,
        });
        continue;
      }

      // Otherwise, resolve the id field (which should be a location name)
      const locationName = item.id || item.title || '';
      if (!locationName) {
        this.logger.warn(`[Strategy: ${strategyId}] Skipping ${parameterKey} item with no id or title`);
        continue;
      }

      const resolvedItem = await this.resolveParameterItem(
        locationName,
        config,
        accountId,
        strategyId,
        searchParameters,
        parameterKey,
        false, // Don't include display for recruiter format
      );

      if (resolvedItem) {
        resolved.push({
          id: resolvedItem.id,
          priority: item.priority || 'CAN_HAVE',
          scope: item.scope || 'CURRENT',
          title: resolvedItem.title,
        });
      } else {
        this.logger.warn(`[Strategy: ${strategyId}] Failed to resolve ${parameterKey}: ${locationName}`);
      }
    }

    return resolved;
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

        // Handle Classic format (flat array of strings)
        if (Array.isArray(parameterValue) && parameterValue.length > 0) {
          // Check if it's recruiter location format (array of objects with id field)
          const isRecruiterLocationFormat = parameterKey === 'location' && 
            typeof parameterValue[0] === 'object' && 
            parameterValue[0] !== null &&
            ('id' in parameterValue[0] || 'title' in parameterValue[0]);
          
          if (isRecruiterLocationFormat) {
            const resolved = await this.resolveRecruiterLocationArray(
              parameterValue as Array<{ id?: string; priority?: string; scope?: string; title?: string }>,
              config,
              accountId,
              strategyId,
              searchParameters,
              parameterKey,
            );
            resolvedParameters[parameterKey] = resolved.length > 0 ? resolved : undefined;
          } else {
            // Classic format: array of strings
            const resolved = await this.resolveParameterArray(
              parameterValue as string[],
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
  private findBestMatch(
    items: LinkedinParameterMatchItem[],
    searchTerm: string,
  ): LinkedinParameterMatchItem | null {
    return findBestLinkedinParameterMatch(items, searchTerm);
  }
}
