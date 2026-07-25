import { ParsedJobDescription } from '../../candidate-search/types/candidate-search-request.type';
import { LinkedInSearchResult } from '../../candidate-search/types/linkedin-search-result.type';
import { SearchParametersResponse } from '../types/search-plan.types';

export interface AiFilteringPrompt {
  system: string;
  user: string;
  variables?: Record<string, unknown>;
}

export class AiFilteringPrompts {

  static getSystemPrompt(): string {
    return `You are an expert in AI filtering strategies specializing in candidate data analysis and classification. Your role is to create AI filter configurations that will add valuable insights to candidate profiles for executive search.

      Key Responsibilities:
      1. Analyze job requirements to determine necessary AI filters
      2. Create AI filter configurations with appropriate field definitions
      3. Design prompts for AI models to generate consistent classifications
      4. Select relevant metadata fields for AI filter processing

      AI Filter Categories:
      - Skills: Technical and soft skills classification and scoring
      - Seniority: Role level classification (entry, mid, senior, executive)
      - Location: Geographic analysis and distance calculations
      - Experience: Experience level analysis and career progression
      - Cultural: Cultural fit assessment and company alignment
      - Custom: Project-specific custom classifications

      Field Types:
      - text: Free-form text analysis
      - number: Numeric scoring or ranking
      - boolean: Binary classification (yes/no)
      - enum: Categorical classification with predefined options

      AI Filter Design Principles:
      1. Each filter should add clear value for candidate evaluation
      2. Field definitions should be specific and measurable
      3. Prompts should be clear and produce consistent results
      4. Consider both required and preferred qualifications
      5. Balance comprehensiveness with processing efficiency

      Always provide clear reasoning for each AI filter and how it supports the hiring decision.`;
  }

  static getUserPrompt(
    parsedJD: ParsedJobDescription,
    searchParameters: SearchParametersResponse,
    sampleResults?: LinkedInSearchResult[]
  ): string {
    let prompt = `Analyze the following job description and search parameters to create AI filter configurations for candidate data analysis.

      Project Description:
      - Job Title: ${parsedJD?.jobTitle}
      - Company: ${parsedJD?.company}
      - Location: ${parsedJD?.location}
      - Industry: ${parsedJD?.industry}
      - Required Skills: ${parsedJD?.requiredSkills?.join(', ')}
      - Preferred Skills: ${parsedJD?.preferredSkills?.join(', ')}
      - Experience Level: ${parsedJD?.experienceLevel}
      - Education: ${parsedJD?.education?.join(', ')}
      - Keywords: ${parsedJD?.keywords?.join(', ')}
      - Responsibilities: ${parsedJD?.responsibilities?.join('; ')}
      - Qualifications: ${parsedJD?.qualifications?.join('; ')}

      Search Strategy:
      - Search Type: ${searchParameters?.metadata?.searchType || 'N/A'}
      - Search Category: ${searchParameters?.metadata?.searchCategory}
      - Complexity: ${searchParameters?.complexity || 'N/A'}
      - Overall Strategy: ${searchParameters?.overallStrategy || 'N/A'}
      - Number of Variations: ${searchParameters?.variations?.length || 'N/A'}`;

    if (sampleResults && sampleResults.length > 0) {
      prompt += `\n\nSample Search Results (${sampleResults?.length || 0} candidates):
      ${sampleResults?.slice(0, 5).map((result: LinkedInSearchResult, index: number) => `
      Candidate ${index + 1}:
      - Name: ${result?.name || 'N/A'}
      - Headline: ${result?.headline || 'N/A'}
      - Location: ${result?.location || 'N/A'}
      - Industry: ${result?.industry || 'N/A'}
      - Current Position: ${result?.current_positions?.[0]?.role || 'N/A'} at ${result?.current_positions?.[0]?.company || 'N/A'}
      - Network Distance: ${result?.network_distance || 'N/A'}
      `).join('\n')}
      \n\n
      Based on this sample data, please create AI filters that will help classify and evaluate these candidates effectively.`;
    } else {
      prompt += `\n\nPlease create AI filters based on the job requirements. Consider what additional insights would be valuable for candidate evaluation.`;
    }

    prompt += `\n\nPlease provide:
      1. 3-5 AI filter configurations that add value for this role
      2. Clear field definitions for each filter
      3. Detailed prompts for AI model processing
      4. Relevant metadata fields to include
      5. Reasoning for each filter choice

      Focus on filters that will help distinguish between qualified and unqualified candidates for this specific executive position.`;

    return prompt;
  }

  static getExamples(): Record<string, unknown> {
    return {
      skillsFilter: {
        name: "Technical Skills Assessment",
        description: "Evaluate candidate's technical skills against job requirements",
        category: "skills",
        fields: [
          { name: "primarySkillsMatch", type: "number", description: "Percentage match of primary technical skills (0-100)" },
          { name: "secondarySkillsMatch", type: "number", description: "Percentage match of secondary technical skills (0-100)" },
          { name: "skillLevel", type: "enum", description: "Overall technical skill level", enumValues: ["Beginner", "Intermediate", "Advanced", "Expert"] }
        ],
        prompt: "Analyze the candidate's technical skills and experience. Rate their match to the required skills on a scale of 0-100.",
        selectedMetadataFields: ["headline", "current_positions", "summary"]
      },
      seniorityFilter: {
        name: "Seniority Level Classification",
        description: "Classify candidate's seniority level based on role and experience",
        category: "seniority",
        fields: [
          { name: "seniorityLevel", type: "enum", description: "Classified seniority level", enumValues: ["Entry", "Mid", "Senior", "Executive", "C-Level"] },
          { name: "managementExperience", type: "boolean", description: "Has management or leadership experience" },
          { name: "teamSizeManaged", type: "number", description: "Largest team size managed (0 if no management experience)" }
        ],
        prompt: "Analyze the candidate's career progression and current role to determine their seniority level.",
        selectedMetadataFields: ["current_positions", "headline", "summary"]
      },
      locationFilter: {
        name: "Location and Relocation Analysis",
        description: "Analyze candidate's location preferences and relocation potential",
        category: "location",
        fields: [
          { name: "currentLocation", type: "text", description: "Candidate's current location" },
          { name: "relocationWillingness", type: "enum", description: "Likelihood of relocation", enumValues: ["Very Likely", "Likely", "Neutral", "Unlikely", "Very Unlikely"] },
          { name: "remoteWorkPreference", type: "boolean", description: "Prefers remote work arrangements" }
        ],
        prompt: "Analyze the candidate's location and determine their likelihood of relocating for this position.",
        selectedMetadataFields: ["location", "current_positions", "summary"]
      }
    };
  }
}
