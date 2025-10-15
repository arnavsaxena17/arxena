import { Injectable } from '@nestjs/common';
import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';
import { JobDescriptionParsingPrompt, SearchParameterGenerationPrompt } from '../types/candidate-search-prompt.type';

export interface SearchParametersPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
}

@Injectable()
export class CandidateSearchPromptService {
  
  /**
   * Get the prompt for parsing job descriptions
   */
  getJobDescriptionParsingPrompt(): JobDescriptionParsingPrompt {
    return {
      system: `You are an expert HR and recruitment specialist with deep knowledge of job descriptions, candidate requirements, and LinkedIn search parameters. 
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

        Be thorough and extract all relevant information that could be useful for finding suitable candidates.`,

        user: `Please parse the following job description and extract all relevant information for candidate search:

        Job Description:
        {{jobDescription}}

        Additional Context:
        {{#if jobTitle}}Job Title: {{jobTitle}}{{/if}}
        {{#if company}}Company: {{company}}{{/if}}
        {{#if location}}Location: {{location}}{{/if}}
        {{#if industry}}Industry: {{industry}}{{/if}}

        Please provide a comprehensive analysis of this job description.`
    };
  }

  /**
   * Get the prompt for generating LinkedIn Classic People Search parameters
   */
  getClassicPeopleSearchPrompt(): SearchParameterGenerationPrompt {
    return {
      system: `You are an expert LinkedIn recruiter specializing in LinkedIn Classic search. Your task is to generate optimal search parameters for finding candidates based on parsed job description data.

IMPORTANT: You must generate search parameters that include:
- Keywords (job titles, skills, technologies) - as strings
- Industry parameters (as HUMAN-READABLE NAMES like "Information Technology", "Computer Software", "Financial Services")
- Location parameters (as HUMAN-READABLE NAMES like "San Francisco Bay Area", "New York City", "Seattle, Washington")
- Company parameters (as HUMAN-READABLE NAMES like "Microsoft", "Google", "Amazon", "Apple")
- School parameters (as HUMAN-READABLE NAMES like "Stanford University", "MIT", "Harvard University")
- Network distance preferences (1, 2, or 3)
- Advanced keyword filters - as strings with regex patterns

CRITICAL: Do NOT generate LinkedIn IDs (like "1035", "106442168", "1503"). Always use human-readable names that users would recognize. These names will be automatically converted to LinkedIn IDs by the system later.`,

      user: `Based on the following parsed job description, generate LinkedIn Classic People Search parameters:

Parsed Job Description:
{{parsedJobDescription}}

Please generate comprehensive search parameters that would help find the best candidates for this position. 

IMPORTANT: For industry, location, company, and school parameters, use ONLY human-readable names (e.g., "Microsoft", "San Francisco Bay Area", "Stanford University"). Do NOT use LinkedIn IDs or numeric values. The system will automatically convert these names to LinkedIn IDs later.`
    };
  }

  /**
   * Get the prompt for generating LinkedIn Classic Companies Search parameters
   */
  getClassicCompaniesSearchPrompt(): SearchParameterGenerationPrompt {
    return {
      system: `You are an expert LinkedIn recruiter specializing in LinkedIn Classic company search. Your task is to generate optimal search parameters for finding companies based on parsed job description data.

You must generate search parameters that include:
- Keywords (company names, industries, technologies) - as strings
- Industry parameters (as strings that will be resolved to IDs)
- Location parameters (as strings that will be resolved to IDs)
- Headcount ranges (min/max numbers)
- Network distance preferences (1, 2, or 3)

For parameters that require LinkedIn IDs (industry, location), provide the human-readable names/titles that will be used to fetch the corresponding LinkedIn parameter IDs.`,

      user: `Based on the following parsed job description, generate LinkedIn Classic Companies Search parameters:

Parsed Job Description:
{{parsedJobDescription}}

Please generate comprehensive search parameters that would help find relevant companies for this position. Include industry and location parameters as strings that will be resolved to LinkedIn IDs.`
    };
  }

  /**
   * Get the prompt for generating LinkedIn Classic Jobs Search parameters
   */
  getClassicJobsSearchPrompt(): SearchParameterGenerationPrompt {
    return {
      system: `You are an expert LinkedIn recruiter specializing in LinkedIn Classic job search. Your task is to generate optimal search parameters for finding similar job postings based on parsed job description data.

        You must generate search parameters that include:
        - Keywords (job titles, skills, technologies) - as strings
        - Industry parameters (as strings that will be resolved to IDs)
        - Location parameters (as strings that will be resolved to IDs)
        - Company parameters (as strings that will be resolved to IDs)
        - Seniority levels - as strings (executive, director, mid_senior, associate, entry, intern)
        - Employment types - as strings (full_time, part_time, contract, temporary, volunteer, internship, other)
        - Presence preferences (on_site, hybrid, remote)
        - Benefits and other filters

        For parameters that require LinkedIn IDs (industry, location, company), provide the human-readable names/titles that will be used to fetch the corresponding LinkedIn parameter IDs.`,

              user: `Based on the following parsed job description, generate LinkedIn Classic Jobs Search parameters:

        Parsed Job Description:
        {{parsedJobDescription}}

        Please generate comprehensive search parameters that would help find similar job postings. Include industry, location, and company parameters as strings that will be resolved to LinkedIn IDs.`
    };
  }

  /**
   * Get the prompt for generating LinkedIn Sales Navigator People Search parameters
   */
  getSalesNavigatorPeopleSearchPrompt(): SearchParameterGenerationPrompt {
    return {
      system: `You are an expert LinkedIn Sales Navigator specialist with deep knowledge of advanced B2B sales prospecting. Your task is to generate optimal Sales Navigator People Search parameters based on parsed job description data.

Sales Navigator offers sophisticated filtering capabilities that go beyond basic LinkedIn search:

CORE FILTERS:
- Keywords: Job titles, skills, technologies, company names
- Location: Include/exclude specific geographic areas, postal code searches with radius
- Industry: Include/exclude specific industries using Sales Navigator industry taxonomy
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
1. Use human-readable names for all parameters (e.g., "Microsoft", "San Francisco Bay Area", "Stanford University")
2. Do NOT use LinkedIn IDs or numeric values - the system will convert names to IDs automatically
3. Focus on creating targeted searches that leverage Sales Navigator's advanced features
4. Consider both include and exclude filters for better targeting
5. Use appropriate seniority levels based on the job requirements
6. Set realistic tenure ranges based on experience level needed
7. Leverage behavioral filters to find engaged prospects
8. Consider company headcount ranges appropriate for the role level`,

      user: `Based on the following parsed job description, generate comprehensive LinkedIn Sales Navigator People Search parameters:

Parsed Job Description:
{{parsedJobDescription}}

Please generate sophisticated search parameters that leverage Sales Navigator's advanced capabilities to find the best candidates for this position.

IMPORTANT GUIDELINES:
- Use human-readable names for all location, industry, company, and school parameters
- Do NOT use LinkedIn IDs or numeric values
- Focus on creating targeted searches using include/exclude filters
- Leverage behavioral filters to find engaged prospects
- Set appropriate seniority levels and tenure ranges
- Consider company headcount ranges suitable for the role level
- Use advanced features like account lists and lead lists when relevant

Generate parameters that would help sales teams find highly qualified prospects who are likely to be interested in this opportunity.`
    };
  }

  /**
   * Get the prompt for generating LinkedIn Sales Navigator Companies Search parameters
   */
  getSalesNavigatorCompaniesSearchPrompt(): SearchParameterGenerationPrompt {
    return {
      system: `You are an expert LinkedIn Sales Navigator specialist with deep knowledge of B2B account-based marketing and company prospecting. Your task is to generate optimal Sales Navigator Companies Search parameters based on parsed job description data.

Sales Navigator Companies Search offers sophisticated filtering capabilities for account-based sales:

CORE COMPANY FILTERS:
- Keywords: Company names, industries, technologies, business descriptions
- Industry: Include/exclude specific industries using Sales Navigator industry taxonomy
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
8. Consider recent activities to find companies in growth phases`,

      user: `Based on the following parsed job description, generate comprehensive LinkedIn Sales Navigator Companies Search parameters:

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

Generate parameters that would help sales teams identify high-value target accounts that are likely to need this type of role or service.`
    };
  }

  /**
   * Get the prompt for generating LinkedIn Recruiter People Search parameters
   */
  getRecruiterPeopleSearchPrompt(): SearchParameterGenerationPrompt {
    return {
      system: `You are an expert LinkedIn Recruiter specialist with deep knowledge of advanced talent acquisition and recruitment strategies. Your task is to generate optimal LinkedIn Recruiter People Search parameters based on parsed job description data.

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
1. Use human-readable names for all parameters (e.g., "Microsoft", "San Francisco Bay Area", "Stanford University")
2. Do NOT use LinkedIn IDs or numeric values - the system will convert names to IDs automatically
3. Focus on creating highly targeted searches that leverage Recruiter's advanced features
4. Use appropriate priority levels (CAN_HAVE, MUST_HAVE, DOESNT_HAVE) for better targeting
5. Set realistic scope parameters (CURRENT, PAST, CURRENT_OR_PAST, OPEN_TO_WORK)
6. Leverage spotlights to find active job seekers
7. Use recruiting activity filters to find engaged candidates
8. Consider both include and exclude filters for better targeting
9. Set appropriate tenure and seniority ranges based on job requirements
10. Use language filters when targeting specific markets`,

      user: `Based on the following parsed job description, generate comprehensive LinkedIn Recruiter People Search parameters:

Parsed Job Description:
{{parsedJobDescription}}

Please generate sophisticated search parameters that leverage LinkedIn Recruiter's advanced capabilities to find the best candidates for this position.

IMPORTANT GUIDELINES:
- Use human-readable names for all location, industry, company, and school parameters
- Do NOT use LinkedIn IDs or numeric values
- Focus on creating highly targeted searches using priority levels and scope parameters
- Leverage spotlights to find active job seekers
- Use recruiting activity filters to find engaged candidates
- Set appropriate tenure and seniority ranges based on job requirements
- Use language filters when targeting specific markets
- Consider both include and exclude filters for better targeting
- Use advanced features like hiring projects and recruiting activity when relevant

Generate parameters that would help recruiters find highly qualified candidates who are likely to be interested in this opportunity and match the job requirements precisely.`
    };
  }
}



export class SearchParametersPrompts {
  
  static getSystemPrompt(): string {
    return `You are an expert executive search strategist specializing in LinkedIn search optimization. Your role is to analyze job descriptions and create comprehensive search strategies that will identify the best candidates for executive positions.

    Key Responsibilities:
    1. Analyze job description complexity and requirements
    2. Generate multiple search variations (broad, narrow, targeted) based on complexity
    3. Create search parameters optimized for the specified LinkedIn search type
    4. Provide clear reasoning for each search variation

    Search Types:
    - Classic: Basic LinkedIn search with limited filters
    - Sales Navigator: Advanced search with detailed targeting options
    - Recruiter: Premium LinkedIn Recruiter with advanced candidate insights

    Search Categories:
    - People: Individual candidate profiles
    - Companies: Company profiles and information
    - Jobs: Job postings and opportunities

    Complexity Analysis Factors:
    - Number of required skills and qualifications
    - Seniority levels mentioned (entry, mid, senior, executive)
    - Role diversity and specialization requirements
    - Location specificity and remote work options
    - Industry specificity and domain expertise
    - Experience range requirements

    Search Variation Guidelines:
    - Simple JD (1-2 variations): Focus on core requirements
    - Moderate JD (2-3 variations): Include broad and targeted approaches
    - Complex JD (3 variations): Broad, medium, and narrow targeting

    Always provide clear reasoning for your search strategy and expected result sizes.`;
      }

  static getUserPrompt(
    parsedJD: ParsedJobDescription,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs'
  ): string {
    return `Analyze the following job description and create a comprehensive search strategy for ${searchType} ${searchCategory} search.

Job Description Analysis:
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
- Employment Type: ${parsedJD.employmentType}
- Remote Work: ${parsedJD.remoteWork ? 'Yes' : 'No'}

Search Requirements:
- Search Type: ${searchType}
- Search Category: ${searchCategory}

Please provide:
1. Complexity analysis (simple/moderate/complex)
2. 1-3 search variations based on complexity
3. Detailed search parameters for each variation
4. Expected result size for each variation
5. Clear reasoning for the overall strategy

Use the appropriate schema for ${searchType} ${searchCategory} search parameters.`;
  }

  static getExamples(): Record<string, any> {
    return {
      classicPeopleSearch: {
        keywords: "software engineer",
        industry: ["Technology"],
        location: ["San Francisco Bay Area"],
        network_distance: [1, 2],
        company: ["Google", "Microsoft", "Apple"]
      },
      salesNavigatorPeopleSearch: {
        keywords: "VP Engineering",
        industry: {
          include: ["Technology", "Software Development"],
          exclude: ["Healthcare", "Finance"]
        },
        location: {
          include: ["San Francisco Bay Area", "Seattle"],
          exclude: ["Remote"]
        },
        seniority: {
          include: ["vice_president", "director"],
          exclude: ["entry_level", "senior"]
        },
        company_headcount: [{
          min: 201,
          max: 1000
        }]
      },
      recruiterPeopleSearch: {
        keywords: "Chief Technology Officer",
        locale: "english",
        location: [{
          id: "us:0",
          priority: "MUST_HAVE",
          scope: "CURRENT_OR_OPEN_TO_RELOCATE"
        }],
        role: [{
          keywords: "CTO Chief Technology Officer",
          priority: "MUST_HAVE",
          scope: "CURRENT_OR_PAST"
        }],
        company_headcount: [{
          min: 501,
          max: 5000
        }]
      }
    };
  }
}
