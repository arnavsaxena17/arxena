import {
  ClassicPeopleParameterName,
  linkedinIndustryOptions,
} from '../schemas/classic-people-search.schema';

export interface SearchParametersPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
}

export class SearchParametersPrompts {
  
    /**
   * Build enhanced user prompt that prioritizes user message over raw JD text
   * Used when processing chat messages with explicit user requests
   */
  static buildUserPrioritizedPrompt(
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


  static decidingWhichParametersToCreateForClassicPeopleSearch(userMessage: string, classificationReasoning: string, rawJDText: string, searchType: 'people' | 'companies' | 'jobs', searchApiType: 'classic' | 'sales_navigator' | 'recruiter'): string {

    const searchTypeLabel = searchApiType === 'classic' 
      ? 'LinkedIn Classic' 
      : searchApiType === 'sales_navigator' 
        ? 'LinkedIn Sales Navigator' 
        : 'LinkedIn Recruiter';

    const prompt = `
    You are also an expert at searching candidates on LinkedIn.
    The broad task is to filter the LinkedIn database to provide a list of highly relevant candidates for the specific role that we are hiring for, while avoiding false positives (e.g., role = "Sales Head" but results show "EA to Sales Head").
    We need 40-80 qualified candidates across the first few pages of search results—enough volume to close the role without diluting quality.

    In classic people search, we have the following parameters:
    - keywords
    - industry
    - location
    - company
    - past_company
    - school
    - advanced_keywords (first_name, last_name, title, company, school)

    The current search is ${userMessage}
    Classification Analysis: ${classificationReasoning}

    Raw Job Description Context:
    ${rawJDText || 'No job description text available.'}

    STRATEGY REQUIREMENTS:
    - Produce exactly 3 complementary strategies (one Focused, one Balanced, one Broad) that recruiters would use iteratively.
    - Each strategy should explicitly describe how it balances precision vs. coverage, referencing the false-positive example above.
    - Each strategy should target 40-80 viable candidates, adjusting filters (keywords, geography, company lists, etc.) to reach that range.
    - Reference recruiter intuition when describing when to prefer each strategy (e.g., hyper-specific titles in 15-20 companies vs. broader keyword sweeps).

    PARAMETER GUIDELINES (apply within each strategy):
    - Keywords: Maximum of 6 clauses in a boolean string using AND/OR/NOT. Prioritize organization-structure-aligned titles and skills.
    - Industry: Use only if it meaningfully narrows to the right talent pool. Prefer keyword filtering if industry would exclude good candidates.
      Valid LinkedIn industries (exact match required): ${linkedinIndustryOptions.join(', ')}
    - Location: Start specific (city/state) before widening (country/region). Use when relocation risk exists.
    - Company & Past Company: Only when the user names specific companies or the niche is best identified via employer lists.
    - School: Only when explicit schools are required (ignore vague “top tier” statements).
    - Advanced Keywords: Use when you must pin down specific titles/names/company mentions within profile fields.

    OUTPUT FORMAT (JSON ONLY):
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
    }

    IMPORTANT:
    - Always include at least one strategy that is clearly “focused” (very tight filters) and one that is clearly “broad” (looser filters) while keeping the candidate count goal.
    - Never output prose outside the JSON object.`;


    console.log(`Prompt for deciding which parameters to create for classic people search: ${prompt}`);
    return prompt;
  }

  static buildClassicPeopleParameterGenerationPrompt(
    parameter: ClassicPeopleParameterName,
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

    const parameterInstructions: Record<ClassicPeopleParameterName, string> = {
      keywords: `Generate a boolean string (max 6 keyword clauses) that captures the most relevant job titles, skills, or functions for this role. Respect LinkedIn Classic limits: use AND/OR/NOT, optional parentheses, and quote multi-word titles. Avoid redundant synonyms and keep the string readable.`,
      industry: `Return an array of industry names selected strictly from the official LinkedIn industry list provided. Only include industries if they are clearly tied to the target profile. Prefer leaving the array empty if industry would unnecessarily narrow results.`,
      location: `Return an array of the most precise locations (city/state/country/region) that match the sourcing needs. Start with the most specific geography mentioned by the user before expanding broader.`,
      company: `Return an array of current companies that best represent the target talent pool. Include only companies explicitly mentioned or that are dominantly known for hosting similar talent.`,
      past_company: `Return an array of past companies (employers) that would indicate relevant prior experience. Use when alumni of specific organizations are highly valued.`,
      school: `Return an array of schools only if the user requires graduates from specific institutions. Generic statements like "top-tier schools" should not be turned into a school list.`,
      advanced_keywords: `Return an object with the shape { "first_name": string|null, "last_name": string|null, "title": string|null, "company": string|null, "school": string|null }. Populate only the fields that have very specific values to enforce (for example, a required current title or a required current company). Leave others as null. Do not invent names.`,
    };

    const outputExamples: Record<ClassicPeopleParameterName, string> = {
      keywords: `{"keywords": "(sales AND (director OR \\\"head of sales\\\")) OR \\\"vp sales\\\" OR \\\"commercial lead\\\""}`,
      industry: `{"industry": ["Pharmaceutical Manufacturing", "Biotechnology Research"]}`,
      location: `{"location": ["San Francisco Bay Area", "Austin, Texas"]}`,
      company: `{"company": ["Salesforce", "HubSpot"]}`,
      past_company: `{"past_company": ["McKinsey & Company", "Boston Consulting Group (BCG)"]}`,
      school: `{"school": ["Stanford University", "MIT"]}`,
      advanced_keywords: `{"advanced_keywords": {"first_name": null, "last_name": null, "title": "Chief Revenue Officer", "company": "Figma", "school": null}}`,
    };

    return `
    You are generating the ${parameter} parameter for a LinkedIn Classic People search.
    ${commonContext}

    Parameter-specific instructions:
    ${parameterInstructions[parameter]}

    OUTPUT REQUIREMENTS:
    - Respond with JSON only.
    - Match exactly the schema illustrated in this example:
      ${outputExamples[parameter]}
    - Use human-readable text (no LinkedIn IDs).
    - When no values are appropriate, set the field to null (for keywords) or an empty array/object according to the schema.
    - Keep the boolean string precise enough to avoid false positives like "EA to Sales Head" when searching for "Head of Sales".`;
  }



  booleanClassicPeopleSearchStringPrompt(userMessage: string): string {
    const specificRoleDescription = `The specific role that we are hiring for is: ${userMessage}`;
    const specificRoleName = `The specific role name that we are hiring for is: ${userMessage}`;
    const roleLocation = `The location of the role is: ${location}`;
    const roleIndustry = `The industry of the role is: ${userMessage}`;
    const roleCompany = `The company of the role is: ${userMessage}`;

    const prompt = `

    You are an expert linkedin boolean search string generator.
    The broad task is to filter the linkedin database to provide a list of relevant candidates for the specific role that we are hiring for.
    ${specificRoleName}


    ${roleLocation}    
    ${roleIndustry}
    ${roleCompany}

    Bear in mind the context within which the candidate comes from and where he will go to.

    Your task is to generate a boolean string with a maximum of 6 keywords separated by boolean operators AND, OR, NOT in brackets.
    As a boolean string expert, you will use brackets and boolean operators to generate a more accurate search string.
    For example, if the user mentions "sales representatives", you can use combination like - 
    -  (sales AND (representative OR executive OR manager)) OR "business development executive" OR "account executive" 
    or 
    -  "sales representative" OR "sales executive" OR "sales manager" OR "business development executive" OR "account executive" OR "sales officer"

    Think of all related job titles, synonyms, and variations but intelligently put a maximum of 6 keywords.
    Linkedin Classic People search allows only a maximum of 6 keywords in the boolean string.
    Also use very targeted keywords to generate a search string that can filter the raw linkedin database and provide the most relevant results.
    Your priority will be to generate organisation structure matching keywords. Keywords may be for job titles as well as specific keywords to denote the industry or specific skills that would be most commonly found in the linkedin bios of people performing the specific role that we are hiring for.
    Generate a boolean string with a maximum of 6 keywords separated by boolean operators AND, OR, NOT in brackets. For example, if the user mentions "sales representatives", include variations like "sales representative OR sales executive OR sales manager OR business development executive OR account executive OR territory sales OR inside sales". Think of all related job titles, synonyms, and variations.`;

    console.log(prompt);
    return prompt;
  }
}
