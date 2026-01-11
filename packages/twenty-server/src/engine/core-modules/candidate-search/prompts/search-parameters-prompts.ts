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

        8. **refinement** - User wants to refine or modify existing search parameters
          - Keywords: "more", "also", "add", "refine", "improve", "better", "narrow", "expand", "adjust", "modify", "change", "update", "tweak", "enhance", "further", "additionally", "plus", "include", "exclude", "remove", "filter"
          - Context: There are existing search parameters in the conversation
          - Intent: User wants to modify or enhance existing search parameters rather than create new ones

        NOTE: Clarification detection is handled automatically during search parameter generation via query understanding. If a query needs clarification, it will be detected and questions will be asked as part of the search_parameters flow.
  
        CLASSIFICATION RULES:
        - Analyze the PRIMARY intent of the message
        - Consider context clues and specific terminology
        - Review chat history to understand conversation flow
        - CRITICAL: Check if the LAST assistant message in chat history contains clarification questions (look for "I need some clarification", numbered questions "1.", "2.", etc.) - if yes, the current user message is VERY LIKELY a clarification_response
        - If the user message appears to be answering questions (numbered responses, short specific answers, providing missing details), classify as clarification_response
        - Check if there are existing search parameters - if yes and message contains refinement keywords, likely refinement
        - If the message is vague or incomplete AND there are no clarification questions in history, classify as search_parameters - the query understanding step will detect if clarification is needed
        - If multiple intents are present, choose the most specific one
        - If unclear, default to "general_help"
        - Be precise and consistent in classification
  
        RESPONSE FORMAT:
        Return ONLY the classification category name (e.g., "search_parameters", "enrichments", "filters", "sorts", "complete_plan", "general_help", "clarification_response", or "refinement")`,
  
        user: `Classify the following user message to determine their intent:
  
        User Message: "{{message}}"${chatHistoryContext}${jdContext}
  
        Context: This is a chat interface for a candidate search and recruitment system where users can generate search parameters, enrichments, filters, and sorting strategies for LinkedIn candidate searches.
  
        Classify this message into one of the categories: search_parameters, enrichments, filters, sorts, complete_plan, general_help, clarification_response, or refinement.`
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
    queryUnderstanding?: import('../types/candidate-search-request.type').QueryUnderstanding,
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
      CRITICAL: If specific companies are mentioned (e.g., "Novartis", "Microsoft"), DO NOT include industry filter. Company filter is more precise and including industry would unnecessarily restrict results (candidates may have worked at the company in different roles/industries).
      Valid LinkedIn industries (exact match required): ${linkedinIndustryOptions.join(', ')}
    - Location: Start specific (city/state) before widening (country/region). Use when relocation risk exists.
    - Company & Past Company: Only when the user names specific companies or the niche is best identified via employer lists. If company is specified, do not also include industry filter as it's redundant and restrictive.
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

    const queryUnderstandingSection = queryUnderstanding 
      ? `
    QUERY UNDERSTANDING (Structured Analysis):
    Primary Role: ${queryUnderstanding.primaryRole}
    Role Variations: ${queryUnderstanding.roleVariations.join(', ')}
    Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
    Location: ${queryUnderstanding.locationHierarchy.primary}${queryUnderstanding.locationHierarchy.secondary ? `, ${queryUnderstanding.locationHierarchy.secondary.join(', ')}` : ''}${queryUnderstanding.locationHierarchy.regional ? ` (Region: ${queryUnderstanding.locationHierarchy.regional})` : ''}
    Company Preferences: ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'Not specified'}
    Seniority Level: ${queryUnderstanding.seniorityLevel || 'Not specified'}
    Domain Context: ${queryUnderstanding.domainContext || 'Not specified'}
    Skills: ${queryUnderstanding.skills?.join(', ') || 'Not specified'}
    Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ')}
    Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ')}
    `
      : '';

    const prompt = `
    You are also an expert at searching candidates on ${searchTypeLabel}.
    The broad task is to filter the LinkedIn database to provide a list of highly relevant candidates for the specific role that we are hiring for, while avoiding false positives (e.g., role = "Sales Head" but results show "EA to Sales Head").
    We need 40-80 qualified candidates across the first few pages of search results—enough volume to close the role without diluting quality.

    ${parameterList}

    The current search is ${userMessage}
    Classification Analysis: ${classificationReasoning}
    ${queryUnderstandingSection}
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
   * Build enhanced keyword generation prompt with domain awareness
   */
  buildEnhancedKeywordPrompt(
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    strategy: {
      label: string;
      aggressiveness: 'focused' | 'balanced' | 'broad';
      goal: string;
    },
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const searchTypeLabel = searchType === 'classic' 
      ? 'LinkedIn Classic People' 
      : searchType === 'sales_navigator' 
        ? 'LinkedIn Sales Navigator People' 
        : 'LinkedIn Recruiter People';

    const booleanLimit = searchType === 'classic' 
      ? 'Maximum 6 keyword clauses in the boolean string. Use parentheses for grouping.' 
      : 'Can use more variations but keep it focused.';

    const certificationsInfo = queryUnderstanding.certifications?.length 
      ? `Certifications Required: ${queryUnderstanding.certifications.filter(c => c.required).map(c => c.name).join(', ')}\nCertifications Preferred: ${queryUnderstanding.certifications.filter(c => !c.required).map(c => c.name).join(', ')}`
      : 'Certifications: Not specified';
    
    const regulatoryInfo = queryUnderstanding.regulatoryExperience?.length 
      ? `Regulatory Experience: ${queryUnderstanding.regulatoryExperience.join(', ')}`
      : 'Regulatory Experience: Not specified';
    
    const skillsInfo = queryUnderstanding.skills?.length 
      ? `Key Skills/Technologies: ${queryUnderstanding.skills.join(', ')}`
      : 'Key Skills/Technologies: Not specified';

    return `Generate precise LinkedIn search keywords for this role using the enhanced keyword schema:

PRIMARY ROLE: ${queryUnderstanding.primaryRole}
ROLE VARIATIONS: ${queryUnderstanding.roleVariations.join(', ')}
INDUSTRY: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
DOMAIN: ${queryUnderstanding.domainContext || 'Not specified'}
${certificationsInfo}
${regulatoryInfo}
${skillsInfo}

STRATEGY: ${strategy.label} (${strategy.aggressiveness})
GOAL: ${strategy.goal}

KEYWORD GENERATION STRATEGY:

1. PRIMARY KEYWORDS (Job Titles):
   - Maximum ${searchType === 'classic' ? '6' : '10'} primary keywords for ${searchType === 'classic' ? 'classic search' : 'Sales Navigator/Recruiter'}
   - Include all relevant role variations: ${queryUnderstanding.roleVariations.join(', ')}
   - Avoid false positives: Exclude variations like "EA to ${queryUnderstanding.primaryRole}", "Assistant to ${queryUnderstanding.primaryRole}"
   - Use precise title matching
   - Consider organizational hierarchy and seniority (${queryUnderstanding.seniorityLevel || 'not specified'})

2. CERTIFICATION KEYWORDS (if certifications are critical):
   ${queryUnderstanding.certifications?.length ? `- Prioritize certification keywords: ${queryUnderstanding.certifications.map(c => c.name).join(', ')}
   - Include certification names that candidates might mention in their profiles
   - For classic search: If certifications are critical, consider including them in primary keywords or advanced_keywords` : '- No certification requirements specified'}

3. TECHNOLOGY KEYWORDS (if technologies are critical):
   ${queryUnderstanding.skills?.length ? `- Prioritize technology keywords: ${queryUnderstanding.skills.join(', ')}
   - Include domain-specific technologies that are critical requirements
   - For classic search: Use advanced_keywords field if technologies can't fit in primary keywords` : '- No critical technology requirements specified'}

4. REGULATORY KEYWORDS (if regulatory experience is critical):
   ${queryUnderstanding.regulatoryExperience?.length ? `- Include regulatory keywords: ${queryUnderstanding.regulatoryExperience.join(', ')}
   - These should be included if regulatory experience is a critical requirement` : '- No regulatory experience requirements specified'}

5. DOMAIN-SPECIFIC KEYWORDS:
   - Include domain-specific terminology: ${queryUnderstanding.domainContext || 'general'}
   - For Indian market: Use common terminology (3PL, modern trade, dark store, UPI, PLG, etc.)
   - Account for MNC vs Indian company title differences

6. KEYWORD STRUCTURE:
   - ${booleanLimit}
   - Use parentheses for grouping related terms
   - Prioritize: Critical certifications/technologies > Role titles > Domain terms
   - Example structure: "(sales AND (director OR head)) OR \"vp sales\" OR \"commercial lead\""
   ${searchType === 'classic' ? '- For classic search: Use advanced_keywords field for certifications/technologies if they can\'t fit in primary keywords' : ''}

PRIORITIZATION RULES:
- If certifications are CRITICAL (required), they should be included in primary keywords or advanced_keywords
- If technologies are CRITICAL, they should be prioritized in keyword generation
- Role match is paramount, but critical non-title requirements should be included when possible
- For classic search with limited keywords: Prioritize role titles, but include critical certifications/technologies in advanced_keywords if available

Generate keywords that will return highly relevant candidates while prioritizing critical non-title requirements.`;
  }

  /**
   * Build parameter validation prompt
   */
  buildParameterValidationPrompt(
    generatedParameters: any,
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    strategy: {
      label: string;
      goal: string;
      aggressiveness: 'focused' | 'balanced' | 'broad';
      estimatedCandidateCount: { minimum: number; maximum: number };
    },
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    return `Validate these LinkedIn search parameters for coherence and effectiveness:

GENERATED PARAMETERS:
${JSON.stringify(generatedParameters, null, 2)}

QUERY UNDERSTANDING:
Primary Role: ${queryUnderstanding.primaryRole}
Role Variations: ${queryUnderstanding.roleVariations.join(', ')}
Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
Location: ${queryUnderstanding.locationHierarchy.primary}
Company Preferences: ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'Not specified'}
Domain: ${queryUnderstanding.domainContext || 'Not specified'}

STRATEGY: ${strategy.label} (${strategy.aggressiveness})
GOAL: ${strategy.goal}
TARGET CANDIDATE COUNT: ${strategy.estimatedCandidateCount.minimum}-${strategy.estimatedCandidateCount.maximum}

VALIDATION CHECKS:
1. Do keywords align with industry filters?
2. Are location filters appropriate for the role level and domain?
3. Are company filters too restrictive or too broad?
4. Will this likely return ${strategy.estimatedCandidateCount.minimum}-${strategy.estimatedCandidateCount.maximum} candidates?
5. Are there conflicting filters (e.g., industry excludes location)?
6. Are there redundant filters that can be removed?
7. Are false positives likely (e.g., "EA to Sales Head" when searching for "Sales Head")?
8. Do parameters match the strategy's aggressiveness level?

Provide validation result with:
- isCoherent: true/false
- issues: [list of specific issues found]
- suggestedRefinements: [specific suggestions to improve]
- estimatedResultCount: "low" | "medium" | "high"
- reasoning: brief explanation`;
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
          industry: `Return an array of industry names selected strictly from the official LinkedIn industry list provided. Only include industries if they are clearly tied to the target profile. Prefer leaving the array empty if industry would unnecessarily narrow results. CRITICAL: If the user mentions specific companies (e.g., "Novartis", "Microsoft"), DO NOT include industry filter. Company filter is more precise and including industry would unnecessarily restrict results - candidates may have worked at the company in different roles or industries.`,
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

  /**
   * Build parameter generation prompt from strategy text
   * This method interprets natural language strategy text to generate parameters
   */
  buildParameterGenerationPromptFromStrategyText(
    strategyText: string,
    queryUnderstandingText: string,
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    let searchTypeLabel: string;
    let availableParameters: string;

    switch (searchType) {
      case 'classic': {
        searchTypeLabel = 'LinkedIn Classic People';
        availableParameters = `Available parameters:
- keywords: Boolean string (max 6 keyword clauses) for job titles, skills, or functions
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

SEARCH STRATEGY:
${strategyText}

QUERY UNDERSTANDING:
${queryUnderstandingText}

ORIGINAL USER QUERY:
"${userMessage}"

CLASSIFICATION REASONING:
${classificationReasoning}

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
- If strategy mentions "job titles", extract them from query understanding and generate keywords
- If strategy mentions "location", extract location values from query understanding
- If strategy mentions "industry", extract industry values from query understanding
- If strategy mentions "company", extract company values from query understanding
- Be specific with values - use actual names from query understanding, not placeholders

Raw Job Description Context:
${rawJDText || 'No job description text available.'}

Generate the complete parameter set based on the strategy description.`;
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

  /**
   * Build result validation prompt
   */
  buildResultValidationPrompt(
    searchResults: any[],
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage: string,
  ): string {
    // Sample 5-10 results for validation
    const sampleResults = searchResults.slice(0, Math.min(10, searchResults.length));
    const sampleResultsText = sampleResults.map((result, idx) => {
      const name = result.name || `${result.first_name || ''} ${result.last_name || ''}`.trim();
      const headline = result.headline || '';
      const currentPosition = result.current_positions?.[0] 
        ? `${result.current_positions[0].role} at ${result.current_positions[0].company}`
        : '';
      return `${idx + 1}. ${name} - ${headline} - ${currentPosition}`;
    }).join('\n');

    return `Validate these LinkedIn search results against the original query:

ORIGINAL QUERY: ${userMessage}

QUERY UNDERSTANDING:
Primary Role: ${queryUnderstanding.primaryRole}
Role Variations: ${queryUnderstanding.roleVariations.join(', ')}
Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
Location: ${queryUnderstanding.locationHierarchy.primary}
Company Preferences: ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'Not specified'}
Domain: ${queryUnderstanding.domainContext || 'Not specified'}
Seniority Level: ${queryUnderstanding.seniorityLevel || 'Not specified'}
Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ')}
Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ')}

SAMPLE RESULTS (${sampleResults.length} of ${searchResults.length} total):
${sampleResultsText}

VALIDATION TASKS:
1. Assess relevance: Do these results match the query requirements?
2. Check for false positives: Are there results like "EA to ${queryUnderstanding.primaryRole}" when searching for "${queryUnderstanding.primaryRole}"?
3. Evaluate quality: Are the results appropriate for the role level and domain?
4. Calculate relevance score: What percentage of results are truly relevant? (0-1 scale)
5. Determine pagination: Should we continue fetching more pages?

Provide validation result with:
- isRelevant: true/false (overall relevance)
- relevanceScore: number (0-1, percentage of relevant results)
- falsePositives: [array of false positive examples found]
- qualityAssessment: "high" | "medium" | "low"
- shouldContinuePagination: true/false (based on relevance, quality, and whether we need more candidates)
- reasoning: brief explanation of the validation decision`;
  }

  /**
   * Get prompt for query understanding
   */
  getQueryUnderstandingPrompt(
    userMessage: string,
    rawJDText: string,
    isClarificationResponse: boolean = false,
    clarificationQuestions?: string[],
    clarificationAnswers?: string,
  ): string {
    const clarificationContext = isClarificationResponse 
      ? `\n\n⚠️ CRITICAL: This is a CLARIFICATION RESPONSE from the user. They have already provided additional information to clarify their previous query.
      
      ${clarificationQuestions && clarificationQuestions.length > 0 
        ? `CLARIFICATION QUESTIONS THAT WERE ASKED:
      ${clarificationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
      
      USER'S CLARIFICATION ANSWERS:
      "${clarificationAnswers || userMessage}"
      
      ` 
        : `The user message contains BOTH:
      1. ORIGINAL USER QUERY - This contains the PRIMARY search intent (role, location, industry, etc.). You MUST preserve ALL information from this.
      2. USER'S CLARIFICATION ANSWERS - These are numbered responses that answer specific clarification questions.
      `}
      
      EXTRACTION RULES:
      - FIRST: Extract and preserve ALL information from the ORIGINAL USER QUERY section:
        * PRIMARY ROLE (e.g., "Pulmonologist", "Sales Manager", "Software Engineer") - THIS IS CRITICAL
        * LOCATION (e.g., "Mumbai", "Bangalore", "Delhi NCR") - THIS IS CRITICAL
        * INDUSTRY (e.g., "Hospitals and Health Care", "SaaS", "FMCG") - THIS IS CRITICAL
        * COMPANY preferences, domain context, skills, etc.
      ${clarificationQuestions && clarificationQuestions.length > 0
        ? `- SECOND: Map the clarification answers to the questions:
        * Match each numbered answer (1., 2., 3., etc.) to the corresponding clarification question
        * Update/refine the original query information with clarification details
        * Example: If question 1 was about seniority and answer is "consultant", update seniorityLevel to "senior"
        * Example: If question 2 was about subspecialty and answer is "any", preserve the original role without narrowing`
        : `- SECOND: Extract answers from the CLARIFICATION ANSWERS section and merge them with the original query:
        * Map numbered answers to the clarification questions they answer
        * Update/refine the original query information with clarification details
        * Example: If original query says "Pulmonologist" and clarification says "1. Consultant level", the result should be "Consultant Pulmonologist" or "Pulmonologist at Consultant level"`}
      - CRITICAL: DO NOT replace the original role/location/industry with generic terms from clarification answers
      - CRITICAL: If clarification says "Any" for location/industry, but original query specified "Mumbai" or "Healthcare", preserve the original specification
      - CRITICAL: If clarification answers are numbered (1., 2., 3., 4.), they typically answer questions about: seniority level, work context, skills/certifications, background preferences
      - Be more lenient in interpretation - use context clues to infer missing details
      - Only set needsClarification to true if there are CRITICAL missing pieces that would make search impossible
      - If the user has provided reasonable information (even if not perfect), proceed with needsClarification: false
      - The user has already answered clarification questions, so avoid asking for more unless absolutely necessary`
      : '';

    return `You are an expert recruiter analyzing a candidate search query. Extract structured information from the user's query and job description context.
${clarificationContext}

User Query: ${userMessage}
Job Description Context: ${rawJDText || 'None'}

Extract the following structured information:

1. PRIMARY ROLE: The main job title or role being searched for
2. ROLE VARIATIONS: List 5-10 common variations, synonyms, and related titles that describe similar roles
3. INDUSTRY/SECTOR: Specific industries mentioned (use exact LinkedIn industry names from the official list)
4. LOCATION HIERARCHY: 
   - Primary location (most specific: city/state)
   - Secondary locations (if multiple mentioned)
   - Regional context (e.g., "Delhi NCR" includes Noida, Gurgaon; "Mumbai" includes Navi Mumbai, Thane)
5. COMPANY PREFERENCES:
   - Current companies (explicitly mentioned)
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
  : `If clarification is needed:
- Generate 2-4 specific, actionable questions that will help clarify the requirements
- Prioritize the most critical missing information first
- Make questions clear and easy to answer
- Explain why clarification is needed in ambiguityReasons

Example clarification questions:
- "Which specific location(s) should we focus on? (e.g., Bangalore, Mumbai, Delhi NCR)"
- "What industry or sector should candidates come from? (e.g., SaaS, FMCG, BFSI)"
- "What level of seniority are you looking for? (e.g., Mid-level, Senior, Executive)"
- "Are there any specific companies or company types you prefer or want to exclude?"`}`;
  }

  /**
   * Get prompt for query complexity assessment
   */
  getQueryComplexityPrompt(
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage: string,
  ): string {
    return `You are an expert recruiter and search strategist analyzing the complexity of a candidate search query. Your task is to assess whether the query requires a simple, moderate, or complex search strategy.

QUERY UNDERSTANDING ANALYSIS:
Primary Role: ${queryUnderstanding.primaryRole}
Role Variations: ${queryUnderstanding.roleVariations.join(', ')} (${queryUnderstanding.roleVariations.length} variations)
Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'} (${queryUnderstanding.industry?.length || 0} industries)
Location Hierarchy:
  - Primary: ${queryUnderstanding.locationHierarchy.primary || 'Not specified'}
  - Secondary: ${queryUnderstanding.locationHierarchy.secondary?.join(', ') || 'None'} (${queryUnderstanding.locationHierarchy.secondary?.length || 0} secondary locations)
  - Regional: ${queryUnderstanding.locationHierarchy.regional || 'None'}
Company Preferences:
  - Current: ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'None'} (${queryUnderstanding.companyPreferences?.current?.length || 0} companies)
  - Past: ${queryUnderstanding.companyPreferences?.past?.join(', ') || 'None'} (${queryUnderstanding.companyPreferences?.past?.length || 0} companies)
Seniority Level: ${queryUnderstanding.seniorityLevel || 'Not specified'}
Domain Context: ${queryUnderstanding.domainContext || 'Not specified'}
Skills: ${queryUnderstanding.skills?.join(', ') || 'Not specified'}
Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ') || 'None'} (${queryUnderstanding.explicitRequirements.length} requirements)
Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ') || 'None'} (${queryUnderstanding.preferredRequirements.length} requirements)
Needs Clarification: ${queryUnderstanding.needsClarification ? 'Yes' : 'No'}

ORIGINAL USER QUERY:
"${userMessage}"

COMPLEXITY ASSESSMENT GUIDELINES:

1. SIMPLE QUERIES:
   - Clear, well-defined role with specific requirements
   - Single primary location (secondary locations are acceptable if they're part of a region like "Delhi NCR")
   - Single or no industry specified (industry is optional if domain context is clear)
   - Specific domain context (SaaS, FMCG, Pharma, etc.)
   - Explicit requirements clearly stated
   - No ambiguous or conflicting requirements
   - Even with many role variations (5-10), if other criteria are specific, it can still be simple
   - Highly specific queries: single location + specific domain + explicit requirements = simple
   - Example: "Sales Manager in Mumbai for SaaS company with 5+ years experience" = simple

2. MODERATE QUERIES:
   - Some complexity but manageable with a focused strategy
   - Multiple locations OR multiple industries (but not both)
   - Some ambiguity but can be resolved with reasonable inference
   - Multiple company preferences (3-5 companies) but not excessive
   - Role has moderate variations (5-8 variations)
   - Example: "Senior Software Engineer in Bangalore or Hyderabad for tech companies" = moderate

3. COMPLEX QUERIES:
   - Multiple locations AND multiple industries simultaneously
   - Many role variations (>8) combined with multiple locations or industries
   - Highly ambiguous requirements that cannot be reasonably inferred
   - Excessive company preferences (>5 current companies OR >5 past companies)
   - Broad scope: many role variations + multiple locations/industries
   - If clarification is needed (needsClarification = true), consider it complex until clarified
   - Conflicting requirements that require multiple search strategies
   - Example: "Manager roles across Mumbai, Delhi, Bangalore in FMCG, Pharma, and BFSI industries with experience at 10+ different companies" = complex

SPECIAL CONSIDERATIONS:

- Regional locations (like "Delhi NCR" which includes Noida, Gurgaon) are NOT considered multiple locations - they're a refinement of the primary location
- Only secondary locations count as multiple locations
- Company is preferred but not required for "simple" classification - if location, domain, and role are very specific, it can be simple even without company
- Highly specific queries should be classified as simple even if they have many role variations, as long as location, domain, and requirements are specific
- If the query needs clarification, it should be classified as complex until clarified

ASSESSMENT TASK:
1. Analyze all factors in the query understanding
2. Determine the complexity level: simple, moderate, or complex
3. Provide detailed reasoning explaining your assessment
4. Identify which specific factors influenced your decision

Your assessment will determine whether to generate:
- Simple: Single focused search strategy
- Moderate: Primary strategy with one alternative
- Complex: Multiple complementary strategies (focused, balanced, broad)

Be thorough in your analysis and provide clear reasoning for your complexity assessment.`;
  }

  /**
   * Get prompt for strategy generation as natural language text
   */
  getStrategyGenerationPrompt(
    queryUnderstandingText: string,
    complexityReasoning: string,
    classificationReasoning: string,
    userMessage: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    // List available parameters based on search type
    let availableParameters = '';
    if (searchType === 'classic') {
      availableParameters = `Available parameters for Classic LinkedIn Search:
- keywords: Job titles, role names, or search terms (required)
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

COMPLEXITY ASSESSMENT:
${complexityReasoning}

CLASSIFICATION REASONING:
${classificationReasoning}

ORIGINAL USER QUERY:
"${userMessage}"

YOUR TASK:
Generate natural language search strategy descriptions. Each strategy should describe which parameters to use and how to combine them.

STRATEGY DESCRIPTION FORMAT:
Describe strategies in natural language, specifying:
1. Which parameters to use (keywords, location, industry, company, etc.)
2. What values to include in each parameter (be specific when possible)
3. How parameters should be combined

EXAMPLES OF GOOD STRATEGY DESCRIPTIONS (ordered from simplest to most comprehensive):

Example 1 - Simple query (Pulmonologist in Mumbai):
- Strategy 1 (SIMPLEST): "Use keywords (job titles: Pulmonologist OR Chest Physician) and location (Mumbai)"

Example 2 - Moderate query (Senior Software Engineer in Bangalore):
- Strategy 1 (SIMPLEST): "Use keywords (job titles: Software Engineer) and location (Bangalore)"
- Strategy 2 (MODERATE): "Use keywords (job titles: Software Engineer OR Senior Software Engineer) and location (Bangalore) and industry (Technology)"

Example 3 - Complex query (Consultant Pulmonologist in Mumbai hospitals):
- Strategy 1 (SIMPLEST): "Use keywords (job titles: Pulmonologist OR Chest Physician) and location (Mumbai)"
- Strategy 2 (MODERATE): "Use keywords (job titles: Pulmonologist OR Chest Physician OR Respiratory Physician) and location (Mumbai) and industry (Hospitals and Health Care)"
- Strategy 3 (COMPREHENSIVE): "Use keywords (job titles: all 36 role variations for Pulmonologist, emphasizing consultant and senior roles) and location (Mumbai) and company (current: list of 10 major Mumbai hospitals)"

GENERAL EXAMPLES:
- Simple: "Use keywords (job titles: Software Engineer) and location (Mumbai)"
- Moderate: "Use keywords (job titles: Software Engineer, Senior Developer) and location (Mumbai) and industry (Technology)"
- Comprehensive: "Use keywords (job titles: Software Engineer OR Senior Software Engineer OR Full Stack Developer) and location (Mumbai, Navi Mumbai) and industry (Technology) and company (current: TCS, Infosys, Wipro)"

GUIDELINES:
1. Always include keywords (job titles) - this is required for all searches
2. Use location when specified in query understanding
3. Use industry when specified and relevant
4. Use company filters when company preferences are mentioned
5. Combine parameters logically based on query requirements
6. STRATEGY ORDERING: Always order strategies from SIMPLEST to MOST COMPREHENSIVE
7. FIRST STRATEGY (REQUIRED): Must be the simplest possible baseline strategy using minimal filters:
   - Use only the most essential parameters (keywords + location, or keywords + location + industry if industry is critical)
   - Use the primary role title and 1-2 most common variations (e.g., "Pulmonologist OR Chest Physician")
   - Do NOT include company filters, seniority filters, or other restrictive parameters in the first strategy
   - This ensures we capture the broadest relevant candidate pool first
8. SUBSEQUENT STRATEGIES: Progressively add more filters and specificity:
   - Add more role variations
   - Add company filters if specified
   - Add seniority filters if specified
   - Add industry filters if not in first strategy
   - Each strategy should build upon the previous one with additional specificity
9. For simple queries: Generate 1 focused strategy (still keep it simple)
10. For moderate queries: Generate 2 strategies (simple baseline + one with additional filters)
11. For complex queries: Generate 2-3 strategies (simple baseline + progressively more comprehensive)
12. Each strategy should be distinct and complementary
13. Be specific about what values to include (e.g., "Mumbai" not just "location")

DECIDE HOW MANY STRATEGIES:
- Simple query: 1 strategy (simple baseline)
- Moderate query: 2 strategies (simple baseline + one with additional filters)
- Complex query: 2-3 strategies (simple baseline + progressively more comprehensive)

STRATEGY ORDERING REQUIREMENT:
- Strategy 1: SIMPLEST - Minimal filters (keywords with primary role + location, optionally + industry if critical)
- Strategy 2: MODERATE - Add more role variations and/or additional filters
- Strategy 3: COMPREHENSIVE - All filters, all role variations, maximum specificity

For each strategy, provide:
- strategyText: Natural language description of the strategy
- label: Short descriptive label (optional)
- estimatedCandidateCount: Estimated range of candidates (optional)

Generate the strategies now, ensuring the first strategy is always the simplest baseline.`;
  }

  /**
   * Get prompt for ambiguity detection
   */
  getAmbiguityDetectionPrompt(
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage: string,
    isClarificationResponse: boolean = false,
  ): string {
    const clarificationContext = isClarificationResponse 
      ? `\n\nIMPORTANT: This is a CLARIFICATION RESPONSE from the user. They have already provided additional information to clarify their previous query.
      - Be VERY conservative in flagging ambiguity - only set needsClarification to true if search is truly impossible
      - Use context clues to infer missing details rather than asking for more
      - If the user has provided reasonable information (even if not perfect), proceed with needsClarification: false
      - The user has already answered clarification questions, so avoid asking for more unless absolutely necessary`
      : '';

    return `You are an expert recruiter analyzing a candidate search query for ambiguity and missing information. Your task is to determine if the query needs clarification before generating search parameters.

QUERY UNDERSTANDING ANALYSIS:
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
${clarificationContext}

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
   * Get prompt for discovery complexity assessment
   * Determines the complexity level of discovery operations needed
   */
  getDiscoveryComplexityPrompt(
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage: string,
  ): string {
    return `You are an expert recruiter analyzing a candidate search query to determine the complexity of discovery operations needed. Your task is to assess what discovery operations are required and classify the overall complexity.

QUERY UNDERSTANDING ANALYSIS:
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

DISCOVERY OPERATIONS TO ASSESS:

1. JOB TITLE DISCOVERY (needsJobTitleDiscovery):
   - Needed when: Role is specialized, medical, technical, or has many industry-specific variations
   - Examples: "pulmonologist", "cardiologist", "orthopedic surgeon", "data engineer", "ML engineer"
   - Not needed for: Generic roles like "manager", "developer", "analyst" with sufficient variations already
   - Consider: Role specificity, domain context, number of existing variations

2. COMPANY DISCOVERY (needsCompanyDiscovery):
   - Needed when: Query mentions company descriptions rather than specific company names
   - Examples: "textile machinery manufacturers", "ceramics insulators companies", "SaaS companies"
   - Patterns: "companies that manufacture", "companies in the X space", "X manufacturing companies"
   - Not needed for: Specific company names already mentioned

3. COMPANY GROUP DISCOVERY (needsCompanyGroupDiscovery):
   - Needed when: Query mentions company groups (e.g., "Tata group", "Birla group", "Adani group")
   - These groups need to be expanded to their subsidiaries
   - Check: companyGroupPreferences field in query understanding

4. INSTITUTE DISCOVERY (needsInstituteDiscovery):
   - Needed when: Query mentions educational institute requirements
   - Examples: "tier-1", "IIT", "IIM", "premier institutes", "top colleges"
   - Patterns: "from tier-1", "IIT/IIM graduates", "premier institutes"
   - Check: explicitRequirements and preferredRequirements for institute mentions

COMPLEXITY LEVELS:

- SIMPLE: Only one discovery operation needed, or no discovery needed
  - Example: Only company group expansion, or only job title discovery for a single specialized role

- MODERATE: Two discovery operations needed, or one complex discovery operation
  - Example: Job title discovery + company discovery, or institute discovery with domain filtering

- COMPLEX: Three or more discovery operations needed, or discovery operations with complex filtering
  - Example: Job title discovery + company discovery + institute discovery + company group expansion

ASSESSMENT TASK:
1. Analyze the query understanding and user message for discovery needs
2. Determine which discovery operations are needed (needsJobTitleDiscovery, needsCompanyDiscovery, needsCompanyGroupDiscovery, needsInstituteDiscovery)
3. Classify the overall complexity as 'simple', 'moderate', or 'complex'
4. Provide detailed reasoning for your assessment

Remember: Be accurate in identifying discovery needs. Only flag discovery operations that are truly needed based on the query content.`;
  }

  /**
   * Get prompt for pattern identification
   * Identifies patterns in the query that require discovery operations
   */
  getPatternIdentificationPrompt(
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage: string,
  ): string {
    return `You are an expert recruiter analyzing a candidate search query to identify patterns that require discovery operations. Your task is to detect specific patterns in the query that indicate the need for discovery.

QUERY UNDERSTANDING ANALYSIS:
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

IDENTIFICATION TASK:
1. Analyze the query understanding and user message for each pattern type
2. For each pattern, determine:
   - detected: true/false (whether the pattern is present)
   - confidence: 0.0-1.0 (how confident you are in the detection)
   - Additional fields: description, groupNames, instituteType (as applicable)
   - reasoning: Explanation of why the pattern was or wasn't detected
3. Be thorough but accurate - only flag patterns that are clearly present

Remember: 
- Confidence should reflect how certain you are about the pattern
- Extract specific text/names when patterns are detected
- Check both the user message and the structured query understanding fields
- Some patterns may overlap (e.g., specialized role + company description)`;
  }

  /**
   * Build prompt for refining existing search parameters
   */
  /**
   * Build prompt for scoring individual candidate relevance
   */
  buildCandidateRelevanceScoringPrompt(
    candidate: any,
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
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

    return `Score the relevance of this candidate against the search query:

ORIGINAL QUERY: ${userMessage}

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

SCORING TASKS:
1. Calculate relevanceScore (0-1): 
   - 0.8-1.0: Highly relevant (matches primary role, company, location, and most requirements)
   - 0.5-0.79: Somewhat relevant (matches some key requirements but may have gaps)
   - 0.0-0.49: Less relevant (minimal match or significant mismatches)

2. Determine relevanceLabel: "highly_relevant", "somewhat_relevant", or "less_relevant"

3. Identify matchReasons: List specific reasons why this candidate matches (e.g., "Exact role match: Sales Manager", "Company match: Novartis", "Location match: Mumbai"${hasEducationRequirements && candidateInfo.education ? ', "Education match: [details]"' : ''})

4. Identify mismatchReasons (if any): List reasons for gaps (e.g., "Different seniority level", "Location mismatch"${hasEducationRequirements && !candidateInfo.education ? ', "Education requirements not met"' : hasEducationRequirements && candidateInfo.education ? ', "Education mismatch: [details]"' : ''})

5. Check specific matches:
   - roleMatch: Does the candidate's current/past role match the primary role or variations?
   - companyMatch: Does the candidate work at (or worked at) the specified company?
   - locationMatch: Does the candidate's location match the query location?
   ${hasEducationRequirements ? `- educationMatch: ${candidateInfo.education ? 'Does the candidate\'s education meet the requirements? Check if candidate has the required degrees, institutions, or fields of study. Return true if education matches, false if it doesn\'t match, or null if education data is not available.' : 'Education requirements specified but candidate education data not available - return null (not false, as data is missing not mismatched).'}` : '- educationMatch: null (no education requirements specified in query)'}
   ${queryUnderstanding.certifications?.length ? `- certificationMatch: Check if candidate's profile mentions the required certifications (${queryUnderstanding.certifications.filter(c => c.required).map(c => c.name).join(', ')}). Analyze headline, current position, past positions, and skills for certification mentions. Return true if required certifications are found, false if missing, null if cannot determine.` : '- certificationMatch: null (no certification requirements specified)'}
   ${queryUnderstanding.regulatoryExperience?.length ? `- regulatoryExperienceMatch: Check if candidate has experience with regulatory requirements (${queryUnderstanding.regulatoryExperience.join(', ')}). Look for mentions in headline, positions, or skills. Return true if found, false if not found, null if cannot determine.` : '- regulatoryExperienceMatch: null (no regulatory experience requirements specified)'}
   ${queryUnderstanding.companySizeRange ? `- companySizeMatch: Check if candidate's current company size matches the requirement (${queryUnderstanding.companySizeRange.description || `${queryUnderstanding.companySizeRange.min || ''}-${queryUnderstanding.companySizeRange.max || ''} employees`}). This may require inference from company name/industry if size data is not directly available. Return true if matches, false if doesn't match, null if cannot determine.` : '- companySizeMatch: null (no company size requirement specified)'}
   ${queryUnderstanding.fundingStage?.length ? `- fundingStageMatch: Check if candidate's current company matches the funding stage requirement (${queryUnderstanding.fundingStage.join(', ')}). This may require inference from company name/industry if funding data is not directly available. Return true if matches, false if doesn't match, null if cannot determine.` : '- fundingStageMatch: null (no funding stage requirement specified)'}
   ${queryUnderstanding.ageConstraint ? `- ageMatch: Check if candidate's age (inferred from graduation year if available: ${candidateInfo.education}) matches the age constraint (${queryUnderstanding.ageConstraint.maxAge ? `max ${queryUnderstanding.ageConstraint.maxAge} years` : ''}${queryUnderstanding.ageConstraint.minAge ? `, min ${queryUnderstanding.ageConstraint.minAge} years` : ''}). Calculate age from graduation year: age = currentYear - graduationYear + 22 (assuming 22 years old at graduation). Return true if matches, false if doesn't match, null if graduation year not available.` : '- ageMatch: null (no age constraint specified)'}
   ${queryUnderstanding.targetCompanyProfile ? `- likeToLikeMatch: Check if candidate is an exact like-to-like match - same role, similar company type, similar company size, same industry. This is the highest priority match. Return true if exact like-to-like match, false otherwise.` : '- likeToLikeMatch: null (no like-to-like matching requirement specified)'}
   - hierarchicalMatchLevel: If this candidate was found through hierarchical search expansion, indicate the level (0 = exact match, 1 = one level down, etc.). If not applicable, return null.

6. Prioritize scoring:
   - Like-to-like matches (exact role + company type + size) should score highest (0.9-1.0)
   - Exact role matches with great education should score high (0.8-0.9)
   - Hierarchical matches (level 0 > level 1 > level 2) should be ranked accordingly
   - Candidates meeting certification/regulatory requirements should be prioritized
   - Company size and funding stage matches add to relevance

7. Provide reasoning: Brief explanation of the score${hasEducationRequirements ? ', including education relevance assessment' : ''}, highlighting like-to-like matches, hierarchical level, and certification/regulatory matches

${hasEducationRequirements ? `\nEDUCATION RELEVANCE ASSESSMENT:
- If education requirements are specified (${educationRequirementsText}), check if the candidate's education (${candidateInfo.education || 'Not available'}) matches these requirements.
- If candidate education is not available but requirements are specified, note this as a potential mismatch.
- If both are available, assess how well the candidate's education aligns with the requirements.
- Include education match/mismatch in matchReasons or mismatchReasons accordingly.` : ''}

Provide scoring result with all required fields.`;
  }

  /**
   * Build prompt for hierarchical search strategy generation
   * Used for multi-level search expansion (e.g., CEO → COO → Head of Operations)
   */
  buildHierarchicalSearchStrategyPrompt(
    queryUnderstanding: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage: string,
  ): string {
    return `Generate a hierarchical search strategy for this executive/leadership search query.

ORIGINAL QUERY: ${userMessage}

QUERY UNDERSTANDING:
Primary Role: ${queryUnderstanding.primaryRole}
Industry: ${queryUnderstanding.industry?.join(', ') || queryUnderstanding.domainContext || 'Not specified'}
Target Company Profile: ${queryUnderstanding.targetCompanyProfile ? JSON.stringify(queryUnderstanding.targetCompanyProfile) : 'Not specified'}

HIERARCHICAL SEARCH STRATEGY:

For executive/leadership roles in specific industries, create a multi-level search strategy that expands from exact match to broader matches:

1. LEVEL 0 (Exact Match - Highest Priority):
   - Role: ${queryUnderstanding.primaryRole}
   - Industry: Exact industry from query (${queryUnderstanding.industry?.join(', ') || queryUnderstanding.domainContext || 'exact'})
   - Priority: 0 (highest)
   - Stop if sufficient: true (if enough candidates found, stop here)

2. LEVEL 1 (One Level Down):
   - Role: One level below primary role (e.g., if CEO → COO, if CHRO → VP HR)
   - Industry: Same as Level 0
   - Priority: 1
   - Stop if sufficient: true

3. LEVEL 2 (Functional Head):
   - Role: Functional head role (e.g., Head of Operations, Head of Sales)
   - Industry: Same as Level 0
   - Priority: 2
   - Stop if sufficient: false (continue to allied industries)

4. LEVEL 3+ (Allied Industries):
   - Role: Same as Level 2
   - Industry: Allied/related industries (e.g., ceramics → glass, insulators → electrical components)
   - Priority: 3+
   - Stop if sufficient: false

RECRUITING KNOWLEDGE:
- Role hierarchies: CEO → COO → Head of Operations → Operations Manager
- Industry hierarchies: ceramics insulators → ceramics → glass → electrical components
- For CEO searches: Start with exact role + industry, then COO, then Head of Operations
- For functional heads: Start with exact role + industry, then one level down, then allied industries

EXPANSION PATH:
Describe the expansion path clearly (e.g., "CEO → COO → Head of Operations, ceramics insulators → ceramics → glass")

Generate strategies that prioritize exact matches but provide fallback options when exact matches are insufficient.`;
  }

  buildRefinementPrompt(
    existingParams: any,
    userMessage: string,
    parsedJobDescription: ParsedJobDescription,
    rawJDText: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  ): string {
    const searchTypeLabel = searchType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchType === 'sales_navigator' 
        ? 'LinkedIn Sales Navigator' 
        : 'LinkedIn Recruiter';
    return `You are refining existing ${searchTypeLabel} search parameters based on user feedback.

EXISTING SEARCH PARAMETERS:
${JSON.stringify(existingParams, null, 2)}

USER'S REFINEMENT REQUEST:
${userMessage}

JOB DESCRIPTION CONTEXT:
${parsedJobDescription ? `Job Title: ${parsedJobDescription.jobTitle}
Company: ${parsedJobDescription.company || 'Not specified'}
Location: ${parsedJobDescription.location || 'Not specified'}
Industry: ${parsedJobDescription.industry || 'Not specified'}
Keywords: ${parsedJobDescription.keywords?.join(', ') || 'Not specified'}` : 'No job description provided'}

${rawJDText ? `RAW JOB DESCRIPTION TEXT:
${rawJDText}` : ''}

INSTRUCTIONS:
1. Analyze the user's refinement request carefully
2. Intelligently merge the new requirements with existing parameters
3. Preserve good aspects of existing parameters that weren't mentioned in the refinement
4. Update only the parameters that need to be changed based on the user's request
5. Maintain parameter coherence and validity
6. Explain your changes in the reasoning

Generate refined search parameters that incorporate the user's feedback while maintaining the quality of the existing search.`;
  }

  /**
   * Build prompt for query simplification when "Content too large" error occurs
   */
  buildQuerySimplificationPrompt(
    failedParameters: any,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    attemptNumber: number,
    previousAttempts: any[] = [],
    queryUnderstanding?: import('../types/candidate-search-request.type').QueryUnderstanding,
    userMessage?: string,
    parsedJobDescription?: ParsedJobDescription,
  ): string {
    const searchTypeLabel = searchType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchType === 'sales_navigator' 
        ? 'LinkedIn Sales Navigator' 
        : 'LinkedIn Recruiter';

    const parameterKey = searchCategory === 'people' 
      ? (searchType === 'classic' ? 'classicPeopleSearch' : searchType === 'sales_navigator' ? 'salesNavigatorPeopleSearch' : 'recruiterPeopleSearch')
      : searchCategory === 'companies'
        ? (searchType === 'classic' ? 'classicCompaniesSearch' : 'salesNavigatorCompaniesSearch')
        : 'classicJobsSearch';

    const failedParams = failedParameters[parameterKey] || failedParameters;

    // Count keyword terms for classic search
    let keywordTermCount = 0;
    if (searchType === 'classic' && failedParams?.keywords) {
      // Rough estimate: count quoted strings and unquoted words
      const keywords = failedParams.keywords;
      const quotedMatches = keywords.match(/"([^"]+)"/g) || [];
      const unquotedParts = keywords.replace(/"([^"]+)"/g, '').split(/\s+(?:AND|OR|NOT)\s+/i);
      keywordTermCount = quotedMatches.length + unquotedParts.filter(p => p.trim().length > 0).length;
    }

    let previousAttemptsText = '';
    if (previousAttempts.length > 0) {
      previousAttemptsText = `\n\nPREVIOUS SIMPLIFICATION ATTEMPTS (avoid repeating these strategies):\n${previousAttempts.map((attempt, idx) => 
        `Attempt ${idx + 1}: Strategy "${attempt.strategy}" - ${attempt.reasoning}\nModifications: ${attempt.modifications.join(', ')}`
      ).join('\n\n')}`;
    }

    const queryUnderstandingText = queryUnderstanding 
      ? `\n\nQUERY UNDERSTANDING CONTEXT:
Primary Role: ${queryUnderstanding.primaryRole}
Location: ${queryUnderstanding.locationHierarchy?.primary || 'Not specified'}
Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
Company Preferences: ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'Not specified'}
Domain Context: ${queryUnderstanding.domainContext || 'Not specified'}

IMPORTANT: Preserve the core search intent from the query understanding while simplifying.`
      : '';

    const userMessageText = userMessage 
      ? `\n\nORIGINAL USER REQUEST:
"${userMessage}"

IMPORTANT: The simplified query must still match the user's intent.`
      : '';

    const jdContextText = parsedJobDescription
      ? `\n\nJOB DESCRIPTION CONTEXT:
Job Title: ${parsedJobDescription.jobTitle}
Company: ${parsedJobDescription.company || 'Not specified'}
Location: ${parsedJobDescription.location || 'Not specified'}
Industry: ${parsedJobDescription.industry || 'Not specified'}`
      : '';

    // Determine which simplification strategies to try based on attempt number
    let strategyGuidance = '';
    if (attemptNumber === 1) {
      strategyGuidance = `PRIORITY STRATEGIES (try in this order - CRITICAL for 503 errors):
1. Remove location filter - This is the MOST EFFECTIVE simplification for 503 errors. Location can be filtered server-side after getting results. If location filter exists, REMOVE IT FIRST.
2. Reduce keywords - For classic search, ensure keywords have MAXIMUM 6 terms. Simplify boolean logic.
3. Remove company from keywords - If company name appears in keywords AND company filter exists, remove from keywords (redundant)
4. Remove redundant filters - If industry is specified but company filter is more precise, remove industry

IMPORTANT FOR 503 ERRORS: Start with location removal - it's the most reliable way to reduce query complexity and help the service process the request.`;
    } else if (attemptNumber === 2) {
      strategyGuidance = `PRIORITY STRATEGIES (try more aggressive simplifications):
1. Remove company filter - If company is mentioned in keywords, remove the company filter
2. Simplify boolean logic - Reduce complex AND/OR/NOT combinations to simpler forms
3. Reduce to core keywords - Keep only the most essential 3-4 keyword terms
4. Remove industry filter - If not critical for search intent`;
    } else {
      strategyGuidance = `PRIORITY STRATEGIES (most aggressive simplifications):
1. Combine multiple strategies - Apply location removal + keyword reduction + filter removal together
2. Minimal keywords - Use only 2-3 core keyword terms
3. Remove all optional filters - Keep only keywords and essential filters
4. Simplify to bare minimum - Preserve only the absolute core search intent`;
    }

    // Determine error type for context
    const errorType = previousAttempts.length === 0 
      ? (failedParams?.keywords && failedParams.keywords.length > 200 ? 'Content too large' : 'Service unavailable (503)')
      : 'Content too large or Service unavailable';
    
    // Check if location filter exists - this is a key simplification target
    const hasLocationFilter = failedParams?.location && 
      (Array.isArray(failedParams.location) ? failedParams.location.length > 0 : true);
    
    return `You are simplifying a ${searchTypeLabel} ${searchCategory} search query that was rejected by LinkedIn API with "${errorType}" error.

NOTE: 503 "Service unavailable" errors often indicate that the query is too complex for the service to process. Simplifying the query can help the service handle it successfully.

${hasLocationFilter ? `\n⚠️ CRITICAL: This query has a location filter. For 503 errors, removing the location filter is the MOST EFFECTIVE simplification strategy. Location can be filtered server-side after getting results, so removing it from the query reduces complexity without losing functionality.` : ''}

FAILED SEARCH PARAMETERS:
${JSON.stringify(failedParams, null, 2)}

${keywordTermCount > 6 && searchType === 'classic' ? `\n⚠️ CRITICAL: Keywords contain ${keywordTermCount} terms, but LinkedIn Classic search allows MAXIMUM 6 keyword terms. You MUST reduce this to 6 or fewer.` : ''}

${previousAttemptsText}

${queryUnderstandingText}

${userMessageText}

${jdContextText}

${strategyGuidance}

LINKEDIN SEARCH LIMITATIONS:
- Classic search: Maximum 6 keyword terms in boolean string
- Complex boolean logic (nested AND/OR/NOT) increases payload size
- Multiple filters (location + company + industry) increase complexity
- Company names in keywords + company filter = redundancy

SIMPLIFICATION REQUIREMENTS:
1. Reduce query complexity while preserving core search intent
2. For classic search: Ensure keywords have MAXIMUM 6 terms
3. Remove redundant filters (e.g., company in keywords AND company filter)
4. Simplify boolean logic in keywords (avoid deep nesting)
5. Remove location filter if present (can filter results server-side)
6. Preserve the most important search criteria from user intent

OUTPUT REQUIREMENTS:
- Return simplified parameters in the same structure as the original
- Specify which simplification strategy you used
- List all modifications made
- Explain why this simplification reduces complexity
- Estimate the complexity level after simplification (high/medium/low)
- For classic search, count keyword terms and ensure <= 6

Generate a simplified version of the search parameters that will pass LinkedIn's size limits while maintaining search relevance.`;
  }

  /**
   * Get prompt for company culture classification
   */
  getCultureClassificationPrompt(
    companyName: string,
    industry?: string,
    context?: string,
  ): string {
    return `Classify the company culture for: ${companyName}
${industry ? `Industry: ${industry}` : ''}
${context ? `Context: ${context}` : ''}

Classify the company into one of these culture types:
- promoter_driven: Promoter-owned companies where promoters are actively involved
- family_run: Family-owned businesses with family members in management
- mnc: Multinational corporations with global presence
- startup: Early-stage companies, typically funded
- psu: Public Sector Undertakings (government-owned)
- pe_backed: Private equity-backed companies
- listed: Publicly listed companies

Consider indicators like:
- Company ownership structure
- Management style
- Company size and stage
- Industry norms
- Context provided

Return the culture type with confidence score and indicators.`;
  }

  /**
   * Get prompt for org structure knowledge
   */
  getOrgStructureKnowledgePrompt(
    role: string,
    companySize: { min?: number; max?: number },
    industry: string,
  ): string {
    return `Analyze the organizational structure for role: ${role}
Company Size: ${companySize.min || 0}-${companySize.max || 'unlimited'} employees
Industry: ${industry}

Determine:
1. Who does this role report to? (e.g., "CEO", "VP Operations", "MD")
2. What roles report to this position? (e.g., ["Manager", "Senior Manager"])
3. Hierarchy level (0 = CEO, 1 = C-suite, 2 = VP, 3 = Director, etc.)
4. Equivalent roles at different company sizes

RECRUITING KNOWLEDGE:
- Structure is strategy. Role equivalence depends on company size.
- VP in 10K+ company manages entire assets, while VP in 1K company is like C-suite.
- Executive Director in ONGC (10K+) manages oil fields, while ED in 1K company is like CEO.
- Plant Manager in large MNC ≈ GM Operations in smaller company.
- Service companies use "Managing Director" for P&L heads, manufacturing uses "MD" for CEO.

Return the organizational structure pattern.`;
  }

  /**
   * Get prompt for location strategy
   */
  getLocationStrategyPrompt(
    location: string,
    industry?: string,
  ): string {
    return `Identify location fallback strategy for: ${location}
${industry ? `Industry: ${industry}` : ''}

For remote or tier 2/3 locations, identify:
1. Nearby industrial clusters
2. Priority-ordered fallback locations
3. Reasoning for each fallback location

RECRUITING KNOWLEDGE:
- For remote locations (tier 2/3 towns), identify nearby industrial clusters.
- Example: Mt Abu has no candidates → try Rajasthan → Gujarat (industrial clusters).
- Candidates from nearby clusters are more likely to relocate.
- Prioritize locations by proximity and industrial relevance.

Return a location fallback strategy with priority-ordered locations.`;
  }

  /**
   * Get prompt for competitor matching
   */
  getCompetitorMatchingPrompt(
    companyName?: string,
    industry?: string,
    companyType?: string,
  ): string {
    if (companyName) {
      return `Classify the competitor tier for: ${companyName}
${industry ? `Industry: ${industry}` : ''}

Classify into:
- tier_1: Market leaders, top companies in the industry
- tier_2: Strong competitors, established players
- tier_3: Other competitors, smaller players

Return the tier classification with reasoning.`;
    }

    return `Get competitor tiers for industry: ${industry}
${companyType ? `Company Type: ${companyType}` : ''}

Classify companies in this industry into:
- tier_1: Market leaders, top companies
- tier_2: Strong competitors, established players
- tier_3: Other competitors

Return a comprehensive list of companies with their tier classifications.`;
  }
}
