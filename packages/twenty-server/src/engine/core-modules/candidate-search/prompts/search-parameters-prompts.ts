import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';

export interface SearchParametersPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
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
