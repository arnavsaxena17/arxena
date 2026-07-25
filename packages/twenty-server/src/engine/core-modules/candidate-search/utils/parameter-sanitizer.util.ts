import { Logger } from '@nestjs/common';
import {
    LinkedInClassicCompaniesSearchRequest,
    LinkedInClassicJobsSearchRequest,
    LinkedInClassicPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';

type IncludeExcludeStringIds = {
  include?: string[];
  exclude?: string[];
};

export class ParameterSanitizer {
  private readonly logger = new Logger(ParameterSanitizer.name);

  /**
   * Normalize Sales Navigator / Recruiter include/exclude filters.
   * Accepts either a flat numeric-id array or an existing { include, exclude } object.
   */
  private sanitizeIncludeExcludeNumericIds(
    value: unknown,
  ): IncludeExcludeStringIds | undefined {
    if (Array.isArray(value) && value.length > 0) {
      const validIds = value.filter(
        (id): id is string => typeof id === 'string' && /^\d+$/.test(id),
      );
      if (validIds.length > 0) {
        return { include: validIds, exclude: [] };
      }
      return undefined;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const param = value as { include?: unknown; exclude?: unknown };
    if (!param.include && !param.exclude) {
      return undefined;
    }

    const result: IncludeExcludeStringIds = {};

    if (Array.isArray(param.include) && param.include.length > 0) {
      const validIncludeIds = param.include.filter(
        (id): id is string => typeof id === 'string' && /^\d+$/.test(id),
      );
      if (validIncludeIds.length > 0) {
        result.include = validIncludeIds;
      }
    }

    if (Array.isArray(param.exclude) && param.exclude.length > 0) {
      const validExcludeIds = param.exclude.filter(
        (id): id is string => typeof id === 'string' && /^\d+$/.test(id),
      );
      if (validExcludeIds.length > 0) {
        result.exclude = validExcludeIds;
      }
    }

    if (result.include || result.exclude) {
      return result;
    }

    return undefined;
  }

  private sanitizeSalesNavigatorSeniority(
    value: unknown,
  ): IncludeExcludeStringIds | undefined {
    const validSeniorityValues = [
      'owner/partner',
      'cxo',
      'vice_president',
      'director',
      'experienced_manager',
      'entry_level_manager',
      'strategic',
      'senior',
      'entry_level',
      'in_training',
    ];

    if (Array.isArray(value) && value.length > 0) {
      const validValues = value.filter(
        (val): val is string =>
          typeof val === 'string' && validSeniorityValues.includes(val),
      );
      if (validValues.length > 0) {
        return { include: validValues, exclude: [] };
      }
      return undefined;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const param = value as { include?: unknown; exclude?: unknown };
    if (!param.include && !param.exclude) {
      return undefined;
    }

    const result: IncludeExcludeStringIds = {};

    if (Array.isArray(param.include) && param.include.length > 0) {
      const validIncludeValues = param.include.filter(
        (val): val is string =>
          typeof val === 'string' && validSeniorityValues.includes(val),
      );
      if (validIncludeValues.length > 0) {
        result.include = validIncludeValues;
      }
    }

    if (Array.isArray(param.exclude) && param.exclude.length > 0) {
      const validExcludeValues = param.exclude.filter(
        (val): val is string =>
          typeof val === 'string' && validSeniorityValues.includes(val),
      );
      if (validExcludeValues.length > 0) {
        result.exclude = validExcludeValues;
      }
    }

    if (result.include || result.exclude) {
      return result;
    }

    return undefined;
  }

  private assignIncludeExcludeNumericIds(
    sanitized: Record<string, unknown>,
    key: string,
    value: unknown,
  ): void {
    const normalized = this.sanitizeIncludeExcludeNumericIds(value);
    if (normalized) {
      sanitized[key] = normalized;
    }
  }

  /**
   * Format keywords string by wrapping multi-word terms in quotes
   * This ensures proper parsing by LinkedIn's search API
   * Also ensures proper grouping with parentheses when multiple terms are OR'd together
   * Example: "Pulmonologist OR Consultant Pulmonologist" -> "Pulmonologist OR \"Consultant Pulmonologist\""
   * Example: "Pulmonologist OR Consultant Pulmonologist OR Senior Pulmonologist" -> "(Pulmonologist OR \"Consultant Pulmonologist\" OR \"Senior Pulmonologist\")"
   */
  formatKeywordsWithQuotes(keywords: string, depth: number = 0): string {
    if (!keywords || typeof keywords !== 'string') {
      return keywords;
    }

    // Prevent infinite recursion
    if (depth > 10) {
      return keywords;
    }

    const trimmed = keywords.trim();
    
    // If the entire expression is wrapped in parentheses, handle it specially to avoid recursion
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      // Check if it's a complete outer group
      let parenDepth = 0;
      let isCompleteGroup = true;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '(') parenDepth++;
        if (trimmed[i] === ')') parenDepth--;
        if (parenDepth === 0 && i < trimmed.length - 1) {
          isCompleteGroup = false;
          break;
        }
      }
      if (isCompleteGroup && parenDepth === 0) {
        // It's a complete outer group, format the inside (without adding outer brackets again)
        const inside = trimmed.substring(1, trimmed.length - 1).trim();
        const formattedInside = this.formatQuotesInKeywords(inside, depth + 1);
        // Don't call ensureProperGrouping since it's already grouped
        return `(${formattedInside})`;
      }
    }

    // First, format quotes for multi-word terms
    let formatted = this.formatQuotesInKeywords(trimmed, depth);
    
    // Then, ensure proper grouping with parentheses if multiple terms exist (only at top level)
    if (depth === 0) {
      formatted = this.ensureProperGrouping(formatted);
    }
    
    return formatted;
  }

  /**
   * Format quotes for multi-word terms in keywords string
   */
  private formatQuotesInKeywords(keywords: string, depth: number = 0): string {
    const trimmed = keywords.trim();
    
    // Check if the entire expression is wrapped in parentheses first
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      let parenDepth = 0;
      let isCompleteGroup = true;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '(') parenDepth++;
        if (trimmed[i] === ')') parenDepth--;
        if (parenDepth === 0 && i < trimmed.length - 1) {
          isCompleteGroup = false;
          break;
        }
      }
      if (isCompleteGroup && parenDepth === 0) {
        // It's a complete outer group, format the inside
        const inside = trimmed.substring(1, trimmed.length - 1).trim();
        const formattedInside = this.formatQuotesInKeywords(inside, depth + 1);
        return `(${formattedInside})`;
      }
    }
    
    // Split by boolean operators (OR, AND, NOT) while preserving them
    // But be careful not to split inside parentheses
    const parts = this.splitByOperatorsRespectingParentheses(trimmed);
    
    // Process each part - if it contains spaces and isn't already quoted, wrap it in quotes
    const formattedParts = parts.map((part, index) => {
      // Skip boolean operators (they appear at odd indices after split)
      if (index % 2 === 1) {
        return part.toUpperCase(); // Normalize operators to uppercase
      }

      // Check if this part is already quoted
      const partTrimmed = part.trim();
      if (partTrimmed.startsWith('"') && partTrimmed.endsWith('"')) {
        return part; // Already quoted, return as is
      }

      // Check if this part contains parentheses (grouped expression)
      if (partTrimmed.includes('(') || partTrimmed.includes(')')) {
        // Handle grouped expressions - format recursively
        return this.formatGroupedExpression(partTrimmed, depth + 1);
      }

      // If the part contains spaces, it's a multi-word term - wrap in quotes
      if (partTrimmed.includes(' ') && partTrimmed.length > 0) {
        return `"${partTrimmed}"`;
      }

      return part; // Single word, return as is
    });

    return formattedParts.join(' ');
  }

  /**
   * Split string by boolean operators while respecting parentheses
   * Doesn't split operators that are inside parentheses
   */
  private splitByOperatorsRespectingParentheses(str: string): string[] {
    const parts: string[] = [];
    let currentPart = '';
    let depth = 0;
    let i = 0;

    while (i < str.length) {
      const char = str[i];
      
      if (char === '(') {
        depth++;
        currentPart += char;
      } else if (char === ')') {
        depth--;
        currentPart += char;
      } else if (depth === 0) {
        // Check if we're at the start of an operator
        const remaining = str.substring(i);
        const orMatch = remaining.match(/^\s+(OR)\s+/i);
        const andMatch = remaining.match(/^\s+(AND)\s+/i);
        const notMatch = remaining.match(/^\s+(NOT)\s+/i);
        
        if (orMatch || andMatch || notMatch) {
          // Found an operator at top level
          if (currentPart.trim()) {
            parts.push(currentPart.trim());
          }
          parts.push((orMatch || andMatch || notMatch)![1]);
          currentPart = '';
          i += (orMatch || andMatch || notMatch)![0].length - 1; // -1 because we'll increment
        } else {
          currentPart += char;
        }
      } else {
        // Inside parentheses, just accumulate
        currentPart += char;
      }
      
      i++;
    }

    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }

    return parts;
  }

  /**
   * Ensure proper grouping with parentheses when multiple terms are connected with OR
   * Only adds brackets for simple OR chains that aren't already grouped
   * Preserves existing complex boolean logic structure
   */
  private ensureProperGrouping(keywords: string): string {
    const trimmed = keywords.trim();
    
    // If already wrapped in outer parentheses, verify it's a complete group
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      // Check if it's a complete outer group by counting parentheses depth
      let depth = 0;
      let isCompleteGroup = true;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '(') depth++;
        if (trimmed[i] === ')') depth--;
        // If depth reaches 0 before the end, it's not a complete outer group
        if (depth === 0 && i < trimmed.length - 1) {
          isCompleteGroup = false;
          break;
        }
      }
      if (isCompleteGroup && depth === 0) {
        // Already properly grouped, return as is
        return trimmed;
      }
    }

    // Count operators
    const orMatches = trimmed.match(/\s+OR\s+/gi);
    const andMatches = trimmed.match(/\s+AND\s+/gi);
    const notMatches = trimmed.match(/\s+NOT\s+/gi);
    
    const orCount = orMatches?.length || 0;
    const andCount = andMatches?.length || 0;
    const notCount = notMatches?.length || 0;
    
    // Only add brackets for simple OR chains (2+ OR operators, no AND/NOT, no existing parentheses)
    // This helps LinkedIn parse the boolean logic correctly
    if (orCount >= 1 && andCount === 0 && notCount === 0 && !trimmed.includes('(') && !trimmed.includes(')')) {
      // Simple OR chain without parentheses - wrap in parentheses for proper grouping
      // Example: "term1 OR term2 OR term3" -> "(term1 OR term2 OR term3)"
      return `(${trimmed})`;
    }
    
    // For expressions with existing parentheses or complex logic (AND/NOT), preserve as is
    // The quotes formatting is already done, so just return the formatted string
    return trimmed;
  }

  /**
   * Format grouped expressions (with parentheses) by wrapping multi-word terms inside
   * Handles nested parentheses and complex boolean expressions
   */
  private formatGroupedExpression(expression: string, depth: number = 0): string {
    const trimmed = expression.trim();
    
    // Prevent infinite recursion
    if (depth > 10) {
      return trimmed;
    }
    
    // Find the outermost matching parentheses
    let parenDepth = 0;
    let startIdx = -1;
    let endIdx = -1;
    
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '(') {
        if (parenDepth === 0) {
          startIdx = i;
        }
        parenDepth++;
      } else if (trimmed[i] === ')') {
        parenDepth--;
        if (parenDepth === 0 && startIdx !== -1) {
          endIdx = i;
          break;
        }
      }
    }

    // If we found a complete parenthesized group
    if (startIdx !== -1 && endIdx !== -1) {
      const before = trimmed.substring(0, startIdx).trim();
      const inside = trimmed.substring(startIdx + 1, endIdx).trim();
      const after = trimmed.substring(endIdx + 1).trim();
      
      // Recursively format the inside (this will handle nested parentheses and quotes)
      // Use formatQuotesInKeywords to format quotes, but don't add grouping (already grouped)
      const formattedInside = this.formatQuotesInKeywords(inside, depth + 1);
      
      // Format before and after parts if they exist
      const formattedBefore = before ? this.formatQuotesInKeywords(before, depth + 1) : '';
      const formattedAfter = after ? this.formatQuotesInKeywords(after, depth + 1) : '';
      
      // Reconstruct with parentheses
      let result = '';
      if (formattedBefore) {
        result += formattedBefore + ' ';
      }
      result += `(${formattedInside})`;
      if (formattedAfter) {
        result += ' ' + formattedAfter;
      }
      return result.trim();
    }

    // No complete parentheses found, treat as regular expression
    // Split by boolean operators
    const parts = trimmed.split(/\s+(OR|AND|NOT)\s+/i);
    const formattedParts = parts.map((part, index) => {
      if (index % 2 === 1) {
        return part.toUpperCase(); // Operator
      }

      const partTrimmed = part.trim();
      
      // Already quoted
      if (partTrimmed.startsWith('"') && partTrimmed.endsWith('"')) {
        return part;
      }

      // Check if this part has parentheses (might be nested)
      if (partTrimmed.includes('(') || partTrimmed.includes(')')) {
        return this.formatGroupedExpression(partTrimmed, depth + 1);
      }

      // Multi-word term - wrap in quotes
      if (partTrimmed.includes(' ') && partTrimmed.length > 0) {
        return `"${partTrimmed}"`;
      }

      return part;
    });

    return formattedParts.join(' ');
  }

  /**
   * Sanitize LinkedIn Classic People Search request to remove parameters that require numeric IDs
   */
  sanitizeClassicPeopleSearchRequest(
    request: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> {
    // First remove display fields
    const sanitized: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> = {};

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = this.formatKeywordsWithQuotes(request.keywords);
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Always include network_distance if present and is a non-empty array
    if (Array.isArray(request.network_distance) && request.network_distance.length > 0) {
      sanitized.network_distance = request.network_distance;
    }

    // Only include company if present and contains valid numeric IDs
    if (Array.isArray(request.company) && request.company.length > 0) {
      const validCompanyIds = request.company.filter(id => /^\d+$/.test(id));
      if (validCompanyIds.length > 0) {
        sanitized.company = validCompanyIds;
      }
    }

    // Only include past_company if present and contains valid numeric IDs
    if (Array.isArray(request.past_company) && request.past_company.length > 0) {
      const validPastCompanyIds = request.past_company.filter(id => /^\d+$/.test(id));
      if (validPastCompanyIds.length > 0) {
        sanitized.past_company = validPastCompanyIds;
      }
    }

    // Only include school if present and contains valid numeric IDs
    if (Array.isArray(request.school) && request.school.length > 0) {
      const validSchoolIds = request.school.filter(id => /^\d+$/.test(id));
      if (validSchoolIds.length > 0) {
        sanitized.school = validSchoolIds;
      }
    }

    // Only include service if present and contains valid numeric IDs
    if (Array.isArray(request.service) && request.service.length > 0) {
      const validServiceIds = request.service.filter(id => /^\d+$/.test(id));
      if (validServiceIds.length > 0) {
        sanitized.service = validServiceIds;
      }
    }

    // Always include advanced_keywords if present
    if (request.advanced_keywords) {
      sanitized.advanced_keywords = request.advanced_keywords;
    }

    // Only include profile_language if present and non-empty
    if (request.profile_language) {
      // sanitized.profile_language = request.profile_language;
    }

    // Only include connections_of if present and non-empty
    if (request.connections_of) {
      // sanitized.connections_of = request.connections_of;
    }

    // Only include followers_of if present and non-empty
    if (request.followers_of) {
      sanitized.followers_of = request.followers_of;
    }

    // Only include open_to if present and non-empty
    if (request.open_to) {
      sanitized.open_to = request.open_to;
    }

    // Preserve useRawEndpoint flag if present
    if (request.useRawEndpoint !== undefined) {
      sanitized.useRawEndpoint = request.useRawEndpoint;
    }
    
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Classic Companies Search request to remove parameters that require numeric IDs
   */
  sanitizeClassicCompaniesSearchRequest(
    request: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'> {
    const sanitized: Omit<LinkedInClassicCompaniesSearchRequest, 'api' | 'category'> = {};


    this.logger.log(`Input request to sanitizer in classic companies search: ${JSON.stringify(request, null, 2)}`);
    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = this.formatKeywordsWithQuotes(request.keywords);
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Only include non-null parameters
    if (request.has_job_offers !== undefined && request.has_job_offers !== null) {
      sanitized.has_job_offers = request.has_job_offers;
    }
    if (request.headcount) {
      sanitized.headcount = request.headcount;
    }
    if (request.network_distance) {
      sanitized.network_distance = request.network_distance;
    }
    
    this.logger.log(`Sanitized LinkedIn Classic Companies Search request: ${JSON.stringify(sanitized, null, 2)}`);
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Sales Navigator People Search request
   */
  sanitizeSalesNavigatorPeopleSearchRequest(
    request: any
  ): any {
    const sanitized: any = {};

    this.logger.log(`Input request to sanitizer in sales navigator people search: ${JSON.stringify(request, null, 2)}`);

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = this.formatKeywordsWithQuotes(request.keywords);
    }

    // Handle location parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'location', request.location);

    // Handle industry parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'industry', request.industry);

    // Handle company parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'company', request.company);

    // Handle past_company parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'past_company', request.past_company);

    // Handle school parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'school', request.school);

    // Handle function parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'function', request.function);

    // Handle role parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'role', request.role);

    // Handle past_role parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'past_role', request.past_role);

    // Handle company_location parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(
      sanitized,
      'company_location',
      request.company_location,
    );

    // Handle seniority parameter - flat array or include/exclude structure
    const seniority = this.sanitizeSalesNavigatorSeniority(request.seniority);
    if (seniority) {
      sanitized.seniority = seniority;
    }

    // Handle network_distance parameter
    if (Array.isArray(request.network_distance) && request.network_distance.length > 0) {
      const validNetworkDistances = request.network_distance.filter(val => 
        typeof val === 'number' && [1, 2, 3].includes(val) || val === 'GROUP'
      );
      if (validNetworkDistances.length > 0) {
        sanitized.network_distance = validNetworkDistances;
      }
    }

    // Handle profile_language parameter
    if (Array.isArray(request.profile_language) && request.profile_language.length > 0) {
      const validLanguages = request.profile_language.filter(lang => 
        typeof lang === 'string' && lang.length === 2
      );
      if (validLanguages.length > 0) {
        sanitized.profile_language = validLanguages;
      }
    }

    // Handle company_headcount parameter
    if (Array.isArray(request.company_headcount) && request.company_headcount.length > 0) {
      const validHeadcounts = request.company_headcount.filter(hc => 
        hc && typeof hc.min === 'number' && typeof hc.max === 'number'
      );
      if (validHeadcounts.length > 0) {
        sanitized.company_headcount = validHeadcounts;
      }
    }

    // Handle boolean parameters
    if (typeof request.changed_jobs === 'boolean') {
      sanitized.changed_jobs = request.changed_jobs;
    }
    if (typeof request.past_colleague === 'boolean') {
      sanitized.past_colleague = request.past_colleague;
    }
    if (typeof request.past_applicants === 'boolean') {
      sanitized.past_applicants = request.past_applicants;
    }
    if (typeof request.messaged_recently === 'boolean') {
      sanitized.messaged_recently = request.messaged_recently;
    }
    if (typeof request.posted_on_linkedin === 'boolean') {
      sanitized.posted_on_linkedin = request.posted_on_linkedin;
    }
    if (typeof request.shared_experiences === 'boolean') {
      sanitized.shared_experiences = request.shared_experiences;
    }
    if (typeof request.include_saved_leads === 'boolean') {
      sanitized.include_saved_leads = request.include_saved_leads;
    }
    if (typeof request.military_background === 'boolean') {
      sanitized.military_background = request.military_background;
    }
    if (typeof request.following_your_company === 'boolean') {
      sanitized.following_your_company = request.following_your_company;
    }
    if (typeof request.include_saved_accounts === 'boolean') {
      sanitized.include_saved_accounts = request.include_saved_accounts;
    }
    if (typeof request.viewed_profile_recently === 'boolean') {
      sanitized.viewed_profile_recently = request.viewed_profile_recently;
    }
    if (typeof request.viewed_your_profile_recently === 'boolean') {
      sanitized.viewed_your_profile_recently = request.viewed_your_profile_recently;
    }

    // Handle string parameters
    if (typeof request.first_name === 'string' && request.first_name.trim().length > 0) {
      sanitized.first_name = request.first_name;
    }
    if (typeof request.last_name === 'string' && request.last_name.trim().length > 0) {
      sanitized.last_name = request.last_name;
    }

    this.logger.log(`Sanitized LinkedIn Sales Navigator People Search request: ${JSON.stringify(sanitized, null, 2)}`);
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Classic Projects Search request to remove parameters that require numeric IDs
   */
  sanitizeClassicJobsSearchRequest(
    request: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'>
  ): Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'> {
    const sanitized: Omit<LinkedInClassicJobsSearchRequest, 'api' | 'category'> = {};

    this.logger.log(`Input request to sanitizer in classic jobs search: ${JSON.stringify(request, null, 2)}`);

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = this.formatKeywordsWithQuotes(request.keywords);
    }

    // Only include region if present and is a valid numeric ID
    if (typeof request.region === 'string' && /^\d+$/.test(request.region)) {
      sanitized.region = request.region;
    }

    // Only include location if present and contains valid numeric IDs
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocationIds = request.location.filter(id => /^\d+$/.test(id));
      if (validLocationIds.length > 0) {
        sanitized.location = validLocationIds;
      }
    }

    // Only include industry if present and contains valid numeric IDs
    if (Array.isArray(request.industry) && request.industry.length > 0) {
      const validIndustryIds = request.industry.filter(id => /^\d+$/.test(id));
      if (validIndustryIds.length > 0) {
        sanitized.industry = validIndustryIds;
      }
    }

    // Only include function if present and contains valid IDs (alphanumeric pattern)
    if (Array.isArray(request.function) && request.function.length > 0) {
      const validFunctionIds = request.function.filter(id => /^[a-z]+$/.test(id));
      if (validFunctionIds.length > 0) {
        sanitized.function = validFunctionIds;
      }
    }

    // Only include role if present and contains valid numeric IDs
    if (Array.isArray(request.role) && request.role.length > 0) {
      const validRoleIds = request.role.filter(id => /^\d+$/.test(id));
      if (validRoleIds.length > 0) {
        sanitized.role = validRoleIds;
      }
    }

    // Only include company if present and contains valid numeric IDs
    if (Array.isArray(request.company) && request.company.length > 0) {
      const validCompanyIds = request.company.filter(id => /^\d+$/.test(id));
      if (validCompanyIds.length > 0) {
        sanitized.company = validCompanyIds;
      }
    }

    // Only include non-null parameters
    if (request.sort_by) {
      sanitized.sort_by = request.sort_by;
    }
    if (request.date_posted !== undefined && request.date_posted !== null) {
      sanitized.date_posted = request.date_posted;
    }
    if (request.location_within_area !== undefined && request.location_within_area !== null) {
      sanitized.location_within_area = request.location_within_area;
    }
    if (request.seniority) {
      sanitized.seniority = request.seniority;
    }
    if (request.job_type) {
      sanitized.job_type = request.job_type;
    }
    if (request.presence) {
      sanitized.presence = request.presence;
    }
    if (request.easy_apply !== undefined && request.easy_apply !== null) {
      sanitized.easy_apply = request.easy_apply;
    }
    if (request.has_verifications !== undefined && request.has_verifications !== null) {
      sanitized.has_verifications = request.has_verifications;
    }
    if (request.under_10_applicants !== undefined && request.under_10_applicants !== null) {
      sanitized.under_10_applicants = request.under_10_applicants;
    }
    if (request.in_your_network !== undefined && request.in_your_network !== null) {
      sanitized.in_your_network = request.in_your_network;
    }
    if (request.fair_chance_employer !== undefined && request.fair_chance_employer !== null) {
      sanitized.fair_chance_employer = request.fair_chance_employer;
    }
    if (request.benefits) {
      sanitized.benefits = request.benefits;
    }
    if (request.commitments) {
      sanitized.commitments = request.commitments;
    }
    if (request.minimum_salary) {
      sanitized.minimum_salary = request.minimum_salary;
    }
    
    this.logger.log(`Sanitized LinkedIn Classic Projects Search request: ${JSON.stringify(sanitized, null, 2)}`);
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Sales Navigator Companies Search request
   */
  sanitizeSalesNavigatorCompaniesSearchRequest(
    request: any
  ): any {
    const sanitized: any = {};

    this.logger.log(`Input request to sanitizer in sales navigator companies search: ${JSON.stringify(request, null, 2)}`);

    // Only include keywords if present and non-empty
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = this.formatKeywordsWithQuotes(request.keywords);
    }

    // Handle industry parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'industry', request.industry);

    // Handle location parameter - flat array or include/exclude structure
    this.assignIncludeExcludeNumericIds(sanitized, 'location', request.location);

    // Handle headcount parameter
    if (Array.isArray(request.headcount) && request.headcount.length > 0) {
      const validHeadcounts = request.headcount.filter(hc => 
        hc && typeof hc.min === 'number' && typeof hc.max === 'number'
      );
      if (validHeadcounts.length > 0) {
        sanitized.headcount = validHeadcounts;
      }
    }

    // Handle network_distance parameter
    if (Array.isArray(request.network_distance) && request.network_distance.length > 0) {
      const validNetworkDistances = request.network_distance.filter(val => 
        typeof val === 'number' && [1, 2, 3].includes(val)
      );
      if (validNetworkDistances.length > 0) {
        sanitized.network_distance = validNetworkDistances;
      }
    }

    // Handle boolean parameters
    if (typeof request.has_job_offers === 'boolean') {
      sanitized.has_job_offers = request.has_job_offers;
    }

    // Handle technologies parameter
    if (Array.isArray(request.technologies) && request.technologies.length > 0) {
      const validTechnologyIds = request.technologies.filter(id => /^\d+$/.test(id));
      if (validTechnologyIds.length > 0) {
        sanitized.technologies = validTechnologyIds;
      }
    }

    // Handle recent_activities parameter
    if (Array.isArray(request.recent_activities) && request.recent_activities.length > 0) {
      const validActivities = request.recent_activities.filter(activity => 
        ['senior_leadership_changes', 'funding_events'].includes(activity)
      );
      if (validActivities.length > 0) {
        sanitized.recent_activities = validActivities;
      }
    }

    // Handle saved_accounts parameter
    if (Array.isArray(request.saved_accounts) && request.saved_accounts.length > 0) {
      const validSavedAccounts = request.saved_accounts.filter(account => 
        typeof account === 'string' && account.trim().length > 0
      );
      if (validSavedAccounts.length > 0) {
        sanitized.saved_accounts = validSavedAccounts;
      }
    }

    // Handle account_lists parameter
    if (request.account_lists && (request.account_lists.include || request.account_lists.exclude)) {
      sanitized.account_lists = {};
      if (Array.isArray(request.account_lists.include) && request.account_lists.include.length > 0) {
        const validIncludeIds = request.account_lists.include.filter(id => /^(\d+|ALL)$/.test(id));
        if (validIncludeIds.length > 0) {
          sanitized.account_lists.include = validIncludeIds;
        }
      }
      if (Array.isArray(request.account_lists.exclude) && request.account_lists.exclude.length > 0) {
        const validExcludeIds = request.account_lists.exclude.filter(id => /^(\d+|ALL)$/.test(id));
        if (validExcludeIds.length > 0) {
          sanitized.account_lists.exclude = validExcludeIds;
        }
      }
    }

    this.logger.log(`Sanitized LinkedIn Sales Navigator Companies Search request: ${JSON.stringify(sanitized, null, 2)}`);
    return sanitized;
  }

  /**
   * Sanitize LinkedIn Recruiter People Search request
   */
  sanitizeRecruiterPeopleSearchRequest(
    request: any
  ): any {
    const sanitized: any = {};

    this.logger.log(`Input request to sanitizer in recruiter people search: ${JSON.stringify(request, null, 2)}`);

    // Only include keywords if present and non-empty (required for Recruiter)  
    if (typeof request.keywords === 'string' && request.keywords.trim().length > 0) {
      sanitized.keywords = this.formatKeywordsWithQuotes(request.keywords);
    }

    // Handle locale parameter
    if (typeof request.locale === 'string' && request.locale.trim().length > 0) {
      const validLocales = [
        'arabic', 'bangla', 'czech', 'danish', 'german', 'greek', 'english', 'spanish', 
        'persian', 'finnish', 'french', 'hindi', 'hungarian', 'indonesian', 'italian', 
        'hebrew', 'japanese', 'korean', 'marathi', 'malay', 'dutch', 'norwegian', 
        'punjabi', 'polish', 'portuguese', 'romanian', 'russian', 'swedish', 'telugu', 
        'thai', 'tagalog', 'turkish', 'ukrainian', 'vietnamese', 'chinese_simplified', 
        'chinese_traditional'
      ];
      if (validLocales.includes(request.locale)) {
        sanitized.locale = request.locale;
      }
    }

    // Handle saved_search parameter
    if (request.saved_search && request.saved_search.id && request.saved_search.project_id) {
      if (/^\d+$/.test(request.saved_search.id) && /^\d+$/.test(request.saved_search.project_id)) {
        sanitized.saved_search = {
          id: request.saved_search.id,
          project_id: request.saved_search.project_id
        };
      }
    }

    // Handle saved_filter parameter
    if (typeof request.saved_filter === 'string' && /^\d+$/.test(request.saved_filter)) {
      sanitized.saved_filter = request.saved_filter;
    }

    // Handle location parameter - Recruiter format
    if (Array.isArray(request.location) && request.location.length > 0) {
      const validLocations = request.location.filter(loc => 
        loc && typeof loc.id === 'string' && /^\d+$/.test(loc.id)
      );
      if (validLocations.length > 0) {
        sanitized.location = validLocations.map(loc => ({
          id: loc.id,
          priority: loc.priority || 'CAN_HAVE',
          scope: loc.scope || 'CURRENT',
          ...(loc.title && { title: loc.title })
        }));
      }
    }

    // Handle location_within_area parameter
    if (typeof request.location_within_area === 'number' && request.location_within_area > 0) {
      sanitized.location_within_area = request.location_within_area;
    }

    // Handle industry parameter - Recruiter format
    if (request.industry && (request.industry.include || request.industry.exclude)) {
      sanitized.industry = {};
      if (Array.isArray(request.industry.include) && request.industry.include.length > 0) {
        const validIncludeIds = request.industry.include.filter(id => /^\d+$/.test(id));
        if (validIncludeIds.length > 0) {
          sanitized.industry.include = validIncludeIds;
        }
      }
      if (Array.isArray(request.industry.exclude) && request.industry.exclude.length > 0) {
        const validExcludeIds = request.industry.exclude.filter(id => /^\d+$/.test(id));
        if (validExcludeIds.length > 0) {
          sanitized.industry.exclude = validExcludeIds;
        }
      }
    }

    // Handle role parameter - Recruiter format
    if (Array.isArray(request.role) && request.role.length > 0) {
      const validRoles = request.role.filter(role => {
        if (role.id && /^\d+$/.test(role.id) && typeof role.is_selection === 'boolean') {
          return true; // ID-based role
        }
        if (role.keywords && typeof role.keywords === 'string' && role.keywords.trim().length > 0) {
          return true; // Keywords-based role
        }
        return false;
      });
      if (validRoles.length > 0) {
        sanitized.role = validRoles.map(role => ({
          ...role,
          keywords: role.keywords ? this.formatKeywordsWithQuotes(role.keywords) : role.keywords,
          priority: role.priority || 'CAN_HAVE',
          scope: role.scope || 'CURRENT_OR_PAST'
        }));
      }
    }

    // Handle skills parameter - Recruiter format
    if (Array.isArray(request.skills) && request.skills.length > 0) {
      const validSkills = request.skills.filter(skill => {
        if (skill.id && /^\d+$/.test(skill.id)) {
          return true; // ID-based skill
        }
        if (skill.keywords && typeof skill.keywords === 'string' && skill.keywords.trim().length > 0) {
          return true; // Keywords-based skill
        }
        return false;
      });
      if (validSkills.length > 0) {
        sanitized.skills = validSkills.map(skill => ({
          ...skill,
          keywords: skill.keywords ? this.formatKeywordsWithQuotes(skill.keywords) : skill.keywords,
          priority: skill.priority || 'CAN_HAVE'
        }));
      }
    }

    // Handle company parameter - Recruiter format
    if (Array.isArray(request.company) && request.company.length > 0) {
      const validCompanies = request.company.filter(company => {
        if (company.id && /^\d+$/.test(company.id)) {
          return true; // ID-based company
        }
        if (company.keywords && typeof company.keywords === 'string' && company.keywords.trim().length > 0) {
          return true; // Keywords-based company
        }
        return false;
      });
      if (validCompanies.length > 0) {
        sanitized.company = validCompanies.map(company => ({
          ...company,
          keywords: company.keywords ? this.formatKeywordsWithQuotes(company.keywords) : company.keywords,
          priority: company.priority || 'CAN_HAVE',
          scope: company.scope || 'CURRENT_OR_PAST'
        }));
      }
    }

    // Handle company_headcount parameter
    if (Array.isArray(request.company_headcount) && request.company_headcount.length > 0) {
      const validHeadcounts = request.company_headcount.filter(hc => 
        hc && typeof hc.min === 'number' && typeof hc.max === 'number'
      );
      if (validHeadcounts.length > 0) {
        sanitized.company_headcount = validHeadcounts;
      }
    }

    // Handle current_company parameter
    if (Array.isArray(request.current_company) && request.current_company.length > 0) {
      const validCurrentCompanies = request.current_company.filter(company => 
        company && typeof company.id === 'string' && /^\d+$/.test(company.id)
      );
      if (validCurrentCompanies.length > 0) {
        sanitized.current_company = validCurrentCompanies.map(company => ({
          id: company.id,
          priority: company.priority || 'CAN_HAVE'
        }));
      }
    }

    // Handle past_company parameter
    if (Array.isArray(request.past_company) && request.past_company.length > 0) {
      const validPastCompanies = request.past_company.filter(company => 
        company && typeof company.id === 'string' && /^\d+$/.test(company.id)
      );
      if (validPastCompanies.length > 0) {
        sanitized.past_company = validPastCompanies.map(company => ({
          id: company.id,
          priority: company.priority || 'CAN_HAVE'
        }));
      }
    }

    // Handle school parameter
    if (Array.isArray(request.school) && request.school.length > 0) {
      const validSchools = request.school.filter(school => 
        school && typeof school.id === 'string' && /^\d+$/.test(school.id)
      );
      if (validSchools.length > 0) {
        sanitized.school = validSchools.map(school => ({
          id: school.id,
          priority: school.priority || 'CAN_HAVE'
        }));
      }
    }

    // Handle groups parameter
    if (Array.isArray(request.groups) && request.groups.length > 0) {
      const validGroupIds = request.groups.filter(id => /^\d+$/.test(id));
      if (validGroupIds.length > 0) {
        sanitized.groups = validGroupIds;
      }
    }

    // Handle graduation_year parameter
    if (request.graduation_year && typeof request.graduation_year.min === 'number' && typeof request.graduation_year.max === 'number') {
      if (request.graduation_year.min >= 1000 && request.graduation_year.min <= 9999 &&
          request.graduation_year.max >= 1000 && request.graduation_year.max <= 9999) {
        sanitized.graduation_year = request.graduation_year;
      }
    }

    // Handle tenure parameter
    if (request.tenure && typeof request.tenure.min === 'number' && typeof request.tenure.max === 'number') {
      sanitized.tenure = request.tenure;
    }

    // Handle seniority parameter - Recruiter format
    if (request.seniority && (request.seniority.include || request.seniority.exclude)) {
      sanitized.seniority = {};
      if (Array.isArray(request.seniority.include) && request.seniority.include.length > 0) {
        const validIncludeValues = request.seniority.include.filter(val => 
          ['owner', 'partner', 'cxo', 'vp', 'director', 'manager', 'senior', 'entry', 'training', 'unpaid'].includes(val)
        );
        if (validIncludeValues.length > 0) {
          sanitized.seniority.include = validIncludeValues;
        }
      }
      if (Array.isArray(request.seniority.exclude) && request.seniority.exclude.length > 0) {
        const validExcludeValues = request.seniority.exclude.filter(val => 
          ['owner', 'partner', 'cxo', 'vp', 'director', 'manager', 'senior', 'entry', 'training', 'unpaid'].includes(val)
        );
        if (validExcludeValues.length > 0) {
          sanitized.seniority.exclude = validExcludeValues;
        }
      }
    }

    // Handle function parameter
    if (Array.isArray(request.function) && request.function.length > 0) {
      const validFunctionIds = request.function.filter(id => /^\d+$/.test(id));
      if (validFunctionIds.length > 0) {
        sanitized.function = validFunctionIds;
      }
    }

    // Handle network_distance parameter
    if (Array.isArray(request.network_distance) && request.network_distance.length > 0) {
      const validNetworkDistances = request.network_distance.filter(val => 
        typeof val === 'number' && [1, 2, 3].includes(val) || val === 'GROUP'
      );
      if (validNetworkDistances.length > 0) {
        sanitized.network_distance = validNetworkDistances;
      }
    }

    // Handle spoken_languages parameter
    if (Array.isArray(request.spoken_languages) && request.spoken_languages.length > 0) {
      const validLanguages = request.spoken_languages.filter(lang => 
        lang && typeof lang.language === 'string' && lang.language.trim().length > 0
      );
      if (validLanguages.length > 0) {
        sanitized.spoken_languages = validLanguages.map(lang => ({
          language: lang.language,
          priority: lang.priority || 'CAN_HAVE',
          scope: lang.scope || 'PROFESSIONAL_WORKING'
        }));
      }
    }

    // Handle hide_previously_viewed parameter
    if (request.hide_previously_viewed && typeof request.hide_previously_viewed.timespan === 'number') {
      sanitized.hide_previously_viewed = request.hide_previously_viewed;
    }

    // Handle profile_language parameter
    if (Array.isArray(request.profile_language) && request.profile_language.length > 0) {
      const validLanguages = request.profile_language.filter(lang => 
        typeof lang === 'string' && lang.length === 2
      );
      if (validLanguages.length > 0) {
        sanitized.profile_language = validLanguages;
      }
    }

    // Handle recently_joined parameter
    if (Array.isArray(request.recently_joined) && request.recently_joined.length > 0) {
      const validRecentlyJoined = request.recently_joined.filter(rj => 
        rj && typeof rj.min === 'number' && typeof rj.max === 'number'
      );
      if (validRecentlyJoined.length > 0) {
        sanitized.recently_joined = validRecentlyJoined;
      }
    }

    // Handle spotlights parameter
    if (Array.isArray(request.spotlights) && request.spotlights.length > 0) {
      const validSpotlights = request.spotlights.filter(spotlight => 
        ['OPEN_TO_WORK', 'ACTIVE_TALENT', 'REDISCOVERED_CANDIDATES', 'INTERNAL_CANDIDATES', 
         'INTERESTED_IN_YOUR_COMPANY', 'HAVE_COMPANY_CONNECTIONS'].includes(spotlight)
      );
      if (validSpotlights.length > 0) {
        sanitized.spotlights = validSpotlights;
      }
    }

    // Handle first_name parameter
    if (Array.isArray(request.first_name) && request.first_name.length > 0) {
      const validFirstNames = request.first_name.filter(name => 
        typeof name === 'string' && name.trim().length > 0
      );
      if (validFirstNames.length > 0) {
        sanitized.first_name = validFirstNames;
      }
    }

    // Handle last_name parameter
    if (Array.isArray(request.last_name) && request.last_name.length > 0) {
      const validLastNames = request.last_name.filter(name => 
        typeof name === 'string' && name.trim().length > 0
      );
      if (validLastNames.length > 0) {
        sanitized.last_name = validLastNames;
      }
    }

    // Handle boolean parameters
    if (typeof request.has_military_background === 'boolean') {
      sanitized.has_military_background = request.has_military_background;
    }
    if (typeof request.past_applicants === 'boolean') {
      sanitized.past_applicants = request.past_applicants;
    }

    // Handle hiring_projects parameter
    if (request.hiring_projects && (request.hiring_projects.include || request.hiring_projects.exclude)) {
      sanitized.hiring_projects = {};
      if (Array.isArray(request.hiring_projects.include) && request.hiring_projects.include.length > 0) {
        const validIncludeIds = request.hiring_projects.include.filter(id => /^\d+$/.test(id));
        if (validIncludeIds.length > 0) {
          sanitized.hiring_projects.include = validIncludeIds;
        }
      }
      if (Array.isArray(request.hiring_projects.exclude) && request.hiring_projects.exclude.length > 0) {
        const validExcludeIds = request.hiring_projects.exclude.filter(id => /^\d+$/.test(id));
        if (validExcludeIds.length > 0) {
          sanitized.hiring_projects.exclude = validExcludeIds;
        }
      }
    }

    // Handle recruiting_activity parameter
    if (Array.isArray(request.recruiting_activity) && request.recruiting_activity.length > 0) {
      const validActivities = request.recruiting_activity.filter(activity => 
        activity && typeof activity.id === 'string' && 
        ['messages', 'tags', 'notes', 'projects', 'resumes', 'reviews'].includes(activity.id) &&
        typeof activity.timespan === 'number'
      );
      if (validActivities.length > 0) {
        sanitized.recruiting_activity = validActivities.map(activity => ({
          id: activity.id,
          priority: activity.priority || 'CAN_HAVE',
          timespan: activity.timespan
        }));
      }
    }

    // Handle notes parameter
    if (Array.isArray(request.notes) && request.notes.length > 0) {
      const validNotes = request.notes.filter(note => 
        typeof note === 'string' && note.trim().length > 0
      );
      if (validNotes.length > 0) {
        sanitized.notes = validNotes;
      }
    }

    this.logger.log(`Sanitized LinkedIn Recruiter People Search request: ${JSON.stringify(sanitized, null, 2)}`);
    return sanitized;
  }
}