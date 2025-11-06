import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';
import { LinkedInSearchResult } from '../../candidate-search/types/linkedin-search-result.type';
import { linkedinIndustryOptions } from '../schemas/classic-people-search.schema';

export interface SearchParametersPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
}

export class SearchParametersPrompts {
  
  static getSystemPrompt(): string {
    return `You are an expert LinkedIn search strategist specializing in candidate sourcing and recruitment. Your role is to create comprehensive search parameter variations that will help find the most qualified candidates for executive positions.

      Key Responsibilities:
      1. Analyze job requirements to determine optimal LinkedIn search strategies
      2. Create multiple search parameter variations for different approaches
      3. Design search configurations that balance reach and precision
      4. Consider different LinkedIn search types (Classic, Sales Navigator, Recruiter)

      Search Strategy Principles:
      1. Primary Strategy: Most comprehensive approach targeting ideal candidates
      2. Secondary Strategy: Broader reach with slightly relaxed criteria
      3. Tertiary Strategy: Highly targeted approach for specific niches
      4. Consider both include and exclude filters for better targeting
      5. Balance between keywords, location, industry, and company filters

      Search Parameter Categories:
      - Keywords: Job titles, skills, technologies, company names
      - Location: Geographic filters with radius options
      - Industry: Industry-specific targeting
      - Company: Company size, type, and specific company targeting
      - Experience: Years of experience and seniority levels
      - Education: Educational background and institution targeting
      - Network: LinkedIn connection distance and relationship targeting

      Search Type Considerations:
      - Classic: Basic LinkedIn search with standard filters
      - Sales Navigator: Advanced B2B targeting with behavioral filters
      - Recruiter: Professional recruitment tools with advanced candidate insights

      Always provide clear reasoning for each search strategy and how it supports finding the right candidates for this specific role.`;
  }

  static getUserPrompt(
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'classic',
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people',
    sampleResults?: LinkedInSearchResult[]
  ): string {
    let prompt = `Analyze the following job description to create comprehensive LinkedIn search parameter variations for candidate sourcing.

      Job Description:
      - Job Title: ${parsedJD.jobTitle}
      - Company: ${parsedJD.company}
      - Location: ${parsedJD.location}
      - Industry: ${parsedJD.industry}
      - Required Skills: ${parsedJD.requiredSkills.join(', ')}
      - Preferred Skills: ${parsedJD.preferredSkills.join(', ')}
      - Experience Level: ${parsedJD.experienceLevel}
      - Education: ${parsedJD.education.join(', ')}
      - Keywords: ${parsedJD.keywords.join(', ')}
      - Responsibilities: ${parsedJD.responsibilities.join('; ')}
      - Qualifications: ${parsedJD.qualifications.join('; ')}

      Search Configuration:
      - Search Type: ${searchType}
      - Search Category: ${searchCategory}`;

    if (sampleResults && sampleResults.length > 0) {
      prompt += `\n\nSample Search Results (${sampleResults.length} candidates):
      ${sampleResults.slice(0, 5).map((result, index) => `
      Candidate ${index + 1}:
      - Name: ${result.name || 'N/A'}
      - Headline: ${result.headline || 'N/A'}
      - Location: ${result.location || 'N/A'}
      - Industry: ${result.industry || 'N/A'}
      - Current Position: ${result.current_positions?.[0]?.role || 'N/A'} at ${result.current_positions?.[0]?.company || 'N/A'}
      - Network Distance: ${result.network_distance || 'N/A'}
      `).join('')}

      Based on this sample data, please create search parameters that will help find similar qualified candidates.`;
    } else {
      prompt += `\n\nPlease create search parameters based on the job requirements. Consider what search criteria would help find the most qualified candidates.`;
    }

    prompt += `\n\nPlease provide:
      1. 3-5 search parameter variations with different approaches
      2. Clear reasoning for each variation
      3. Expected candidate pool size for each variation
      4. Specific LinkedIn search parameters for each variation
      5. Overall search strategy and approach

      Focus on creating search parameters that will help identify the most qualified candidates for this executive position while maintaining a reasonable candidate pool size.`;

    return prompt;
  }

  static getExamples(): Record<string, any> {
    return {
      classicPeopleSearch: {
        primaryStrategy: {
          name: "Comprehensive Executive Search",
          description: "Target senior executives with relevant experience and skills",
          keywords: "VP Engineering, CTO, Head of Engineering, Engineering Director",
          location: ["San Francisco Bay Area", "New York", "Seattle"],
          industry: ["Computer Software", "Information Technology"],
          company: ["Microsoft", "Google", "Amazon", "Apple"],
          experienceLevel: "senior_level",
          networkDistance: [1, 2],
          reasoning: "Focus on senior-level candidates in major tech hubs with relevant industry experience"
        },
        secondaryStrategy: {
          name: "Broader Technical Leadership",
          description: "Cast wider net for technical leaders across various industries",
          keywords: "Engineering Manager, Technical Lead, Software Architect",
          location: ["United States"],
          industry: ["Computer Software", "Information Technology", "Financial Services"],
          experienceLevel: "mid_level",
          networkDistance: [1, 2, 3],
          reasoning: "Broader search to capture technical leaders who might transition to executive roles"
        },
        tertiaryStrategy: {
          name: "Industry-Specific Targeting",
          description: "Highly targeted search within specific industry verticals",
          keywords: "VP Technology, Chief Technology Officer",
          location: ["San Francisco Bay Area"],
          industry: ["Computer Software"],
          company: ["startup", "scale-up"],
          experienceLevel: "executive",
          networkDistance: [1, 2],
          reasoning: "Target executives in specific industry verticals for niche expertise"
        }
      },
      salesNavigatorPeopleSearch: {
        primaryStrategy: {
          name: "Advanced B2B Executive Targeting",
          description: "Use Sales Navigator's advanced filters for precise targeting",
          keywords: "VP Engineering, CTO",
          location: { include: ["San Francisco Bay Area"], exclude: [] },
          industry: { include: ["Computer Software"], exclude: ["Non-profit"] },
          company: { include: ["Microsoft", "Google"], exclude: [] },
          seniority: { include: ["VP", "C-Level"], exclude: [] },
          tenure: { min: 2, max: 10 },
          reasoning: "Leverage Sales Navigator's advanced targeting for executive-level candidates"
        }
      },
      recruiterPeopleSearch: {
        primaryStrategy: {
          name: "Professional Recruitment Targeting",
          description: "Use Recruiter's professional tools for candidate sourcing",
          keywords: "VP Engineering",
          location: ["San Francisco Bay Area"],
          industry: ["Computer Software"],
          seniority: ["VP", "C-Level"],
          function: ["Engineering"],
          spotlights: ["Open to work", "Active talent"],
          reasoning: "Use Recruiter's professional tools to find active and engaged candidates"
        }
      }
    };
  }

  /**
   * Build enhanced user prompt that prioritizes user message over parsedJD
   * Used when processing chat messages with explicit user requests
   */
  static buildUserPrioritizedPrompt(
    userMessage: string,
    classificationReasoning: string,
    parsedJobDescription: ParsedJobDescription,
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
        
        return `PRIORITY USER REQUEST:
    The user has explicitly requested: "${userMessage}"

    Classification Analysis: ${classificationReasoning}

    IMPORTANT: Generate search parameters based PRIMARILY on the user's request above. Use the parsed job description below ONLY as supplementary context or fallback information when the user's request doesn't specify certain details.

    Parsed Job Description (for reference only):
    ${JSON.stringify(parsedJobDescription, null, 2)}

    Generate ${searchTypeLabel} ${searchType.charAt(0).toUpperCase() + searchType.slice(1)} Search parameters that fulfill the user's explicit request. Extract and interpret:
    ${criteriaList}

    CRITICAL INSTRUCTIONS:
    1. Keywords: Generate a comprehensive string with multiple job title variations. For example, if the user mentions "sales representatives", include variations like "sales representative sales executive sales manager business development executive account executive territory sales inside sales". Think of all related job titles, synonyms, and variations.
    2. Industry: MUST use EXACT industry names. Examples:
       - For pharma: ${pharmaOptions}
       - For technology: ${techOptions.slice(0, 200)}
       - You can search the full list of ${linkedinIndustryOptions.length} valid industry names. These MUST match exactly.
    3. Prioritize extracting search criteria from the user's message over the parsed job description fields.`;
  }
}
