import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';
import { LinkedInSearchResult } from '../../candidate-search/types/linkedin-search-result.type';
import { AiFiltersResponse } from '../types/search-plan.types';

export interface FiltersPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
}

export class FiltersPrompts {
  
  static getSystemPrompt(): string {
    return `You are an expert filter strategist specializing in candidate shortlisting and data filtering. Your role is to create intelligent filter configurations that will help identify the most qualified candidates for executive positions.

        Key Responsibilities:
        1. Analyze job requirements and AI filter configurations to design effective filters
        2. Create both Handsontable and CandidateSearch filter configurations
        3. Set intelligent thresholds based on data distribution when available
        4. Design filter strategies that balance quality and quantity

        Filter Types:

        Handsontable Filters (for DataTable):
        - text: Text-based filtering (contains, equals, begins with, etc.)
        - numeric: Number-based filtering (greater than, less than, between, etc.)
        - date: Date-based filtering (before, after, between dates)
        - dropdown: Selection from predefined options
        - checkbox: Boolean filtering (true/false)
        - autocomplete: Text input with suggestions

        CandidateSearch Filters (for Search Results Table):
        - text_search: Free text search across fields
        - dropdown_selection: Single selection from options
        - date_range: Date range selection
        - numeric_range: Number range selection
        - boolean: True/false selection
        - multi_select: Multiple selection from options
        - location: Geographic filtering
        - company: Company-based filtering
        - industry: Industry-based filtering
        - seniority: Seniority level filtering
        - network_distance: LinkedIn network distance
        - experience_range: Experience level range
        - salary_range: Salary expectation range

        Filter Strategy Principles:
        1. Start with high-impact filters that eliminate unqualified candidates
        2. Use progressive filtering (broad to narrow)
        3. Consider data distribution to set realistic thresholds
        4. Balance between quality (strict filters) and quantity (loose filters)
        5. Provide clear reasoning for each filter choice

        Target Shortlist Sizes:
        - Small (10-25): High-quality, highly targeted
        - Medium (25-50): Balanced quality and quantity
        - Large (50-100): Broader reach, more candidates

        Always provide clear reasoning for your filter strategy and expected outcomes.`;
  }

  static getUserPrompt(
    parsedJD: ParsedJobDescription,
    aiFilters: AiFiltersResponse,
    sampleResults?: LinkedInSearchResult[],
    dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>
  ): string {
    let prompt = `Analyze the following job description and AI filter configurations to create intelligent filter strategies for candidate shortlisting.

    Project Description:
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

    Available AI Filters:
    ${aiFilters.aiFilters.map((filter, index) => `
    ${index + 1}. ${filter.name} (${filter.category})
      Description: ${filter.description}
      Fields: ${filter.fields.map(f => `${f.name} (${f.type})`).join(', ')}
    `).join('')}`;

    if (sampleResults && sampleResults.length > 0) {
      prompt += `\n\nSample Enriched Results (${sampleResults.length} candidates):
    ${sampleResults.slice(0, 10).map((result, index) => `
    Candidate ${index + 1}:
    - Name: ${result.name || 'N/A'}
    - Headline: ${result.headline || 'N/A'}
    - Location: ${result.location || 'N/A'}
    - Industry: ${result.industry || 'N/A'}
    - Current Position: ${result.current_positions?.[0]?.role || 'N/A'} at ${result.current_positions?.[0]?.company || 'N/A'}
    - Network Distance: ${result.network_distance || 'N/A'}
    - Enriched Data: ${Object.keys(result).filter(key => 
      !['name', 'headline', 'location', 'industry', 'current_positions', 'network_distance', 'id', 'url'].includes(key)
    ).map(key => `${key}: ${JSON.stringify(result[key])}`).join(', ')}
    `).join('')}

    Based on this enriched sample data, please create filters that will help identify the most qualified candidates from similar profiles.`;
        } else if (dataDistribution) {
          prompt += `\n\nData Distribution Analysis:
    ${Object.entries(dataDistribution).map(([field, stats]) => `
    - ${field}: min=${stats.min}, max=${stats.max}, avg=${stats.avg}, count=${stats.count}
    `).join('')}

    Use this data distribution to set intelligent filter thresholds.`;
        } else {
          prompt += `\n\nNo sample data or data distribution available. Create filter templates that users can adjust based on actual data.`;
        }

        prompt += `\n\nPlease provide:
    1. Filter strategy with target shortlist size and reasoning
    2. Handsontable filters for DataTable integration
    3. CandidateSearch filters for Search Results Table integration
    4. Clear reasoning for each filter choice
    5. Expected outcomes and shortlist quality

    Focus on filters that will help identify the most qualified candidates for this executive position while maintaining a reasonable shortlist size.`;

    return prompt;
  }

  static getExamples(): Record<string, any> {
    return {
      handsontableFilters: [
        {
          column: "primarySkillsMatch",
          type: "numeric",
          condition: "gte",
          value: 70,
          description: "Primary skills match >= 70%"
        },
        {
          column: "seniorityLevel",
          type: "dropdown",
          condition: "by_value",
          options: ["Senior", "Executive", "C-Level"],
          description: "Seniority level filter"
        },
        {
          column: "managementExperience",
          type: "checkbox",
          condition: "eq",
          value: true,
          description: "Has management experience"
        }
      ],
      candidateSearchFilters: [
        {
          field: "headline",
          type: "text_search",
          label: "Job Title Search",
          placeholder: "Search by job title..."
        },
        {
          field: "location",
          type: "location",
          label: "Location",
          options: ["San Francisco Bay Area", "New York", "Remote"]
        },
        {
          field: "network_distance",
          type: "network_distance",
          label: "Network Distance",
          options: ["1st", "2nd", "3rd"]
        },
        {
          field: "experience_years",
          type: "numeric_range",
          label: "Experience Range",
          min: 5,
          max: 15
        }
      ],
      filterStrategy: {
        name: "Executive Quality Focus",
        description: "Focus on high-quality candidates with strong technical skills and leadership experience",
        targetShortlistSize: 25,
        priority: "quality",
        reasoning: "For executive positions, quality over quantity is crucial. Focus on candidates with strong technical skills, management experience, and appropriate seniority level."
      }
    };
  }
}
