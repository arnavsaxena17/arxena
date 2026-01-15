import { Injectable, Logger } from '@nestjs/common';
import { JobDescriptionParsingPrompt, SearchParameterGenerationPrompt } from 'src/engine/core-modules/candidate-search/types/candidate-search-prompt.type';
import {
  LinkedInPeopleSearchResult,
  LinkedInSearchResult
} from '../../linkedin-search/types/linkedin-search-response.type';
import {
  linkedinIndustryOptions
} from '../schemas/classic-people-search.schema';
import { StreamProcessingService } from '../services/stream-processing.service';
import { ParsedJobDescription, QueryUnderstanding } from '../types/candidate-search-request.type';
import { replaceTemplateVariables } from '../utils/template.utils';



export interface SearchParametersPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
}
@Injectable()
export class SearchParametersPrompts {
  private readonly logger = new Logger(SearchParametersPrompts.name);
  // Cache for system prompts to avoid regeneration
  private systemPromptCache: Map<string, string> = new Map();

  // Common instruction constants
  private readonly COMMON_INSTRUCTIONS = {
    humanReadableNames: 'Use human-readable names for all parameters (e.g., "Microsoft", "San Francisco Bay Area", "Stanford University")',
    noLinkedInIds: 'Do NOT use LinkedIn IDs or numeric values - the system will convert names to IDs automatically',
    industryExactMatch: (industryList: string) => `MUST use EXACT industry names from this list: ${industryList}. For pharmaceuticals, use "Pharmaceutical Manufacturing". For technology, use "Technology, Information and Internet" or "Computer Software" or "IT Services and IT Consulting". These MUST match exactly from the list above.`,
  };

  constructor(
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * Get system prompt for parameter generation (cached)
   */
  private getCachedSystemPrompt(
    cacheKey: string,
    generator: () => string,
  ): string {
    if (!this.systemPromptCache.has(cacheKey)) {
      this.systemPromptCache.set(cacheKey, generator());
    }
    return this.systemPromptCache.get(cacheKey)!;
  }

  /**
   * Get system prompt for people search parameter generation
   * @param searchType - The type of search (classic, sales_navigator, recruiter)
   * @param hasDiscoveredIndustries - If true, industries were discovered and will be provided in user prompt, so exclude industry list from system prompt
   */
  getPeopleSearchSystemPrompt(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    hasDiscoveredIndustries: boolean = false,
  ): string {
    const cacheKey = `people-search-system-${searchType}-${hasDiscoveredIndustries}`;
    return this.getCachedSystemPrompt(cacheKey, () => {
      const industryList = `${linkedinIndustryOptions.slice(0, 50).join(', ')}, and ${linkedinIndustryOptions.length - 50} more options available`;
      const industryInstruction = hasDiscoveredIndustries 
        ? 'Industry parameters: Use the exact industry names provided in the user prompt. These industries have been pre-identified from the query.'
        : `Industry parameters: ${this.COMMON_INSTRUCTIONS.industryExactMatch(industryList)}`;
      
      switch (searchType) {
        case 'classic':
          return `You are an expert LinkedIn recruiter specializing in LinkedIn Classic search. Your task is to generate optimal search parameters for finding candidates based on parsed job description data.
        IMPORTANT: You must generate search parameters that include:
        - Keywords: Generate a comprehensive boolean string comprising of AND,OR,NOT with multiple job title variations. ⚠️ CRITICAL CONSTRAINT: LinkedIn Classic allows MAXIMUM 6 keyword terms in the keywords field. Each term can be a quoted phrase (e.g., "sales manager" counts as 1 term) or an unquoted word separated by boolean operators (AND, OR, NOT). Count terms carefully: "sales manager" OR "account executive" OR "business development" OR "territory sales" OR "inside sales" OR "field sales" = 6 terms (MAXIMUM). You may use brackets (parentheses) () to group the keywords. CRITICAL: All multi-word job titles MUST be wrapped in double quotes (inverted commas). Single-word titles do not need quotes. For example, if the role is "sales representative", prioritize the most important variations and limit to 6 terms total: "sales representative" OR "sales executive" OR "sales manager" OR "business development executive" OR "account executive" OR "territory sales". If you need more role variations, they should be split into separate search parameter sets. Format: Single words without quotes (e.g., Pulmonologist), multi-word phrases with quotes (e.g., "Consultant Pulmonologist", "Chest Physician", "Respiratory Specialist").
        - ${industryInstruction}
          CRITICAL: If specific companies are mentioned (e.g., "Novartis", "Microsoft"), DO NOT include industry filter. Company filter is more precise and including industry would unnecessarily restrict results - candidates may have worked at the company in different roles or industries.
        - Location parameters (as HUMAN-READABLE NAMES like "San Francisco Bay Area", "New York City", "Seattle, Washington", "Mumbai, Maharashtra")
        - Company parameters (as HUMAN-READABLE NAMES like "Microsoft", "Google", "Amazon", "Apple")
        - School parameters (as HUMAN-READABLE NAMES like "Stanford University", "MIT", "Harvard University")
        - Network distance: Only include if explicitly needed to restrict to specific connection levels (1st, 2nd, or 3rd+). Leave as null/undefined to search all connections - this maximizes candidate pool.
        CRITICAL: ${this.COMMON_INSTRUCTIONS.noLinkedInIds}`;

        case 'sales_navigator':
          return `You are an expert LinkedIn Sales Navigator specialist with deep knowledge of advanced B2B sales prospecting. Your task is to generate optimal Sales Navigator People Search parameters based on parsed job description data.
  
        Sales Navigator offers sophisticated filtering capabilities that go beyond basic LinkedIn search:
  
        CORE FILTERS:
        - Keywords: Job titles, skills, technologies, company names. Generate a comprehensive boolean string comprising of AND,OR,NOT with multiple job title variations. You may use brackets (parentheses) () to group the keywords. CRITICAL: All multi-word job titles MUST be wrapped in double quotes (inverted commas). Single-word titles do not need quotes. For example, if the role is "sales representative", you should include variations like "sales representative" OR "sales executive" OR "sales manager" OR "business development executive" OR "account executive" OR "territory sales". Think of all related job titles, synonyms, and variations that describe similar roles.
        
        🎯 SOPHISTICATED BOOLEAN QUERIES FOR SALES NAVIGATOR:
        For roles with hierarchical and domain components (e.g., "Head of Operations", "VP Sales", "GM Marketing"), create sophisticated boolean queries that capture different company nomenclatures by combining hierarchical terms (GM, VP, President, AGM, Head, Director, Manager, etc.) with domain/functional terms (Operations, Sales, Marketing, Plant, Unit, Works, Site, etc.).
        
        PATTERN: (DomainTerm AND (HierarchicalTerm1 OR HierarchicalTerm2 OR ...)) OR ((AlternativeDomainTerm1 OR AlternativeDomainTerm2) AND HierarchicalTerm)
        
        EXAMPLES:
        - For "Head of Operations": (Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head))
        - For "VP Sales": (Sales AND (VP OR "Vice President" OR vp)) OR (Sales AND (head OR director))
        - For "GM Marketing": (Marketing AND (GM OR "General Manager" OR gm)) OR (Marketing AND (head OR director OR vp))
        
        These sophisticated queries work well in Sales Navigator (unlike Classic which has a 6-term limit) and capture all common nomenclature variations across different companies.
        - Location: Include/exclude specific geographic areas, postal code searches with radius
        - Industry: Include/exclude specific industries using Sales Navigator industry taxonomy. ${hasDiscoveredIndustries ? 'Use the exact industry names provided in the user prompt. These industries have been pre-identified from the query.' : this.COMMON_INSTRUCTIONS.industryExactMatch(industryList)}
        - Company: Include/exclude companies by name, headcount ranges, company types, headquarters location
        - Function & Role: Department filters, current/past job titles with include/exclude options
        - Seniority: Owner/partner, C-level, VP, Director, Manager levels, Strategic/Senior/Entry/In-training
        - Tenure: Years of experience, years at current company, years in current position
        - School: Include/exclude educational institutions
        - Profile Language: Language preferences for profiles
  
        ADVANCED BEHAVIORAL FILTERS:
        - Network Distance: 1st, 2nd, 3rd degree connections or GROUP connections
        - Following Your Company: People who follow the hiring company
        - Viewed Your Profile Recently: Recent profile viewers
        - Past Colleague: People who worked at the same companies
        - Shared Experiences: Common work experiences
        - Changed Jobs: Recently changed positions
        - Posted on LinkedIn: Active content creators
        - Mentioned in News: People featured in news articles
        - Viewed Profile Recently: Recent profile interactions
        - Messaged Recently: Recent communication history
  
        ACCOUNT & LEAD MANAGEMENT:
        - Account Lists: Include/exclude specific account lists
        - Lead Lists: Include/exclude specific lead lists
        - Saved Leads: Include saved leads
        - Saved Accounts: Include saved accounts
  
        CRITICAL INSTRUCTIONS:
        1. ${this.COMMON_INSTRUCTIONS.humanReadableNames}
        2. ${this.COMMON_INSTRUCTIONS.noLinkedInIds}
        3. Focus on creating targeted searches that leverage Sales Navigator's advanced features
        4. Consider both include and exclude filters for better targeting
        5. Use appropriate seniority levels based on the job requirements
        6. Set realistic tenure ranges based on experience level needed
        7. Leverage behavioral filters to find engaged prospects
        8. Consider company headcount ranges appropriate for the role level`;

        case 'recruiter':
          return `You are an expert LinkedIn Recruiter specialist with deep knowledge of advanced talent acquisition and recruitment strategies. Your task is to generate optimal LinkedIn Recruiter People Search parameters based on parsed job description data.
  
        LinkedIn Recruiter offers the most sophisticated filtering capabilities for talent acquisition:
  
        CORE SEARCH FILTERS:
        - Keywords: Job titles, skills, technologies, company names with boolean modifiers (AND, OR, NOT). Generate comprehensive boolean strings that capture different company nomenclatures.
        
        🎯 SOPHISTICATED BOOLEAN QUERIES FOR RECRUITER:
        For roles with hierarchical and domain components (e.g., "Head of Operations", "VP Sales", "GM Marketing"), create sophisticated boolean queries that capture different company nomenclatures by combining hierarchical terms (GM, VP, President, AGM, Head, Director, Manager, etc.) with domain/functional terms (Operations, Sales, Marketing, Plant, Unit, Works, Site, etc.).
        
        PATTERN: (DomainTerm AND (HierarchicalTerm1 OR HierarchicalTerm2 OR ...)) OR ((AlternativeDomainTerm1 OR AlternativeDomainTerm2) AND HierarchicalTerm)
        
        EXAMPLES:
        - For "Head of Operations": (Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head or ...))
        - For "VP Sales": (Sales AND (VP OR "Vice President" OR vp)) OR ("business development" AND (head OR director))
        - For "GM Marketing": (Marketing AND (GM OR "General Manager" OR gm)) OR (Marketing AND (head OR director OR vp))
        
        These sophisticated queries work well in Recruiter (unlike Classic which has a 6-term limit) and capture all common nomenclature variations across different companies.
        - Locale: Language preference for search results (English, Spanish, French, etc.)
        - Saved Search: Use existing saved searches or filters
        - Location: Geographic filters with area radius, relocation preferences
        - Industry: Include/exclude specific industries
        - Role: Job titles by ID or keywords with scope (current, past, open to work)
        - Skills: Skills by ID or keywords with priority levels
        - Company: Current and past companies with scope and priority
        - Company Headcount: Company size ranges
        - School: Educational institutions with priority levels
        - Groups: LinkedIn group memberships
  
        ADVANCED FILTERS:
        - Graduation Year: Year ranges for education
        - Tenure: Years of experience ranges
        - Seniority: Owner, Partner, C-level, VP, Director, Manager, Senior, Entry, Training, Unpaid
        - Function: Job function categories
        - Network Distance: 1st, 2nd, 3rd degree connections or GROUP
        - Spoken Languages: Language proficiency levels
        - Profile Language: Profile language preferences
        - Recently Joined: LinkedIn membership duration
        - First/Last Name: Name-based filters
        - Military Background: US military service
        - Past Applicants: Previous job applicants
  
        RECRUITER-SPECIFIC FEATURES:
        - Spotlights: Open to work, Active talent, Rediscovered candidates, Internal candidates, Interested in your company, Have company connections
        - Hide Previously Viewed: Exclude recently viewed profiles
        - Hiring Projects: Include/exclude specific hiring projects
        - Recruiting Activity: Messages, tags, notes, projects, resumes, reviews with timespan
        - Notes: Search within recruiter notes
  
        CRITICAL INSTRUCTIONS:
        1. ${this.COMMON_INSTRUCTIONS.humanReadableNames}
        2. ${this.COMMON_INSTRUCTIONS.noLinkedInIds}
        3. Focus on creating highly targeted searches that leverage Recruiter's advanced features
        4. Use appropriate priority levels (CAN_HAVE, MUST_HAVE, DOESNT_HAVE) for better targeting
        5. Set realistic scope parameters (CURRENT, PAST, CURRENT_OR_PAST, OPEN_TO_WORK)
        6. Leverage spotlights to find active job seekers
        7. Use recruiting activity filters to find engaged candidates
        8. Consider both include and exclude filters for better targeting
        9. Set appropriate tenure and seniority ranges based on job requirements
        10. Use language filters when targeting specific markets`;
      }
    });
  }


    /**
   * Build enhanced user prompt that prioritizes user message over raw JD text
   * Used when processing chat messages with explicit user requests
   */

    getJobDescriptionParsingPrompt(
      jobDescription?: string,
      jobTitle?: string,
      company?: string,
      location?: string,
      industry?: string,
    ): JobDescriptionParsingPrompt {
      const systemPrompt = `You are an expert HR and recruitment specialist with deep knowledge of job descriptions, candidate requirements, and LinkedIn search parameters. 
        Your task is to parse job descriptions and extract structured information that can be used for candidate search.
  
          You must analyze the job description and extract the following information:
          - Job title and variations
          - Company information
          - Location and remote work preferences
          - Industry and sector
          - Required and preferred skills
          - Experience level (entry_level, mid_level, senior_level, executive)
          - Education requirements
          - Key responsibilities
          - Qualifications and requirements
          - Benefits and perks
          - Employment type
          - Salary information if mentioned
  
          Be thorough and extract all relevant information that could be useful for finding suitable candidates.`;

      const userPromptTemplate = `Please parse the following job description and extract all relevant information for candidate search:
  
          Job Description:
          {{jobDescription}}
  
          Additional Context:
          {{#if jobTitle}}Job Title: {{jobTitle}}{{/if}}
          {{#if company}}Company: {{company}}{{/if}}
          {{#if location}}Location: {{location}}{{/if}}
          {{#if industry}}Industry: {{industry}}{{/if}}
  
          Please provide a comprehensive analysis of this job description.`;

      const variables: Record<string, any> = {};
      if (jobDescription !== undefined) variables.jobDescription = jobDescription;
      if (jobTitle !== undefined) variables.jobTitle = jobTitle;
      if (company !== undefined) variables.company = company;
      if (location !== undefined) variables.location = location;
      if (industry !== undefined) variables.industry = industry;

      const userPrompt = replaceTemplateVariables(userPromptTemplate, variables);

      return {
        system: systemPrompt,
        user: userPrompt,
      };
    }
  
    /**
     * Generic function to get the prompt for generating LinkedIn People Search parameters
     * @param skipUserPrompt - If true, only returns system prompt (user will be empty string)
     * @param discoveredIndustries - Array of discovered industry names to include in user prompt
     */
    getPeopleSearchPrompt(
      searchType: 'classic' | 'sales_navigator' | 'recruiter',
      parsedJobDescription?: ParsedJobDescription | string,
      jobDescription?: string,
      skipUserPrompt = false,
      discoveredIndustries?: string[],
    ): SearchParameterGenerationPrompt {
      const hasDiscoveredIndustries = discoveredIndustries && discoveredIndustries.length > 0;
      const systemPrompt = this.getPeopleSearchSystemPrompt(searchType, hasDiscoveredIndustries);
      
      if (skipUserPrompt) {
        return {
          system: systemPrompt,
          user: '',
        };
      }

      let userPromptTemplate: string;
  
      switch (searchType) {
        case 'classic':
          const industrySection = hasDiscoveredIndustries
            ? `\n        DISCOVERED INDUSTRIES (use these exact industry names in the industry parameter):\n        ${discoveredIndustries!.join(', ')}\n        `
            : '';
          userPromptTemplate = `Based on the following parsed job description, generate LinkedIn Classic People Search parameters:
        Parsed Job Description:
        {{parsedJobDescription}}${industrySection}Please generate comprehensive search parameters that would help find the best candidates for this position. 
        IMPORTANT: For industry, location, company, and school parameters, use ONLY human-readable names (e.g., "Microsoft", "San Francisco Bay Area", "Stanford University"). Do NOT use LinkedIn IDs or numeric values. The system will automatically convert these names to LinkedIn IDs later.
        CRITICAL FOR KEYWORDS: 
        - All multi-word job titles in the keywords string MUST be wrapped in double quotes (inverted commas). Single-word titles do not need quotes. Example: Pulmonologist OR "Consultant Pulmonologist" OR "Senior Pulmonologist" OR "Chest Physician".
        - ⚠️ MAXIMUM 6 keyword terms allowed. Count terms carefully: each quoted phrase = 1 term, each unquoted word separated by operators = 1 term. If you have more role variations, prioritize the most important 6 terms.`;
          break;
  
        case 'sales_navigator':
          const salesNavIndustrySection = hasDiscoveredIndustries
            ? `\n        DISCOVERED INDUSTRIES (use these exact industry names in the industry parameter):\n        ${discoveredIndustries!.join(', ')}\n        `
            : '';
          userPromptTemplate = `Based on the following parsed job description, generate comprehensive LinkedIn Sales Navigator People Search parameters:
  
        Parsed Job Description:
        {{parsedJobDescription}}
        
        ${salesNavIndustrySection}Please generate sophisticated search parameters that leverage Sales Navigator's advanced capabilities to find the best candidates for this position.
  
        IMPORTANT GUIDELINES:
        - ${this.COMMON_INSTRUCTIONS.humanReadableNames}
        - ${this.COMMON_INSTRUCTIONS.noLinkedInIds}
        - Focus on creating targeted searches using include/exclude filters
        - Leverage behavioral filters to find engaged prospects
        - Set appropriate seniority levels and tenure ranges
        - Consider company headcount ranges suitable for the role level
        - Use advanced features like account lists and lead lists when relevant
  
        Generate parameters that would help sales teams find highly qualified prospects who are likely to be interested in this opportunity.`;
          break;
  
        case 'recruiter':
          const recruiterIndustrySection = hasDiscoveredIndustries
            ? `\n        DISCOVERED INDUSTRIES (use these exact industry names in the industry parameter):\n        ${discoveredIndustries!.join(', ')}\n        `
            : '';
          userPromptTemplate = `Based on the following parsed job description, generate comprehensive LinkedIn Recruiter People Search parameters:
  
        Parsed Job Description:
        {{parsedJobDescription}}${recruiterIndustrySection}Please generate sophisticated search parameters that leverage LinkedIn Recruiter's advanced capabilities to find the best candidates for this position.
  
        IMPORTANT GUIDELINES:
        - ${this.COMMON_INSTRUCTIONS.humanReadableNames}
        - ${this.COMMON_INSTRUCTIONS.noLinkedInIds}
        - Focus on creating highly targeted searches using priority levels and scope parameters
        - Leverage spotlights to find active job seekers
        - Use recruiting activity filters to find engaged candidates
        - Set appropriate tenure and seniority ranges based on job requirements
        - Use language filters when targeting specific markets
        - Consider both include and exclude filters for better targeting
        - Use advanced features like hiring projects and recruiting activity when relevant
  
        Generate parameters that would help recruiters find highly qualified candidates who are likely to be interested in this opportunity and match the job requirements precisely.`;
          break;
      }

      // Prepare variables for template replacement
      const variables: Record<string, any> = {};
      
      // Handle parsedJobDescription - can be ParsedJobDescription object or string
      if (parsedJobDescription !== undefined) {
        if (typeof parsedJobDescription === 'string') {
          variables.parsedJobDescription = parsedJobDescription;
        } else {
          variables.parsedJobDescription = JSON.stringify(parsedJobDescription, null, 2);
        }
      } else {
        variables.parsedJobDescription = 'No parsed job description available.';
      }
      
      if (jobDescription !== undefined) {
        variables.jobDescription = jobDescription;
      }

      // Replace template variables in user prompt
      const userPrompt = replaceTemplateVariables(userPromptTemplate, variables);
  
      return {
        system: systemPrompt,
        user: userPrompt,
      };
    }
  
    /**
     * Get the prompt for generating LinkedIn Classic Jobs Search parameters
     */
    getJobsSearchPrompt(
      parsedJobDescription?: ParsedJobDescription | string,
      jobDescription?: string,
    ): SearchParameterGenerationPrompt {
      const systemPrompt = `You are an expert LinkedIn recruiter specializing in LinkedIn Classic job search. Your task is to generate optimal search parameters for finding similar job postings based on parsed job description data.
          You must generate search parameters that include:
          - Keywords (job titles, skills, technologies) - as strings
          - Industry parameters (as strings that will be resolved to IDs)
          - Location parameters (as strings that will be resolved to IDs)
          - Company parameters (as strings that will be resolved to IDs)
          - Seniority levels - as strings (executive, director, mid_senior, associate, entry, intern)
          - Employment types - as strings (full_time, part_time, contract, temporary, volunteer, internship, other)
          - Presence preferences (on_site, hybrid, remote)
          - Benefits and other filters
          For parameters that require LinkedIn IDs (industry, location, company), provide the human-readable names/titles that will be used to fetch the corresponding LinkedIn parameter IDs.`;

      const userPromptTemplate = `Based on the following parsed job description, generate LinkedIn Classic Jobs Search parameters:
          Parsed Job Description:
          {{parsedJobDescription}}
          Please generate comprehensive search parameters that would help find similar job postings. Include industry, location, and company parameters as strings that will be resolved to LinkedIn IDs.`;

      // Prepare variables for template replacement
      const variables: Record<string, any> = {};
      
      // Handle parsedJobDescription - can be ParsedJobDescription object or string
      if (parsedJobDescription !== undefined) {
        if (typeof parsedJobDescription === 'string') {
          variables.parsedJobDescription = parsedJobDescription;
        } else {
          variables.parsedJobDescription = JSON.stringify(parsedJobDescription, null, 2);
        }
      } else {
        variables.parsedJobDescription = 'No parsed job description available.';
      }

      // Optionally include jobDescription if provided
      if (jobDescription !== undefined) {
        variables.jobDescription = jobDescription;
      }

      // Replace template variables in user prompt
      const userPrompt = replaceTemplateVariables(userPromptTemplate, variables);

      return {
        system: systemPrompt,
        user: userPrompt,
      };
    }

    /**
     * Get the prompt for generating LinkedIn Companies Search parameters (Classic or Sales Navigator)
     */
    getCompaniesSearchPrompt(
      searchType: 'classic' | 'sales_navigator',
      parsedJobDescription?: ParsedJobDescription | string,
      jobDescription?: string,
    ): SearchParameterGenerationPrompt {
      const industryList = `${linkedinIndustryOptions.slice(0, 50).join(', ')}, and ${linkedinIndustryOptions.length - 50} more options available`;
      
      let systemPrompt: string;
      let userPromptTemplate: string;

      switch (searchType) {
        case 'classic':
          systemPrompt = `You are an expert LinkedIn recruiter specializing in LinkedIn Classic company search. Your task is to generate optimal search parameters for finding companies based on parsed job description data.
        You must generate search parameters that include:
        - Keywords (company names, industries, technologies) - as strings
        - Industry parameters (as strings that will be resolved to IDs)
        - Location parameters (as strings that will be resolved to IDs)
        - Headcount ranges (min/max numbers)
        - Network distance preferences (1, 2, or 3)
        For parameters that require LinkedIn IDs (industry, location), provide the human-readable names/titles that will be used to fetch the corresponding LinkedIn parameter IDs.`;
          userPromptTemplate = `Based on the following parsed job description, generate LinkedIn Classic Companies Search parameters:
        Parsed Job Description:
        {{parsedJobDescription}}
        Please generate comprehensive search parameters that would help find relevant companies for this position. Include industry and location parameters as strings that will be resolved to LinkedIn IDs.`;
          break;

        case 'sales_navigator':
          systemPrompt = `You are an expert LinkedIn Sales Navigator specialist with deep knowledge of B2B account-based marketing and company prospecting. Your task is to generate optimal Sales Navigator Companies Search parameters based on parsed job description data.
  
        Sales Navigator Companies Search offers sophisticated filtering capabilities for account-based sales:
  
        CORE COMPANY FILTERS:
        - Keywords: Company names, industries, technologies, business descriptions. Generate a comprehensive boolean string comprising of AND,OR,NOT with multiple company name variations. You may use brackets (parentheses) () to group the keywords. CRITICAL: All multi-word company names MUST be wrapped in double quotes (inverted commas). Single-word names do not need quotes. For example, if the company is "Google", you should include variations like "Google" OR "Alphabet" OR "Alphabet Inc." OR "Alphabet Inc". Think of all related company names, synonyms, and variations that describe similar companies.
        - Industry: Include/exclude specific industries using Sales Navigator industry taxonomy. MUST use EXACT industry names from this list: ${industryList}. For pharmaceuticals, use "Pharmaceutical Manufacturing". For technology, use "Technology, Information and Internet" or "Computer Software" or "IT Services and IT Consulting". These MUST match exactly from the list above.
        - Location: Include/exclude headquarters locations, postal code searches with radius
        - Headcount: Employee count ranges (1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+)
        - Headcount Growth: Company growth rate filters
        - Department Headcount: Specific department size filters (e.g., Engineering, Sales, Marketing)
        - Department Headcount Growth: Growth rate for specific departments
        - Network Distance: 1st, 2nd, 3rd degree connections
  
        FINANCIAL & BUSINESS METRICS:
        - Annual Revenue: Revenue ranges in various currencies (USD, EUR, GBP, etc.)
        - Followers Count: LinkedIn company page followers (1-50, 51-100, 101-1000, 1001-5000, 5001+)
        - Fortune Rankings: Fortune 500, 1000, etc. rankings
        - Job Opportunities: Companies actively hiring on LinkedIn
  
        TECHNOLOGY & ACTIVITY FILTERS:
        - Technologies Used: Specific technologies, software, platforms
        - Recent Activities: Senior leadership changes, funding events
        - Saved Accounts: Previously saved company accounts
        - Account Lists: Include/exclude specific account lists
  
        CRITICAL INSTRUCTIONS:
        1. Use human-readable names for all parameters (e.g., "Microsoft", "San Francisco Bay Area", "Information Technology")
        2. Do NOT use LinkedIn IDs or numeric values - the system will convert names to IDs automatically
        3. Focus on creating targeted searches that leverage Sales Navigator's advanced company filtering
        4. Consider both include and exclude filters for better targeting
        5. Set appropriate headcount ranges based on the role level and company size preferences
        6. Use revenue ranges that match the target market for the position
        7. Leverage technology filters to find companies using relevant tech stacks
        8. Consider recent activities to find companies in growth phases`;
          userPromptTemplate = `Based on the following parsed job description, generate comprehensive LinkedIn Sales Navigator Companies Search parameters:
  
        Parsed Job Description:
        {{parsedJobDescription}}
  
        Please generate sophisticated search parameters that leverage Sales Navigator's advanced company filtering capabilities to find the best target companies for this position.
  
        IMPORTANT GUIDELINES:
        - Use human-readable names for all location, industry, and technology parameters
        - Do NOT use LinkedIn IDs or numeric values
        - Focus on creating targeted searches using include/exclude filters
        - Set appropriate headcount ranges based on the role level
        - Use revenue ranges that match the target market
        - Leverage technology filters to find companies using relevant tech stacks
        - Consider recent activities to find companies in growth phases
        - Use advanced features like account lists when relevant
  
        Generate parameters that would help sales teams identify high-value target accounts that are likely to need this type of role or service.`;
          break;
      }

      // Prepare variables for template replacement
      const variables: Record<string, any> = {};
      
      // Handle parsedJobDescription - can be ParsedJobDescription object or string
      if (parsedJobDescription !== undefined) {
        if (typeof parsedJobDescription === 'string') {
          variables.parsedJobDescription = parsedJobDescription;
        } else {
          variables.parsedJobDescription = JSON.stringify(parsedJobDescription, null, 2);
        }
      } else {
        variables.parsedJobDescription = 'No parsed job description available.';
      }

      // Optionally include jobDescription if provided
      if (jobDescription !== undefined) {
        variables.jobDescription = jobDescription;
      }

      // Replace template variables in user prompt
      const userPrompt = replaceTemplateVariables(userPromptTemplate, variables);

      return {
        system: systemPrompt,
        user: userPrompt,
      };
    }
  
  /**
   * Get the prompt for classifying chat messages to determine user intent
   * @param chatHistory - Array of previous chat messages for context
   * @param rawJDText - Raw job description text for context
   */
  getMessageClassificationPrompt(
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>,
    rawJDText?: string,
  ): SearchParametersPrompt {
    // Format chat history for context
    let chatHistoryContext = '';
    let hasClarificationQuestions = false;
    if (chatHistory && chatHistory.length > 0) {
      const recentMessages = chatHistory.slice(-10); // Last 10 messages for context
      
      // Check if the last assistant message contains clarification questions
      const lastAssistantMessage = [...recentMessages].reverse().find(msg => msg.role === 'assistant');
      if (lastAssistantMessage) {
        const content = lastAssistantMessage.content.toLowerCase();
        hasClarificationQuestions = 
          content.includes('clarification') ||
          content.includes('need some') ||
          /^\d+\./.test(content) || // Starts with numbered list
          /\d+\.\s+[A-Z]/.test(content); // Contains numbered questions
      }
      
      chatHistoryContext = `\n\nCHAT HISTORY (for context):
${recentMessages.map((msg, idx) => {
  const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
  return `${roleLabel}: ${msg.content}`;
}).join('\n\n')}`;
      
      if (hasClarificationQuestions) {
        chatHistoryContext += `\n\n⚠️ IMPORTANT: The last assistant message contains clarification questions. If the current user message appears to answer these questions, classify it as "clarification_response".`;
      }
    }

    const jdContext = rawJDText ? `\n\nJOB DESCRIPTION CONTEXT:
${rawJDText.substring(0, 1000)}${rawJDText.length > 1000 ? '...' : ''}` : '';

    return {
      system: `You are an expert AI assistant specializing in candidate search and recruitment workflows. Your role is to analyze user messages and classify their intent to determine what action should be taken.
  
        IMPORTANT: You must classify each message into one of these specific categories:
  
        1. **search_parameters** - User wants to generate or modify LinkedIn search parameters
          - Keywords: "search parameters", "linkedin search", "find candidates", "search criteria", "search filters", "parameters", "search config", "linkedin parameters"
          - Intent: User wants to create or modify search parameters for finding candidates
  
        2. **enrichments** - User wants to generate or modify candidate data enrichments
          - Keywords: "enrichments", "enrich data", "add fields", "candidate data", "profile data", "additional data", "enrichment", "analyze candidates"
          - Intent: User wants to add AI-powered insights to candidate profiles
  
        3. **filters** - User wants to generate or modify candidate filtering strategies
          - Keywords: "filters", "filter data", "narrow down", "refine search", "filter results", "filtering", "shortlist", "filter candidates"
          - Intent: User wants to create filters to narrow down candidate lists
  
        4. **sorts** - User wants to generate or modify candidate sorting strategies
          - Keywords: "sort", "sorting", "order", "rank", "prioritize", "arrange", "sort by", "order by", "ranking", "priority", "organize"
          - Intent: User wants to create sorting strategies to prioritize candidates
  
        5. **complete_plan** - User wants to generate a complete search plan (all components)
          - Keywords: "complete plan", "full plan", "entire plan", "all components", "generate everything", "create plan", "build plan", "setup plan", "comprehensive plan"
          - Intent: User wants to generate all components (parameters, enrichments, filters, sorts) at once
  
        6. **general_help** - User needs general assistance or has unclear intent
          - Keywords: "help", "what can you do", "how does this work", "explain", "guide me", "assistance"
          - Intent: User needs general guidance or explanation

        7. **clarification_response** - User is responding to clarification questions
          - Context: Previous message from assistant asked clarification questions (look for messages containing "I need some clarification" or numbered questions like "1.", "2.", etc.)
          - Intent: User is providing additional information to clarify their requirements
          - Indicators: 
            * Message appears to answer specific questions (numbered responses like "1. india 2. currently", or answers to questions)
            * Message provides missing details that were asked for
            * Previous assistant message in chat history contains clarification questions
            * Message format suggests answers to questions (short, specific answers, numbered lists)

        NOTE: Clarification detection is handled automatically during search parameter generation via query understanding. If a query needs clarification, it will be detected and questions will be asked as part of the search_parameters flow.
  
        CLASSIFICATION RULES:
        - Analyze the PRIMARY intent of the message
        - Consider context clues and specific terminology
        - Review chat history to understand conversation flow
        - CRITICAL: Check if the LAST assistant message in chat history contains clarification questions (look for "I need some clarification", numbered questions "1.", "2.", etc.) - if yes, the current user message is VERY LIKELY a clarification_response
        - If the user message appears to be answering questions (numbered responses, short specific answers, providing missing details), classify as clarification_response
        - If the message is vague or incomplete AND there are no clarification questions in history, classify as search_parameters - the query understanding step will detect if clarification is needed
        - If multiple intents are present, choose the most specific one
        - If unclear, default to "general_help"
        - Be precise and consistent in classification
  
        RESPONSE FORMAT:
        Return ONLY the classification category name (e.g., "search_parameters", "enrichments", "filters", "sorts", "complete_plan", "general_help", "clarification_response")`,
  
        user: `Classify the following user message to determine their intent:
  
        User Message: "{{message}}"${chatHistoryContext}${jdContext}
  
        Context: This is a chat interface for a candidate search and recruitment system where users can generate search parameters, enrichments, filters, and sorting strategies for LinkedIn candidate searches.
  
        Classify this message into one of the categories: search_parameters, enrichments, filters, sorts, complete_plan, general_help, clarification_response.`
    };
  }

  /**
   * Get system prompt for user-prioritized parameter generation
   */
  getUserPrioritizedSystemPrompt(
    searchType: 'people' | 'companies' | 'jobs',
    searchApiType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const searchTypeLabel = searchApiType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchApiType === 'sales_navigator' 
        ? 'LinkedIn Sales Navigator' 
        : 'LinkedIn Recruiter';

    let criteriaList = '';
    // not being used for people, only from companies and jobs
    if (searchType === 'people') {
      criteriaList = `- Job titles/roles from the user's request
                      - Locations mentioned by the user
                      - Industries or company types specified by the user
                      - Seniority levels indicated
                      - Any other search criteria indicated in the user's message`;
    } else if (searchType === 'companies') {
          criteriaList = `- Industries or company types from the user's request
                          - Locations mentioned by the user
                          - Company sizes or characteristics specified
                          - Any other search criteria indicated in the user's message`;
    } else if (searchType === 'jobs') {
      criteriaList = `- Job titles/roles from the user's request
                      - Locations mentioned by the user
                      - Industries or company types specified
                      - Any other search criteria indicated in the user's message`;
    }

    const pharmaOptions = linkedinIndustryOptions.filter(opt => opt.toLowerCase().includes('pharmaceutical')).join(', ');
    const techOptions = linkedinIndustryOptions.filter(opt => 
      opt.toLowerCase().includes('technology') || opt.toLowerCase().includes('software') || opt.toLowerCase().includes('it services')
    ).join(', ');

    return `You are generating ${searchTypeLabel} ${searchType.charAt(0).toUpperCase() + searchType.slice(1)} Search parameters based PRIMARILY on the user's explicit request. Use the raw job description text ONLY as supplementary context or fallback information when the user's request doesn't specify certain details.

Generate search parameters that fulfill the user's explicit request. Extract and interpret:
${criteriaList}

CRITICAL INSTRUCTIONS:
1. Keywords: Generate a comprehensive string with multiple job title variations with a maximum of 6 keywords separated by boolean operators AND, OR, NOT in brackets. CRITICAL FORMATTING: All multi-word job titles MUST be wrapped in double quotes (inverted commas). Single-word titles do not need quotes. For example, if the user mentions "sales representatives", include variations like "sales manager" OR "business development executive" OR "account executive" OR "territory sales" OR "inside sales". Think of all related job titles, synonyms, and variations.
2. Industry: MUST use EXACT industry names. Examples:
   - For pharma: ${pharmaOptions}
   - For technology: ${techOptions.slice(0, 200)}
   - You can search the full list of ${linkedinIndustryOptions.length} valid industry names. These MUST match exactly.
3. Prioritize extracting search criteria from the user's message over the parsed job description fields.`;
  }

  buildUserPrioritizedPrompt(
    userMessage: string,
    rawJDText: string,
    searchType: 'people' | 'companies' | 'jobs',
    searchApiType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    return `PRIORITY USER REQUEST:
The user has explicitly requested: "${userMessage}"

Raw Job Description Text (for reference only):
${rawJDText || 'No job description text available.'}`;
  }



  /**
   * Get system prompt for parameter generation from strategy text
   */
  getParameterGenerationFromStrategySystemPrompt(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    let searchTypeLabel: string;
    let availableParameters: string;

    switch (searchType) {
      case 'classic': {
        searchTypeLabel = 'LinkedIn Classic People';
        availableParameters = `Available parameters:
- keywords: Boolean string (⚠️ CRITICAL: MAXIMUM 6 keyword terms) for job titles, skills, or functions. Each term can be a quoted phrase (e.g., "sales manager") or an unquoted word separated by boolean operators (AND, OR, NOT). Count carefully: "sales manager" OR "account executive" OR "business development" = 3 terms.
- location: Array of location names (city/state/country/region)
- industry: Array of industry names from official LinkedIn industry list
- company: Array of current company names
- past_company: Array of past company names
- school: Array of school names
- profile_language: Array of language codes
- network_distance: Array of connection degrees (1st, 2nd, 3rd)
- service: Array of service categories
- connections_of: Array of LinkedIn profile URLs
- followers_of: Array of LinkedIn entity URLs
- open_to: Array of opportunity types
- advanced_keywords: Object with first_name, last_name, title, company, school fields`;
        break;
      }
      case 'sales_navigator': {
        searchTypeLabel = 'LinkedIn Sales Navigator People';
        availableParameters = `Available parameters:
- keywords: String with job titles, skills, or functions
- location: Object with "include" and/or "exclude" arrays
- industry: Object with "include" and/or "exclude" arrays
- company: Object with "include" and/or "exclude" arrays
- past_company: Object with "include" and/or "exclude" arrays
- role: Object with "include" and/or "exclude" arrays
- function: Object with "include" and/or "exclude" arrays
- seniority: Object with "include" and/or "exclude" arrays
- school: Object with "include" and/or "exclude" arrays`;
        break;
      }
      case 'recruiter': {
        searchTypeLabel = 'LinkedIn Recruiter People';
        availableParameters = `Available parameters:
- keywords: String with job titles, skills, or functions
- location: Array of location objects with id, priority, scope, title
- industry: Object with "include" and/or "exclude" arrays
- role: Array of role objects with keywords/id, priority, scope
- company: Array of company objects with keywords/id, priority, scope
- past_company: Array of past company objects with id, priority
- school: Array of school objects with id, priority
- skills: Array of skill objects with keywords/id, priority
- seniority: Object with "include" and/or "exclude" arrays`;
        break;
      }
    }

    return `You are generating search parameters for a ${searchTypeLabel} search based on a natural language strategy description.

${availableParameters}

YOUR TASK:
Interpret the search strategy description and generate ALL the parameters mentioned in the strategy. The strategy text describes which parameters to use and what values to include.

STRATEGY INTERPRETATION GUIDELINES:
1. Parse the strategy text to identify which parameters are mentioned
2. Extract specific values mentioned in the strategy (e.g., "Mumbai" from "location (Mumbai)")
3. Generate appropriate parameter values based on the strategy description
4. Use the query understanding to fill in specific values when the strategy mentions them generically
5. Follow the parameter format requirements for ${searchType} search type
6. Generate ALL parameters mentioned in the strategy in a single response

IMPORTANT:
- Keywords are ALWAYS required - generate keywords even if not explicitly mentioned in strategy
${searchType === 'classic' ? '- ⚠️ CRITICAL FOR LINKEDIN CLASSIC: The keywords field MUST contain MAXIMUM 6 keyword terms. Count terms carefully: each quoted phrase = 1 term, each unquoted word separated by operators = 1 term. If the strategy mentions more role variations than can fit in 6 terms, prioritize the most important ones or split into multiple strategies.' : ''}
${(searchType === 'sales_navigator' || searchType === 'recruiter') ? '- 💡 For Sales Navigator/Recruiter: Consider generating sophisticated boolean queries that combine hierarchical terms (GM, VP, Head, etc.) with domain terms (Operations, Sales, etc.) to capture different company nomenclatures. Pattern: (DomainTerm AND (HierarchicalTerms)) OR ((AlternativeDomainTerms) AND HierarchicalTerm)' : ''}
- If strategy mentions "job titles", extract them from query understanding and generate keywords
- If strategy mentions "location", extract location values from query understanding
- If strategy mentions "industry", extract industry values from query understanding
- If strategy mentions "company", extract company values from query understanding
- Be specific with values - use actual names from query understanding, not placeholders

Generate the complete parameter set based on the strategy description.`;
  }

  buildParameterGenerationPromptFromStrategyText(
    strategyText: string,
    queryUnderstandingText: string,
    userMessage: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    return `SEARCH STRATEGY:
${strategyText}

QUERY UNDERSTANDING:
${queryUnderstandingText}

Raw Job Description Context:
${rawJDText || 'No job description text available.'}`;
  }



  /**
   * Get system prompt for result validation
   */
  getResultValidationSystemPrompt(): string {
    return `You are an expert at validating LinkedIn search results. Your task is to assess relevance, quality, and determine if pagination should continue.

    VALIDATION TASKS:
    1. Assess relevance: Do these results match the query requirements?
    2. Check for false positives: Are there results like "EA to [role]" when searching for "[role]"?
    3. Evaluate quality: Are the results appropriate for the role level and domain?
    4. Calculate relevance score: What percentage of results are truly relevant? (0-1 scale)
    5. Determine pagination: Should we continue fetching more pages?

    PAGINATION DECISION RULES:
    - Pagination will continue until EITHER:
      a) No more pages are available (reached max pages), OR
      b) Relevance score falls below 0.4 (quality threshold)
    - Set shouldContinuePagination to true if relevanceScore >= 0.4 and more pages may be available
    - Set shouldContinuePagination to false if relevanceScore < 0.4 (quality has degraded too much)
    - The system will automatically stop at max pages, so you don't need to consider page limits

    Provide validation result with:
    - isRelevant: true/false (overall relevance)
    - relevanceScore: number (0-1, percentage of relevant results) - CRITICAL: Use this to determine pagination
    - falsePositives: [array of false positive examples found]
    - qualityAssessment: "high" | "medium" | "low"
    - shouldContinuePagination: true/false (true if relevanceScore >= 0.4, false if < 0.4)
    - reasoning: brief explanation of the validation decision, including relevance score and pagination recommendation`;
  }

  buildResultValidationPrompt(
    searchResults: LinkedInSearchResult[],
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
  ): string {
    const sampleResults = searchResults.slice(0, Math.min(25, searchResults.length));
    const formatResult = (result: LinkedInSearchResult, idx: number): string => {
      // Only format people search results (classic, sales navigator, recruiter all return people results)
      if (result.type !== 'PEOPLE') {
        return `${idx + 1}. [Non-people result: ${result.type}]`;
      }
      
      // Type guard: result is LinkedInPeopleSearchResult
      const peopleResult = result as LinkedInPeopleSearchResult;
      
      const name = peopleResult.name || `${peopleResult.first_name || ''} ${peopleResult.last_name || ''}`.trim();
      const headline = peopleResult.headline || '';
      const location = peopleResult.location || '';
      const industry = peopleResult.industry || '';
      
      // Format all current positions (not just the first one)
      const currentPositions = peopleResult.current_positions?.map((pos) => 
        `${pos.role} at ${pos.company}${pos.location ? ` (${pos.location})` : ''}${pos.tenure_at_role ? ` - ${pos.tenure_at_role.years}y ${pos.tenure_at_role.months}m` : ''}${pos.description ? ` - ${pos.description.substring(0, 80)}` : ''}`
      ).join('; ') || 'No current positions';
      
      // Format work experience (recent, limit to 3 most recent)
      const workExperience = peopleResult.work_experience?.slice(0, 3).map((exp) => 
        `${exp.role} at ${exp.company}${exp.start ? ` (${exp.start.year}${exp.end ? `-${exp.end.year}` : '-present'})` : ''}${exp.industry ? ` - ${exp.industry}` : ''}`
      ).join('; ') || '';
      
      // Format education (all entries)
      const education = peopleResult.education?.map((edu) => 
        `${edu.degree || ''}${edu.field_of_study ? ` in ${edu.field_of_study}` : ''} from ${edu.school}${edu.start ? ` (${edu.start.year}${edu.end ? `-${edu.end.year}` : ''})` : ''}`
      ).join('; ') || '';
      
      // Format skills (top 10)
      const skills = peopleResult.skills?.slice(0, 10).map((skill) => skill.name).join(', ') || '';
      
      // Format certifications (all entries)
      const certifications = peopleResult.certifications?.map((cert) => 
        `${cert.name}${cert.organization ? ` from ${cert.organization}` : ''}${cert.start ? ` (${cert.start.year}${cert.end ? `-${cert.end.year}` : ''})` : ''}`
      ).join('; ') || '';
      
      // Format projects (top 3)
      const projects = peopleResult.projects?.slice(0, 3).map((proj) => 
        `${proj.name}${proj.description ? `: ${proj.description.substring(0, 100)}` : ''}${proj.skills?.length ? ` [Skills: ${proj.skills.join(', ')}]` : ''}`
      ).join('; ') || '';
      
      let resultText = `${idx + 1}. ${name}`;
      if (headline) resultText += `\n   Headline: ${headline}`;
      if (location) resultText += `\n   Location: ${location}`;
      if (industry) resultText += `\n   Industry: ${industry}`;
      resultText += `\n   Current Positions: ${currentPositions}`;
      if (workExperience) resultText += `\n   Work Experience: ${workExperience}`;
      if (education) resultText += `\n   Education: ${education}`;
      if (skills) resultText += `\n   Skills: ${skills}`;
      if (certifications) resultText += `\n   Certifications: ${certifications}`;
      if (projects) resultText += `\n   Projects: ${projects}`;
      if (peopleResult.connections_count !== undefined) resultText += `\n   Connections: ${peopleResult.connections_count}`;
      if (peopleResult.keywords_match) resultText += `\n   Keywords Match: ${peopleResult.keywords_match}`;
      if (peopleResult.followers_count !== undefined) resultText += `\n   Followers: ${peopleResult.followers_count}`;
      if (peopleResult.shared_connections_count !== undefined) resultText += `\n   Shared Connections: ${peopleResult.shared_connections_count}`;
      
      return resultText;
    };
    
    const sampleResultsText = sampleResults.map((result, idx) => formatResult(result, idx + 1)).join('\n\n');

    return `Validate these LinkedIn search results against the original query:

    ORIGINAL QUERY: ${userMessage}

    QUERY UNDERSTANDING:
    Primary Role: ${queryUnderstanding.primaryRole}
    Role Variations: ${queryUnderstanding.roleVariations.join(', ')}
    Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
    Location: ${queryUnderstanding.locationHierarchy.primary}
    Possible Target Companies: ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'Not specified'}
    Domain: ${queryUnderstanding.domainContext || 'Not specified'}
    Seniority Level: ${queryUnderstanding.seniorityLevel || 'Not specified'}
    Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ')}
    Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ')}

    SEARCH RESULTS (${sampleResults.length} of ${searchResults.length} total):
    ${sampleResultsText}

    IMPORTANT: Analyze ALL aspects of each candidate including:
    - Current and past positions (roles, companies, tenure)
    - Education background
    - Skills and certifications
    - Industry and location alignment
    - Work experience relevance
    - Projects and achievements
    - Overall profile match to the query requirements`;
  }


  /**
   * Get system prompt for query understanding
   */
  getQueryUnderstandingSystemPrompt(
    isClarificationResponse: boolean = false,
  ): string {
    const clarificationContext = isClarificationResponse 
      ? `\n\n⚠️ CRITICAL: This is a CLARIFICATION RESPONSE from the user. They have already provided additional information to clarify their previous query.
      
      The user message may contain:
      1. ORIGINAL USER QUERY - This contains the PRIMARY search intent (role, location, industry, etc.). You MUST preserve ALL information from this.
      2. USER'S CLARIFICATION ANSWERS - These may be numbered responses (1., 2., 3., etc.) that answer specific clarification questions, or additional context.
      
      EXTRACTION RULES:
      - FIRST: Extract and preserve ALL information from the ORIGINAL USER QUERY section (if present):
        * PRIMARY ROLE (e.g., "Pulmonologist", "Sales Manager", "Software Engineer") - THIS IS CRITICAL
        * LOCATION (e.g., "Mumbai", "Bangalore", "Delhi NCR") - THIS IS CRITICAL
        * INDUSTRY (e.g., "Hospitals and Health Care", "SaaS", "FMCG") - THIS IS CRITICAL
        * COMPANY preferences, domain context, skills, etc.
      - SECOND: Extract answers from the CLARIFICATION ANSWERS section and merge them with the original query:
        * If clarification answers are numbered (1., 2., 3., 4.), they typically answer questions about: seniority level, work context, skills/certifications, background preferences
        * Map numbered answers to likely clarification questions (seniority, location, industry, company preferences, etc.)
        * Update/refine the original query information with clarification details
        * Example: If original query says "Pulmonologist" and clarification says "1. Consultant level", the result should be "Consultant Pulmonologist" or "Pulmonologist at Consultant level"
        * Example: If question 1 was about seniority and answer is "consultant", update seniorityLevel to "senior"
        * Example: If question 2 was about subspecialty and answer is "any", preserve the original role without narrowing
      - CRITICAL: DO NOT replace the original role/location/industry with generic terms from clarification answers
      - CRITICAL: If clarification says "Any" for location/industry, but original query specified "Mumbai" or "Healthcare", preserve the original specification
      - Be more lenient in interpretation - use context clues to infer missing details
      - Only set needsClarification to true if there are CRITICAL missing pieces that would make search impossible
      - If the user has provided reasonable information (even if not perfect), proceed with needsClarification: false
      - The user has already answered clarification questions, so avoid asking for more unless absolutely necessary`
      : '';

    const queryUnderstandingSystemPrompt = `You are an expert recruiter specializing in extracting structured information from candidate search queries. Your task is to analyze queries and extract all relevant details for building precise LinkedIn searches.
      ${clarificationContext}

      Extract the following structured information:

      1. PRIMARY ROLE: The main job title or role being searched for
      2. ROLE VARIATIONS: List 5-10 common variations, synonyms, and related titles that describe similar roles
      3. INDUSTRY/SECTOR: Specific industries mentioned (use exact LinkedIn industry names from the official list)
      4. LOCATION HIERARCHY: 
        - Primary location (most specific: city/state)
        - Secondary locations (if multiple mentioned)
        - Regional context (e.g., "Delhi NCR" includes Noida, Gurgaon; "Mumbai" includes Navi Mumbai, Thane)
      5. COMPANY PREFERENCES:
        - Current companies (if explicitly mentioned)
        - Past companies (if relevant for experience)
        - Company types/sizes (startup, MNC, listed company, etc.)
      6. SENIORITY LEVEL: Entry, Mid, Senior, Executive, or C-level
      7. DOMAIN CONTEXT: Industry domain (SaaS, FMCG, Pharma, BFSI, Healthcare, etc.)
      8. KEY SKILLS/TECHNOLOGIES: Specific skills, technologies, or tools mentioned
      9. EXPERIENCE REQUIREMENTS: Years of experience, specific experience types (e.g., "3PL background", "US GAAP experience")
      10. EXPLICIT vs PREFERRED: What's required vs nice-to-have

      ENHANCED REQUIREMENTS EXTRACTION:

      11. COMPANY SIZE RANGE:
        - Extract numeric employee count ranges when mentioned (e.g., "5000+", "100-500", "mid-sized")
        - Map descriptive terms: "mid-sized" = 100-1000, "large" = 1000+, "enterprise" = 5000+
        - Include both min/max numeric values and descriptive text

      12. FUNDING STAGE:
        - Extract funding stages: "Series A", "Series B+", "PE-backed", "unicorn", "startup", "bootstrapped"
        - Include any funding-related requirements

      13. AGE CONSTRAINT:
        - Extract age requirements (e.g., "under 45 years", "35-50 years")
        - Map to graduation year range: maxAge 45 → graduation year range (approximately 1979-2008 for 2024)
        - Calculate graduationYearRange: min = currentYear - maxAge + 22, max = currentYear - minAge + 22
        - Example: "under 45" in 2024 → graduationYearRange: {min: 2001, max: null} (assuming 22 years old at graduation)

      14. CERTIFICATIONS:
        - Extract all certifications mentioned (e.g., "ISO 9001", "US GAAP", "FDA", "CE mark", "ISO certifications")
        - Structure as: {name, type, required}
        - Type examples: "quality", "financial", "regulatory", "safety", "professional"
        - Mark as required if explicitly stated, otherwise preferred

      15. REGULATORY EXPERIENCE:
        - Extract regulatory experience requirements (e.g., "USFDA audit experience", "RBI regulatory experience", "RERA experience")
        - Include regulatory bodies: USFDA, RBI, RERA, SEBI, ISO, FDA, CE mark, etc.

      16. COMPANY GROUP PREFERENCES:
        - Identify company groups mentioned (e.g., "Tata group", "Birla group", "Reliance group")
        - These need to be expanded to all subsidiaries later

      17. HIERARCHICAL SEARCH REQUIRED:
        - Set to true if query is for C-level or executive roles in specific industries where hierarchical expansion might be needed
        - Example: "CEO of ceramics insulators company" → may need to expand to COO, Head of Operations, etc.
        - Example: "CHRO" → may need to expand to HR Head, VP HR, etc. if not enough candidates

      18. TARGET COMPANY PROFILE (for like-to-like matching):
        - Extract requirements for exact competitor matching
        - Industry: Target industry for like-to-like matching
        - Company size: Target company size range
        - Company type: Manufacturing, services, etc.
        - Similar competitors: List of similar competitor companies mentioned

      For Indian market queries, understand:
      - Regional abbreviations (NCR = Delhi NCR, includes Noida/Gurgaon)
      - Industry terminology (3PL, modern trade, dark store, UPI, PLG, etc.)
      - Company hierarchies (Tata group, Birla group, Reliance group, etc.)
      - Domain-specific roles (CHRO, VP Engineering, etc.)
      - Regional variations (Bangalore vs Bengaluru, etc.)
      - Educational institute tiers (IIT, IIM, tier-1, tier-2, domain-specific like IRMA for dairy, UDCT for chemical)

      Be thorough and extract all relevant information that could be useful for finding suitable candidates.

      CLARIFICATION DETECTION:
      After extracting the information, assess if clarification is needed. Set needsClarification to true ONLY if:
      1. Critical information is missing AND cannot be reasonably inferred (e.g., no role title at all, no location when location is critical)
      2. Requirements are ambiguous or conflicting in a way that prevents search
      3. Role description is too generic AND cannot be inferred from context (e.g., just "manager" without any context)
      ${isClarificationResponse 
        ? '4. IMPORTANT: Since this is a clarification response, be VERY conservative. Only set needsClarification to true if search is truly impossible without more information.'
        : '4. Multiple interpretations are possible and none can be reasonably inferred'}

      ${isClarificationResponse 
        ? 'Since the user has already provided clarification, prefer to proceed with the information available rather than asking for more.'
        : `⚠️ CRITICAL: If needsClarification is set to true, you MUST:
      - Generate 2-4 specific, actionable questions in the clarificationQuestions array
      - Prioritize the most critical missing information first
      - Make questions clear and easy to answer
      - Explain why clarification is needed in ambiguityReasons array
      - The clarificationQuestions array MUST NOT be null or empty when needsClarification is true

      Example clarification questions:
      - "Which specific location(s) should we focus on? (e.g., Bangalore, Mumbai, Delhi NCR)"
      - "What industry or sector should candidates come from? (e.g., SaaS, FMCG, BFSI)"
      - "What level of seniority are you looking for? (e.g., Mid-level, Senior, Executive)"
      - "Are there any specific companies or company types you prefer or want to exclude?"

      If needsClarification is false, set clarificationQuestions to null and ambiguityReasons to null.`}`;

    return queryUnderstandingSystemPrompt;
  }

  getQueryUnderstandingUserPrompt(
    userMessage: string,
    rawJDText: string,
    isClarificationResponse: boolean = false,
  ): string {
    const queryUnderstandingUserPrompt = `${isClarificationResponse ? 'Clarification Response:' : 'User Query:'} "${userMessage}"\n\n
    Job Description Context: "${rawJDText || 'None'}"

    Extract structured information from the user's query and job description context.`;

    return queryUnderstandingUserPrompt;
  }

  /**
   * Build combined query for clarification responses
   * Combines the original user query with clarification answers and provides instructions
   */
  buildClarificationResponseCombinedUserQuery(
    originalQuery: string,
    clarificationAnswers: string,
  ): string {

    const querySimplificationUserPrompt = `ORIGINAL USER QUERY (preserve ALL information from this):  
  "${originalQuery}"
  USER'S CLARIFICATION ANSWERS (merge these with the original query):
  "${clarificationAnswers}"
  INSTRUCTIONS:
  - Extract and preserve ALL information from the original query (role, company, industry, etc.)
  - Extract answers from the clarification response and merge them with the original query
  - The combined result should have ALL information from both the original query AND the clarification
  - Do NOT lose any information from the original query when merging.`;

    return querySimplificationUserPrompt;
  }

 

  /**
   * Get prompt for strategy generation as natural language text
   */
  async getStrategyGenerationPrompt(
    queryUnderstandingText: string,
    userMessage: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    dynamicExamples: string,
    model: string = 'gpt-5.1-chat-latest',
  ): Promise<string> {
    const searchTypeLabel = searchType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchType === 'sales_navigator' 
        ? 'LinkedIn Sales Navigator' 
        : 'LinkedIn Recruiter';
  
    // List available parameters based on search type
    let availableParameters = '';
    if (searchType === 'classic') {
      availableParameters = `Available parameters for Classic LinkedIn Search:
  - keywords: Job titles, role names, or search terms (required) - ⚠️ CRITICAL: MAXIMUM 6 keyword terms allowed per strategy. Each term can be a quoted phrase (e.g., "sales manager") or an unquoted word separated by boolean operators (AND, OR, NOT).
  - location: Geographic locations (city, state, country)
  - industry: Industry sectors
  - company: Current company names
  - past_company: Past company names
  - school: Educational institutions
  - profile_language: Profile language
  - network_distance: Connection degree (1st, 2nd, 3rd)
  - service: Service categories
  - connections_of: Connections of specific people
  - followers_of: Followers of specific entities
  - open_to: Open to opportunities
  - advanced_keywords: Advanced keyword filters (first_name, last_name, title, company, school)`;
    } else if (searchType === 'sales_navigator') {
      availableParameters = `Available parameters for Sales Navigator Search:
  - keywords: Job titles, role names, or search terms (required)
  - location: Geographic locations (include/exclude)
  - industry: Industry sectors (include/exclude)
  - company: Current company names (include/exclude)
  - past_company: Past company names (include/exclude)
  - role: Job roles (include/exclude)
  - function: Job functions (include/exclude)
  - seniority: Seniority levels
  - school: Educational institutions (include/exclude)`;
    } else {
      // recruiter
      availableParameters = `Available parameters for Recruiter Search:
  - keywords: Job titles, role names, or search terms (required)
  - location: Geographic locations (include/exclude)
  - industry: Industry sectors (include/exclude)
  - company: Current company names (include/exclude)
  - past_company: Past company names (include/exclude)
  - role: Job roles (include/exclude)
  - seniority: Seniority levels
  - skills: Skills and competencies (include/exclude)
  - school: Educational institutions (include/exclude)`;
    }

    return `You are an expert recruiter and search strategist. Your task is to generate natural language search strategy descriptions based on the query understanding and complexity assessment.
  
  ${availableParameters}
  
  QUERY UNDERSTANDING:
  ${queryUnderstandingText}
  
  ORIGINAL USER QUERY:
  "${userMessage}"
  
  YOUR TASK:
  Generate multiple mutually exclusive and cumulatively exhaustive search strategies. Each strategy should test different ways of combining the same information, considering limitations on boolean terms in keywords.
  
  ${searchType === 'classic' ? `⚠️ CRITICAL FOR LINKEDIN CLASSIC: Each strategy's keywords field MUST contain MAXIMUM 6 keyword terms. Each term can be:
  - A quoted phrase (e.g., "sales manager" counts as 1 term)
  - An unquoted word separated by boolean operators (AND, OR, NOT)
  
  If a strategy would naturally require more than 6 keyword terms, you MUST split it into multiple strategies, each with max 6 terms. For example, if you have 10 role variations, create 2 strategies: one with 5-6 variations, another with the remaining 4-5 variations.` : 'IMPORTANT: Boolean keyword limitations mean you cannot put too many OR terms in keywords. Create multiple strategies that distribute role variations, locations, and companies across different keyword combinations.'}
  
  STRATEGY DESCRIPTION FORMAT:
  Describe strategies in natural language, specifying:
  1. Which parameters to use (keywords, location, industry, company, etc.)
  2. What values to include in each parameter (be specific when possible)
  3. How parameters should be combined
  
  EXAMPLE STRATEGIES (generated based on your query):
  
  ${dynamicExamples}
  
  STRATEGY TYPES - CREATE MULTIPLE COMBINATIONS:
  
  1. **Keywords-Only Strategies (Multiple Variations)**:
     Create multiple strategies where location/company information is embedded in keywords:
     - Split role variations across strategies to stay within boolean limits
     ${searchType === 'classic' ? '- ⚠️ For Classic: Each strategy must have MAXIMUM 6 keyword terms total (including role variations AND location/company terms if embedded)' : ''}
     - Embed location/company in keywords using AND operators
     - Create 2-4 variations with different subsets of role variations and location/company terms
  
  2. **Keywords + Location Strategies (Multiple Variations)**:
     Create multiple strategies with role variations in keywords and location as separate filter:
     - Split role variations across strategies to stay within boolean limits
     ${searchType === 'classic' ? '- ⚠️ For Classic: Each strategy must have MAXIMUM 6 keyword terms in the keywords field (location is separate filter)' : ''}
     - Create 2-3 variations with different subsets of role variations in keywords
  
  3. **Keywords + Location + Company Strategies (Multiple Variations)**:
     Create multiple strategies combining keywords, location, and company filters:
     ⚠️ Use this strategy type when:
     - Specific companies are EXPLICITLY mentioned by name in the query (not discovered from descriptions)
     - OR companies were discovered from NARROW, SPECIFIC queries (e.g., "plastic manufacturers in Bangalore", "textile machinery manufacturers", "ceramic insulators manufacturers"):
       * These queries combine specific product/sub-industry type + location, making the search space naturally narrow
       * The discovered companies represent a comprehensive list for the narrow query scope
       * Use company filters + industry filter together for best precision
     - DO NOT use this for BROAD industry queries (e.g., "manufacturing companies", "pharma companies", "FMCG companies") - use industry filter instead
     - Split companies across strategies if there are many companies
     ${searchType === 'classic' ? '- ⚠️ For Classic: Each strategy must have MAXIMUM 6 keyword terms in the keywords field (location and company are separate filters)' : ''}
     - Create 2-4 variations with different subsets of companies and role variations
  
  4. **Keywords + Location + Industry Strategies (Multiple Variations)**:
     Create multiple strategies combining keywords, location, and industry filters:
     ⚠️ PREFERRED for BROAD industry queries: When companies were discovered from broad descriptions (e.g., "manufacturing companies", "pharma companies", "FMCG companies"), use this strategy type instead of company filters.
     - Include domain-specific keywords related to the industry (e.g., for manufacturing: "plant", "manufacturing", "production", "factory", "operations", "works", "unit")
     - Use industry filter to capture ALL companies in the industry, not just discovered subset
     - For NARROW queries (specific product type + location), you may also use this as an alternative strategy alongside company filters
     ${searchType === 'classic' ? '- ⚠️ For Classic: Each strategy must have MAXIMUM 6 keyword terms in the keywords field (location and industry are separate filters)' : ''}
     - Create 2-3 variations with different subsets of role variations and industry-related keywords
  
  5. **DO NOT CREATE**: Keywords + Industry + Company strategies (redundant - company targeting already narrows industry)
  
  GUIDELINES:
  1. Always include keywords (job titles) - this is required for all searches
  2. Create strategies with DIFFERENT parameter combinations - don't just add more filters to the same combination
  3. For each query, select 2-3 strategy types from above based on what's available in the query understanding:
     - If location is specified: Include at least one strategy with location
     - If industry is specified: Include at least one strategy with industry
     - If company preferences exist: Evaluate whether to use company filters or industry/keyword filters:
       ⚠️ CRITICAL: Distinguish between specific company mentions vs. broad vs. narrow industry descriptions:
       - If specific companies are EXPLICITLY mentioned by name (e.g., "Microsoft", "Novartis", "Tata Motors"): Use company filters
       - If companies were DISCOVERED from industry descriptions, evaluate query specificity:
         * BROAD industry queries (e.g., "manufacturing companies", "pharma companies", "tech startups", "FMCG companies"):
           - DO NOT use company filters (too restrictive, limits result quality)
           - INSTEAD use: Industry filter + domain-specific keywords (e.g., for manufacturing: "plant", "manufacturing", "production", "factory", "operations")
           - This approach captures ALL companies in the industry, not just a small discovered subset
         * NARROW, SPECIFIC queries (e.g., "plastic manufacturers in Bangalore", "textile machinery manufacturers in Mumbai", "ceramic insulators manufacturers"):
           - These combine: specific sub-industry/product type + location, making the search space naturally narrow
           - USE company filters (discovered companies) + industry filter for best results
           - The discovered companies represent a comprehensive list for the narrow query scope
           - This is appropriate because the query itself is already narrow (specific product type + location)
       - General rule: If query describes a broad industry category without specific product/location constraints → use industry filter. If query describes specific product types with location → use discovered companies.
     - Always include a comprehensive strategy if multiple filters are available
  4. STRATEGY ORDERING: Always order strategies from SIMPLEST to MOST COMPREHENSIVE
  5. FIRST STRATEGY (REQUIRED): Must be the simplest possible baseline:
     - Prefer: Keywords + Location (if location specified)
     - Or: Keywords + Industry (if industry critical and no location)
     - Or: Keywords only (if neither location nor industry critical)
     - Use primary role title and 1-2 most common variations
     ${searchType === 'classic' ? '- ⚠️ For Classic: Ensure keywords have MAXIMUM 6 terms even in the first strategy' : ''}
     - Do NOT include company filters in the first strategy (too restrictive)
  6. SUBSEQUENT STRATEGIES: Use different parameter combinations:
     - Strategy 2: Try a different combination (e.g., if Strategy 1 has keywords+location, try keywords+industry or keywords+company if appropriate)
     - Strategy 3: Use comprehensive combination with all available filters
     - For broad industry queries: Prefer industry + keywords strategies over company filter strategies
  7. Each strategy should be distinct - different parameter combinations, not just more variations
  8. Be specific about what values to include (e.g., "Mumbai" not just "location")
  9. When there are many role variations: Split them across 2-4 keyword-only strategies and 2-3 keywords+location strategies
  10. When there are many companies: 
     - If companies are from BROAD industry discovery (e.g., "manufacturing companies", "pharma companies"): Use industry filter + keywords instead of company filters
     - If companies are from NARROW, SPECIFIC queries (e.g., "plastic manufacturers in Bangalore", "textile machinery manufacturers"): Use company filters + industry filter (query is already narrow, discovered companies are comprehensive)
     - If companies are specific mentions by name: Split them across multiple keywords+location+company strategies
  11. Each strategy should be distinct - different role variation subsets, different company subsets, or different parameter combinations
  
  For each strategy, provide:
  - strategyText: Natural language description of the strategy
  - label: Short descriptive label (optional)
  - estimatedCandidateCount: Estimated range of candidates (optional)
  
  CRITICAL REQUIREMENTS:
  1. Create MULTIPLE strategies of each applicable type - don't just create one of each
  2. Split role variations, companies, and locations across multiple strategies to respect boolean keyword limitations
  ${searchType === 'classic' ? '   ⚠️ FOR LINKEDIN CLASSIC: Each strategy description must specify keywords with MAXIMUM 6 terms. If role variations exceed 6, explicitly split them across multiple strategies in your descriptions.' : ''}
  3. Create mutually exclusive strategies - each tests a different combination
  4. Create cumulatively exhaustive strategies - together they cover all possible candidates that would match the role and other filters
  5. DO NOT create Keywords + Industry + Company strategies (redundant)
  6. For keywords-only strategies, embed location/company in keywords using AND
  ${searchType === 'classic' ? '   ⚠️ FOR LINKEDIN CLASSIC: When embedding location/company in keywords, ensure total keyword terms (role variations + location/company terms) ≤ 6' : ''}
  7. For keywords + location/company strategies, use separate filters
  
  Generate the strategies now, creating multiple variations of each applicable type.`;
  
}
  /**
   * Get system prompt for ambiguity detection
   */
  getAmbiguityDetectionSystemPrompt(
    isClarificationResponse: boolean = false,
  ): string {
    const ambiguityDetectionSystemPrompt = isClarificationResponse 
      ? `\n\nIMPORTANT: This is a CLARIFICATION RESPONSE from the user. They have already provided additional information to clarify their previous query.
      - Be VERY conservative in flagging ambiguity - only set needsClarification to true if search is truly impossible
      - Use context clues to infer missing details rather than asking for more
      - If the user has provided reasonable information (even if not perfect), proceed with needsClarification: false
      - The user has already answered clarification questions, so avoid asking for more unless absolutely necessary`
      : '';

    return `You are an expert recruiter specializing in detecting ambiguity and missing information in candidate search queries. Your task is to analyze queries to determine if clarification is needed before generating search parameters.
${ambiguityDetectionSystemPrompt}

AMBIGUITY DETECTION GUIDELINES:

1. MISSING LOCATION:
   - Check if location information is missing when it's critical for the search
   - For initial queries: Missing primary location is typically a problem
   - For clarification responses: Location may be optional if the role can be searched broadly
   - Consider if location can be inferred from context (e.g., company headquarters, industry hubs)
   - Flag as missing if: No location AND location is critical for the role/industry

2. VAGUE ROLE DESCRIPTION:
   - Check if role description is too generic (e.g., just "manager", "executive", "lead" without context)
   - Vague role indicators: "manager", "executive", "lead", "head", "director", "officer" with <= 2 words total
   - If role is vague AND has < 3 role variations, it's likely ambiguous
   - Consider if role can be inferred from domain context or company type
   - Flag as vague if: Generic role title + insufficient variations + no domain context

3. MISSING INDUSTRY:
   - Check if industry information is missing when it's likely needed
   - Industry is needed when: Role suggests industry-specific requirements (pharma, healthcare, banking, finance, retail, FMCG, SaaS, tech)
   - Industry may NOT be needed if: Domain context is available OR role is generic enough
   - For clarification responses: Only flag if industry is truly critical and cannot be inferred
   - Flag as missing if: No industry + no domain context + role suggests industry-specific needs

4. CONFLICTING REQUIREMENTS:
   - Check for logical conflicts (e.g., entry level with significant experience requirements)
   - Example: seniorityLevel = "entry" but experienceRequirements mentions "5+ years" or "significant experience"
   - Check for contradictory filters (e.g., multiple locations that don't make sense together)
   - Flag as conflicting if: Requirements contradict each other in a way that prevents search

5. INSUFFICIENT CONTEXT:
   - Check if there's insufficient information to proceed with search
   - This is a catch-all for queries that are too vague or incomplete
   - Consider if enough information exists to generate meaningful search parameters
   - For clarification responses: Be very lenient - only flag if truly insufficient

${isClarificationResponse 
  ? `CLARIFICATION RESPONSE RULES:
- Only require primary role - other fields can be inferred or are optional
- Don't require location if user hasn't specified it - we can search broadly
- Don't require industry if domain context is available
- Only flag needsClarification if search is truly impossible without more information
- Prefer to proceed with available information rather than asking for more`
  : `INITIAL QUERY RULES:
- Be thorough in detecting missing critical information
- Flag vague role descriptions that cannot be inferred
- Flag missing location when it's critical
- Flag missing industry when role suggests industry-specific needs
- Generate specific, actionable clarification questions`}

CLARIFICATION QUESTION GUIDELINES:
- Generate 2-4 specific, actionable questions
- Prioritize the most critical missing information first
- Make questions clear and easy to answer
- Avoid asking for information that can be reasonably inferred
- Examples:
  * "Which specific location(s) should we focus on? (e.g., Bangalore, Mumbai, Delhi NCR)"
  * "What industry or sector should candidates come from? (e.g., SaaS, FMCG, BFSI)"
  * "What specific role or job title are you looking for? Please provide more context about the function or department."
  * "What level of seniority are you looking for? (e.g., Mid-level, Senior, Executive)"

ASSESSMENT TASK:
1. Analyze the query understanding for all types of ambiguity
2. Determine if clarification is needed (needsClarification: true/false)
3. If clarification is needed:
   - Generate specific clarification questions (2-4 questions)
   - List all ambiguity reasons
   - Explain why clarification is needed
4. If clarification is NOT needed:
   - Set needsClarification to false
   - Set clarificationQuestions to null
   - Set ambiguityReasons to null
   - Explain why the query is clear enough to proceed

${isClarificationResponse 
  ? 'Remember: Since this is a clarification response, be VERY conservative. Only flag ambiguity if search is truly impossible.'
  : 'Remember: Be thorough but reasonable. Only flag ambiguity if critical information is missing and cannot be inferred.'}`;
  }

  /**
   * Get prompt for ambiguity detection
   */
  getAmbiguityDetectionUserPrompt(
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage: string,
    isClarificationResponse: boolean = false,
  ): string {
    return `QUERY UNDERSTANDING ANALYSIS:
Primary Role: ${queryUnderstanding.primaryRole}
Role Variations: ${queryUnderstanding.roleVariations.join(', ')} (${queryUnderstanding.roleVariations.length} variations)
Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'} (${queryUnderstanding.industry?.length || 0} industries)
Location Hierarchy:
  - Primary: ${queryUnderstanding.locationHierarchy.primary || 'Not specified'}
  - Secondary: ${queryUnderstanding.locationHierarchy.secondary?.join(', ') || 'None'}
  - Regional: ${queryUnderstanding.locationHierarchy.regional || 'None'}
Company Preferences:
  - Current: ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'None'}
  - Past: ${queryUnderstanding.companyPreferences?.past?.join(', ') || 'None'}
Seniority Level: ${queryUnderstanding.seniorityLevel || 'Not specified'}
Domain Context: ${queryUnderstanding.domainContext || 'Not specified'}
Skills: ${queryUnderstanding.skills?.join(', ') || 'Not specified'}
Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ') || 'None'} (${queryUnderstanding.explicitRequirements.length} requirements)
Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ') || 'None'} (${queryUnderstanding.preferredRequirements.length} requirements)

ORIGINAL USER QUERY:
"${userMessage}"

Analyze the query understanding above for ambiguity and determine if clarification is needed.`;
  }

  /**
   * Get prompt for discovery complexity assessment
   * Determines the complexity level of discovery operations needed
   */

  /**
   * Get system prompt for pattern identification
   */
  getPatternIdentificationSystemPrompt(): string {
    return `You are an expert recruiter specializing in identifying patterns in candidate search queries that require discovery operations. Your task is to analyze queries to detect patterns that indicate the need for discovering companies, job titles, institutes, and industries.

PATTERNS TO IDENTIFY:

1. SPECIALIZED ROLE PATTERN (specializedRole):
   - Detect: Medical specialties, technical specialties, highly specialized roles
   - Indicators: "pulmonologist", "cardiologist", "orthopedic", "specialist", "surgeon", "physician"
   - Also consider: Domain-specific technical roles that may have many variations
   - Confidence: High (0.8-1.0) for clear medical/technical specialties, Medium (0.5-0.7) for domain-specific roles
   - Reasoning: Explain why the role is considered specialized

2. COMPANY DESCRIPTION PATTERN (companyDescription):
   - Detect: Descriptions of companies rather than specific company names
   - Patterns to look for:
     * "companies that manufacture/make/produce/build/create/develop"
     * "manufacturing/production companies"
     * "companies in the X space"
     * "X companies" (where X is an industry/type)
   - Extract: The actual description text (e.g., "textile machinery manufacturers", "ceramics insulators")
   - Confidence: High (0.8-1.0) for clear manufacturing/description patterns, Medium (0.5-0.7) for industry mentions
   - Reasoning: Explain what company description was detected

3. COMPANY GROUP PATTERN (companyGroup):
   - Detect: Mentions of company groups (conglomerates, business groups)
   - Examples: "Tata group", "Birla group", "Adani group", "Reliance group"
   - Extract: All company group names mentioned
   - Confidence: High (0.9-1.0) for clear group mentions
   - Reasoning: Explain which company groups were identified

4. INSTITUTE REQUIREMENT PATTERN (instituteRequirement):
   - Detect: Educational institute requirements or preferences
   - Patterns to look for:
     * "tier-1", "tier-2", "tier one", "tier 1"
     * "IIT", "IIM"
     * "premier institutes", "top colleges", "elite universities"
     * "from tier-1", "IIT/IIM graduates"
   - Extract: The institute type mentioned (e.g., "tier-1", "IIT", "IIM", "premier")
   - Check: Both user message and explicitRequirements/preferredRequirements fields
   - Confidence: High (0.8-1.0) for clear tier/IIT/IIM mentions, Medium (0.5-0.7) for "premier"/"top" mentions
   - Reasoning: Explain what institute requirement was detected

5. INDUSTRY REQUIREMENT PATTERN (industryRequirement):
   - Detect: Industry mentions that need to be matched to exact LinkedIn industry names
   - Patterns to look for:
     * Generic industry terms: "pharma", "pharmaceutical", "tech", "technology", "manufacturing", "FMCG", "BFSI", "healthcare"
     * Industry descriptions: "software industry", "financial services", "healthcare sector"
     * Domain context mentions that map to industries
   - Extract: The industry description text (e.g., "pharmaceutical", "technology", "manufacturing", "FMCG")
   - Check: Both user message, domainContext, and industry fields in query understanding
   - Confidence: High (0.8-1.0) for clear industry mentions, Medium (0.5-0.7) for domain context that implies industry
   - Reasoning: Explain what industry description was detected
   - Note: This pattern is for when industries are mentioned generically and need to be matched to exact LinkedIn industry names from the full list

  IDENTIFICATION TASK:
  1. Analyze the query understanding and user message for each pattern type
  2. For each pattern, determine:
    - detected: true/false (whether the pattern is present)
    - confidence: 0.0-1.0 (how confident you are in the detection)
    - Additional fields: description, groupNames, instituteType, industryDescription (as applicable)
    - reasoning: Explanation of why the pattern was or wasn't detected
  3. Be thorough but accurate - only flag patterns that are clearly present

  Remember: 
  - Confidence should reflect how certain you are about the pattern
  - Extract specific text/names when patterns are detected
  - Check both the user message and the structured query understanding fields
  - Some patterns may overlap (e.g., specialized role + company description)
  - Industry requirement pattern is for generic industry mentions that need exact matching, not when specific LinkedIn industry names are already provided`;
  }

  /**
   * Get prompt for pattern identification
   * Identifies patterns in the query that require discovery operations
   */
  getPatternIdentificationUserPrompt(
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage: string,
  ): string {
    return `QUERY UNDERSTANDING ANALYSIS:
    Primary Role: ${queryUnderstanding.primaryRole}
    Role Variations: ${queryUnderstanding.roleVariations.join(', ')} (${queryUnderstanding.roleVariations.length} variations)
    Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
    Location: ${queryUnderstanding.locationHierarchy?.primary || 'Not specified'}
    Company Preferences:
      - Current: ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'None'}
      - Company Groups: ${queryUnderstanding.companyGroupPreferences?.join(', ') || 'None'}
    Domain Context: ${queryUnderstanding.domainContext || 'Not specified'}
    Skills: ${queryUnderstanding.skills?.join(', ') || 'Not specified'}
    Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ') || 'None'}
    Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ') || 'None'}

    ORIGINAL USER QUERY:
    "${userMessage}"

    Analyze the query understanding and user message above to identify patterns that require discovery operations.`;
  }

  /**
   * Build prompt for refining existing search parameters
   */
  /**
   * Get system prompt for candidate relevance scoring
   */
  getCandidateRelevanceScoringSystemPrompt(): string {
    return `You are an expert at scoring candidate relevance for LinkedIn search results. Your task is to assess how well a candidate matches the search query requirements and provide accurate relevance scores with detailed reasoning.

    SCORING TASKS:
    1. Calculate relevanceScore (0-1): 
      - 0.8-1.0: Highly relevant (matches primary role, company, location, and most requirements)
      - 0.5-0.79: Somewhat relevant (matches some key requirements but may have gaps)
      - 0.0-0.49: Less relevant (minimal match or significant mismatches)

    2. Determine relevanceLabel: "highly_relevant", "somewhat_relevant", or "less_relevant"

    3. Identify matchReasons: List specific reasons why this candidate matches (e.g., "Exact role match: Sales Manager", "Company match: Novartis", "Location match: Mumbai", "Education match: [details]" if applicable)

    4. Identify mismatchReasons (if any): List reasons for gaps (e.g., "Different seniority level", "Location mismatch", "Education requirements not met" or "Education mismatch: [details]" if applicable)

    5. Check specific matches (only check fields that are specified in the query understanding):
      - roleMatch: Does the candidate's current/past role match the primary role or variations?
      - companyMatch: If the query requires a specific set of companies, does the candidate work at (or worked at) the specified company?
      - industryMatch: If the query requires a specific industry, does the candidate's industry match the query industry?
      - locationMatch: Does the candidate's location match the query location?
      - educationMatch: If education requirements are specified in the query, check if the candidate's education meets the requirements. Check if candidate has the required degrees, institutions, or fields of study. Return true if education matches, false if it doesn't match, or null if education data is not available. If no education requirements are specified, return null.
      - certificationMatch: If certifications are specified in the query, check if candidate's profile mentions the required certifications. Analyze headline, current position, past positions, and skills for certification mentions. Return true if required certifications are found, false if missing, null if cannot determine. If no certification requirements are specified, return null.
      - regulatoryExperienceMatch: If regulatory experience is specified in the query, check if candidate has experience with regulatory requirements. Look for mentions in headline, positions, or skills. Return true if found, false if not found, null if cannot determine. If no regulatory experience requirements are specified, return null.
      - companySizeMatch: If company size range is specified in the query, check if candidate's current company size matches the requirement. This may require inference from company name/industry if size data is not directly available. Return true if matches, false if doesn't match, null if cannot determine. If no company size requirement is specified, return null.
      - fundingStageMatch: If funding stage is specified in the query, check if candidate's current company matches the funding stage requirement. This may require inference from company name/industry if funding data is not directly available. Return true if matches, false if doesn't match, null if cannot determine. If no funding stage requirement is specified, return null.
      - ageMatch: If age constraint is specified in the query, check if candidate's age (inferred from graduation year if available) matches the age constraint. Calculate age from graduation year: age = currentYear - graduationYear + 22 (assuming 22 years old at graduation). Return true if matches, false if doesn't match, null if graduation year not available. If no age constraint is specified, return null.
      - likeToLikeMatch: If target company profile (like-to-like matching) is specified in the query, check if candidate is an exact like-to-like match - same role, similar company type, similar company size, same industry. This is the highest priority match. Return true if exact like-to-like match, false otherwise. If no like-to-like matching requirement is specified, return null.
      - hierarchicalMatchLevel: If this candidate was found through hierarchical search expansion, indicate the level (0 = exact match, 1 = one level down, etc.). If not applicable, return null.

    6. Prioritize scoring:
      - Like-to-like matches (exact role + company type + size) should score highest (0.9-1.0)
      - Exact role matches with great education should score high (0.8-0.9)
      - Hierarchical matches (level 0 > level 1 > level 2) should be ranked accordingly
      - Candidates meeting certification/regulatory requirements should be prioritized
      - Company size and funding stage matches add to relevance

    7. Provide reasoning: Brief explanation of the score, including education relevance assessment if education requirements are specified, highlighting like-to-like matches, hierarchical level, and certification/regulatory matches

    EDUCATION RELEVANCE ASSESSMENT (if education requirements are specified in the query):
    - If education requirements are specified, check if the candidate's education matches these requirements.
    - If candidate education is not available but requirements are specified, note this as a potential mismatch.
    - If both are available, assess how well the candidate's education aligns with the requirements.
    - Include education match/mismatch in matchReasons or mismatchReasons accordingly.

    Provide scoring result with all required fields.`;
  }

  /**
   * Build prompt for scoring individual candidate relevance
   */
  buildCandidateRelevanceScoringUserPrompt(
    candidate: any,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    parsedJobDescription?: ParsedJobDescription,
  ): string {
    const candidateInfo = {
      name: candidate.name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim(),
      headline: candidate.headline || '',
      currentPosition: candidate.current_positions?.[0] 
        ? `${candidate.current_positions[0].role} at ${candidate.current_positions[0].company}`
        : '',
      location: candidate.location || '',
      pastPositions: candidate.past_positions?.slice(0, 3).map((pos: any) => 
        `${pos.role} at ${pos.company}`
      ).join(', ') || '',
      skills: candidate.skills?.slice(0, 10).join(', ') || '',
      education: candidate.education?.map((edu: any) => 
        `${edu.school || edu.institution || ''} - ${edu.degree || edu.field_of_study || ''}${edu.end_date ? ` (${edu.end_date})` : ''}`
      ).join('; ') || '',
    };

    // Check if query has educational requirements
    const hasEducationRequirements = parsedJobDescription?.education && parsedJobDescription.education.length > 0;
    const educationRequirementsText = hasEducationRequirements 
      ? parsedJobDescription.education.join(', ')
      : 'Not specified';

    const companySizeInfo = queryUnderstanding.companySizeRange 
      ? `Company Size: ${queryUnderstanding.companySizeRange.description || `${queryUnderstanding.companySizeRange.min || ''}-${queryUnderstanding.companySizeRange.max || ''} employees`}`
      : 'Company Size: Not specified';
    
    const fundingStageInfo = queryUnderstanding.fundingStage?.length 
      ? `Funding Stage: ${queryUnderstanding.fundingStage.join(', ')}`
      : 'Funding Stage: Not specified';
    
    const ageConstraintInfo = queryUnderstanding.ageConstraint?.maxAge 
      ? `Age Constraint: ${queryUnderstanding.ageConstraint.minAge ? `${queryUnderstanding.ageConstraint.minAge}-` : ''}${queryUnderstanding.ageConstraint.maxAge} years (Graduation Year Range: ${queryUnderstanding.ageConstraint.graduationYearRange?.min || 'N/A'}-${queryUnderstanding.ageConstraint.graduationYearRange?.max || 'N/A'})`
      : 'Age Constraint: Not specified';
    
    const certificationsInfo = queryUnderstanding.certifications?.length 
      ? `Certifications: ${queryUnderstanding.certifications.map(c => `${c.name}${c.required ? ' (required)' : ' (preferred)'}`).join(', ')}`
      : 'Certifications: Not specified';
    
    const regulatoryInfo = queryUnderstanding.regulatoryExperience?.length 
      ? `Regulatory Experience: ${queryUnderstanding.regulatoryExperience.join(', ')}`
      : 'Regulatory Experience: Not specified';
    
    const likeToLikeInfo = queryUnderstanding.targetCompanyProfile 
      ? `Target Company Profile (Like-to-Like): Industry: ${queryUnderstanding.targetCompanyProfile.industry || 'N/A'}, Size: ${queryUnderstanding.targetCompanyProfile.companySize?.description || 'N/A'}, Type: ${queryUnderstanding.targetCompanyProfile.companyType || 'N/A'}`
      : 'Target Company Profile: Not specified';

    return `ORIGINAL QUERY: ${userMessage}

    QUERY UNDERSTANDING:
    Primary Role: ${queryUnderstanding.primaryRole}
    Role Variations: ${queryUnderstanding.roleVariations.join(', ')}
    Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
    Location: ${queryUnderstanding.locationHierarchy.primary}
    Company Preferences (Current): ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'Not specified'}
    Company Preferences (Past): ${queryUnderstanding.companyPreferences?.past?.join(', ') || 'Not specified'}
    Domain: ${queryUnderstanding.domainContext || 'Not specified'}
    Seniority Level: ${queryUnderstanding.seniorityLevel || 'Not specified'}
    Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ')}
    Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ')}
    ${companySizeInfo}
    ${fundingStageInfo}
    ${ageConstraintInfo}
    ${certificationsInfo}
    ${regulatoryInfo}
    ${likeToLikeInfo}
    ${hasEducationRequirements ? `Education Requirements: ${educationRequirementsText}` : ''}

    CANDIDATE PROFILE:
    Name: ${candidateInfo.name}
    Headline: ${candidateInfo.headline}
    Current Position: ${candidateInfo.currentPosition}
    Location: ${candidateInfo.location}
    Past Positions: ${candidateInfo.pastPositions}
    Skills: ${candidateInfo.skills}
    ${candidateInfo.education ? `Education: ${candidateInfo.education}` : 'Education: Not available'}

    Score the relevance of this candidate against the search query above.`;
  }



  async getStrategyGenerationSystemPrompt(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): Promise<string> {
    const classicKeywordLimit = searchType === 'classic' 
      ? `\n\n⚠️ CRITICAL CONSTRAINT FOR LINKEDIN CLASSIC:
    Each strategy you generate must specify keywords with MAXIMUM 6 keyword terms. Each term can be:
    - A quoted phrase (e.g., "sales manager" counts as 1 term)
    - An unquoted word separated by boolean operators (AND, OR, NOT)

    When describing strategies, if a strategy would naturally require more than 6 keyword terms, you MUST explicitly describe it as multiple strategies, each with max 6 terms. For example:
    - Instead of: "Use keywords: 'sales manager' OR 'account executive' OR 'business development' OR 'territory sales' OR 'inside sales' OR 'field sales' OR 'channel sales' OR 'partner manager'"
    - Write: "Strategy 1: Use keywords: 'sales manager' OR 'account executive' OR 'business development' OR 'territory sales' OR 'inside sales' OR 'field sales' (6 terms). Strategy 2: Use keywords: 'channel sales' OR 'partner manager' (2 terms)."

    Always count terms carefully and ensure each strategy description specifies keywords with ≤6 terms.`
          : '';

        return `You are an expert recruiter and search strategist specializing in generating natural language search strategy descriptions. Generate clear, specific strategy descriptions that explain which parameters to use and how to combine them.
    ${classicKeywordLimit}
  `;
  }
  /**
   * Build prompt for hierarchical search strategy generation
   * Used for multi-level search expansion (e.g., CEO → COO → Head of Operations)
   */


  /**
   * Get system prompt and user prompt for splitting keywords into multiple strategies for LinkedIn Classic
   * This is used when a single strategy's keywords exceed the 6-term limit
   */
  getClassicKeywordSplitSystemAndUserPrompts(
    originalKeywords: string,
    originalParameters: any,
    strategyText: string,
    queryUnderstandingText: string,
    userMessage: string,
  ): { system: string; user: string } {
    const systemPrompt = `You are an expert at optimizing LinkedIn Classic search queries. Your task is to split a keyword string that exceeds LinkedIn Classic's strict 6-term limit into multiple keyword-limited strategies.

CRITICAL CONSTRAINT: LinkedIn Classic allows MAXIMUM 6 keyword terms in a boolean search string. Each term can be:
- A quoted phrase (e.g., "sales manager" counts as 1 term)
- An unquoted word separated by boolean operators (AND, OR, NOT)

Your goal is to intelligently split the original keywords into multiple strategies, each with at most 6 terms, while:
1. Preserving search coverage - together, the split strategies should cover all original keywords
2. Maintaining logical groupings - group related terms together
3. Prioritizing important terms - most important/primary terms should be in earlier strategies
4. Ensuring each split strategy is independently useful and searchable

OUTPUT FORMAT:
Return an array of split strategies, each containing:
- keywords: A boolean string with MAXIMUM 6 terms (quoted phrases and/or unquoted words with AND/OR/NOT operators)
- label: Short descriptive label (e.g., "Primary Roles", "Secondary Roles", "Alternative Titles")
- description: Brief explanation of which keyword subset this covers

KEYWORD SPLITTING GUIDELINES:
1. Count terms carefully: Each quoted phrase = 1 term, each unquoted word separated by operators = 1 term
2. Group semantically related terms together (e.g., all "manager" variations in one strategy)
3. Prioritize primary/important terms in earlier strategies
4. Use boolean operators (AND, OR, NOT) and parentheses to group terms efficiently
5. Ensure each split strategy has meaningful keywords (at least 2-3 terms, ideally 4-6 terms)
6. All multi-word job titles MUST be wrapped in double quotes
7. Single-word titles do not need quotes


TASK:
Split the keywords above into multiple keyword-limited strategies. Each strategy must have:
- MAXIMUM 6 keyword terms
- Meaningful keyword combinations that preserve search intent
- Logical grouping of related terms
- Clear labels and descriptions


`;

    const userPrompt = `Split the following LinkedIn Classic search keywords into multiple strategies, each with MAXIMUM 6 keyword terms.

ORIGINAL KEYWORDS (${this.countKeywordTermsInString(originalKeywords)} terms - EXCEEDS LIMIT):
${originalKeywords}

ORIGINAL STRATEGY:
${strategyText}

ORIGINAL PARAMETERS:
${JSON.stringify(originalParameters, null, 2)}

QUERY UNDERSTANDING:
${queryUnderstandingText}

ORIGINAL USER QUERY:
"${userMessage}"


Generate the split strategies now.`;

    return { system: systemPrompt, user: userPrompt };
  }

  /**
   * Helper to count keyword terms (same logic as in service)
   */
  private countKeywordTermsInString(keywords: string): number {
    if (!keywords || typeof keywords !== 'string') {
      return 0;
    }
    const quotedMatches = keywords.match(/"([^"]+)"/g) || [];
    const quotedCount = quotedMatches.length;
    const unquotedText = keywords.replace(/"([^"]+)"/g, '');
    const unquotedParts = unquotedText
      .split(/\s+(?:AND|OR|NOT)\s+/i)
      .map(p => p.trim())
      .filter(p => p.length > 0 && !p.match(/^[()]+$/));
    return quotedCount + unquotedParts.length;
  }

  /**
   * Get prompt for generating sophisticated boolean queries
   * Used for Sales Navigator and Recruiter to create comprehensive boolean queries
   * that capture different company nomenclatures
   */
  /**
   * Get system prompt for boolean query generation
   */
  getBooleanQueryGenerationSystemPrompt(
    searchType: 'sales_navigator' | 'recruiter',
  ): string {
    const searchTypeLabel = searchType === 'sales_navigator' ? 'Sales Navigator' : 'Recruiter';

    return `You are an expert at generating sophisticated boolean queries for LinkedIn ${searchTypeLabel} searches. Your task is to create comprehensive boolean query strings that capture different company nomenclatures for positions by combining hierarchical terms (GM, VP, President, Head, etc.) with domain/functional terms (Operations, Sales, Plant, Unit, Works, Site, etc.) using AND/OR operators.

    YOUR TASK:
    Create a comprehensive boolean query string that captures different company nomenclatures for the given position.

    BOOLEAN QUERY PATTERNS:
    1. Combine domain terms with hierarchical terms: (DomainTerm AND (HierarchicalTerm1 OR HierarchicalTerm2 OR ...))
      Example: (Operations AND (GM OR President OR vp OR agm OR head))

    2. Alternative domain terms with hierarchical terms: ((AlternativeDomainTerm1 OR AlternativeDomainTerm2) AND HierarchicalTerm)
      Example: ((plant OR unit OR works OR site) AND (head))

    3. Combine both patterns with OR: (DomainTerm AND (HierarchicalTerms)) OR ((AlternativeDomainTerms) AND HierarchicalTerm)
      Example: (Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head))

    4. For roles without clear hierarchical/domain split, use comprehensive OR: (Term1 OR Term2 OR Term3 OR ...)
      Example: (Pulmonologist OR "Chest Physician" OR "Respiratory Specialist")

    REQUIREMENTS:
    - Use parentheses to group terms logically
    - Use AND to combine related terms (domain + hierarchical)
    - Use OR to capture alternative nomenclatures
    - Keep terms lowercase where appropriate for better matching
    - Wrap multi-word terms in quotes if they need exact matching
    - Single words don't need quotes
    - Make the query comprehensive to capture all common variations
    - Ensure the query works in ${searchTypeLabel} search syntax

    EXAMPLES OF GOOD BOOLEAN QUERIES:
    1. For "Head of Operations": (Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head))
    2. For "VP Sales": (Sales AND (VP OR "Vice President" OR "Vice Pres" OR vp)) OR (Sales AND (head OR director OR manager))
    3. For "GM Marketing": (Marketing AND (GM OR "General Manager" OR "Gen Manager" OR gm)) OR (Marketing AND (head OR director OR vp))

    Generate the boolean query based on the discovered information provided.`;
  }

  getBooleanQueryGenerationUserPrompt(
    role: string,
    variations: string[],
    hierarchicalTerms: string[],
    domainTerms: string[],
    nomenclaturePatterns: string[],
    searchType: 'sales_navigator' | 'recruiter',
  ): string {
    return `Generate a sophisticated boolean query for ${searchType === 'sales_navigator' ? 'Sales Navigator' : 'Recruiter'} search to find candidates for the role: "${role}"

    DISCOVERED INFORMATION:
    - Role: ${role}
    - All Variations: ${variations.join(', ')}
    - Hierarchical Terms: ${hierarchicalTerms.length > 0 ? hierarchicalTerms.join(', ') : 'None identified'}
    - Domain Terms: ${domainTerms.length > 0 ? domainTerms.join(', ') : 'None identified'}
    - Nomenclature Patterns: ${nomenclaturePatterns.length > 0 ? nomenclaturePatterns.join(', ') : 'None identified'}`;
  }
}
