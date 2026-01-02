import { Injectable } from '@nestjs/common';
import { JobDescriptionParsingPrompt, SearchParameterGenerationPrompt } from 'src/engine/core-modules/candidate-search/types/candidate-search-prompt.type';
import {
  ClassicPeopleParameterName,
  linkedinIndustryOptions,
} from '../schemas/classic-people-search.schema';
import {
  RecruiterPeopleParameterName,
} from '../schemas/recruiter-people-search.schema';
import {
  SalesNavigatorPeopleParameterName,
} from '../schemas/sales-navigator-people-search.schema';
import { ParsedJobDescription } from '../types/candidate-search-request.type';
import { replaceTemplateVariables } from '../utils/template.utils';



export interface SearchParametersPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
}
@Injectable()
export class SearchParametersPrompts {
  // Cache for system prompts to avoid regeneration
  private systemPromptCache: Map<string, string> = new Map();

  // Common instruction constants
  private readonly COMMON_INSTRUCTIONS = {
    humanReadableNames: 'Use human-readable names for all parameters (e.g., "Microsoft", "San Francisco Bay Area", "Stanford University")',
    noLinkedInIds: 'Do NOT use LinkedIn IDs or numeric values - the system will convert names to IDs automatically',
    industryExactMatch: (industryList: string) => `MUST use EXACT industry names from this list: ${industryList}. For pharmaceuticals, use "Pharmaceutical Manufacturing". For technology, use "Technology, Information and Internet" or "Computer Software" or "IT Services and IT Consulting". These MUST match exactly from the list above.`,
  };

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
   */
  getPeopleSearchSystemPrompt(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const cacheKey = `people-search-system-${searchType}`;
    return this.getCachedSystemPrompt(cacheKey, () => {
      const industryList = `${linkedinIndustryOptions.slice(0, 50).join(', ')}, and ${linkedinIndustryOptions.length - 50} more options available`;
      
      switch (searchType) {
        case 'classic':
          return `You are an expert LinkedIn recruiter specializing in LinkedIn Classic search. Your task is to generate optimal search parameters for finding candidates based on parsed job description data.
        IMPORTANT: You must generate search parameters that include:
        - Keywords: Generate a comprehensive boolean string comprising of AND,OR,NOT with multiple job title variations. You may use brackets (parentheses) () to group the keywords. For example, if the role is "sales representative", you should include variations like "sales representative OR sales executive OR sales manager OR business development executive OR account executive OR territory sales". Think of all related job titles, synonyms, and variations that describe similar roles.
        - Industry parameters: ${this.COMMON_INSTRUCTIONS.industryExactMatch(industryList)}
        - Location parameters (as HUMAN-READABLE NAMES like "San Francisco Bay Area", "New York City", "Seattle, Washington", "Mumbai, Maharashtra")
        - Company parameters (as HUMAN-READABLE NAMES like "Microsoft", "Google", "Amazon", "Apple")
        - School parameters (as HUMAN-READABLE NAMES like "Stanford University", "MIT", "Harvard University")
        CRITICAL: ${this.COMMON_INSTRUCTIONS.noLinkedInIds}`;

        case 'sales_navigator':
          return `You are an expert LinkedIn Sales Navigator specialist with deep knowledge of advanced B2B sales prospecting. Your task is to generate optimal Sales Navigator People Search parameters based on parsed job description data.
  
        Sales Navigator offers sophisticated filtering capabilities that go beyond basic LinkedIn search:
  
        CORE FILTERS:
        - Keywords: Job titles, skills, technologies, company names. Generate a comprehensive boolean string comprising of AND,OR,NOT with multiple job title variations. You may use brackets (parentheses) () to group the keywords. For example, if the role is "sales representative", you should include variations like "sales representative sales executive sales manager business development executive account executive territory sales". Think of all related job titles, synonyms, and variations that describe similar roles.
        - Location: Include/exclude specific geographic areas, postal code searches with radius
        - Industry: Include/exclude specific industries using Sales Navigator industry taxonomy. ${this.COMMON_INSTRUCTIONS.industryExactMatch(industryList)}
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
        - Keywords: Job titles, skills, technologies, company names with boolean modifiers (AND, OR, NOT)
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
   * Get system prompt for strategy planning
   */
  getPeopleSearchStrategySystemPrompt(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const cacheKey = `people-search-strategy-system-${searchType}`;
    return this.getCachedSystemPrompt(cacheKey, () => {
      const baseSystemPrompt = this.getPeopleSearchSystemPrompt(searchType);
      return `${baseSystemPrompt}

        Additionally, you are an expert at planning search strategies. Your task is to analyze search requirements and create multiple complementary strategies that recruiters can use iteratively to find candidates.`;
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
     */
    getPeopleSearchPrompt(
      searchType: 'classic' | 'sales_navigator' | 'recruiter',
      parsedJobDescription?: ParsedJobDescription | string,
      jobDescription?: string,
      skipUserPrompt = false,
    ): SearchParameterGenerationPrompt {
      const systemPrompt = this.getPeopleSearchSystemPrompt(searchType);
      
      if (skipUserPrompt) {
        return {
          system: systemPrompt,
          user: '',
        };
      }

      let userPromptTemplate: string;
  
      switch (searchType) {
        case 'classic':
          userPromptTemplate = `Based on the following parsed job description, generate LinkedIn Classic People Search parameters:
        Parsed Job Description:
        {{parsedJobDescription}}
        Please generate comprehensive search parameters that would help find the best candidates for this position. 
        IMPORTANT: For industry, location, company, and school parameters, use ONLY human-readable names (e.g., "Microsoft", "San Francisco Bay Area", "Stanford University"). Do NOT use LinkedIn IDs or numeric values. The system will automatically convert these names to LinkedIn IDs later.`;
          break;
  
        case 'sales_navigator':
          userPromptTemplate = `Based on the following parsed job description, generate comprehensive LinkedIn Sales Navigator People Search parameters:
  
        Parsed Job Description:
        {{parsedJobDescription}}
  
        Please generate sophisticated search parameters that leverage Sales Navigator's advanced capabilities to find the best candidates for this position.
  
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
          userPromptTemplate = `Based on the following parsed job description, generate comprehensive LinkedIn Recruiter People Search parameters:
  
        Parsed Job Description:
        {{parsedJobDescription}}
  
        Please generate sophisticated search parameters that leverage LinkedIn Recruiter's advanced capabilities to find the best candidates for this position.
  
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
        - Keywords: Company names, industries, technologies, business descriptions. Generate a comprehensive boolean string comprising of AND,OR,NOT with multiple company name variations. You may use brackets (parentheses) () to group the keywords. For example, if the company is "Google", you should include variations like "Google OR Alphabet OR Alphabet Inc. OR Alphabet Inc". Think of all related company names, synonyms, and variations that describe similar companies.
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
     */
    getMessageClassificationPrompt(): SearchParametersPrompt {
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
  
        CLASSIFICATION RULES:
        - Analyze the PRIMARY intent of the message
        - Consider context clues and specific terminology
        - If multiple intents are present, choose the most specific one
        - If unclear, default to "general_help"
        - Be precise and consistent in classification
  
        RESPONSE FORMAT:
        Return ONLY the classification category name (e.g., "search_parameters", "enrichments", "filters", "sorts", "complete_plan", or "general_help")`,
  
        user: `Classify the following user message to determine their intent:
  
        User Message: "{{message}}"
  
        Context: This is a chat interface for a candidate search and recruitment system where users can generate search parameters, enrichments, filters, and sorting strategies for LinkedIn candidate searches.
  
        Classify this message into one of the categories: search_parameters, enrichments, filters, sorts, complete_plan, or general_help.`
      };
    }
  
  buildUserPrioritizedPrompt(
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'people' | 'companies' | 'jobs',
    searchApiType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const searchTypeLabel = searchApiType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchApiType === 'sales_navigator' 
        ? 'LinkedIn Sales Navigator' 
        : 'LinkedIn Recruiter';

    let criteriaList = '';
    
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
    


    const prompt = `PRIORITY USER REQUEST:
    The user has explicitly requested: "${userMessage}"

    Classification Analysis: ${classificationReasoning}

    IMPORTANT: Generate search parameters based PRIMARILY on the user's request above. Use the raw job description text below ONLY as supplementary context or fallback information when the user's request doesn't specify certain details.

    Raw Job Description Text (for reference only):
    ${rawJDText || 'No job description text available.'}

    Generate ${searchTypeLabel} ${searchType.charAt(0).toUpperCase() + searchType.slice(1)} Search parameters that fulfill the user's explicit request. Extract and interpret:
    ${criteriaList}

    CRITICAL INSTRUCTIONS:
    1. Keywords: Generate a comprehensive string with multiple job title variations with a maximum of 6 keywords separated by boolean operators AND, OR, NOT in brackets. For example, if the user mentions "sales representatives", include variations like " sales manager OR business development executive OR account executive OR territory sales OR inside sales". Think of all related job titles, synonyms, and variations.
    2. Industry: MUST use EXACT industry names. Examples:
       - For pharma: ${pharmaOptions}
       - For technology: ${techOptions.slice(0, 200)}
       - You can search the full list of ${linkedinIndustryOptions.length} valid industry names. These MUST match exactly.
    3. Prioritize extracting search criteria from the user's message over the parsed job description fields.`;

    console.log(prompt);
    return prompt;
  }


  /**
   * Generalized method to generate strategy prompts for people search across all API types
   */
  decidingWhichParametersToCreateForPeopleSearch(
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchCategory: 'people' | 'companies' | 'jobs',
    searchApiType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const searchTypeLabel = searchApiType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchApiType === 'sales_navigator' 
        ? 'LinkedIn Sales Navigator' 
        : 'LinkedIn Recruiter';

    // Only support people search for now
    if (searchCategory !== 'people') {
      throw new Error(`Strategy prompts are only supported for people search, got: ${searchCategory}`);
    }

    // Build parameter list based on API type
    let parameterList = '';
    let parameterGuidelines = '';
    let outputFormat = '';

    if (searchApiType === 'classic') {
      parameterList = `In classic people search, we have the following parameters:
    - keywords
    - industry
    - location
    - company
    - past_company
    - school
    - advanced_keywords (first_name, last_name, title, company, school)`;

      parameterGuidelines = `PARAMETER GUIDELINES (apply within each strategy):
    - Keywords: Maximum of 6 clauses in a boolean string using AND/OR/NOT. Prioritize organization-structure-aligned titles and skills.
    - Industry: Use only if it meaningfully narrows to the right talent pool. Prefer keyword filtering if industry would exclude good candidates.
      Valid LinkedIn industries (exact match required): ${linkedinIndustryOptions.join(', ')}
    - Location: Start specific (city/state) before widening (country/region). Use when relocation risk exists.
    - Company & Past Company: Only when the user names specific companies or the niche is best identified via employer lists.
    - School: Only when explicit schools are required (ignore vague "top tier" statements).
    - Advanced Keywords: Use when you must pin down specific titles/names/company mentions within profile fields.`;

      outputFormat = `OUTPUT FORMAT (JSON ONLY):
    {
      "strategies": [
        {
          "id": "balanced_visibility",
          "label": "Balanced Core Titles",
          "goal": "Hit 40-80 candidates by mixing synonymous senior sales lead titles with tight geo filters",
          "aggressiveness": "balanced",
          "description": "Explain how this strategy balances precision/coverage and avoids typical false positives.",
          "whenToUse": "Explain the recruiting scenario when this strategy is preferred.",
          "estimatedCandidateCount": { "minimum": 40, "maximum": 80 },
          "filterFocus": "Describe the main filters (e.g., tight geography + company list).",
          "parameterSelection": {
            "keywords": {"shouldGenerate": true|false, "reasoning": "no more than 2 sentences"},
            "industry": {"shouldGenerate": true|false, "reasoning": "..."},
            "location": {"shouldGenerate": true|false, "reasoning": "..."},
            "company": {"shouldGenerate": true|false, "reasoning": "..."},
            "past_company": {"shouldGenerate": true|false, "reasoning": "..."},
            "school": {"shouldGenerate": true|false, "reasoning": "..."},
            "advanced_keywords": {"shouldGenerate": true|false, "reasoning": "..."}
          }
        },
        { ... two more strategies ... }
      ]
    }`;
    } else if (searchApiType === 'sales_navigator') {
      parameterList = `Sales Navigator People search has many powerful parameters including:
    - keywords
    - location (include/exclude)
    - industry (include/exclude)
    - company (include/exclude)
    - past_company (include/exclude)
    - role (include/exclude)
    - function (include/exclude)
    - seniority (include/exclude)
    - school (include/exclude)
    - company_headcount
    - tenure_at_company
    - network_distance
    - And many boolean filters (following_your_company, viewed_your_profile_recently, etc.)`;

      parameterGuidelines = '';

      outputFormat = `OUTPUT FORMAT (JSON ONLY):
    {
      "strategies": [
        {
          "id": "balanced_visibility",
          "label": "Balanced Core Titles",
          "goal": "Hit 40-80 candidates by mixing synonymous senior sales lead titles with tight geo filters",
          "aggressiveness": "balanced",
          "description": "Explain how this strategy balances precision/coverage and avoids typical false positives.",
          "whenToUse": "Explain the recruiting scenario when this strategy is preferred.",
          "estimatedCandidateCount": { "minimum": 40, "maximum": 80 },
          "filterFocus": "Describe the main filters (e.g., tight geography + company list).",
          "parameterSelection": {
            "keywords": {"shouldGenerate": true|false, "reasoning": "no more than 2 sentences"},
            "location": {"shouldGenerate": true|false, "reasoning": "..."},
            "industry": {"shouldGenerate": true|false, "reasoning": "..."},
            "company": {"shouldGenerate": true|false, "reasoning": "..."},
            "past_company": {"shouldGenerate": true|false, "reasoning": "..."},
            "role": {"shouldGenerate": true|false, "reasoning": "..."},
            "function": {"shouldGenerate": true|false, "reasoning": "..."},
            "seniority": {"shouldGenerate": true|false, "reasoning": "..."},
            "school": {"shouldGenerate": true|false, "reasoning": "..."}
          }
        },
        { ... two more strategies ... }
      ]
    }`;
    } else if (searchApiType === 'recruiter') {
      parameterList = `Recruiter People search has many powerful parameters including:
    - keywords
    - location (with priority and scope)
    - industry (include/exclude)
    - role (with priority and scope)
    - company (with priority and scope)
    - past_company (with priority)
    - school (with priority)
    - skills (with priority)
    - seniority (include/exclude)
    - function
    - network_distance
    - spotlights (OPEN_TO_WORK, ACTIVE_TALENT, etc.)
    - And many other advanced filters`;

      parameterGuidelines = '';

      outputFormat = `OUTPUT FORMAT (JSON ONLY):
    {
      "strategies": [
        {
          "id": "balanced_visibility",
          "label": "Balanced Core Titles",
          "goal": "Hit 40-80 candidates by mixing synonymous senior sales lead titles with tight geo filters",
          "aggressiveness": "balanced",
          "description": "Explain how this strategy balances precision/coverage and avoids typical false positives.",
          "whenToUse": "Explain the recruiting scenario when this strategy is preferred.",
          "estimatedCandidateCount": { "minimum": 40, "maximum": 80 },
          "filterFocus": "Describe the main filters (e.g., tight geography + company list).",
          "parameterSelection": {
            "keywords": {"shouldGenerate": true|false, "reasoning": "no more than 2 sentences"},
            "location": {"shouldGenerate": true|false, "reasoning": "..."},
            "industry": {"shouldGenerate": true|false, "reasoning": "..."},
            "role": {"shouldGenerate": true|false, "reasoning": "..."},
            "company": {"shouldGenerate": true|false, "reasoning": "..."},
            "past_company": {"shouldGenerate": true|false, "reasoning": "..."},
            "school": {"shouldGenerate": true|false, "reasoning": "..."},
            "skills": {"shouldGenerate": true|false, "reasoning": "..."},
            "seniority": {"shouldGenerate": true|false, "reasoning": "..."}
          }
        },
        { ... two more strategies ... }
      ]
    }`;
    }

    const prompt = `
    You are also an expert at searching candidates on ${searchTypeLabel}.
    The broad task is to filter the LinkedIn database to provide a list of highly relevant candidates for the specific role that we are hiring for, while avoiding false positives (e.g., role = "Sales Head" but results show "EA to Sales Head").
    We need 40-80 qualified candidates across the first few pages of search results—enough volume to close the role without diluting quality.

    ${parameterList}

    The current search is ${userMessage}
    Classification Analysis: ${classificationReasoning}

    Raw Job Description Context:
    ${rawJDText || 'No job description text available.'}

    STRATEGY REQUIREMENTS:
    - Produce exactly 3 complementary strategies (one Focused, one Balanced, one Broad) that recruiters would use iteratively.
    - Each strategy should explicitly describe how it balances precision vs. coverage, referencing the false-positive example above.
    - Each strategy should target 40-80 viable candidates, adjusting filters to reach that range.
    - Reference recruiter intuition when describing when to prefer each strategy${searchApiType === 'classic' ? ' (e.g., hyper-specific titles in 15-20 companies vs. broader keyword sweeps).' : '.'}

    ${parameterGuidelines}

    ${outputFormat}

    IMPORTANT:
    - Always include at least one strategy that is clearly "focused" (very tight filters) and one that is clearly "broad" (looser filters) while keeping the candidate count goal.
    - Never output prose outside the JSON object.${searchApiType === 'classic' ? '\n    - Never provide more than 6 keywords in the boolean string.' : ''}`;

    return prompt;
  }

  /**
   * Generic function to build parameter generation prompts for people search
   */
  buildPeopleParameterGenerationPrompt(
    parameter: ClassicPeopleParameterName | SalesNavigatorPeopleParameterName | RecruiterPeopleParameterName,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    {
      userMessage,
      classificationReasoning,
      rawJDText,
      selectionReasoning,
      strategyLabel,
      strategyGoal,
      strategyAggressiveness,
      estimatedCandidateRange,
    }: {
      userMessage: string;
      classificationReasoning: string;
      rawJDText: string;
      selectionReasoning?: string;
      strategyLabel: string;
      strategyGoal: string;
      strategyAggressiveness: 'focused' | 'balanced' | 'broad';
      estimatedCandidateRange: { minimum: number; maximum: number };
    },
  ): string {
    const commonContext = `
    User Request: ${userMessage}
    Classification Analysis: ${classificationReasoning}
    Strategy: ${strategyLabel} (${strategyAggressiveness}) — ${strategyGoal}
    Expected Candidate Count: ${estimatedCandidateRange.minimum}-${estimatedCandidateRange.maximum}
    Reason to generate ${parameter}: ${selectionReasoning || 'Not provided'}

    Raw Job Description Context:
    ${rawJDText || 'No job description text available.'}
    `;

    let searchTypeLabel: string;
    let parameterInstructions: Record<string, string>;
    let outputExamples: Record<string, string>;
    let additionalRequirements: string;

    switch (searchType) {
      case 'classic': {
        searchTypeLabel = 'LinkedIn Classic People';
        parameterInstructions = {
          keywords: `Generate a boolean string (max 6 keyword clauses) that captures the most relevant job titles, skills, or functions for this role. Respect LinkedIn Classic limits: use AND/OR/NOT, optional parentheses, and quote multi-word titles. Avoid redundant synonyms and keep the string readable. Never provide more than 6 keywords in the boolean string.`,
          industry: `Return an array of industry names selected strictly from the official LinkedIn industry list provided. Only include industries if they are clearly tied to the target profile. Prefer leaving the array empty if industry would unnecessarily narrow results.`,
          location: `Return an array of the most precise locations (city/state/country/region) that match the sourcing needs. Start with the most specific geography mentioned by the user before expanding broader.`,
          company: `Return an array of current companies that best represent the target talent pool. Include only companies explicitly mentioned or that are dominantly known for hosting similar talent.`,
          past_company: `Return an array of past companies (employers) that would indicate relevant prior experience. Use when alumni of specific organizations are highly valued.`,
          school: `Return an array of schools only if the user requires graduates from specific institutions. Generic statements like "top-tier schools" should not be turned into a school list.`,
          advanced_keywords: `Return an object with the shape { "first_name": string|null, "last_name": string|null, "title": string|null, "company": string|null, "school": string|null }. Populate only the fields that have very specific values to enforce (for example, a required current title or a required current company). Leave others as null. Do not invent names.`,
        };
        outputExamples = {
          keywords: `{"keywords": "(sales AND (director OR \\\"head of sales\\\")) OR \\\"vp sales\\\" OR \\\"commercial lead\\\""}`,
          industry: `{"industry": ["Pharmaceutical Manufacturing", "Biotechnology Research"]}`,
          location: `{"location": ["San Francisco Bay Area", "Austin, Texas"]}`,
          company: `{"company": ["Salesforce", "HubSpot"]}`,
          past_company: `{"past_company": ["McKinsey & Company", "Boston Consulting Group (BCG)"]}`,
          school: `{"school": ["Stanford University", "MIT"]}`,
          advanced_keywords: `{"advanced_keywords": {"first_name": null, "last_name": null, "title": "Chief Revenue Officer", "company": "Figma", "school": null}}`,
        };
        additionalRequirements = `- Keep the boolean string precise enough to avoid false positives like "EA to Sales Head" when searching for "Head of Sales".
    - Never provide more than 6 keywords in the boolean string.`;
        break;
      }

      case 'sales_navigator': {
        searchTypeLabel = 'LinkedIn Sales Navigator People';
        parameterInstructions = {
          keywords: `Generate a comprehensive string with job titles, skills, or functions for this role. Use boolean operators (AND, OR, NOT) and parentheses for complex queries. Focus on organization-structure-aligned titles and skills.`,
          location: `Return an object with "include" and/or "exclude" arrays of location names (city/state/country/region). Use include to only show results in listed locations, exclude to hide results from listed locations. Start with the most specific geography mentioned.`,
          industry: `Return an object with "include" and/or "exclude" arrays of industry names from the official LinkedIn industry list. Use include to only show results in listed industries, exclude to hide results from listed industries. Only include industries if they meaningfully narrow to the right talent pool.`,
          company: `Return an object with "include" and/or "exclude" arrays of current company names. Use include to only show results working at listed companies, exclude to hide results working at listed companies. Include only companies explicitly mentioned or dominantly known for hosting similar talent.`,
          past_company: `Return an object with "include" and/or "exclude" arrays of past company names. Use include to only show results who worked at listed companies, exclude to hide results who worked at listed companies. Use when alumni of specific organizations are highly valued.`,
          role: `Return an object with "include" and/or "exclude" arrays of job titles. Use include to only show results with listed titles, exclude to hide results with listed titles. Focus on specific job titles relevant to the role.`,
          function: `Return an object with "include" and/or "exclude" arrays of function/department names. Use include to only show results in listed functions, exclude to hide results in listed functions.`,
          seniority: `Return an object with "include" and/or "exclude" arrays of seniority levels. Valid values: "owner/partner", "cxo", "vice_president", "director", "experienced_manager", "entry_level_manager", "strategic", "senior", "entry_level", "in_training". Use include to only show specified seniority levels, exclude to hide specified seniority levels.`,
          school: `Return an object with "include" and/or "exclude" arrays of school names. Use include to only show results who attended listed schools, exclude to hide results who attended listed schools. Only include schools if the user requires graduates from specific institutions.`,
        };
        outputExamples = {
          keywords: `{"keywords": "sales director OR head of sales OR VP sales OR commercial lead"}`,
          location: `{"location": {"include": ["San Francisco Bay Area", "Austin, Texas"], "exclude": null}}`,
          industry: `{"industry": {"include": ["Pharmaceutical Manufacturing", "Biotechnology Research"], "exclude": null}}`,
          company: `{"company": {"include": ["Salesforce", "HubSpot"], "exclude": null}}`,
          past_company: `{"past_company": {"include": ["McKinsey & Company", "Boston Consulting Group (BCG)"], "exclude": null}}`,
          role: `{"role": {"include": ["Sales Director", "Head of Sales"], "exclude": null}}`,
          function: `{"function": {"include": ["Sales", "Business Development"], "exclude": null}}`,
          seniority: `{"seniority": {"include": ["director", "vice_president"], "exclude": ["entry_level"]}}`,
          school: `{"school": {"include": ["Stanford University", "MIT"], "exclude": null}}`,
        };
        additionalRequirements = `- When no values are appropriate, set the field to null or use null for include/exclude arrays.`;
        break;
      }

      case 'recruiter': {
        searchTypeLabel = 'LinkedIn Recruiter People';
        parameterInstructions = {
          keywords: `Generate a comprehensive string with job titles, skills, or functions for this role. Use boolean operators (AND, OR, NOT) and parentheses for complex queries. Focus on organization-structure-aligned titles and skills.`,
          location: `Return an array of location objects. Each object should have: "id" (string, use human-readable name), "priority" (CAN_HAVE, MUST_HAVE, or DOESNT_HAVE), "scope" (CURRENT, OPEN_TO_RELOCATE_ONLY, or CURRENT_OR_OPEN_TO_RELOCATE), and "title" (human-readable location name). Use human-readable names that will be converted to IDs automatically.`,
          industry: `Return an object with "include" and/or "exclude" arrays of industry names from the official LinkedIn industry list. Use include to only show results in listed industries, exclude to hide results from listed industries. Only include industries if they meaningfully narrow to the right talent pool.`,
          role: `Return an array of role objects. Each object can have either: (1) "id" (string), "is_selection" (boolean), "priority" (CAN_HAVE, MUST_HAVE, or DOESNT_HAVE), and "scope" (CURRENT_OR_PAST, CURRENT, PAST, PAST_NOT_CURRENT, or OPEN_TO_WORK), OR (2) "keywords" (string), "priority", and "scope". Use keywords format for human-readable job titles.`,
          company: `Return an array of company objects. Each object can have either: (1) "id" (string), "name" (string), "priority" (CAN_HAVE, MUST_HAVE, or DOESNT_HAVE), and "scope" (CURRENT_OR_PAST, CURRENT, PAST, or PAST_NOT_CURRENT), OR (2) "keywords" (string), "priority", and "scope". Use keywords format for human-readable company names.`,
          past_company: `Return an array of past company objects. Each object should have: "id" (string, use human-readable name) and "priority" (CAN_HAVE, MUST_HAVE, or DOESNT_HAVE). Use human-readable names that will be converted to IDs automatically.`,
          school: `Return an array of school objects. Each object should have: "id" (string, use human-readable name) and "priority" (CAN_HAVE, MUST_HAVE, or DOESNT_HAVE). Use human-readable names that will be converted to IDs automatically. Only include schools if the user requires graduates from specific institutions.`,
          skills: `Return an array of skill objects. Each object can have either: (1) "id" (string) and "priority" (CAN_HAVE, MUST_HAVE, or DOESNT_HAVE), OR (2) "keywords" (string) and "priority". Use keywords format for human-readable skill names.`,
          seniority: `Return an object with "include" and/or "exclude" arrays of seniority levels. Valid values: "owner", "partner", "cxo", "vp", "director", "manager", "senior", "entry", "training", "unpaid". Use include to only show specified seniority levels, exclude to hide specified seniority levels.`,
        };
        outputExamples = {
          keywords: `{"keywords": "sales director OR head of sales OR VP sales OR commercial lead"}`,
          location: `{"location": [{"id": "San Francisco Bay Area", "priority": "MUST_HAVE", "scope": "CURRENT", "title": "San Francisco Bay Area"}]}`,
          industry: `{"industry": {"include": ["Pharmaceutical Manufacturing", "Biotechnology Research"], "exclude": null}}`,
          role: `{"role": [{"keywords": "Sales Director", "priority": "MUST_HAVE", "scope": "CURRENT"}]}`,
          company: `{"company": [{"keywords": "Salesforce", "priority": "CAN_HAVE", "scope": "CURRENT_OR_PAST"}]}`,
          past_company: `{"past_company": [{"id": "McKinsey & Company", "priority": "CAN_HAVE"}]}`,
          school: `{"school": [{"id": "Stanford University", "priority": "CAN_HAVE"}]}`,
          skills: `{"skills": [{"keywords": "Sales Management", "priority": "MUST_HAVE"}]}`,
          seniority: `{"seniority": {"include": ["director", "vp"], "exclude": ["entry"]}}`,
        };
        additionalRequirements = `- Use human-readable text (no LinkedIn IDs - they will be converted automatically).
    - When no values are appropriate, set the field to null or use an empty array.`;
        break;
      }
    }

    const instruction = parameterInstructions[parameter];
    const example = outputExamples[parameter];

    if (!instruction || !example) {
      throw new Error(`Parameter "${parameter}" is not supported for ${searchType} search type`);
    }

    return `
    You are generating the ${parameter} parameter for a ${searchTypeLabel} search.
    ${commonContext}

    Parameter-specific instructions:
    ${instruction}

    OUTPUT REQUIREMENTS:
    - Respond with JSON only.
    - Match exactly the schema illustrated in this example:
      ${example}
    - Use human-readable text (no LinkedIn IDs).
    ${additionalRequirements}`;
  }



  // booleanClassicPeopleSearchStringPrompt(userMessage: string): string {
  //   const specificRoleDescription = `The specific role that we are hiring for is: ${userMessage}`;
  //   const specificRoleName = `The specific role name that we are hiring for is: ${userMessage}`;
  //   const roleLocation = `The location of the role is: ${location}`;
  //   const roleIndustry = `The industry of the role is: ${userMessage}`;
  //   const roleCompany = `The company of the role is: ${userMessage}`;

  //   const prompt = `

  //   You are an expert linkedin boolean search string generator.
  //   The broad task is to filter the linkedin database to provide a list of relevant candidates for the specific role that we are hiring for.
  //   ${specificRoleName}


  //   ${roleLocation}    
  //   ${roleIndustry}
  //   ${roleCompany}

  //   Bear in mind the context within which the candidate comes from and where he will go to.

  //   Your task is to generate a boolean string with a maximum of 6 keywords separated by boolean operators AND, OR, NOT in brackets.
  //   As a boolean string expert, you will use brackets and boolean operators to generate a more accurate search string.
  //   For example, if the user mentions "sales representatives", you can use combination like - 
  //   -  (sales AND (representative OR executive OR manager)) OR "business development executive" OR "account executive" 
  //   or 
  //   -  "sales representative" OR "sales executive" OR "sales manager" OR "business development executive" OR "account executive" OR "sales officer"

  //   Think of all related job titles, synonyms, and variations but intelligently put a maximum of 6 keywords.
  //   Linkedin Classic People search allows only a maximum of 6 keywords in the boolean string.
  //   Also use very targeted keywords to generate a search string that can filter the raw linkedin database and provide the most relevant results.
  //   Your priority will be to generate organisation structure matching keywords. Keywords may be for job titles as well as specific keywords to denote the industry or specific skills that would be most commonly found in the linkedin bios of people performing the specific role that we are hiring for.
  //   Generate a boolean string with a maximum of 6 keywords separated by boolean operators AND, OR, NOT in brackets. For example, if the user mentions "sales representatives", include variations like "sales representative OR sales executive OR sales manager OR business development executive OR account executive OR territory sales OR inside sales". Think of all related job titles, synonyms, and variations.
  //   Never provide more than 6 keywords in the boolean string.`;

  //   console.log(prompt);
  //   return prompt;
  // }

}
