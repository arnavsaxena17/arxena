import { Injectable } from '@nestjs/common';
import { JobDescriptionParsingPrompt, SearchParameterGenerationPrompt } from '../types/candidate-search-prompt.type';

@Injectable()
export class CandidateSearchPromptService {
  
  /**
   * Get the prompt for parsing job descriptions
   */
  getJobDescriptionParsingPrompt(): JobDescriptionParsingPrompt {
    return {
      system: `You are an expert HR and recruitment specialist with deep knowledge of job descriptions, candidate requirements, and LinkedIn search parameters. Your task is to parse job descriptions and extract structured information that can be used for candidate search.

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
      system: `You are an expert LinkedIn Sales Navigator specialist. Your task is to generate optimal Sales Navigator People Search parameters based on parsed job description data.

Sales Navigator offers advanced filtering capabilities including:
- Location filters (include/exclude, postal code)
- Industry filters (include/exclude)
- Company filters (include/exclude, headcount, type)
- Function and role filters
- Seniority levels
- Tenure filters
- School filters
- Profile language
- Network distance
- Advanced behavioral filters (viewed profile, posted content, etc.)
- Account and lead lists

Focus on creating sophisticated searches that leverage Sales Navigator's advanced features.`,

      user: `Based on the following parsed job description, generate LinkedIn Sales Navigator People Search parameters:

Parsed Job Description:
{{parsedJobDescription}}

Please generate comprehensive Sales Navigator search parameters that would help find the best candidates for this position.`
    };
  }

  /**
   * Get the prompt for generating LinkedIn Sales Navigator Companies Search parameters
   */
  getSalesNavigatorCompaniesSearchPrompt(): SearchParameterGenerationPrompt {
    return {
      system: `You are an expert LinkedIn Sales Navigator specialist. Your task is to generate optimal Sales Navigator Companies Search parameters based on parsed job description data.

Sales Navigator Companies Search offers advanced filtering including:
- Industry filters (include/exclude)
- Location filters (include/exclude, postal code)
- Headcount ranges and growth
- Department headcount filters
- Annual revenue ranges
- Technologies used
- Recent activities (funding, leadership changes)
- Network distance
- Account lists

Focus on creating sophisticated company searches that leverage Sales Navigator's advanced features.`,

      user: `Based on the following parsed job description, generate LinkedIn Sales Navigator Companies Search parameters:

Parsed Job Description:
{{parsedJobDescription}}

Please generate comprehensive Sales Navigator company search parameters.`
    };
  }

  /**
   * Get the prompt for generating LinkedIn Recruiter People Search parameters
   */
  getRecruiterPeopleSearchPrompt(): SearchParameterGenerationPrompt {
    return {
      system: `You are an expert LinkedIn Recruiter specialist. Your task is to generate optimal LinkedIn Recruiter People Search parameters based on parsed job description data.

LinkedIn Recruiter offers the most advanced filtering capabilities including:
- Location filters with area radius
- Industry filters
- Role filters (by ID or keywords)
- Skills filters (by ID or keywords)
- Company filters (current and past)
- Company headcount ranges
- School filters
- Groups
- Graduation year ranges
- Tenure filters
- Seniority levels
- Function filters
- Network distance
- Spoken languages
- Profile language
- Recently joined filters
- Spotlight filters (open to work, active talent, etc.)
- First and last name filters
- Military background
- Hiring projects
- Recruiting activity filters

Focus on creating highly targeted searches that leverage Recruiter's advanced features.`,

      user: `Based on the following parsed job description, generate LinkedIn Recruiter People Search parameters:

Parsed Job Description:
{{parsedJobDescription}}

Please generate comprehensive Recruiter search parameters that would help find the best candidates for this position.`
    };
  }
}
