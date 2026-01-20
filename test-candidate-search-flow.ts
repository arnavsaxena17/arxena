/**
 * Candidate Search Flow Test Script
 * 
 * This script tests the candidate search flow by:
 * 1. Reading requirements from leadership_requirements.txt
 * 2. For each requirement, running:
 *    - Query Understanding
 *    - Discovery (via strategy generation)
 *    - Strategy Generation (for all models)
 *    - Parameter Generation (for all models)
 *    - Model Comparison
 * 3. Running all tests in parallel
 * 4. Logging outputs and saving results to test-results.json and CSV
 * 
 * Configuration (see lines 33-45):
 *   - MODELS_TO_TEST: Array of models to test and compare
 *   - ENABLE_SEARCH_TYPES: Set to false to disable search type testing (faster)
 *   - DEFAULT_SEARCH_TYPE: Which search type to use when search types are disabled
 * 
 * Usage:
 *   export API_TOKEN=your_api_token_here
 *   export SERVER_URL=http://localhost:3000  # optional, defaults to localhost:3000
 *   npx ts-node test-candidate-search-flow.ts
 * 
 * Note: This script does NOT resolve parameters or make LinkedIn API calls.
 * It only tests the flow up to parameter generation and model comparison.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzhkZTU3ZC0xYzM2LTQyZmMtYTEyYy1kY2U4ZTVlM2Y1MWMiLCJ3b3Jrc3BhY2VJZCI6IjA0Nzk2ZWFkLWM0NDktNGJhOC1hY2FlLWM4YzgzNTNkZTM5ZCIsIndvcmtzcGFjZU1lbWJlcklkIjoiODNlMjYxYjYtZjk3Yy00OWI5LWFjMWEtMjM5ZDM2MGNiOTljIiwidXNlcldvcmtzcGFjZUlkIjoiNjJlMGYwN2QtNjhjMi00ZTZmLWJmMTgtYjFiNTI5ZWU0MjE3IiwiaWF0IjoxNzY4OTAwMzA2LCJleHAiOjE3NjkwODAzMDZ9.A-NKmmJrWKUBU70rzeDP5mctonOwgSeBuJazIcci4rI';
// Use process.cwd() to get the project root directory
const REQUIREMENTS_FILE = path.join(process.cwd(), 'leadership_requirements.txt');

// ============================================================================
// TEST CONFIGURATION - Easy to toggle between different test modes
// ============================================================================
// Models to test - used consistently across strategy and parameter generation
// const MODELS_TO_TEST = ['gpt-5.1-chat-latest', 'gpt-5-nano'];
const MODELS_TO_TEST = ['gpt-5.1-chat-latest'];

// Search type configuration
// Set to false to disable search types and only test models
// Set to true to test both models and search types (more comprehensive but slower)
const ENABLE_SEARCH_TYPES = false;
// const ENABLE_SEARCH_TYPES = true;

// Default search type to use when search types are disabled
// Options: 'classic' | 'sales_navigator' | 'recruiter'
const DEFAULT_SEARCH_TYPE: 'classic' | 'sales_navigator' | 'recruiter' = 'classic';
// ============================================================================

// Types
interface ParsedJobDescription {
  jobTitle: string;
  company: string;
  location: string;
  industry: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: 'entry_level' | 'mid_level' | 'senior_level' | 'executive';
  education: string[];
  keywords: string[];
  responsibilities: string[];
  qualifications: string[];
  benefits: string[];
  employmentType: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship';
  remoteWork: boolean;
  salaryRange: {
    min: number;
    max: number;
    currency: string;
  } | null;
}

interface QueryUnderstanding {
  needsClarification?: boolean;
  clarificationQuestions?: string[] | null;
  clarificationAnswers?: string | null;
  ambiguityReasons?: string[] | null;
  primaryRole: string;
  roleVariations: string[];
  industry?: string[] | null;
  locationHierarchy: {
    primary: string;
    secondary?: string[] | null;
    regional?: string | null;
  };
  companyPreferences?: {
    current?: string[] | null;
    past?: string[] | null;
    types?: string[] | null;
  } | null;
  seniorityLevel?: 'entry' | 'mid' | 'senior' | 'executive' | 'c_level' | null;
  domainContext?: string | null;
  skills?: string[] | null;
  experienceRequirements?: string | null;
  explicitRequirements: string[];
  preferredRequirements: string[];
  patternIdentification?: {
    identifiedPatterns: {
      specializedRole: {
        detected: boolean;
        confidence: number;
        reasoning: string | null;
      };
      companyDescription: {
        detected: boolean;
        confidence: number;
        description: string | null;
        reasoning: string | null;
      };
      instituteRequirement: {
        detected: boolean;
        confidence: number;
        instituteType: string | null;
        reasoning: string | null;
      };
    };
  } | null;
}

interface TestResult {
  requirement: string;
  queryUnderstanding?: QueryUnderstanding;
  clarificationQuestions?: string[];
  ambiguityReasons?: string[];
  clarificationAnswers?: string;
  resolvedQueryUnderstanding?: QueryUnderstanding;
  strategies?: Record<string, {
    strategies: any;
    timing: number;
    error: string | null;
  }>;
  searchParameters?: Record<string, {
    parameters: any;
    strategies?: any;
    timing: number;
    error: string | null;
  }> | any; // Can be comparison format or single result format
  // Results for each model (and optionally by search type)
  resultsByModel?: Record<string, Record<string, {
    strategies?: any[];
    parameters?: any;
    error?: string;
  }>>;
  // Legacy: Results for each search type (kept for backward compatibility)
  resultsBySearchType?: {
    classic?: {
      strategies?: any[];
      parameters?: any;
      error?: string;
    };
    sales_navigator?: {
      strategies?: any[];
      parameters?: any;
      error?: string;
    };
    recruiter?: {
      strategies?: any[];
      parameters?: any;
      error?: string;
    };
  };
  modelComparison?: {
    analysis: string;
    bestModel: string;
    reasoning: string;
    detailedComparison: any;
    timing: number;
  };
  error?: string;
  timing: {
    queryUnderstanding: number;
    clarificationAnswerGeneration: number;
    clarificationResolution: number;
    strategyGeneration: number;
    parameterGeneration: number;
    modelComparison: number;
    total: number;
  };
}

/**
 * Create a minimal ParsedJobDescription from requirement text
 */
function createParsedJobDescription(requirement: string): ParsedJobDescription {
  // Extract job title (first part before "for")
  const titleMatch = requirement.match(/^(.*?)\s+for\s+/i);
  const jobTitle = titleMatch ? titleMatch[1].trim() : 'Executive';

  // Extract location (look for common location patterns)
  const locationMatch = requirement.match(/\b(in|at|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const location = locationMatch ? locationMatch[2] : 'India';

  // Extract industry hints
  let industry = 'General';
  if (requirement.toLowerCase().includes('manufacturing')) industry = 'Manufacturing';
  else if (requirement.toLowerCase().includes('finance') || requirement.toLowerCase().includes('cfo')) industry = 'Finance';
  else if (requirement.toLowerCase().includes('hr') || requirement.toLowerCase().includes('chro')) industry = 'Human Resources';
  else if (requirement.toLowerCase().includes('tech') || requirement.toLowerCase().includes('cto') || requirement.toLowerCase().includes('cio')) industry = 'Technology';
  else if (requirement.toLowerCase().includes('legal') || requirement.toLowerCase().includes('counsel')) industry = 'Legal';
  else if (requirement.toLowerCase().includes('banking') || requirement.toLowerCase().includes('financial services')) industry = 'Banking';
  else if (requirement.toLowerCase().includes('pharma')) industry = 'Pharmaceuticals';
  else if (requirement.toLowerCase().includes('retail')) industry = 'Retail';

  // Extract company name if mentioned
  const companyMatch = requirement.match(/for\s+(?:a|an|the)?\s*([A-Z][a-zA-Z\s&]+?)(?:\s+in|\s+with|\s+Need|$)/);
  const company = companyMatch ? companyMatch[1].trim() : 'Company';

  // Extract keywords from requirement
  const keywords: string[] = [];
  const keywordPatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, // Capitalized phrases (company names, titles)
  ];
  keywordPatterns.forEach(pattern => {
    const matches = Array.from(requirement.matchAll(pattern));
    for (const match of matches) {
      if (match[1] && match[1].length > 2 && !keywords.includes(match[1])) {
        keywords.push(match[1]);
      }
    }
  });

  return {
    jobTitle,
    company,
    location,
    industry,
    requiredSkills: [],
    preferredSkills: [],
    experienceLevel: 'executive',
    education: [],
    keywords: keywords.slice(0, 10), // Limit to 10 keywords
    responsibilities: [],
    qualifications: [],
    benefits: [],
    employmentType: 'full_time',
    remoteWork: false,
    salaryRange: null,
  };
}

/**
 * Generate sample answers to clarification questions using LLM
 */
async function generateClarificationAnswers(
  originalQuery: string,
  clarificationQuestions: string[],
  index: number,
): Promise<string> {
  console.log(`[${index}] Generating sample answers to ${clarificationQuestions.length} clarification questions...`);
  
  try {
    // Create a prompt that generates realistic answers
    try {
      const openaiResponse = await axios.post(
        `${SERVER_URL}/candidate-search/test/generate-clarification-answers`,
        {
          originalQuery,
          clarificationQuestions,
        },
        {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const answers = openaiResponse.data?.answers || '';
      if (answers) {
        console.log(`[${index}] ✓ Generated clarification answers via LLM (${answers.length} chars)`);
        return answers;
      }
    } catch (error: any) {
      console.log(`[${index}] ⚠ LLM answer generation failed: ${error.message}, using fallback`);
    }
    
    // Fallback: create a simple combined answer
    const fallbackAnswers: string[] = [];
    clarificationQuestions.forEach((question) => {
      const lowerQuestion = question.toLowerCase();
      if (lowerQuestion.includes('location')) {
        fallbackAnswers.push(`Location: Bangalore, India`);
      } else if (lowerQuestion.includes('industry')) {
        fallbackAnswers.push(`Industry: Technology/SaaS`);
      } else if (lowerQuestion.includes('seniority') || lowerQuestion.includes('level')) {
        fallbackAnswers.push(`Seniority: Senior level`);
      } else if (lowerQuestion.includes('company')) {
        fallbackAnswers.push(`Company: Looking for candidates from top tech companies`);
      } else {
        fallbackAnswers.push(`Based on the original query requirements`);
      }
    });
    const fallbackAnswer = fallbackAnswers.join(' ');
    console.log(`[${index}] ✓ Generated clarification answers via fallback (${fallbackAnswer.length} chars)`);
    return fallbackAnswer;
  } catch (error: any) {
    console.log(`[${index}] ⚠ Failed to generate clarification answers: ${error.message}, using fallback`);
    // Fallback: create simple answers
    const fallbackAnswers: string[] = [];
    clarificationQuestions.forEach((question) => {
      const lowerQuestion = question.toLowerCase();
      if (lowerQuestion.includes('location')) {
        fallbackAnswers.push(`Location: Bangalore, India`);
      } else if (lowerQuestion.includes('industry')) {
        fallbackAnswers.push(`Industry: Technology/SaaS`);
      } else if (lowerQuestion.includes('seniority') || lowerQuestion.includes('level')) {
        fallbackAnswers.push(`Seniority: Senior level`);
      } else if (lowerQuestion.includes('company')) {
        fallbackAnswers.push(`Company: Looking for candidates from top tech companies`);
      } else {
        fallbackAnswers.push(`Based on the original query requirements`);
      }
    });
    return fallbackAnswers.join(' ');
  }
}



// function calculateCost(
//   model: string,
//   inputTokens: number,
//   outputTokens: number,
//   cachedTokens?: number,
// ): { inputCost: number; outputCost: number; cachedCost?: number; totalCost: number } {
//   const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-5.1-chat-latest'];
//   const inputCost = (inputTokens / 1_000_000) * pricing.input;
//   const outputCost = (outputTokens / 1_000_000) * pricing.output;
//   let cachedCost: number | undefined;
//   if (cachedTokens && cachedTokens > 0 && pricing.cachedInput) {
//     cachedCost = (cachedTokens / 1_000_000) * pricing.cachedInput;
//     const nonCachedInputTokens = inputTokens - cachedTokens;
//     const adjustedInputCost = (nonCachedInputTokens / 1_000_000) * pricing.input;
//     return {
//       inputCost: adjustedInputCost,
//       outputCost,
//       cachedCost,
//       totalCost: adjustedInputCost + cachedCost + outputCost,
//     };
//   }
//   return {
//     inputCost,
//     outputCost,
//     cachedCost,
//     totalCost: inputCost + outputCost,
//   };
// }

async function processRequirement(requirement: string, index: number): Promise<TestResult> {
  const startTime = Date.now();

  const result: TestResult = {
    requirement,
    timing: {
      queryUnderstanding: 0,
      clarificationAnswerGeneration: 0,
      clarificationResolution: 0,
      strategyGeneration: 0,
      parameterGeneration: 0,
      modelComparison: 0,
      total: 0,
    },
  };

  console.log(`\n[${index}] Processing: ${requirement.substring(0, 80)}...`);

  try {
    const parsedJD = createParsedJobDescription(requirement);
    const searchCategory: 'people' | 'companies' | 'posts' | 'jobs' = 'people';

    // Step 1: Query Understanding
    console.log(`[${index}] Step 1: Query Understanding...`);
    const queryUnderstandingStart = Date.now();
    try {
      const queryUnderstandingResponse = await axios.post(
        `${SERVER_URL}/candidate-search/test/understand-query`,
        {
          prompt: requirement,
          rawJDText: '',
          isClarificationResponse: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      result.queryUnderstanding = queryUnderstandingResponse.data.queryUnderstanding;
      result.timing.queryUnderstanding = Date.now() - queryUnderstandingStart;
      

      
      console.log(`[${index}] ✓ Query Understanding completed (${result.timing.queryUnderstanding}ms)`);
      console.log(`[${index}]   Primary Role: ${result.queryUnderstanding?.primaryRole || 'N/A'}`);
      
      // Log discovery results if available
      if (result.queryUnderstanding?.patternIdentification) {
        const patterns = result.queryUnderstanding.patternIdentification.identifiedPatterns;
        const discoveredPatterns: string[] = [];
        if (patterns.specializedRole?.detected) {
          discoveredPatterns.push(`Specialized Role (${(patterns.specializedRole.confidence * 100).toFixed(0)}%)`);
        }
        if (patterns.companyDescription?.detected) {
          discoveredPatterns.push(`Company Description (${(patterns.companyDescription.confidence * 100).toFixed(0)}%)`);
        }
        if (patterns.instituteRequirement?.detected) {
          discoveredPatterns.push(`Institute Requirement (${(patterns.instituteRequirement.confidence * 100).toFixed(0)}%)`);
        }
        if (discoveredPatterns.length > 0) {
          console.log(`[${index}]   Discovery: ${discoveredPatterns.join(', ')}`);
        }
      }
      
      // Log discovered enhancements
      if (result.queryUnderstanding?.roleVariations && result.queryUnderstanding.roleVariations.length > 0) {
        console.log(`[${index}]   Discovered Role Variations: ${result.queryUnderstanding.roleVariations.length}`);
      }
      if (result.queryUnderstanding?.companyPreferences?.current && result.queryUnderstanding.companyPreferences.current.length > 0) {
        console.log(`[${index}]   Discovered Companies: ${result.queryUnderstanding.companyPreferences.current.length}`);
      }
      
      // Check if clarification is needed (ambiguity detection)
      if (result.queryUnderstanding?.needsClarification) {
        console.log(`[${index}]   Needs Clarification: Yes`);
        result.clarificationQuestions = result.queryUnderstanding.clarificationQuestions || [];
        result.ambiguityReasons = result.queryUnderstanding.ambiguityReasons || [];
        
        // Display ambiguity reasons (why clarification is needed)
        if (result.ambiguityReasons && result.ambiguityReasons.length > 0) {
          console.log(`[${index}] ⚠ Ambiguity Detected: ${result.ambiguityReasons.length} reason(s)`);
          result.ambiguityReasons.forEach((reason, i) => {
            console.log(`[${index}]   Ambiguity ${i + 1}: ${reason}`);
          });
        }
        
        console.log(`[${index}] ⚠ Clarification needed: ${result.clarificationQuestions.length} questions`);
        result.clarificationQuestions.forEach((q, i) => {
          console.log(`[${index}]   Q${i + 1}: ${q}`);
        });
        
        // Step 1.5: Generate sample answers to clarification questions
        const answerGenerationStart = Date.now();
        result.clarificationAnswers = await generateClarificationAnswers(
          requirement,
          result.clarificationQuestions,
          index,
        );
        result.timing.clarificationAnswerGeneration = Date.now() - answerGenerationStart;
        console.log(`[${index}] ✓ Generated clarification answers (${result.timing.clarificationAnswerGeneration}ms)`);
        console.log(`[${index}]   Answers: ${result.clarificationAnswers.substring(0, 100)}...`);
        
        // Step 1.6: Resolve clarification by calling understand-query again with combined query
        const clarificationResolutionStart = Date.now();
        console.log(`[${index}] Step 1.6: Resolving clarification...`);
        try {
          // Build combined query (similar to buildClarificationResponseCombinedQuery)
          const combinedQuery = `ORIGINAL USER QUERY (preserve ALL information from this):
            "${requirement}"

            USER'S CLARIFICATION ANSWERS (merge these with the original query):
            "${result.clarificationAnswers}"

            INSTRUCTIONS:
            - Extract and preserve ALL information from the original query (role, company, industry, etc.)
            - Extract answers from the clarification response and merge them with the original query
            - The combined result should have ALL information from both the original query AND the clarification
            - Do NOT lose any information from the original query when merging`;
                      
          const resolvedQueryUnderstandingResponse = await axios.post(
            `${SERVER_URL}/candidate-search/test/understand-query`,
            {
              prompt: combinedQuery,
              rawJDText: '',
              isClarificationResponse: true,
            },
            {
              headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
              },
            }
          );
          result.resolvedQueryUnderstanding = resolvedQueryUnderstandingResponse.data.queryUnderstanding;
          result.timing.clarificationResolution = Date.now() - clarificationResolutionStart;
          
          // Log token usage if available
          if (resolvedQueryUnderstandingResponse.data.tokenUsage) {
            const usage = resolvedQueryUnderstandingResponse.data.tokenUsage;
            const model = resolvedQueryUnderstandingResponse.data.model || 'gpt-5.1-chat-latest';

            console.log(`[${index}]   Tokens: ${usage.promptTokens} input + ${usage.completionTokens} output = ${usage.totalTokens} total`);
          }
          
          console.log(`[${index}] ✓ Clarification resolved (${result.timing.clarificationResolution}ms)`);
          console.log(`[${index}]   Resolved Primary Role: ${result.resolvedQueryUnderstanding?.primaryRole || 'N/A'}`);
          
          // Use resolved query understanding for subsequent steps
          result.queryUnderstanding = result.resolvedQueryUnderstanding;
        } catch (error: any) {
          console.log(`[${index}] ⚠ Clarification resolution failed: ${error.message}, continuing with original understanding`);
          result.timing.clarificationResolution = Date.now() - clarificationResolutionStart;
          // Continue with original query understanding
        }
      }
      else{
        console.log(`[${index}]   Needs Clarification: No`);
        console.log(`[${index}]   Primary Role: ${result.queryUnderstanding?.primaryRole || 'N/A'}`);
        if (result.queryUnderstanding?.ambiguityReasons === null || 
            (result.queryUnderstanding?.ambiguityReasons && result.queryUnderstanding.ambiguityReasons.length === 0)) {
          console.log(`[${index}]   Ambiguity Check: No ambiguity detected`);
        }
      }
    } catch (error: any) {
      result.error = `Query Understanding failed: ${error.message}`;
      result.timing.queryUnderstanding = Date.now() - queryUnderstandingStart;
      console.log(`[${index}] ✗ Query Understanding failed: ${error.message}`);
      throw error;
    }

    // Step 2: Parameter Generation for all models
    // NOTE: Strategy generation happens internally within parameter generation to avoid duplication
    const searchTypesToTest = ENABLE_SEARCH_TYPES 
      ? ['classic', 'sales_navigator', 'recruiter'] as Array<'classic' | 'sales_navigator' | 'recruiter'>
      : [DEFAULT_SEARCH_TYPE];
    
    console.log(`[${index}] Step 2: Parameter Generation for all models (${MODELS_TO_TEST.join(', ')})...`);
    if (ENABLE_SEARCH_TYPES) {
      console.log(`[${index}]   Testing search types: ${searchTypesToTest.join(', ')}`);
    } else {
      console.log(`[${index}]   Using search type: ${DEFAULT_SEARCH_TYPE} (search types disabled)`);
    }
    
    const parameterStart = Date.now();
    
    // Use combined query if clarification was resolved, otherwise use original requirement
    const promptForParameters = result.clarificationAnswers && result.resolvedQueryUnderstanding
      ? `ORIGINAL USER QUERY (preserve ALL information from this):
"${requirement}"

USER'S CLARIFICATION ANSWERS (merge these with the original query):
"${result.clarificationAnswers}"

INSTRUCTIONS:
- Extract and preserve ALL information from the original query (role, company, industry, etc.)
- Extract answers from the clarification response and merge them with the original query
- The combined result should have ALL information from both the original query AND the clarification
- Do NOT lose any information from the original query when merging`
      : requirement;
    
    // Models to compare - use the shared constant
    const models = MODELS_TO_TEST;
    
    // Store results by model (and optionally by search type)
    result.resultsByModel = {};
    result.strategies = {};
    result.searchParameters = {};
    
    // Generate parameters for each model
    for (const model of models) {
      console.log(`[${index}]   Processing model: ${model}...`);
      result.resultsByModel[model] = {};
      result.strategies[model] = {
        strategies: null,
        timing: 0,
        error: null,
      };
      result.searchParameters[model] = {
        parameters: null,
        strategies: null,
        timing: 0,
        error: null,
      };
      
      // For each search type (or just the default one)
      for (const searchType of searchTypesToTest) {
        const modelStart = Date.now();
        
        try {
          const parameterResponse = await axios.post(
            `${SERVER_URL}/candidate-search/test/generate-search-parameters`,
            {
              prompt: promptForParameters,
              parsedJobDescription: parsedJD,
              searchType,
              searchCategory,
              queryUnderstanding: result.queryUnderstanding,
              model,
            },
            {
              headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          const modelTime = Date.now() - modelStart;
          
          // Store results by model (use the first search type's results as primary, or combine if needed)
          if (!result.resultsByModel[model][searchType]) {
            result.resultsByModel[model][searchType] = {
              strategies: parameterResponse.data.searchStrategies || [],
              parameters: parameterResponse.data.searchParameters || {},
              error: undefined,
            };
          }
          
          // Store primary results (from first search type or default)
          if (searchType === searchTypesToTest[0]) {
            result.strategies[model] = {
              strategies: parameterResponse.data.searchStrategies || [],
              timing: modelTime,
              error: null,
            };
            result.searchParameters[model] = {
              parameters: parameterResponse.data.searchParameters || {},
              strategies: parameterResponse.data.searchStrategies || [],
              timing: modelTime,
              error: null,
            };
          }
          
          const paramKeys = Object.keys(parameterResponse.data.searchParameters || {}).filter(
            k => parameterResponse.data.searchParameters[k] !== null && parameterResponse.data.searchParameters[k] !== undefined
          );
          const strategyCount = (parameterResponse.data.searchStrategies || []).length;
          
          const searchTypeLabel = ENABLE_SEARCH_TYPES ? ` (${searchType})` : '';
          console.log(`[${index}]     ✓ ${model}${searchTypeLabel}: ${paramKeys.length} parameter fields, ${strategyCount} strategies (${modelTime}ms)`);
        } catch (error: any) {
          const modelTime = Date.now() - modelStart;
          if (searchType === searchTypesToTest[0]) {
            result.strategies[model] = {
              strategies: null,
              timing: modelTime,
              error: error.message,
            };
            result.searchParameters[model] = {
              parameters: null,
              strategies: null,
              timing: modelTime,
              error: error.message,
            };
          }
          if (!result.resultsByModel[model][searchType]) {
            result.resultsByModel[model][searchType] = {
              strategies: [],
              parameters: {},
              error: error.message,
            };
          }
          const searchTypeLabel = ENABLE_SEARCH_TYPES ? ` (${searchType})` : '';
          console.log(`[${index}]     ✗ ${model}${searchTypeLabel}: Failed - ${error.message}`);
        }
      }
    }
    
    result.timing.parameterGeneration = Date.now() - parameterStart;
    result.timing.strategyGeneration = 0; // Strategies generated as part of parameter generation
    console.log(`[${index}] ✓ Parameter Generation for all models completed (${result.timing.parameterGeneration}ms)`);

    
    return result;
  } catch (error: any) {
    result.timing.total = Date.now() - startTime;
    result.error = error.message || 'Unknown error';
    console.log(`[${index}] ✗ Failed after ${result.timing.total}ms: ${result.error}`);
    return result;
  }
}

/**
 * Read requirements from file and extract 10-15 requirements
 */
function extractRequirements(): string[] {
  const content = fs.readFileSync(REQUIREMENTS_FILE, 'utf-8');
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Filter out section headers (lines that are just category names with numbers)
  const requirements = lines.filter(line => {
    // Skip lines that look like headers: "Category Name (number)" or just "Category Name"
    if (/^[A-Z][a-z\s&]+(\s+\(\d+\))?$/.test(line) && !line.includes('for') && !line.includes('Looking')) {
      return false;
    }
    // Skip empty lines and very short lines
    if (line.length < 20) {
      return false;
    }
    return true;
  });

  // Take 10-15 requirements (let's take 12)
  return requirements.slice(0,1);
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Candidate Search Flow Test');
  console.log('='.repeat(80));
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`API Token: ${API_TOKEN ? '***' + API_TOKEN.slice(-4) : 'NOT SET'}`);
  console.log(`Requirements File: ${REQUIREMENTS_FILE}`);
  console.log('='.repeat(80));

  if (!API_TOKEN) {
    console.error('\n❌ ERROR: API_TOKEN environment variable is required');
    console.error('   Set it with: export API_TOKEN=your_token_here');
    process.exit(1);
  }

  if (!fs.existsSync(REQUIREMENTS_FILE)) {
    console.error(`\n❌ ERROR: Requirements file not found: ${REQUIREMENTS_FILE}`);
    process.exit(1);
  }

  const requirements = extractRequirements();
  console.log(`\n📋 Found ${requirements.length} requirements to process\n`);

  // Process all requirements in parallel
  console.log('🚀 Starting parallel processing...\n');
  const startTime = Date.now();
  
  const results = await Promise.all(
    requirements.map((req, index) => processRequirement(req, index + 1))
  );

  const totalTime = Date.now() - startTime;
 
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Requirements: ${requirements.length}`);
  console.log(`Total Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log(`Average Time per Requirement: ${(totalTime / requirements.length).toFixed(0)}ms`);

  const successful = results.filter(r => !r.error || (r.queryUnderstanding && r.searchParameters));
  const failed = results.filter(r => r.error && (!r.queryUnderstanding || !r.searchParameters));
  const withClarification = results.filter(r => r.queryUnderstanding?.needsClarification);
  const withAmbiguity = results.filter(r => r.ambiguityReasons && r.ambiguityReasons.length > 0);

  console.log(`\n✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⚠️  Required Clarification: ${withClarification.length}`);
  console.log(`🔍 Ambiguity Detected: ${withAmbiguity.length}`);

  // Detailed results
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(80));

  console.log(results);

  console.log('\n' + '='.repeat(80));
  console.log('Test completed!');
  console.log('='.repeat(80));
}



// Run the test
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
