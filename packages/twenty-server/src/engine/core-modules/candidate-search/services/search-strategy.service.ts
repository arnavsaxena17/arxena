import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { strategyExamplesSchema } from 'src/engine/core-modules/candidate-search/schemas/strategy-example.schema';
import {
  LinkedInClassicPeopleSearchRequest,
  LinkedInRecruiterPeopleSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { ClassicPeopleParameterName } from '../schemas/classic-people-search.schema';
import { searchStrategyTextSchema } from '../schemas/query-understanding.schema';
import {
  ClassicPeopleSearchStrategyResult, QueryUnderstanding, RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult
} from '../types/candidate-search-request.type';
import { TokenUsage } from '../utils/token-tracking.util';
import { StreamProcessingService } from './stream-processing.service';

@Injectable()
export class SearchStrategyService {
  private readonly logger = new Logger(SearchStrategyService.name);

  constructor(
    private readonly searchParametersPrompts: SearchParametersPrompts,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  /**
   * Format QueryUnderstanding as natural language text for passing between LLM calls
   */
  formatQueryUnderstandingAsText(queryUnderstanding: QueryUnderstanding, userMessage: string): string {
    const parts: string[] = [];

    parts.push(`ORIGINAL USER QUERY: "${userMessage}"`);
    parts.push('');

    parts.push('QUERY UNDERSTANDING:');
    parts.push(`Primary Role: ${queryUnderstanding.primaryRole}`);
    
    if (queryUnderstanding.roleVariations.length > 0) {
      parts.push(`Role Variations: ${queryUnderstanding.roleVariations.join(', ')} (${queryUnderstanding.roleVariations.length} variations)`);
    }

    if (queryUnderstanding.industry && queryUnderstanding.industry.length > 0) {
      parts.push(`Industry: ${queryUnderstanding.industry.join(', ')} (${queryUnderstanding.industry.length} industries)`);
    } else {
      parts.push('Industry: Not specified');
    }

    parts.push('Location Hierarchy:');
    parts.push(`  - Primary: ${queryUnderstanding.locationHierarchy.primary || 'Not specified'}`);
    if (queryUnderstanding.locationHierarchy.secondary && queryUnderstanding.locationHierarchy.secondary.length > 0) {
      parts.push(`  - Secondary: ${queryUnderstanding.locationHierarchy.secondary.join(', ')} (${queryUnderstanding.locationHierarchy.secondary.length} locations)`);
    }
    if (queryUnderstanding.locationHierarchy.regional) {
      parts.push(`  - Regional: ${queryUnderstanding.locationHierarchy.regional}`);
    }

    if (queryUnderstanding.companyPreferences) {
      parts.push('Company Preferences:');
      if (queryUnderstanding.companyPreferences.current && queryUnderstanding.companyPreferences.current.length > 0) {
        parts.push(`  - Current: ${queryUnderstanding.companyPreferences.current.join(', ')} (${queryUnderstanding.companyPreferences.current.length} companies)`);
      }
      if (queryUnderstanding.companyPreferences.past && queryUnderstanding.companyPreferences.past.length > 0) {
        parts.push(`  - Past: ${queryUnderstanding.companyPreferences.past.join(', ')} (${queryUnderstanding.companyPreferences.past.length} companies)`);
      }
      if (queryUnderstanding.companyPreferences.types && queryUnderstanding.companyPreferences.types.length > 0) {
        parts.push(`  - Types: ${queryUnderstanding.companyPreferences.types.join(', ')}`);
      }
    }

    if (queryUnderstanding.seniorityLevel) {
      parts.push(`Seniority Level: ${queryUnderstanding.seniorityLevel}`);
    }

    if (queryUnderstanding.domainContext) {
      parts.push(`Domain Context: ${queryUnderstanding.domainContext}`);
    }

    if (queryUnderstanding.skills && queryUnderstanding.skills.length > 0) {
      parts.push(`Skills: ${queryUnderstanding.skills.join(', ')}`);
    }

    if (queryUnderstanding.experienceRequirements) {
      parts.push(`Experience Requirements: ${queryUnderstanding.experienceRequirements}`);
    }

    if (queryUnderstanding.explicitRequirements.length > 0) {
      parts.push(`Explicit Requirements: ${queryUnderstanding.explicitRequirements.join(', ')}`);
    }

    if (queryUnderstanding.preferredRequirements.length > 0) {
      parts.push(`Preferred Requirements: ${queryUnderstanding.preferredRequirements.join(', ')}`);
    }

    if (queryUnderstanding.certifications && queryUnderstanding.certifications.length > 0) {
      const requiredCerts = queryUnderstanding.certifications.filter(c => c.required).map(c => c.name);
      const preferredCerts = queryUnderstanding.certifications.filter(c => !c.required).map(c => c.name);
      if (requiredCerts.length > 0) {
        parts.push(`Required Certifications: ${requiredCerts.join(', ')}`);
      }
      if (preferredCerts.length > 0) {
        parts.push(`Preferred Certifications: ${preferredCerts.join(', ')}`);
      }
    }

    if (queryUnderstanding.regulatoryExperience && queryUnderstanding.regulatoryExperience.length > 0) {
      parts.push(`Regulatory Experience: ${queryUnderstanding.regulatoryExperience.join(', ')}`);
    }

    if (queryUnderstanding.companyGroupPreferences && queryUnderstanding.companyGroupPreferences.length > 0) {
      parts.push(`Company Groups: ${queryUnderstanding.companyGroupPreferences.join(', ')}`);
    }

    if (queryUnderstanding.needsClarification) {
      parts.push(`Needs Clarification: Yes`);
      if (queryUnderstanding.clarificationQuestions && queryUnderstanding.clarificationQuestions.length > 0) {
        parts.push(`Clarification Questions: ${queryUnderstanding.clarificationQuestions.join('; ')}`);
      }
    }

    if (queryUnderstanding.clarificationAnswers) {
      parts.push(`Clarification Answers: ${queryUnderstanding.clarificationAnswers}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate search strategies as natural language text descriptions
   * Uses LLM to generate strategy descriptions based on query understanding and complexity
   */


   /**
   * Generate example boolean queries for strategy generation
   */

     /**
   * Fallback examples if LLM generation fails
   */
  private getFallbackExamples(): string {
    return `1. **Keywords-Only Strategies**: Embed location/company information in keywords
  - Example 1: "(("Software Engineer" OR "Developer") AND "San Francisco")"
  - Example 2: "(("Product Manager" OR "Product Lead") AND ("Microsoft" OR "Google"))"

    2. **Keywords + Location Strategies**: Use job titles in keywords, location as separate filter
      - Example 1: "Software Engineer" OR "Developer" OR "Programmer" (with location: San Francisco)
      - Example 2: "Product Manager" OR "Product Lead" (with location: New York)

    3. **Keywords + Location + Company Strategies**: Combine keywords, location, and company filters
      - Example 1: "VP Engineering" OR "Head of Engineering" (with location: Seattle, company: Microsoft)
      - Example 2: "Director of Product" OR "Product Director" (with location: San Francisco, company: Google, Apple)

    4. **Keywords + Location + Industry Strategies**: Combine keywords, location, and industry filters
      - Example 1: "Data Scientist" OR "ML Engineer" (with location: San Francisco, industry: Technology)
      - Example 2: "Marketing Manager" OR "Brand Manager" (with location: New York, industry: Marketing & Advertising)`;
  }


   private async getAvailableParameters(searchType: 'classic' | 'sales_navigator' | 'recruiter'): Promise<string> {
    if (searchType === 'classic') {
      return `Available parameters for Classic LinkedIn Search:
  - keywords: Job titles, role names, or search terms (required)
  - location: Geographic locations (city, state, country)
  - industry: Industry sectors
  - company: Current company names
  - past_company: Past company names
  - school: Educational institutions
  - profile_language: Profile language
  - network_distance: Connection degree (1st, 2nd, 3rd)
  - service: Service categories
  - connections_of: Connections of specific people
  - followers_of: Followers of specific entities
  - open_to: Open to opportunities
  - advanced_keywords: Advanced keyword filters (first_name, last_name, title, company, school)`;
    } else if (searchType === 'sales_navigator') {
      return `Available parameters for Sales Navigator Search:
  - keywords: Job titles, role names, or search terms (required)
  - location: Geographic locations (include/exclude)
  - industry: Industry sectors (include/exclude)
  - company: Current company names (include/exclude)
  - past_company: Past company names (include/exclude)
  - role: Job roles (include/exclude)
  - function: Job functions (include/exclude)
  - seniority: Seniority levels
  - school: Educational institutions (include/exclude)`;
    } else {
      return `Available parameters for Recruiter Search:
  - keywords: Job titles, role names, or search terms (required)
  - location: Geographic locations (include/exclude)
  - industry: Industry sectors (include/exclude)
  - company: Current company names (include/exclude)
  - past_company: Past company names (include/exclude)
  - role: Job roles (include/exclude)
  - seniority: Seniority levels
  - skills: Skills and competencies (include/exclude)
  - school: Educational institutions (include/exclude)`;
    }
  }

   private async getStrategyExamplesSystemPrompt(
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
  ): Promise<string> {
    const availableParameters = await this.getAvailableParameters(searchType);

    const classicKeywordLimit = searchType === 'classic' 
      ? `\n\n⚠️ CRITICAL FOR LINKEDIN CLASSIC: Keywords in boolean queries MUST have MAXIMUM 6 terms. Each term can be:
- A quoted phrase (e.g., "sales manager" counts as 1 term)
- An unquoted word separated by boolean operators (AND, OR, NOT)

When generating example queries for Classic search, ensure each example query has at most 6 keyword terms. If you need more role variations, create multiple example queries, each with max 6 terms.`
      : '';

    const sophisticatedBooleanGuidance = (searchType === 'sales_navigator' || searchType === 'recruiter')
      ? `\n\n🎯 SOPHISTICATED BOOLEAN QUERIES FOR ${searchType.toUpperCase().replace('_', ' ')}:
For ${searchType === 'sales_navigator' ? 'Sales Navigator' : 'Recruiter'} searches, you can create sophisticated boolean queries that capture different company nomenclatures by combining hierarchical terms (GM, VP, President, Head, etc.) with domain/functional terms (Operations, Sales, Plant, Unit, Works, Site, etc.).

EXAMPLES OF SOPHISTICATED BOOLEAN QUERIES:
1. For "Head of Operations": (Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head))
2. For "VP Sales": (Sales AND (VP OR "Vice President" OR vp)) OR (Sales AND (head OR director))
3. For "GM Marketing": (Marketing AND (GM OR "General Manager" OR gm)) OR (Marketing AND (head OR director OR vp))

PATTERN: (DomainTerm AND (HierarchicalTerm1 OR HierarchicalTerm2)) OR ((AlternativeDomainTerm1 OR AlternativeDomainTerm2) AND HierarchicalTerm)

These sophisticated queries work well in ${searchType === 'sales_navigator' ? 'Sales Navigator' : 'Recruiter'} but NOT in Classic (which has a 6-term limit).`
      : '';

    return `You are an expert recruiter and search strategist specializing in generating LinkedIn search query examples. Your task is to generate 10-15 example boolean queries that demonstrate different search strategies.

${availableParameters}
${classicKeywordLimit}
${sophisticatedBooleanGuidance}

YOUR TASK:
Generate 10-15 example boolean queries that can be put in the LinkedIn search bar. These queries should demonstrate different strategy types:

1. **Keywords-Only Strategies**: Embed location/company information in keywords using AND/OR operators
  Example: (("Software Engineer" OR "Developer" OR "Programmer") AND "San Francisco")
  ${searchType === 'classic' ? '⚠️ For Classic: Max 6 keyword terms per query' : ''}
  ${(searchType === 'sales_navigator' || searchType === 'recruiter') ? '💡 For Sales Navigator/Recruiter: Can use sophisticated boolean patterns combining hierarchical and domain terms' : ''}
  
2. **Keywords + Location Strategies**: Use job titles in keywords, location as separate filter
  Example: "Software Engineer" OR "Developer" OR "Programmer" (with location filter: San Francisco)
  ${searchType === 'classic' ? '⚠️ For Classic: Max 6 keyword terms in the keywords string' : ''}
  ${(searchType === 'sales_navigator' || searchType === 'recruiter') ? '💡 For Sales Navigator/Recruiter: Can use sophisticated boolean patterns in keywords' : ''}
  
3. **Keywords + Location + Industry Strategies**: Combine keywords, location, and industry
  Example: "Product Manager" OR "Product Lead" (with location: New York, industry: Technology)
  ${searchType === 'classic' ? '⚠️ For Classic: Max 6 keyword terms in the keywords string' : ''}
  ${(searchType === 'sales_navigator' || searchType === 'recruiter') ? '💡 For Sales Navigator/Recruiter: Can use sophisticated boolean patterns in keywords' : ''}
  
4. **Keywords + Location + Company Strategies**: Combine keywords, location, and company filters
  Example: "VP Engineering" OR "Head of Engineering" (with location: Seattle, company: Microsoft, Amazon)
  ${searchType === 'classic' ? '⚠️ For Classic: Max 6 keyword terms in the keywords string' : ''}
  ${(searchType === 'sales_navigator' || searchType === 'recruiter') ? '💡 For Sales Navigator/Recruiter: Can use sophisticated boolean patterns like (Engineering AND (VP OR head OR director))' : ''}
  ${(searchType === 'sales_navigator' || searchType === 'recruiter') ? '5. **Sophisticated Boolean Strategies**: For roles with hierarchical/domain components, use patterns like (DomainTerm AND (HierarchicalTerms)) OR ((AlternativeDomainTerms) AND HierarchicalTerm)' : ''}

For each strategy type, provide:
- The strategy type name
- 2-4 example boolean query strings (what you would type in the search bar)
- A brief description

Focus on:
- Using the role variations, locations, companies, and industries from the query understanding
- Creating realistic boolean queries that respect LinkedIn's search limitations
- Showing different ways to combine the same information
- Splitting role variations across multiple queries to stay within boolean limits
${searchType === 'classic' ? '- CRITICAL: For LinkedIn Classic, each example query must have MAXIMUM 6 keyword terms. Create multiple example queries if you need more role variations.' : ''}
${(searchType === 'sales_navigator' || searchType === 'recruiter') ? '- IMPORTANT: For Sales Navigator/Recruiter, include examples of sophisticated boolean queries that combine hierarchical and domain terms to capture different company nomenclatures.' : ''}

Return a JSON object with an array of examples, each containing the strategy type, example queries, and description.`;
  }

   private async generateStrategyExamples(
    openaiClient: OpenAI,
    queryUnderstandingText: string,
    userMessage: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    model: string = 'gpt-5.1-chat-latest',
  ): Promise<string> {
    const systemPrompt = await this.getStrategyExamplesSystemPrompt(searchType);
    const userPrompt = `QUERY UNDERSTANDING:
${queryUnderstandingText}

ORIGINAL USER QUERY:
"${userMessage}"

Generate example boolean queries based on the query understanding above.`;

    try {
      const stream = await this.streamProcessingService.createStreamingCompletion(
        openaiClient,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userPrompt },
        ],
        zodResponseFormat(strategyExamplesSchema, 'strategyExamples'),
        model,
      );

      const streamResult = await this.streamProcessingService.processStreamChunks(stream);
      const response = typeof streamResult === 'string' ? streamResult : streamResult.content;
      
      if (!response) {
        this.logger.warn('Failed to generate strategy examples, using fallback');
        return this.getFallbackExamples();
      }

      const parsed = JSON.parse(response);
      const validated = strategyExamplesSchema.parse(parsed);

      // Format examples for use in the prompt
      const formattedExamples = validated.examples.map((example, idx) => {
        const queries = example.exampleQueries.map((q, qIdx) => 
          `  - Example ${qIdx + 1}: "${q}"`
        ).join('\n');
        
        return `${idx + 1}. **${example.strategyType}**${example.description ? `: ${example.description}` : ''}:
${queries}`;
      }).join('\n\n');

      this.logger.log(`Formatted examples: ${formattedExamples}`);

      return formattedExamples;
    } catch (error) {
      this.logger.error(`Error generating strategy examples: ${error}`);
      return this.getFallbackExamples();
    }
  }



  
  async generateStrategies(
    openaiClient: OpenAI,
    queryUnderstandingText: string,
    userMessage: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    sendEvent?: (event: string, data: any) => boolean | void,
    model: string = 'gpt-5.1-chat-latest',
    onTokenUsage?: (usage: TokenUsage) => void,
  ): Promise<Array<{ strategyText: string; label?: string; }>> {
    this.logger.log(`Generating search strategies for model with query understanding: ${queryUnderstandingText} and user message: ${userMessage} and model: ${model}`);
    const isStreamAborted = sendEvent?.('status', { message: 'Generating search strategies...' });
    if (isStreamAborted === false) {
      this.logger.log('Stream aborted during strategy generation');
      // Return default strategy on abort
      return [{
        strategyText: `Use keywords (job titles) and location and industry`,
        label: 'Default Strategy',
      }];
    }


    // Generate dynamic examples based on query understanding
    const dynamicExamples = await this.generateStrategyExamples(
      openaiClient,
      queryUnderstandingText,
      userMessage,
      searchType,
      model,
    );
  
    

    const strategyGenerationPrompt = await this.searchParametersPrompts.getStrategyGenerationPrompt(
      queryUnderstandingText,
      userMessage,
      searchType,
      dynamicExamples,
      model,
    );



    const strategyGenerationSystemPrompt = await this.searchParametersPrompts.getStrategyGenerationSystemPrompt(
      searchType,
    );


    const strategyGenerationStream = await this.streamProcessingService.createStreamingCompletion(
      openaiClient,
      [
        { role: 'system' as const, content: strategyGenerationSystemPrompt },
        { role: 'user' as const, content: strategyGenerationPrompt },
      ],
      zodResponseFormat(searchStrategyTextSchema, 'searchStrategyText'),
      model,
    );

    const strategyGenerationResult = await this.streamProcessingService.processStreamChunks(strategyGenerationStream, sendEvent);
    const strategyGenerationResponse = typeof strategyGenerationResult === 'string' 
      ? strategyGenerationResult 
      : strategyGenerationResult.content;
    
    // Accumulate token usage if available
    if (typeof strategyGenerationResult !== 'string' && strategyGenerationResult.usage && onTokenUsage) {
      onTokenUsage(strategyGenerationResult.usage);
    }

    if (!strategyGenerationResponse) {
      this.logger.warn('Strategy generation returned empty content. Using default strategy.');
      return [{
        strategyText: `Use keywords (job titles) and location and industry`,
        label: 'Default Strategy',
      }];
    }

    try {
      const parsedStrategyGeneration = JSON.parse(strategyGenerationResponse);
      const validated = searchStrategyTextSchema.parse(parsedStrategyGeneration);
      this.logger.log(`Generated ${validated.strategies.length} search strategies`);
      
      return validated.strategies.map(s => ({
        strategyText: s.strategyText,
        label: s.label || undefined,
      }));
    } catch (error) {
      this.logger.error(`Failed to parse strategy generation: ${error}`);
      // Return default strategy on error
      return [{
        strategyText: `Use keywords (job titles) and location and industry`,
        label: 'Default Strategy',
      }];
    }
  }


  buildStrategyResult(
    parameters: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'> | 
                 Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'> | 
                 Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    strategyDef: {
      id: string;
      label: string;
      goal: string;
      description: string; // Can contain strategy text
      filterFocus: string; // Can contain strategy text
    },
  ): ClassicPeopleSearchStrategyResult | SalesNavigatorPeopleSearchStrategyResult | RecruiterPeopleSearchStrategyResult {
    if (searchType === 'classic') {
      return {
        ...strategyDef,
        parameterRationales: {} as Record<ClassicPeopleParameterName, string>,
        parameters: parameters as Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
      } as ClassicPeopleSearchStrategyResult;
    } else if (searchType === 'sales_navigator') {
      return {
        ...strategyDef,
        parameterRationales: {} as Record<string, string>,
        parameters: parameters as Omit<LinkedInSalesNavigatorPeopleSearchRequest, 'api' | 'category'>,
      } as SalesNavigatorPeopleSearchStrategyResult;
    } else {
      return {
        ...strategyDef,
        parameterRationales: {} as Record<string, string>,
        parameters: parameters as Omit<LinkedInRecruiterPeopleSearchRequest, 'api' | 'category'>,
      } as RecruiterPeopleSearchStrategyResult;
    }
  }
}

