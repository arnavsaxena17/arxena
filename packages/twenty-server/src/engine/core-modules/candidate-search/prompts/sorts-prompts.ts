import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';
import { LinkedInSearchResult } from '../../candidate-search/types/linkedin-search-result.type';
import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse } from '../types/search-plan.types';

export interface SortsPrompt {
  system: string;
  user: string;
  variables?: Record<string, any>;
}

export class SortsPrompts {
  
  static getSystemPrompt(): string {
    return `You are an expert data sorting strategist specializing in candidate ranking and prioritization. Your role is to create intelligent multi-column sorting configurations that will help identify and prioritize the most qualified candidates for executive positions.

      Key Responsibilities:
      1. Analyze job requirements, enrichments, and filters to determine optimal sorting strategy
      2. Create multi-column sorting configurations that prioritize the most relevant candidates
      3. Design sorting order that balances different candidate attributes effectively
      4. Consider data quality and availability when determining sort priorities

      Sorting Strategy Principles:
      1. Primary Sort: Most critical attribute for candidate qualification
      2. Secondary Sort: Second most important attribute for tie-breaking
      3. Tertiary Sort: Additional attributes for fine-tuning rankings
      4. Consider data quality and completeness for each field
      5. Balance between different types of qualifications (technical, soft skills, experience)

      Sort Order Types:
      - asc: Ascending order (lowest to highest)
      - desc: Descending order (highest to lowest)

      Common Sorting Patterns:
      - Skills Match: Sort by technical skills alignment (desc)
      - Seniority Level: Sort by experience level (desc)
      - Location Relevance: Sort by location proximity (asc for distance)
      - Experience Years: Sort by years of experience (desc)
      - Education Level: Sort by education relevance (desc)
      - Cultural Fit: Sort by cultural alignment scores (desc)
      - Network Distance: Sort by LinkedIn connection proximity (asc)

      Data Quality Considerations:
      1. Prioritize fields with high data completeness
      2. Consider fields that are enriched vs. raw data
      3. Account for missing or null values in sorting logic
      4. Ensure sorting doesn't break due to data inconsistencies

      Always provide clear reasoning for your sorting strategy and how it supports candidate prioritization for this specific role.`;
  }

  static getUserPrompt(
    parsedJD: ParsedJobDescription,
    searchParameters: SearchParametersResponse,
    enrichments: EnrichmentsResponse,
    filters: FiltersResponse,
    sampleResults?: LinkedInSearchResult[]
  ): string {
    let prompt = `Analyze the following job description, search parameters, enrichments, and filters to create an intelligent multi-column sorting strategy for candidate prioritization.

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

    Search Strategy:
    - Search Type: ${searchParameters?.metadata?.searchType || 'N/A'}
    - Search Category: ${searchParameters?.metadata?.searchCategory}
    - Complexity: ${searchParameters?.complexity || 'N/A'}
    - Overall Strategy: ${searchParameters?.overallStrategy || 'N/A'}

    Available Enrichments:
    ${enrichments.enrichments.map((enrichment, index) => `
    ${index + 1}. ${enrichment.name} (${enrichment.category})
      Description: ${enrichment.description}
      Fields: ${enrichment.fields.map(f => `${f.name} (${f.type})`).join(', ')}
    `).join('')}

    Filter Strategy:
    - Strategy: ${filters.filterStrategy.name}
    - Description: ${filters.filterStrategy.description}
    - Target Shortlist Size: ${filters.filterStrategy.targetShortlistSize}
    - Priority: ${filters.filterStrategy.priority}
    - Reasoning: ${filters.filterStrategy.reasoning}`;

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

    Based on this enriched sample data, please create a sorting strategy that will prioritize the most qualified candidates from similar profiles.`;
    } else {
      prompt += `\n\nNo sample data available. Create a sorting strategy based on the job requirements and available enrichments.`;
    }

    prompt += `\n\nPlease provide:
    1. Sorting strategy with clear reasoning for the approach
    2. Multi-column sorting configuration with column priorities
    3. Sort order (asc/desc) for each column
    4. Clear reasoning for each sorting choice
    5. Expected outcomes and candidate prioritization logic

    Focus on creating a sorting strategy that will surface the most qualified candidates for this executive position at the top of the results.`;

    return prompt;
  }

}
