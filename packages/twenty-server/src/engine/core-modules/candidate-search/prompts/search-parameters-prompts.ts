import { Injectable, Logger } from '@nestjs/common';
import { JobDescriptionParsingPrompt, SearchParameterGenerationPrompt } from 'src/engine/core-modules/candidate-search/types/candidate-search-prompt.type';
import {
  LinkedInPeopleSearchResult,
  LinkedInSearchResult
} from '../../linkedin-search/types/linkedin-search-response.type';
import {
  linkedinIndustryOptions
} from '../schemas/linkedin-classic-people-search.schema';
import { ParsedJobDescription, } from '../types/candidate-search-request.type';

import { QueryUnderstanding } from 'src/engine/core-modules/candidate-search/schemas/query-understanding.schema';
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
    keywordFormatting: 'All multi-word job titles MUST be wrapped in double quotes. Single-word titles do not need quotes. Use boolean operators (AND, OR, NOT) and parentheses to group keywords.',
    classicKeywordLimit: '⚠️ CRITICAL: LinkedIn Classic allows MAXIMUM 6 keyword terms. Each quoted phrase counts as 1 term. Count carefully and prioritize most important variations.',
    sophisticatedBooleanPattern: 'For roles with hierarchical and domain components, create boolean queries combining hierarchical terms (GM, VP, Head, Director, etc.) with domain terms (Operations, Sales, Marketing, Plant, Unit, etc.). Pattern: (DomainTerm AND (HierarchicalTerms)) OR ((AlternativeDomainTerms) AND HierarchicalTerm)',
  };

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

    TASK:
    Interpret the strategy and generate ALL parameters mentioned. Extract specific values from strategy text and use query understanding for generic mentions.

    GUIDELINES:
    1. Parse strategy to identify mentioned parameters
    2. Extract specific values (e.g., "Mumbai" from "location (Mumbai)")
    3. Use query understanding for generic mentions
    4. Follow parameter format for ${searchType}
    5. Generate ALL mentioned parameters in one response

    KEYWORDS:
    - ALWAYS required, even if not mentioned in strategy
    ${searchType === 'classic' ? `- ${this.COMMON_INSTRUCTIONS.classicKeywordLimit}` : ''}
    ${(searchType === 'sales_navigator' || searchType === 'recruiter') ? `- ${this.COMMON_INSTRUCTIONS.sophisticatedBooleanPattern}` : ''}
    - Extract from query understanding when strategy mentions "job titles", "location", "industry", "company"
    - Use actual names, not placeholders

    KEYWORD SIMPLIFICATION:
    - SIMPLIFY when variations share a specific core term (e.g., "Palliative Care Physician/Consultant/Doctor" → "palliative care")
    - DO NOT SIMPLIFY if term becomes too generic (e.g., "digital marketing" → "marketing" is too broad)
    - Goal: Balance inclusivity with precision - catch relevant candidates without introducing irrelevant ones

    Generate complete parameter set from strategy.`;
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

    ${rawJDText ? "Raw Job Description Context:\n" + rawJDText : ''}

    USER QUERY:
    ${userMessage}`;
  }



  /**
   * Get system prompt for result validation
   */
  getResultValidationSystemPrompt(): string {
    return `You are an expert at validating LinkedIn search results. Assess relevance, quality, and determine if pagination should continue.

    TASKS:
    1. Assess relevance: Do results match query requirements?
    2. Check false positives: Are there results like "EA to [role]" when searching for "[role]"?
    3. Evaluate quality: Are results appropriate for role level and domain?
    4. Calculate relevance score: Percentage of truly relevant results (0-1 scale)
    5. Determine pagination: Should we continue fetching more pages?

    PAGINATION RULES:
    - Continue until: No more pages available OR relevance score < 0.4
    - Set shouldContinuePagination: true if relevanceScore >= 0.4, false if < 0.4
    - System automatically stops at max pages

    PROVIDE:
    - isRelevant: true/false
    - relevanceScore: 0-1 (CRITICAL: use to determine pagination)
    - falsePositives: array of false positive examples
    - qualityAssessment: "high" | "medium" | "low"
    - shouldContinuePagination: true/false (true if relevanceScore >= 0.4)
    - reasoning: brief explanation including relevance score and pagination recommendation`;
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
    Hierarchical Level: ${queryUnderstanding.hierarchicalLevel || 'Not specified'}
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
      ? `\n\n⚠️ CRITICAL: This is a CLARIFICATION RESPONSE. User message may contain:
      1. ORIGINAL USER QUERY - Contains PRIMARY search intent (role, location, industry). MUST preserve ALL information.
      2. CLARIFICATION ANSWERS - Numbered responses (1., 2., 3.) or additional context.
      
      EXTRACTION:
      - FIRST: Extract and preserve ALL from ORIGINAL QUERY (PRIMARY ROLE, LOCATION, INDUSTRY, COMPANY, etc.)
      - SECOND: Extract clarification answers and merge with original query
        * Map numbered answers to questions (seniority, location, industry, company, etc.)
        * Update/refine original with clarification details
        * Example: "Pulmonologist" + "1. Consultant level" → "Consultant Pulmonologist" or update seniorityLevel
      - CRITICAL: DO NOT replace original role/location/industry with generic terms from answers
      - CRITICAL: If clarification says "Any" but original specified "Mumbai"/"Healthcare", preserve original
      - Be lenient - use context clues, only set needsClarification if search truly impossible`
      : '';

    const queryUnderstandingSystemPrompt = `You are an expert recruiter extracting structured information from candidate search queries. Analyze queries and extract all relevant details for building precise LinkedIn searches.
      ${clarificationContext}

      EXTRACT:

      1. PRIMARY ROLE: Main job title or role
      2. ROLE VARIATIONS: 5-10 common variations, synonyms, related titles
      3. INDUSTRY/SECTOR: Specific industries (use exact LinkedIn industry names)
      4. LOCATION HIERARCHY: Primary (city/state), secondary, regional context (e.g., "Delhi NCR" includes Noida/Gurgaon; "Mumbai" includes Navi Mumbai/Thane)
      5. COMPANY PREFERENCES: Current/past companies (if mentioned), company types/sizes (startup, MNC, listed, etc.)
      6. SENIORITY LEVEL: Entry, Mid, Senior, Executive, or C-level
      6.1. SUB-SENIORITY LEVEL: Sub-seniority level (e.g., Senior Manager, Manager, Assistant Manager, etc.)
      8. REPORTING STRUCTURE: Reporting structure (e.g., "Channel Partner Manager" → "Regional Sales Head" → "Regional Sales Manager" → "Regional Sales Executive")
      9. FUNCTIONAL ROLE: Functional role (e.g., "Sales", "Marketing", "Engineering", "Finance", "HR", "Legal", "IT", "Operations", "Product", "Technology", "Customer Success", "Support", "Other")
      10. SUB-FUNCTIONAL ROLE: Sub-functional role (e.g., "Sales Manager", "Marketing Manager", "Engineering Manager", "Finance Manager", "HR Manager", "Legal Manager", "IT Manager", "Operations Manager", "Product Manager", "Technology Manager", "Customer Success Manager", "Support Manager", "Other Manager")
      11. DOMAIN CONTEXT: Industry domain (SaaS, FMCG, Pharma, BFSI, Healthcare, etc.)
      12. KEY SKILLS/TECHNOLOGIES: Specific skills, technologies, tools mentioned
      13. EXPERIENCE REQUIREMENTS: Years of experience, specific types (e.g., "3PL background", "US GAAP experience")
      14. EXPLICIT vs PREFERRED: Required vs nice-to-have

      ENHANCED REQUIREMENTS:

      15. COMPANY SIZE RANGE: Extract numeric ranges ("5000+", "100-500", "mid-sized"). Map: "mid-sized"=100-1000, "large"=1000+, "enterprise"=5000+
      16. FUNDING STAGE: Extract stages ("Series A", "Series B+", "PE-backed", "unicorn", "startup", "bootstrapped")
      17. AGE CONSTRAINT: Extract age requirements ("under 45 years", "35-50 years"). Calculate graduationYearRange: min = currentYear - maxAge + 22, max = currentYear - minAge + 22
      18. CERTIFICATIONS: Extract all mentioned ("ISO 9001", "US GAAP", "FDA", "CE mark"). Structure: {name, type: "quality"/"financial"/"regulatory"/"safety"/"professional", required}
      19. REGULATORY EXPERIENCE: Extract requirements ("USFDA audit", "RBI regulatory", "RERA"). Include bodies: USFDA, RBI, RERA, SEBI, ISO, FDA, CE mark
      20. COMPANY GROUP PREFERENCES: Identify groups ("Tata group", "Birla group", "Reliance group") - expand to subsidiaries later
      21. HIERARCHICAL SEARCH REQUIRED: Set true for C-level/executive roles where expansion needed (e.g., "CEO" → COO/Head of Operations, "CHRO" → HR Head/VP HR)
      22. TARGET COMPANY PROFILE (like-to-like): Extract for exact competitor matching - industry, company size, type, similar competitors
      MARKET: Understand regional abbreviations (NCR=Delhi NCR), terminology (3PL, modern trade, dark store, UPI, PLG), company hierarchies (Tata/Birla/Reliance groups), domain roles (CHRO, VP Engineering), regional variations (Bangalore/Bengaluru), institute tiers (IIT, IIM, tier-1/2, IRMA, UDCT)

      Be thorough and extract all relevant information.

      PATTERN IDENTIFICATION:
      Identify patterns requiring discovery operations (companies, job titles, institutes, industries):

      1. SPECIALIZED ROLE (specializedRole): Medical/technical specialties, highly specialized roles
         - Indicators: "pulmonologist", "cardiologist", "specialist", "surgeon", "physician"
         - Confidence: High (0.8-1.0) for clear specialties, Medium (0.5-0.7) for domain-specific roles

      2. COMPANY DESCRIPTION (companyDescription): Descriptions rather than specific names
         - Patterns: "companies that manufacture/make/produce", "manufacturing companies", "X companies"
         - Extract: Description text (e.g., "textile machinery manufacturers", "ceramics insulators")
         - Confidence: High (0.8-1.0) for clear patterns, Medium (0.5-0.7) for industry mentions

      3. INSTITUTE REQUIREMENT (instituteRequirement): Educational institute preferences
         - Patterns: "tier-1", "tier-2", "IIT", "IIM", "premier institutes", "top colleges"
         - Extract: Institute type (e.g., "tier-1", "IIT", "IIM", "premier")
         - Check: User message and explicitRequirements/preferredRequirements
         - Confidence: High (0.8-1.0) for tier/IIT/IIM, Medium (0.5-0.7) for "premier"/"top"

      4. INDUSTRY REQUIREMENT (industryRequirement): Generic industry terms needing exact LinkedIn match
         - Patterns: "pharma", "tech", "manufacturing", "FMCG", "BFSI", "healthcare", "telecom"
         - Extract: Industry description (e.g., "pharmaceutical", "technology", "manufacturing")
         - Check: User message, domainContext, industry fields
         - Confidence: High (0.8-1.0) for clear mentions, Medium (0.5-0.7) for domain context
         - Note: Only when industries are generic, not when specific LinkedIn names are provided

      5. REPORTING STRUCTURE REQUIREMENT (reportingStructureRequirement): Queries where understanding organizational reporting structure would enhance search
         - Indicators: Roles where reporting hierarchy matters (e.g., "Channel Partner Manager", "Regional Sales Head", roles with complex org structures)
         - Context: When industry/domain context suggests reporting structure discovery would help identify candidates or their managers
         - Confidence: High (0.8-1.0) for roles with clear reporting structure needs (sales roles, channel roles, regional roles), Medium (0.5-0.7) for mid-level management roles
         - Note: Useful for understanding who candidates report to, which helps in targeted searches and org chart mapping

      For each pattern, provide: detected (true/false), confidence (0.0-1.0), additional fields (description/instituteType/industryDescription), reasoning
      Remember: Extract specific text, check user message and structured fields, patterns may overlap, be thorough but accurate

      AMBIGUITY DETECTION & CLARIFICATION:
      
      Analyze the query for ambiguity and determine if clarification is needed. Set needsClarification to true ONLY if:
      1. Critical information missing AND cannot be inferred (e.g., no role title, no location when critical)
      2. Requirements ambiguous/conflicting in a way that prevents search
      3. Role too generic AND cannot be inferred from context (e.g., just "manager" without context)
      ${isClarificationResponse 
        ? '4. IMPORTANT: Be VERY conservative - only set true if search is truly impossible'
        : '4. Multiple interpretations possible and none can be reasonably inferred'}

      DETECTED ISSUES - Analyze and set the following boolean flags in detectedIssues:
      1. missingLocation: Flag if no location AND location is critical for role/industry
         - Initial queries: Missing primary location is typically a problem
         - Clarification responses: Location may be optional if role can be searched broadly
         - Consider if location can be inferred (company headquarters, industry hubs)
      
      2. vagueRoleDescription: Flag if role is too generic (e.g., "manager", "executive", "lead" without context)
         - Indicators: "manager", "executive", "lead", "head", "director", "officer" with <= 2 words
         - Flag if: Generic role + < 3 variations + no domain context
         - Consider if role can be inferred from domain context or company type
      
      3. missingIndustry: Flag if no industry + no domain context + role suggests industry-specific needs
         - Needed when: Role suggests industry-specific requirements (pharma, healthcare, banking, finance, retail, FMCG, SaaS, tech)
         - Not needed if: Domain context available OR role is generic enough
         - Clarification responses: Only flag if truly critical and cannot be inferred
      
      4. conflictingRequirements: Flag if requirements contradict (e.g., entry level with "5+ years experience")
         - Check for logical conflicts and contradictory filters
         - Flag if contradictions prevent search
      
      5. insufficientContext: Flag if too vague/incomplete to proceed
         - Catch-all for queries lacking enough information
         - Clarification responses: Be very lenient - only flag if truly insufficient

      ${isClarificationResponse 
        ? `CLARIFICATION RESPONSE RULES:
      - Only require primary role - other fields can be inferred or are optional
      - Don't require location if user hasn't specified it - we can search broadly
      - Don't require industry if domain context is available
      - Only flag needsClarification if search is truly impossible without more information
      - Prefer to proceed with available information rather than asking for more
      - Be VERY conservative in flagging ambiguity - only set true if search is truly impossible`
        : `INITIAL QUERY RULES:
      - Be thorough in detecting missing critical information
      - Flag vague role descriptions that cannot be inferred
      - Flag missing location when it's critical
      - Flag missing industry when role suggests industry-specific needs
      - Generate specific, actionable clarification questions`}

      CLARIFICATION QUESTIONS:
      - Generate 2-4 specific, actionable questions in clarificationQuestions array
      - Prioritize most critical missing information first
      - Examples: "Which location(s)? (e.g., Bangalore, Mumbai)", "What industry? (e.g., SaaS, FMCG)", "What role/title?", "What seniority? (e.g., Mid, Senior, Executive)"
      - If needsClarification is false, set clarificationQuestions and ambiguityReasons to null

      AMBIGUITY REASONING:
      - Provide a detailed explanation in ambiguityReasoning field explaining your ambiguity assessment
      - Explain which issues were detected and why clarification is or isn't needed
      - If needsClarification is false, explain why the query is clear enough to proceed`;

    return queryUnderstandingSystemPrompt;
  }

  getQueryUnderstandingUserPrompt(
    userMessage: string,
    rawJDText: string,
    isClarificationResponse: boolean = false,
  ): string {
    const queryUnderstandingUserPrompt = `${isClarificationResponse ? 'Clarification Response:' : 'User Query:'} "${userMessage}"\n\n
    "${rawJDText ? "Job Description Context:\n" + rawJDText + '\n\n' : ''}\n\n"

    Extract structured information from the user's query and job description context.`;

    return queryUnderstandingUserPrompt;
  }

  /**
   * Build combined query for clarification responses
   * Combines the original user query with clarification answers and provides instructions
   */
  buildClarificationResponseCombinedUserQuery(
    originalQuery: string,
    clarificationQuestions: string[],
    clarificationAnswers: string,
  ): string {

    const querySimplificationUserPrompt = `
  "${originalQuery ? "ORIGINAL USER QUERY:\n" + originalQuery + '\n\n' : ''}"
  "${clarificationQuestions ? "CLARIFICATION QUESTIONS:\n" + clarificationQuestions.join('\n') + '\n\n' : ''}"
  "${clarificationAnswers ? "USER'S CLARIFICATION ANSWERS (merge these with the original query):\n\n" : ''}"
  "${originalQuery ? "INSTRUCTIONS:\n\n" : ''}"
  - Extract and preserve ALL information from the original query (role, company, industry, etc.)
  - Extract answers from the clarification response and merge them with the original query
  - The combined result should have ALL information from both the original query AND the clarification
  - Do NOT lose any information from the original query when merging.\n\n`;

    return querySimplificationUserPrompt;
  }

  async getStrategyGenerationSystemPrompt(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): Promise<string> {
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

    // Check if queryUnderstandingText already contains the user message
      return `You are an expert recruiter and search strategist. Generate natural language search strategy descriptions.
  
  ${availableParameters}  
  TASK:
  Generate multiple mutually exclusive and cumulatively exhaustive strategies. Each strategy tests different parameter combinations, considering boolean keyword limitations.
  
  ${searchType === 'classic' ? `⚠️ CRITICAL FOR CLASSIC: Each strategy's keywords MUST have MAXIMUM 6 terms. Each quoted phrase = 1 term. Split into multiple strategies if needed.` : 'IMPORTANT: Boolean limitations require distributing role variations, locations, and companies across multiple strategies.'}
  
  FORMAT:
  Describe in natural language: which parameters to use, what values to include, how to combine them
  
  STRATEGY TYPES - CREATE MULTIPLE COMBINATIONS:  
  
  1. Keywords-Only: Embed location/company in keywords using AND
     ${searchType === 'classic' ? '- ⚠️ Classic: MAX 6 terms total (role + location/company)' : ''}
     - Create 2-4 variations with different role subsets
  
  2. Keywords + Location: Role variations in keywords, location as separate filter
     ${searchType === 'classic' ? '- ⚠️ Classic: MAX 6 keyword terms' : ''}
     - Create 2-3 variations with different role subsets
  
  3. Keywords + Location + Company: Use when:
     - Specific companies EXPLICITLY mentioned by name, OR
     - Companies discovered from NARROW queries (e.g., "plastic manufacturers in Bangalore")
     - DO NOT use for BROAD industry queries - use industry filter instead
     ${searchType === 'classic' ? '- ⚠️ Classic: MAX 6 keyword terms' : ''}
     - Create 2-4 variations with different company/role subsets
  
  4. Keywords + Location + Industry: PREFERRED for BROAD industry queries
     - Include domain-specific keywords (e.g., manufacturing: "plant", "production", "factory", "operations")
     - Use industry filter to capture ALL companies, not just discovered subset
     ${searchType === 'classic' ? '- ⚠️ Classic: MAX 6 keyword terms' : ''}
     - Create 2-3 variations with different role/industry keyword subsets
  
  5. DO NOT CREATE: Keywords + Industry + Company (redundant)
  
  GUIDELINES:
  1. Always include keywords (job titles) - required for all searches
  2. Create strategies with DIFFERENT parameter combinations
  3. Select 2-3 strategy types based on query understanding:
     - Location specified: Include at least one strategy with location
     - Industry specified: Include at least one strategy with industry
     - Company preferences: Evaluate company filters vs industry/keyword filters:
       ⚠️ CRITICAL: Distinguish specific mentions vs broad vs narrow:
       - Specific companies EXPLICITLY mentioned: Use company filters
       - BROAD industry queries (e.g., "manufacturing companies", "pharma companies"): Use industry filter + domain keywords, NOT company filters
       - NARROW queries (e.g., "plastic manufacturers in Bangalore"): Use company filters + industry filter
       - General rule: Broad category → industry filter. Specific product types + location → discovered companies
  4. ORDERING: SIMPLEST to MOST COMPREHENSIVE
  5. FIRST STRATEGY: Simplest baseline - Keywords + Location (if location), or Keywords + Industry (if industry critical), or Keywords only
     - Use primary role + 1-2 most common variations
     ${searchType === 'classic' ? '- ⚠️ Classic: MAX 6 terms even in first strategy' : ''}
     - Do NOT include company filters (too restrictive)
  6. SUBSEQUENT: Different combinations - Strategy 2: different combo, Strategy 3: comprehensive with all filters
  7. Be specific with values (e.g., "Mumbai" not just "location")
  8. Many role variations: Split across 2-4 keyword-only + 2-3 keywords+location strategies
  9. Many companies: BROAD discovery → use industry filter; NARROW queries → use company filters; Specific mentions → split across strategies
  
  12. KEYWORD SIMPLIFICATION: Balance inclusivity with precision
     - SIMPLIFY when variations share a specific core term (e.g., "Palliative Care Physician/Consultant/Doctor" → "palliative care")
     - DO NOT SIMPLIFY if term becomes too generic (e.g., "digital marketing" → "marketing" is too broad)
     - Goal: Catch more relevant candidates without introducing irrelevant ones
  
  For each strategy, provide:
  - strategyText: Natural language description of the strategy
  - label: Short descriptive label (optional)
  
  TERM-SPECIFIC THINKING (CRITICAL):
  Think like an experienced recruiter who understands how candidates write their LinkedIn profiles:

  Most people will try to write their job titles based on either what their company has given them - it comprises of a hierarchical indicator and a  functional indicator.
  
  1. SPECIFIC TERMS TO USE:
     - Don't just say "use keywords" - specify exact terms: "Use terms: 'Channel Partner', 'Partner Relations', 'Alliance'"
     - Use specific important terms in job titles to get the functional roles
     - Consider job title variations, synonyms, abbreviations candidates might use
     - Think about hierarchical terms (GM, VP, Head, Director) and functional terms (Operations, Sales, Marketing)
     - Think about boolean query patterns (combination of hierarchical + functional + company signals + job titles)
  
  2. TERM CATEGORIZATION:
     - Expansion terms: Broad terms that increase results
     - Filtering terms: Specific terms that narrow results
     - Essential terms: Must-have terms (e.g., role titles & functional terms)
  
  3. COMPANY TYPE SIGNALS INTEGRATION:
     If Company Type Signals are present in the Query Understanding section above, incorporate them into your strategies:
     - Use industry keywords to expand company searches (e.g., "telecom equipment" OR "OEM")
     - Use product keywords to filter candidates (e.g., "base stations" AND "channel partner")
     - Use business model keywords ONLY if candidates commonly mention them in profiles
     - Use partner program keywords when relevant (e.g., "Channel Partner Program" OR "VAR")
     - Use exclusion keywords to avoid false positives (e.g., NOT "consumer handsets")
     - Think about how candidates describe their companies in profiles - they use these terms!
  
  4. CANDIDATE PROFILE WRITING PATTERNS:
     - Candidates use abbreviations (VP, GM, Head, Dir)
     - Candidates use industry-specific terms in company descriptions
     - Candidates may use older company names or variations
     - Candidates combine hierarchical + functional terms (e.g., "Head of Operations", "VP Sales")
     - Candidates mention products, technologies, business models in their profiles
  
  5. BOOLEAN QUERY CONSTRUCTION GUIDANCE:
     - AND for filtering: "Channel Partner Manager" AND "telecom equipment"
     - OR for expansion: ("Channel Partner" OR "Partner Relations" OR "Alliance Manager")
     - NOT for exclusion: NOT "consumer handsets"
     - Create patterns like (((HierarchicalTerm1 OR HierarchicalTerm2) AND (FunctionalTerm1 OR FunctionalTerm2)) AND (CompanySignal)) OR (SpecificJobTitle1 OR SpecificJobTitle2)
     - Make strategies actionable blueprints for boolean query construction
  
  MECE VALIDATION REQUIREMENTS:
  Strategies must be Mutually Exclusive and Collectively Exhaustive:
  
  1. MUTUALLY EXCLUSIVE:
     - Each strategy tests a DIFFERENT parameter combination
     - No significant overlap between strategies
     - Each strategy targets a distinct candidate subset
  
  2. COLLECTIVELY EXHAUSTIVE:
     - Together, strategies cover ALL possible candidates
     - No candidate should be missed by all strategies
     - Consider all relevant variations, locations, companies, industries
  
  3. STRATEGY DIVERSITY RULES:
     - Maximum 2 strategies per type (e.g., max 2 "Keywords + Location" strategies)
     - Create truly diverse combinations, not minor variations
     - If you have 10 similar strategies, consolidate to 4-6 diverse ones
  
  4. CONSOLIDATION CHECK:
     - Before finalizing, review all strategies
     - Remove redundant strategies (same parameter combination)
     - Merge similar strategies into one comprehensive strategy
     - Ensure each strategy adds unique value
  
  5. VALIDATION CHECKLIST:
     - [ ] Are strategies mutually exclusive? (no significant overlap)
     - [ ] Are strategies collectively exhaustive? (cover all candidates)
     - [ ] Are there max 2 strategies per type?
     - [ ] Are there 4-6 strategies total (not 10+)?
     - [ ] Do strategies specify exact terms (not just "use keywords")?
     - [ ] Are company signals incorporated (if available)?
     - [ ] Do strategies guide boolean query construction?
  
  REQUIREMENTS:
  1. Create 4-6 STRATEGIES TOTAL (not 10+)
  2. Maximum 2 strategies per type (e.g., max 2 "Keywords + Location")
  3. Split role variations, companies, locations across strategies to respect boolean limits
  ${searchType === 'classic' ? '   ⚠️ FOR CLASSIC: Each strategy must specify keywords with MAXIMUM 6 terms. Split if variations exceed 6.' : ''}
  4. Mutually exclusive strategies - each tests different combination
  5. Cumulatively exhaustive - together cover all possible candidates
  6. DO NOT create Keywords + Industry + Company (redundant)
  7. Keywords-only: embed location/company in keywords using AND
  ${searchType === 'classic' ? '   ⚠️ FOR CLASSIC: When embedding, ensure total terms (role + location/company) ≤ 6' : ''}
  8. Keywords + location/company: use separate filters
  9. SPECIFY EXACT TERMS in each strategy (not just "use keywords")
  10. INCORPORATE COMPANY SIGNALS when available (industry keywords, product keywords, business model keywords)
  11. THINK ABOUT CANDIDATE PROFILE PATTERNS (how candidates write their profiles)
  12. GUIDE BOOLEAN QUERY CONSTRUCTION (specify AND/OR/NOT patterns)
  
  Generate 4-6 diverse, MECE strategies that specify exact terms and guide boolean query construction.`;
  
}

  getCandidateRelevanceScoringSystemPrompt(
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    let companyMatchNote = '';
    if (searchType === 'classic') {
      companyMatchNote = `
      NOTE ON COMPANY MATCHING FOR CLASSIC SEARCH:
      - In classic search, a candidate's profile may not display their current company, only their headline is shown.
      - If a company was specified in the search strategy/parameters and the candidate appears in results, assume likely match even if company name is not in the headline.
      - Do NOT penalize candidates for missing company name in classic search results when the search strategy includes companies.
      - Use headline and context to assess, but apply leniency as above.
      `;
          }

          return `You are an expert at scoring candidate relevance for LinkedIn search results. Assess how well a candidate matches query requirements and provide accurate scores.
      ${companyMatchNote}
      SCORING:
      1. relevanceScore (0-1): 0.8-1.0 = highly relevant, 0.5-0.79 = somewhat relevant, 0.0-0.49 = less relevant
      2. relevanceLabel: "highly_relevant" | "somewhat_relevant" | "less_relevant"
      3. matchReasons: Specific reasons why candidate matches (e.g., "Exact role match: Sales Manager", "Company match: Novartis", "Location match: Mumbai")
      4. mismatchReasons: Reasons for gaps (e.g., "Different seniority", "Location mismatch", "Education mismatch")

      CHECK MATCHES (only for fields specified in query understanding):
      - roleMatch: Current/past role matches primary role or variations?
      - companyMatch: Works/worked at specified company?
      - industryMatch: Industry matches query industry?
      - locationMatch: Location matches query location?
      - educationMatch: Education meets requirements (degrees, institutions, fields of study)? Return true/false/null
      - certificationMatch: Profile mentions required certifications (check headline, positions, skills)? Return true/false/null
      - regulatoryExperienceMatch: Has regulatory experience (check headline, positions, skills)? Return true/false/null
      - companySizeMatch: Current company size matches requirement (may require inference)? Return true/false/null
      - fundingStageMatch: Company funding stage matches requirement (may require inference)? Return true/false/null
      - ageMatch: Age matches constraint (calculate: currentYear - graduationYear + 22)? Return true/false/null
      - likeToLikeMatch: Exact like-to-like match (same role, similar company type/size, same industry)? Highest priority. Return true/false/null
      - hierarchicalMatchLevel: Hierarchical search level (0 = exact, 1 = one down, etc.)? Return number/null

      PRIORITIZATION:
      - Like-to-like matches: 0.9-1.0
      - Exact role + great education: 0.8-0.9
      - Hierarchical matches: rank by level (0 > 1 > 2)
      - Certification/regulatory matches: prioritize
      - Company size/funding matches: add to relevance

      REASONING: Brief explanation including education assessment, like-to-like matches, hierarchical level, certification/regulatory matches

      EDUCATION ASSESSMENT: If requirements specified, check match, note if unavailable, assess alignment, include in matchReasons/mismatchReasons

      Provide scoring result with all required fields.`;
  }

  /**
   * Build prompt for scoring individual candidate relevance
   */
  buildCandidateRelevanceScoringUserPrompt(
    candidate: LinkedInPeopleSearchResult,
    queryUnderstanding: QueryUnderstanding,
    userMessage: string,
    parsedJobDescription?: ParsedJobDescription,
    strategyText?: string,
  ): string {
    const candidateInfo = {
      name: candidate.name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim(),
      headline: candidate.headline || '',

      currentPosition: candidate.current_positions?.[0] 
        ? `${candidate.current_positions[0].role} at ${candidate.current_positions[0].company}`
        : '',
      location: candidate.location || '',
      pastPositions: candidate.work_experience?.slice(0, 3).map((pos) => 
        `${pos.role} at ${pos.company}`
      ).join(', ') || '',
      skills: candidate.skills?.slice(0, 10).map((skill) => skill.name).join(', ') || '',
      education: candidate.education?.map((edu) => 
        `${edu.school || ''} - ${edu.degree || edu.field_of_study || ''}${edu.end ? ` (${edu.end.year})` : ''}`
      ).join('; ') || '',
    };

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

    const strategyInfo = strategyText 
      ? `SOURCING STRATEGY: ${strategyText}`
      : '';

    return `ORIGINAL QUERY: ${userMessage}
    
    ${strategyInfo ? `\n${strategyInfo}` : ''}

    QUERY UNDERSTANDING:
    Primary Role: ${queryUnderstanding.primaryRole}
    Functional Role: ${queryUnderstanding.functionalRole || 'Not specified'}
    Sub-Functional Role: ${queryUnderstanding.subFunctionalRole || 'Not specified'}
    Hierarchical Level: ${queryUnderstanding.hierarchicalLevel || 'Not specified'}
    Role Variations: ${queryUnderstanding.roleVariations.join(', ')}
    Industry: ${queryUnderstanding.industry?.join(', ') || 'Not specified'}
    Location: ${queryUnderstanding.locationHierarchy.primary}
    Company Preferences (Current): ${queryUnderstanding.companyPreferences?.current?.join(', ') || 'Not specified'}
    Company Preferences (Past): ${queryUnderstanding.companyPreferences?.past?.join(', ') || 'Not specified'}
    Domain: ${queryUnderstanding.domainContext || 'Not specified'}
    Hierarchical Level: ${queryUnderstanding.hierarchicalLevel || 'Not specified'}
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



  async getStrategyGenerationUserPrompt(
    queryUnderstandingText: string,
    userMessage: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): Promise<string> {
    const classicKeywordLimit = searchType === 'classic' 
      ? `\n\n⚠️ CRITICAL FOR CLASSIC: ${this.COMMON_INSTRUCTIONS.classicKeywordLimit} If a strategy requires more than 6 terms, explicitly describe it as multiple strategies, each with max 6 terms.`
      : '';

    return `USER QUERY: ${userMessage}

    QUERY UNDERSTANDING: ${queryUnderstandingText}

    You are an expert recruiter and search strategist. Generate clear, specific natural language strategy descriptions explaining which parameters to use and how to combine them.
    ${classicKeywordLimit}
  `;
  }


  /**
   * Build prompt for hierarchical search strategy generation
   * Used for multi-level search expansion (e.g., CEO → COO → Head of Operations)
   */



  /**
   * Get prompt for generating sophisticated boolean queries
   * Used for Sales Navigator and Recruiter to create comprehensive boolean queries
   * that capture different company nomenclatures
   */
  /**
   * Get system prompt for boolean query generation
   * Complete rewrite with recruiter-style thinking for all search types
   */
  getBooleanQueryGenerationSystemPrompt(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const searchTypeLabel = searchType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchType === 'sales_navigator' 
        ? 'Sales Navigator' 
        : 'Recruiter';
    
    const classicConstraint = searchType === 'classic' 
      ? `\n\n⚠️ CRITICAL FOR CLASSIC: LinkedIn Classic allows MAXIMUM 6 keyword terms. Each quoted phrase counts as 1 term. You MUST intelligently optimize the query to stay within this limit while maximizing coverage:
    - Prioritize essential terms (primary role, key variations)
    - Strategically simplify terms when variations share a core (e.g., "Channel Partner Manager" OR "Partner Relations" → "partner" covers both)
    - Use broad terms that capture multiple variations (e.g., "channel" captures "Channel Partner", "Channel Sales", "Channel Manager")
    - Remove redundant terms that don't add unique value
    - Explain your optimization strategy in the reasoning field
    - If you cannot fit all essential terms in 6, prioritize the most important ones that maximize candidate coverage`
      : '';

    return `You are an expert recruiter with deep experience in LinkedIn boolean query generation. Think like a recruiter who understands how candidates write their profiles and strategically combines terms to find the right candidates.

YOUR ROLE:
Generate sophisticated boolean queries that think like an experienced recruiter - understanding candidate profile writing patterns, strategically categorizing terms, and intelligently combining them to create exhaustive and accurate candidate lists.

${classicConstraint}

RECRUITER-STYLE THINKING:

1. CANDIDATE PROFILE WRITING PATTERNS:
   Candidates write their LinkedIn profiles in specific ways:
   - Job titles: They use abbreviations (VP, GM, Head, Dir), full titles, and variations
   - Company descriptions: They mention industry keywords, products, business models
   - Skills: They list technologies, methodologies, domain expertise
   - Experience: They describe what they did, not just job titles
   
   Think: "How would a candidate describe their role and company in their profile?"

2. TERM CATEGORIZATION (CRITICAL):
   Categorize every term by its strategic purpose:
   
   - EXPAND terms: Broad terms that increase results
     * Examples: "sales", "manager", "operations"
     * Use in: OR groups to expand candidate pool
     * Result impact: HIGH_EXPANSION or MODERATE_EXPANSION
   
   - FILTER terms: Specific terms that narrow results
     * Examples: "telecom equipment", "channel partner", "enterprise solutions"
     * Note: Avoid generic business model terms like "B2B" - candidates rarely mention these. Use exclusion terms instead (NOT "consumer", NOT "B2C")
     * Use in: AND groups to filter and refine
     * Result impact: FILTERING
   
   - ESSENTIAL terms: Must-have terms (primary role, key requirements)
     * Examples: Primary job title, critical domain terms
     * Always include these
     * Result impact: NEUTRAL (required) or MODERATE_EXPANSION
   
   - OPTIONAL terms: Nice-to-have terms (variations, synonyms)
     * Examples: Role variations, alternative titles
     * Include if space allows
     * Result impact: MODERATE_EXPANSION
   
   - EXCLUDE terms: Terms to avoid false positives
     * Examples: "consumer" (if searching B2B), "retail" (if searching enterprise)
     * Use with NOT operator
     * Result impact: FILTERING (removes noise)

3. RESULT IMPACT ANALYSIS:
   For each term, predict its impact on result count:
   - HIGH_EXPANSION: Broad term that significantly increases results (e.g., "sales", "manager")
   - MODERATE_EXPANSION: Term that moderately increases results (e.g., role variations)
   - NEUTRAL: Term that doesn't significantly change result count (e.g., specific job title)
   - FILTERING: Term that narrows results (e.g., "telecom equipment", "enterprise solutions")
     * Avoid: Generic business model terms like "B2B" that candidates don't write
     * Prefer: Exclusion terms (NOT "consumer", NOT "B2C") or industry-specific terms

4. STRATEGIC QUERY CONSTRUCTION PATTERNS:

   Pattern 1: Hierarchical + Domain Combination
   (DomainTerm AND (HierarchicalTerm1 OR HierarchicalTerm2 OR ...))
   Example: (Operations AND (GM OR President OR vp OR agm OR head))
   Use when: Role has clear hierarchical and domain components
   
   Pattern 2: Alternative Domain Terms
   ((AlternativeDomainTerm1 OR AlternativeDomainTerm2) AND HierarchicalTerm)
   Example: ((plant OR unit OR works OR site) AND (head))
   Use when: Multiple domain terms describe the same role
   
   Pattern 3: Combined Patterns
   (DomainTerm AND (HierarchicalTerms)) OR ((AlternativeDomainTerms) AND HierarchicalTerm)
   Example: (Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head))
   Use when: Multiple patterns needed for comprehensive coverage
   
   Pattern 4: Company Signals + Job Titles
   (CompanySignal1 OR CompanySignal2) AND (JobTitle1 OR JobTitle2)
   Example: ("telecom equipment" OR "OEM" OR "network solutions") AND ("Channel Partner Manager" OR "Partner Relations")
   Use when: Company type signals are available
   
   Pattern 5: Comprehensive OR (for roles without clear structure)
   (Term1 OR Term2 OR Term3 OR ...)
   Example: (Pulmonologist OR "Chest Physician" OR "Respiratory Specialist")
   Use when: Role doesn't have hierarchical/domain split

5. COMPANY TYPE SIGNAL INTEGRATION:
   When company type signals are provided:
   - Industry keywords: Use in OR groups to expand company searches
     Example: ("telecom equipment" OR "OEM" OR "network solutions")
   - Product keywords: Use in AND groups to filter by product focus
     Example: ("base stations" OR "switches" OR "routers") AND "sales"
   - Business model keywords: Use ONLY if commonly mentioned by candidates in profiles
     * Most candidates don't write "B2B" in their profiles
     * Prefer exclusion keywords: NOT ("consumer" OR "B2C" OR "retail")
     * If business model must be included, use terms candidates actually write: "enterprise solutions", "corporate sales", "wholesale"
     * Example: NOT ("consumer" OR "retail") AND "enterprise solutions"
   - Partner program keywords: Use when searching for partner/channel roles
     Example: ("Channel Partner Program" OR "VAR" OR "reseller")
   - Exclusion keywords: Use with NOT to avoid false positives
     Example: NOT ("consumer handsets" OR "retail")
   
   Think: "How would candidates describe their company type in their profile?"

6. CANDIDATE PROFILE WRITING PATTERNS:
   Candidates write profiles in these ways:
   - Job title variations: "VP Sales", "Vice President of Sales", "VP - Sales"
   - Company descriptions: "Telecom equipment vendor", "B2B software company", "OEM manufacturer"
   - Skills and technologies: Listed in skills section, mentioned in experience
   - Abbreviations: Common in job titles (VP, GM, Head, Dir, Mgr)
   - Industry terms: Mentioned in company description, experience descriptions
   
   Your query should capture all these variations.

7. QUERY OPTIMIZATION STRATEGY:
   ${searchType === 'classic' 
     ? `FOR CLASSIC (6-term limit):
   - Prioritize essential terms first (primary role, key domain)
   - Use strategic simplification (e.g., "partner" instead of "Channel Partner Manager" OR "Partner Relations")
   - Combine related terms (e.g., "channel" covers multiple variations)
   - Remove redundant terms
   - Explain optimization choices in reasoning
   - If essential terms exceed 6, prioritize by:
     1. Primary role title (must include)
     2. Key domain/functional terms (high priority)
     3. Most common variations (medium priority)
     4. Less common variations (low priority)`
     : `FOR ${searchTypeLabel.toUpperCase()} (no term limit):
   - Include comprehensive term coverage
   - Use all relevant variations
   - Combine multiple patterns for exhaustive coverage
   - Include company signals when available
   - Create alternative queries for different scenarios`}

OUTPUT REQUIREMENTS:
- booleanQuery: The generated boolean query string
- reasoning: Detailed explanation of query construction, term categorization, and optimization strategy
- termAnalysis: Categorize terms by expand, filter, essential, optional, exclude
- queryStrategy: Explain expansion groups, filtering groups, exclusion groups, and balance
- alternativeQueries: Provide alternative queries for different scenarios (too many/few results)

EXAMPLES WITH COMPANY SIGNALS:
1. For "Channel Partner Manager from telecom equipment vendors":
   Query: ("Channel Partner Manager" OR "Partner Relations" OR "Alliance Manager") AND ("telecom equipment" OR "OEM" OR "network solutions" OR "base stations")
   Reasoning: Combined job title variations (OR) with company type signals (industry + product keywords) to find candidates from telecom equipment vendors
   
2. For "Head of Operations" (Classic, 6-term limit):
   Query: (Operations AND (head OR gm OR vp)) OR (plant AND head)
   Reasoning: Optimized to 6 terms by combining "head OR gm OR vp" (3 terms) with Operations (1 term) = 4 terms, plus alternative pattern "plant AND head" (2 terms) = 6 total. Prioritized most common hierarchical terms.

Generate the boolean query thinking like an experienced recruiter who understands candidate profiles and strategically combines terms.`;
  }

  getBooleanQueryGenerationUserPrompt(
    queryUnderstanding: QueryUnderstanding,
    variations: string[],
    hierarchicalTerms: string[],
    domainTerms: string[],
    nomenclaturePatterns: string[],
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const searchTypeLabel = searchType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchType === 'sales_navigator' 
        ? 'Sales Navigator' 
        : 'Recruiter';
    
    const classicInstructions = searchType === 'classic' 
      ? `\n\n⚠️ CLASSIC 6-TERM OPTIMIZATION INSTRUCTIONS:
    - You MUST generate a query with MAXIMUM 6 keyword terms
    - Each quoted phrase counts as 1 term
    - Prioritize essential terms (primary role, key domain terms)
    - Strategically simplify: Use broad terms that capture multiple variations
    - Combine related terms efficiently
    - Explain your optimization strategy in the reasoning field
    - If you cannot fit all terms in 6, prioritize by importance and coverage`
      : '';
    
    const companySignalsSection = queryUnderstanding.companyTypeSignals 
      ? `\n\nCOMPANY TYPE SIGNALS (INCORPORATE INTO QUERY):
    - Industry Keywords: ${queryUnderstanding.companyTypeSignals.industryKeywords?.join(', ') || 'None'}
    - Product Keywords: ${queryUnderstanding.companyTypeSignals.productKeywords?.join(', ') || 'None'}
    - Business Model Keywords: ${queryUnderstanding.companyTypeSignals.businessModelKeywords?.join(', ') || 'None'}
    - Company Type Description: ${queryUnderstanding.companyTypeSignals.companyTypeDescription || 'N/A'}
    
    INSTRUCTIONS FOR COMPANY SIGNALS:
    - Use industry keywords in OR groups to expand company searches
    - Use product keywords in AND groups to filter by product focus
    - Use business model keywords to filter by business model
    - Use partner program keywords when searching for partner/channel roles
    - Use exclusion keywords with NOT to avoid false positives
    - Think about how candidates describe their companies in profiles
    - Incorporate these signals strategically into your boolean query`
      : '';

    return `Generate a sophisticated boolean query for ${searchTypeLabel} search to find candidates for the role: "${queryUnderstanding.primaryRole}"

    DISCOVERED INFORMATION:
    - Role: ${queryUnderstanding.primaryRole}
    - All Variations: ${variations.join(', ')}
    - Hierarchical Terms: ${hierarchicalTerms.length > 0 ? hierarchicalTerms.join(', ') : 'None identified'}
    - Domain Terms: ${domainTerms.length > 0 ? domainTerms.join(', ') : 'None identified'}
    - Nomenclature Patterns: ${nomenclaturePatterns.length > 0 ? nomenclaturePatterns.join(', ') : 'None identified'}${companySignalsSection}${classicInstructions}

    TERM ANALYSIS TASK:
    Categorize all terms you're considering:
    - expand: Terms that expand results (broad terms)
    - filter: Terms that filter results (specific terms)
    - essential: Must-have terms (primary role, key requirements)
    - optional: Nice-to-have terms (variations, synonyms)
    - exclude: Terms to exclude (NOT terms)

    STRATEGIC QUERY CONSTRUCTION:
    - Think about how candidates write their profiles
    - Strategically combine terms using AND/OR/NOT
    - For Sales Nav/Recruiter: Create comprehensive queries with multiple patterns
    - For Classic: Optimize within 6-term constraint while maximizing coverage
    - Incorporate company type signals when available
    - Provide alternative queries for different scenarios

    Generate the boolean query now, thinking like an experienced recruiter.`;
  }
}
