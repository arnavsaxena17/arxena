import { linkedinIndustryOptions } from '../schemas/classic-people-search.schema';

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



  static cumulativePromptToCreateSearchParametersForClassicPeopleSearch(
    userMessage: string,
    classificationReasoning: string,
    rawJDText: string,
    searchType: 'people' | 'companies' | 'jobs',
    searchApiType: 'classic' | 'sales_navigator' | 'recruiter',
  ): string {
    const prompt = `
    The user has explicitly requested: "${userMessage}"

    Classification Analysis: ${classificationReasoning}

    IMPORTANT: Generate search parameters based PRIMARILY on the user's request above. Use the raw job description text below ONLY as supplementary context or fallback information when the user's request doesn't specify certain details.

    Raw Job Description Text (for reference only):
    ${rawJDText || 'No job description text available.'}

    
    
    
    
    `;

    console.log(prompt);
    return prompt;
  }



  decidingWhichParametersToCreateForClassicPeopleSearch(userMessage: string): string {
    const prompt = `
    In classic people search, we have the following parameters:
    - keywords
    - industry
    - location
    - company
    - past_company
    - school
    - advanced_keywords (first_name, last_name, title, company, school)
    The current search is ${userMessage}
    Based on the above parameters, decide which parameters to create for the search.
    
    IMPORTANT:
    For Industry:
    The problem with using industry as a search parameter is that most people change jobs and the industry that they mention in the profile is not the industry that they are currently working in. Eg. a sales professional who has worked in pharma and now works in technology. A better approach is to use the industry as blank and use very specifc keywords to filter the results.
    For Location:
    Location is a very important parameter. Often we can search the location by city/ state/ country/ region. But we start small with the city, then the state, then the country, then the region. Ideally we try to minimise the relocation by getting people closest to the role geographically. 
    For Company:
    Company specific parameters are very relevant if the user has asked for a specific company/ companies. Or a very small niche industry for which we can search the names of companies that match that query and we can then query the companies which match the target list and perform the search.
    For Education type:
    Education type parameters are usually very irrelevant for most roles. So, we can ignore them. 
    For Advanced keywords:
    Advanced keywords parameters are usually when very specific keywords are already provided in the name, job title, company or school.
    For company and school, we can use the company and school direct parameters also which are tagged to the specific company and school names but here we can do keyword match.
    
    Return the parameters in a comma separated list.
    `;





    return prompt;
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
