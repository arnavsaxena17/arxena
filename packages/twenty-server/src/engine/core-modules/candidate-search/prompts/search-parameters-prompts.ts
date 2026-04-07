import { Injectable } from '@nestjs/common';
import { JobDescriptionParsingPrompt, SearchParameterGenerationPrompt } from 'src/engine/core-modules/candidate-search/types/candidate-search-prompt.type';
import {
  LinkedInPeopleSearchResult,
  LinkedInSearchResult
} from '../../linkedin-search/types/linkedin-search-response.type';
import {
  linkedinIndustryOptions
} from '../schemas/linkedin-classic-people-search.schema';
import { ParsedJobDescription, } from '../types/candidate-search-request.type';

import { replaceTemplateVariables } from '../utils/template.utils';



export interface SearchParametersPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
}
@Injectable()
export class SearchParametersPrompts {

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

  private formatPeopleSearchResultLine(
    result: LinkedInSearchResult,
    idx: number,
  ): string {
    if (result.type !== 'PEOPLE') {
      return `${idx + 1}. [Non-people result: ${result.type}]`;
    }

    const peopleResult = result as LinkedInPeopleSearchResult;

    const name =
      peopleResult.name ||
      `${peopleResult.first_name || ''} ${peopleResult.last_name || ''}`.trim();
    const headline = peopleResult.headline || '';
    const location = peopleResult.location || '';
    const industry = peopleResult.industry || '';

    const currentPositions =
      peopleResult.current_positions
        ?.map(
          (pos) =>
            `${pos.role} at ${pos.company}${pos.location ? ` (${pos.location})` : ''}${pos.tenure_at_role ? ` - ${pos.tenure_at_role.years}y ${pos.tenure_at_role.months}m` : ''}`,
        )
        .join('; ') || 'No current positions';

    const workExperience =
      peopleResult.work_experience
        ?.slice(0, 3)
        .map(
          (exp) =>
            `${exp.role} at ${exp.company}${exp.start ? ` (${exp.start.year}${exp.end ? `-${exp.end.year}` : '-present'})` : ''}${exp.industry ? ` - ${exp.industry}` : ''}`,
        )
        .join('; ') || '';

    const education =
      peopleResult.education
        ?.map(
          (edu) =>
            `${edu.degree || ''}${edu.field_of_study ? ` in ${edu.field_of_study}` : ''} from ${edu.school}${edu.start ? ` (${edu.start.year}${edu.end ? `-${edu.end.year}` : ''})` : ''}`,
        )
        .join('; ') || '';

    const skills =
      peopleResult.skills?.slice(0, 10).map((skill) => skill.name).join(', ') ||
      '';

    const certifications =
      peopleResult.certifications
        ?.map(
          (cert) =>
            `${cert.name}${cert.organization ? ` from ${cert.organization}` : ''}${cert.start ? ` (${cert.start.year}${cert.end ? `-${cert.end.year}` : ''})` : ''}`,
        )
        .join('; ') || '';

    const projects =
      peopleResult.projects
        ?.slice(0, 3)
        .map(
          (proj) =>
            `${proj.name}${proj.description ? `: ${proj.description.substring(0, 100)}` : ''}${proj.skills?.length ? ` [Skills: ${proj.skills.join(', ')}]` : ''}`,
        )
        .join('; ') || '';

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
    if (peopleResult.connections_count !== undefined) {
      resultText += `\n   Connections: ${peopleResult.connections_count}`;
    }
    if (peopleResult.keywords_match) {
      resultText += `\n   Keywords Match: ${peopleResult.keywords_match}`;
    }
    if (peopleResult.shared_connections_count !== undefined) {
      resultText += `\n   Shared Connections: ${peopleResult.shared_connections_count}`;
    }

    return resultText;
  }

  getLinkedinXraySerpPaginationValidationSystemPrompt(): string {
    return `You validate LinkedIn x-ray SERP pages. Each row was enriched from the public LinkedIn profile URL via Bright Data (full profile), so Current Positions reflect the scraped profile—not only Google snippet text.

    TASKS:
    1. Compare each candidate's current employer (from Current Positions) to REQUIRED COMPANY NAME. Treat subsidiaries and obvious spelling variants as matches when appropriate.
    2. Assess whether this SERP page is worth continuing: role/title fit, location, and employer alignment with the requirement text.
    3. Compute relevanceScore 0–1 for how useful this page is for the org-chart search.
    4. Decide shouldContinuePagination.

    PAGINATION RULES (all apply):
    - Set shouldContinuePagination false if relevanceScore < 0.4.
    - If total unique profiles collected so far is greater than 60 AND fewer than 40% of candidates on THIS PAGE have a current employer that matches REQUIRED COMPANY NAME (or an acceptable variant), set shouldContinuePagination false unless the page is still clearly on-target (e.g. almost everyone matches company but titles are off).
    - If candidates are clearly the wrong company or wrong geography for the org chart, set shouldContinuePagination false even above the relevance threshold.

    OUTPUT: same JSON shape as standard result validation (isRelevant, relevanceScore, falsePositives, qualityAssessment, shouldContinuePagination, reasoning).`;
  }

  buildLinkedinXraySerpPaginationValidationPrompt(
    searchResults: LinkedInSearchResult[],
    requirementText: string,
    requiredCompanyName: string,
    totalProfilesCollectedSoFar: number,
  ): string {
    const sampleResults = searchResults.slice(0, Math.min(25, searchResults.length));
    const sampleResultsText = sampleResults
      .map((result, i) => this.formatPeopleSearchResultLine(result, i + 1))
      .join('\n\n');

    return `LinkedIn x-ray SERP page validation (Bright Data–enriched profiles).

    REQUIRED COMPANY NAME (org chart target):
    ${requiredCompanyName}

    RECRUITER / SEARCH REQUIREMENT:
    ${requirementText}

    TOTAL UNIQUE PROFILES COLLECTED SO FAR (including this page after merge): ${totalProfilesCollectedSoFar}

    THIS PAGE CANDIDATES (${sampleResults.length} of ${searchResults.length} on page):
    ${sampleResultsText}

    Focus on whether current employers match "${requiredCompanyName}" and whether fetching more SERP pages is likely to help.`;
  }

  buildResultValidationPrompt(
    searchResults: LinkedInSearchResult[],
    userMessage: string,
  ): string {
    const sampleResults = searchResults.slice(0, Math.min(25, searchResults.length));
    const sampleResultsText = sampleResults
      .map((result, idx) => this.formatPeopleSearchResultLine(result, idx + 1))
      .join('\n\n');

    return `Validate these LinkedIn search results against the recruiter requirement below.
If it includes "User steering updates", treat those as extra constraints on top of the base requirement.

    RECRUITER REQUIREMENT (base + any steering from iterative query):
    ${userMessage}

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


  buildCandidateRelevanceScoringUserPrompt(
    candidate: LinkedInPeopleSearchResult,
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

    const strategyInfo = strategyText 
      ? `SOURCING STRATEGY: ${strategyText}`
      : '';

    return `RECRUITER REQUIREMENT (base + any steering from iterative query): ${userMessage}
    
    ${strategyInfo ? `\n${strategyInfo}` : ''}
    ${hasEducationRequirements ? `\nEducation Requirements: ${educationRequirementsText}` : ''}

    CANDIDATE PROFILE:
    Name: ${candidateInfo.name}
    Headline: ${candidateInfo.headline}
    Current Position: ${candidateInfo.currentPosition}
    Location: ${candidateInfo.location}
    Past Positions: ${candidateInfo.pastPositions}
    Skills: ${candidateInfo.skills}
    ${candidateInfo.education ? `Education: ${candidateInfo.education}` : 'Education: Not available'}

    If the recruiter requirement lists steering updates, apply them as additional constraints when scoring.
    Score the relevance of this candidate against the requirement above.`;
  }





}
