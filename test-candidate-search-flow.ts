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
const API_TOKEN = process.env.API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzhkZTU3ZC0xYzM2LTQyZmMtYTEyYy1kY2U4ZTVlM2Y1MWMiLCJ3b3Jrc3BhY2VJZCI6IjA0Nzk2ZWFkLWM0NDktNGJhOC1hY2FlLWM4YzgzNTNkZTM5ZCIsIndvcmtzcGFjZU1lbWJlcklkIjoiODNlMjYxYjYtZjk3Yy00OWI5LWFjMWEtMjM5ZDM2MGNiOTljIiwidXNlcldvcmtzcGFjZUlkIjoiNjJlMGYwN2QtNjhjMi00ZTZmLWJmMTgtYjFiNTI5ZWU0MjE3IiwiaWF0IjoxNzY4NTcxNjU1LCJleHAiOjE3Njg3NTE2NTV9.V-WCu2RsZjNOoNRkGpQBmJEoUkuIaaoIfc1beZDIsOI';
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

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

interface CostBreakdown {
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  inputCost: number;
  outputCost: number;
  cachedCost?: number;
  totalCost: number;
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
  tokenUsage?: {
    byStage: Record<string, TokenUsage[]>;
    total: TokenUsage;
  };
  costs?: {
    byStage: CostBreakdown[];
    total: {
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCachedTokens: number;
      totalInputCost: number;
      totalOutputCost: number;
      totalCachedCost: number;
      totalCost: number;
    };
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
 * Compare models using LLM to determine which model generates the best strategies and parameters
 */
async function compareModelsWithLLM(
  requirement: string,
  queryUnderstanding: QueryUnderstanding | undefined,
  strategiesByModel: Record<string, { strategies: any; timing: number; error: string | null }> | undefined,
  parametersByModel: Record<string, { parameters: any; strategies: any; timing: number; error: string | null }> | undefined,
  index: number,
): Promise<{
  analysis: string;
  bestModel: string;
  reasoning: string;
  detailedComparison: any;
  timing: number;
}> {
  // Format the comparison data - use the shared constant
  const models = MODELS_TO_TEST;
  
  // Skip comparison if there's only one model - nothing to compare
  if (models.length <= 1) {
    const singleModel = models[0] || 'unknown';
    console.log(`[${index}] Skipping model comparison (only 1 model: ${singleModel})`);
    return {
      analysis: `Only one model tested (${singleModel}), no comparison needed.`,
      bestModel: singleModel,
      reasoning: `Single model test - ${singleModel} is automatically the best model.`,
      detailedComparison: {
        [singleModel]: {
          overallScore: 10,
          strategyScore: 10,
          parameterScore: 10,
          strengths: ['Only model tested'],
          weaknesses: [],
          summary: 'Single model test - no comparison performed',
        },
      },
      timing: 0,
    };
  }
  
  console.log(`[${index}] Comparing models using LLM...`);
  
  try {
    
    const comparisonData: any = {
      originalQuery: requirement,
      queryUnderstanding: queryUnderstanding ? {
        primaryRole: queryUnderstanding.primaryRole,
        roleVariations: queryUnderstanding.roleVariations,
        industry: queryUnderstanding.industry,
        locationHierarchy: queryUnderstanding.locationHierarchy,
        seniorityLevel: queryUnderstanding.seniorityLevel,
        skills: queryUnderstanding.skills,
      } : null,
      modelResults: {},
    };
    
    // Format results for each model
    for (const model of models) {
      const strategyResult = strategiesByModel?.[model];
      const parameterResult = parametersByModel?.[model];
      
      comparisonData.modelResults[model] = {
        strategies: {
          count: strategyResult?.error ? 0 : (strategyResult?.strategies?.length || 0),
          strategies: strategyResult?.error ? null : strategyResult?.strategies,
          timing: strategyResult?.timing || 0,
          error: strategyResult?.error || null,
        },
        parameters: {
          fields: parameterResult?.error ? 0 : (Object.keys(parameterResult?.parameters || {}).filter(
            k => parameterResult?.parameters[k] !== null && parameterResult?.parameters[k] !== undefined
          ).length || 0),
          parameters: parameterResult?.error ? null : parameterResult?.parameters,
          timing: parameterResult?.timing || 0,
          error: parameterResult?.error || null,
        },
      };
    }
    
    // Create comparison prompt
    try {
      const comparisonResponse = await axios.post(
        `${SERVER_URL}/candidate-search/test/compare-models`,
        {
          requirement,
          queryUnderstanding,
          strategiesByModel: strategiesByModel || {},
          parametersByModel: parametersByModel || {},
        },
        {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const comparisonResult = comparisonResponse.data;
      
      return {
        analysis: comparisonResult.analysis || 'Analysis unavailable',
        bestModel: comparisonResult.bestModel || 'unknown',
        reasoning: comparisonResult.reasoning || 'Reasoning unavailable',
        detailedComparison: comparisonResult.detailedComparison || {},
        timing: 0, // Will be set by caller
      };
    } catch (error: any) {
      console.log(`[${index}] ⚠ LLM comparison failed: ${error.message}, using fallback analysis`);
      
      // Fallback: simple heuristic-based comparison
      let bestModel = models[0] || 'unknown';
      let bestScore = 0;
      const scores: Record<string, number> = {};
      
      for (const model of models) {
        const strategyResult = strategiesByModel?.[model];
        const parameterResult = parametersByModel?.[model];
        
        let score = 0;
        if (strategyResult && !strategyResult.error) {
          score += (strategyResult.strategies?.length || 0) * 2;
        }
        if (parameterResult && !parameterResult.error) {
          const paramCount = Object.keys(parameterResult.parameters || {}).filter(
            k => parameterResult.parameters[k] !== null && parameterResult.parameters[k] !== undefined
          ).length;
          score += paramCount;
        }
        
        scores[model] = score;
        if (score > bestScore) {
          bestScore = score;
          bestModel = model;
        }
      }
      
      return {
        analysis: `Heuristic comparison based on strategy count and parameter completeness. Scores: ${JSON.stringify(scores)}`,
        bestModel,
        reasoning: `Model ${bestModel} scored highest with ${bestScore} points based on strategy count and parameter completeness.`,
        detailedComparison: scores,
        timing: 0,
      };
    }
  } catch (error: any) {
    console.log(`[${index}] ⚠ Model comparison error: ${error.message}`);
    return {
      analysis: `Comparison failed: ${error.message}`,
      bestModel: 'unknown',
      reasoning: 'Unable to perform comparison due to error',
      detailedComparison: {},
      timing: 0,
    };
  }
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

/**
 * Process a single requirement through the candidate search flow
 */
// Model pricing (per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; cachedInput?: number; output: number }> = {
  'gpt-5.1-chat-latest': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-5.2-chat-latest': { input: 1.75, cachedInput: 0.175, output: 14.00 },
  'gpt-5-chat-latest': { input: 1.25, cachedInput: 0.125, output: 10.00 },
  'gpt-4o': { input: 2.50, cachedInput: 1.25, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.60 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens?: number,
): { inputCost: number; outputCost: number; cachedCost?: number; totalCost: number } {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-5.1-chat-latest'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  let cachedCost: number | undefined;
  if (cachedTokens && cachedTokens > 0 && pricing.cachedInput) {
    cachedCost = (cachedTokens / 1_000_000) * pricing.cachedInput;
    const nonCachedInputTokens = inputTokens - cachedTokens;
    const adjustedInputCost = (nonCachedInputTokens / 1_000_000) * pricing.input;
    return {
      inputCost: adjustedInputCost,
      outputCost,
      cachedCost,
      totalCost: adjustedInputCost + cachedCost + outputCost,
    };
  }
  return {
    inputCost,
    outputCost,
    cachedCost,
    totalCost: inputCost + outputCost,
  };
}

async function processRequirement(requirement: string, index: number): Promise<TestResult> {
  const startTime = Date.now();
  const tokenUsageByStage: Record<string, TokenUsage[]> = {};
  const costBreakdowns: CostBreakdown[] = [];
  
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
      
      // Log token usage if available
      if (queryUnderstandingResponse.data.tokenUsage) {
        const usage = queryUnderstandingResponse.data.tokenUsage;
        if (!tokenUsageByStage['query_understanding']) {
          tokenUsageByStage['query_understanding'] = [];
        }
        tokenUsageByStage['query_understanding'].push(usage);
        
        const model = queryUnderstandingResponse.data.model || 'gpt-5.1-chat-latest';
        const cost = calculateCost(model, usage.promptTokens, usage.completionTokens, usage.cachedTokens);
        costBreakdowns.push({
          stage: 'query_understanding',
          model,
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          cachedTokens: usage.cachedTokens,
          ...cost,
        });
        
        console.log(`[${index}]   Tokens: ${usage.promptTokens} input + ${usage.completionTokens} output = ${usage.totalTokens} total`);
        console.log(`[${index}]   Cost: $${cost.totalCost.toFixed(6)} (Input: $${cost.inputCost.toFixed(6)}, Output: $${cost.outputCost.toFixed(6)})`);
      }
      
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
            if (!tokenUsageByStage['clarification_resolution']) {
              tokenUsageByStage['clarification_resolution'] = [];
            }
            tokenUsageByStage['clarification_resolution'].push(usage);
            
            const model = resolvedQueryUnderstandingResponse.data.model || 'gpt-5.1-chat-latest';
            const cost = calculateCost(model, usage.promptTokens, usage.completionTokens, usage.cachedTokens);
            costBreakdowns.push({
              stage: 'clarification_resolution',
              model,
              inputTokens: usage.promptTokens,
              outputTokens: usage.completionTokens,
              cachedTokens: usage.cachedTokens,
              ...cost,
            });
            
            console.log(`[${index}]   Tokens: ${usage.promptTokens} input + ${usage.completionTokens} output = ${usage.totalTokens} total`);
            console.log(`[${index}]   Cost: $${cost.totalCost.toFixed(6)}`);
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
        // Log that no ambiguity was detected
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
          
          // Log token usage if available
          if (parameterResponse.data.tokenUsage) {
            const usage = parameterResponse.data.tokenUsage;
            const stageKey = `parameter_generation_${model}_${searchType}`;
            if (!tokenUsageByStage[stageKey]) {
              tokenUsageByStage[stageKey] = [];
            }
            tokenUsageByStage[stageKey].push(usage);
            
            const cost = calculateCost(model, usage.promptTokens, usage.completionTokens, usage.cachedTokens);
            costBreakdowns.push({
              stage: stageKey,
              model,
              inputTokens: usage.promptTokens,
              outputTokens: usage.completionTokens,
              cachedTokens: usage.cachedTokens,
              ...cost,
            });
            
            console.log(`[${index}]     Tokens: ${usage.promptTokens} input + ${usage.completionTokens} output = ${usage.totalTokens} total`);
            console.log(`[${index}]     Cost: $${cost.totalCost.toFixed(6)}`);
          }
          
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

    // Step 3: Model Comparison
    console.log(`[${index}] Step 3: Comparing models...`);
    const comparisonStart = Date.now();
    const modelComparison = await compareModelsWithLLM(
      requirement,
      result.queryUnderstanding,
      result.strategies,
      result.searchParameters,
      index,
    );
    result.modelComparison = {
      ...modelComparison,
      timing: Date.now() - comparisonStart,
    };
    result.timing.modelComparison = Date.now() - comparisonStart;
    console.log(`[${index}] ✓ Model comparison completed (${result.timing.modelComparison}ms)`);
    console.log(`[${index}]   Best Model: ${result.modelComparison.bestModel}`);

    result.timing.total = Date.now() - startTime;
    
    // Calculate total token usage
    const totalUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
    };
    
    for (const stageUsages of Object.values(tokenUsageByStage)) {
      for (const usage of stageUsages) {
        totalUsage.promptTokens += usage.promptTokens;
        totalUsage.completionTokens += usage.completionTokens;
        totalUsage.totalTokens += usage.totalTokens;
        totalUsage.cachedTokens = (totalUsage.cachedTokens || 0) + (usage.cachedTokens || 0);
      }
    }
    
    // Calculate total costs
    const totalCosts = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      totalInputCost: 0,
      totalOutputCost: 0,
      totalCachedCost: 0,
      totalCost: 0,
    };
    
    for (const cost of costBreakdowns) {
      totalCosts.totalInputTokens += cost.inputTokens;
      totalCosts.totalOutputTokens += cost.outputTokens;
      totalCosts.totalCachedTokens += (cost.cachedTokens || 0);
      totalCosts.totalInputCost += cost.inputCost;
      totalCosts.totalOutputCost += cost.outputCost;
      totalCosts.totalCachedCost += (cost.cachedCost || 0);
      totalCosts.totalCost += cost.totalCost;
    }
    
    result.tokenUsage = {
      byStage: tokenUsageByStage,
      total: totalUsage,
    };
    
    result.costs = {
      byStage: costBreakdowns,
      total: totalCosts,
    };
    
    console.log(`[${index}] ✓ Completed in ${result.timing.total}ms`);
    console.log(`[${index}] 📊 Total Tokens: ${totalUsage.promptTokens} input + ${totalUsage.completionTokens} output = ${totalUsage.totalTokens} total`);
    console.log(`[${index}] 💰 Total Cost: $${totalCosts.totalCost.toFixed(6)} (Input: $${totalCosts.totalInputCost.toFixed(6)}, Output: $${totalCosts.totalOutputCost.toFixed(6)})`);
    
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

  // Calculate aggregate token usage and costs
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let totalCost = 0;
  let totalInputCost = 0;
  let totalOutputCost = 0;
  let totalCachedCost = 0;

  for (const result of results) {
    if (result.costs?.total) {
      totalInputTokens += result.costs.total.totalInputTokens;
      totalOutputTokens += result.costs.total.totalOutputTokens;
      totalCachedTokens += result.costs.total.totalCachedTokens;
      totalCost += result.costs.total.totalCost;
      totalInputCost += result.costs.total.totalInputCost;
      totalOutputCost += result.costs.total.totalOutputCost;
      totalCachedCost += result.costs.total.totalCachedCost;
    }
  }

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

  // Print token and cost summary
  console.log('\n' + '='.repeat(80));
  console.log('TOKEN USAGE & COST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Input Tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`Total Output Tokens: ${totalOutputTokens.toLocaleString()}`);
  if (totalCachedTokens > 0) {
    console.log(`Total Cached Tokens: ${totalCachedTokens.toLocaleString()}`);
  }
  console.log(`Total Tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`\n💰 Total Cost: $${totalCost.toFixed(6)}`);
  console.log(`   Input Cost: $${totalInputCost.toFixed(6)}`);
  console.log(`   Output Cost: $${totalOutputCost.toFixed(6)}`);
  if (totalCachedCost > 0) {
    console.log(`   Cached Cost: $${totalCachedCost.toFixed(6)}`);
  }
  console.log(`   Average Cost per Requirement: $${(totalCost / requirements.length).toFixed(6)}`);

  // Detailed results
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED RESULTS');
  console.log('='.repeat(80));

  results.forEach((result, index) => {
    console.log(`\n[${index + 1}] ${result.requirement.substring(0, 60)}...`);
    console.log(`    Status: ${result.error ? '❌ FAILED' : '✅ SUCCESS'}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
    console.log(`    Timing:`);
    console.log(`      - Query Understanding: ${result.timing.queryUnderstanding}ms`);
    if (result.timing.clarificationAnswerGeneration > 0) {
      console.log(`      - Clarification Answer Generation: ${result.timing.clarificationAnswerGeneration}ms`);
    }
    if (result.timing.clarificationResolution > 0) {
      console.log(`      - Clarification Resolution: ${result.timing.clarificationResolution}ms`);
    }
    console.log(`      - Strategy Generation: ${result.timing.strategyGeneration}ms`);
    console.log(`      - Parameter Generation: ${result.timing.parameterGeneration}ms`);
    if (result.timing.modelComparison > 0) {
      console.log(`      - Model Comparison: ${result.timing.modelComparison}ms`);
    }
    console.log(`      - Total: ${result.timing.total}ms`);
    
    if (result.queryUnderstanding) {
      console.log(`    Query Understanding:`);
      console.log(`      - Primary Role: ${result.queryUnderstanding.primaryRole}`);
      console.log(`      - Role Variations: ${result.queryUnderstanding.roleVariations.length}`);
      console.log(`      - Industry: ${result.queryUnderstanding.industry?.join(', ') || 'N/A'}`);
      console.log(`      - Location: ${result.queryUnderstanding.locationHierarchy.primary}`);
      if (result.queryUnderstanding.needsClarification) {
        console.log(`      - Needs Clarification: Yes`);
      }
      
      // Display discovery results
      if (result.queryUnderstanding.patternIdentification) {
        const patterns = result.queryUnderstanding.patternIdentification.identifiedPatterns;
        const discoveredPatterns: string[] = [];
        if (patterns.specializedRole?.detected) {
          discoveredPatterns.push(`Specialized Role (${(patterns.specializedRole.confidence * 100).toFixed(0)}% confidence)`);
        }
        if (patterns.companyDescription?.detected) {
          discoveredPatterns.push(`Company Description (${(patterns.companyDescription.confidence * 100).toFixed(0)}% confidence)`);
        }
        if (patterns.instituteRequirement?.detected) {
          discoveredPatterns.push(`Institute Requirement (${(patterns.instituteRequirement.confidence * 100).toFixed(0)}% confidence)`);
        }
        if (discoveredPatterns.length > 0) {
          console.log(`    Discovery Patterns: ${discoveredPatterns.join(', ')}`);
        }
      }
      
      // Display discovered enhancements
      if (result.queryUnderstanding.roleVariations && result.queryUnderstanding.roleVariations.length > 1) {
        console.log(`    Discovered Role Variations: ${result.queryUnderstanding.roleVariations.length} total`);
        const discoveredCount = result.queryUnderstanding.roleVariations.length - 1; // Subtract original
        if (discoveredCount > 0) {
          console.log(`      - ${discoveredCount} variations discovered via pattern matching`);
        }
      }
      if (result.queryUnderstanding.companyPreferences?.current && result.queryUnderstanding.companyPreferences.current.length > 0) {
        console.log(`    Discovered Companies: ${result.queryUnderstanding.companyPreferences.current.length}`);
        result.queryUnderstanding.companyPreferences.current.slice(0, 5).forEach((company, i) => {
          console.log(`      ${i + 1}. ${company}`);
        });
        if (result.queryUnderstanding.companyPreferences.current.length > 5) {
          console.log(`      ... and ${result.queryUnderstanding.companyPreferences.current.length - 5} more`);
        }
      }
    }
    
    if (result.ambiguityReasons && result.ambiguityReasons.length > 0) {
      console.log(`    Ambiguity Reasons: ${result.ambiguityReasons.length}`);
      result.ambiguityReasons.forEach((reason, i) => {
        console.log(`      ${i + 1}. ${reason}`);
      });
    }
    
    if (result.clarificationQuestions && result.clarificationQuestions.length > 0) {
      console.log(`    Clarification Questions: ${result.clarificationQuestions.length}`);
      result.clarificationQuestions.forEach((q, i) => {
        console.log(`      ${i + 1}. ${q}`);
      });
      if (result.clarificationAnswers) {
        console.log(`    Clarification Answers: ${result.clarificationAnswers.substring(0, 100)}...`);
      }
    }
    
    if (result.resolvedQueryUnderstanding) {
      console.log(`    Resolved Query Understanding:`);
      console.log(`      - Primary Role: ${result.resolvedQueryUnderstanding.primaryRole}`);
      if (result.resolvedQueryUnderstanding.needsClarification) {
        console.log(`      - Needs Clarification: Yes`);
      }else{
        console.log(`      - Needs Clarification: No`);
      }

    }
    
    if (result.strategies) {
      // Check if it's a comparison result (object with model keys) or single result (array)
      if (Array.isArray(result.strategies)) {
        console.log(`    Strategies: ${result.strategies.length}`);
        result.strategies.forEach((strategy: any, i: number) => {
          console.log(`      ${i + 1}. ${strategy.label || strategy.id}: ${strategy.goal?.substring(0, 50)}...`);
        });
      } else {
        // Comparison results across models
        console.log(`    Strategy Comparison Across Models:`);
        const models = MODELS_TO_TEST;
        for (const model of models) {
          const modelResult = result.strategies[model];
          if (modelResult) {
            if (modelResult.error) {
              console.log(`      ${model}: ERROR - ${modelResult.error}`);
            } else {
              console.log(`      ${model}: ${modelResult.strategies?.length || 0} strategies (${modelResult.timing}ms)`);
              if (modelResult.strategies && modelResult.strategies.length > 0) {
                modelResult.strategies.slice(0, 3).forEach((strategy: any, i: number) => {
                  console.log(`        ${i + 1}. ${strategy.label || strategy.id}: ${strategy.goal?.substring(0, 60)}...`);
                });
                if (modelResult.strategies.length > 3) {
                  console.log(`        ... and ${modelResult.strategies.length - 3} more`);
                }
              }
            }
          }
        }
      }
    }
    
    if (result.searchParameters) {
      // Check if it's a comparison result (object with model keys) or single result
      const searchParams = result.searchParameters;
      if (typeof searchParams === 'object' && !Array.isArray(searchParams) && searchParams !== null) {
        const paramKeys = Object.keys(searchParams);
        const firstKey = paramKeys[0];
        if (firstKey && MODELS_TO_TEST.includes(firstKey)) {
          // Comparison results across models
          console.log(`    Parameter Comparison Across Models:`);
          const models = MODELS_TO_TEST;
          for (const model of models) {
            const modelResult = (searchParams as Record<string, any>)[model];
            if (modelResult) {
              if (modelResult.error) {
                console.log(`      ${model}: ERROR - ${modelResult.error}`);
              } else {
                const paramKeys = Object.keys(modelResult.parameters || {}).filter(
                  k => modelResult.parameters[k] !== null && modelResult.parameters[k] !== undefined
                );
                console.log(`      ${model}: ${paramKeys.length} parameter fields (${modelResult.timing}ms)`);
                // Show a few key parameters
                const params = modelResult.parameters || {};
                if (params.keywords) {
                  const keywords = typeof params.keywords === 'string' ? params.keywords : Array.isArray(params.keywords) ? params.keywords.join(', ') : 'N/A';
                  console.log(`        - Keywords: ${keywords.substring(0, 80)}...`);
                }
                if (params.location) {
                  const loc = Array.isArray(params.location) ? params.location.join(', ') : params.location;
                  console.log(`        - Location: ${loc}`);
                }
              }
            }
          }
        } else {
          // Single result format
          const singleParamKeys = Object.keys(searchParams).filter(k => (searchParams as any)[k] !== null && (searchParams as any)[k] !== undefined);
          console.log(`    Parameters: ${singleParamKeys.length} fields populated`);
          const singleParams = searchParams as any;
          if (singleParams.keywords) {
            console.log(`      - Keywords: ${typeof singleParams.keywords === 'string' ? singleParams.keywords.substring(0, 50) : 'N/A'}`);
          }
          if (singleParams.location) {
            const loc = Array.isArray(singleParams.location) 
              ? singleParams.location.join(', ')
              : singleParams.location;
            console.log(`      - Location: ${loc}`);
          }
          if (singleParams.company) {
            const comp = Array.isArray(singleParams.company)
              ? singleParams.company.join(', ')
              : singleParams.company;
            console.log(`      - Company: ${comp}`);
          }
        }
      }
    }
    
      if (result.modelComparison) {
      console.log(`    Model Comparison Results:`);
      console.log(`      Best Model: ${result.modelComparison.bestModel}`);
      if (result.modelComparison.analysis) {
        console.log(`      Analysis: ${result.modelComparison.analysis.substring(0, 200)}...`);
      }
      if (result.modelComparison.reasoning) {
        console.log(`      Reasoning: ${result.modelComparison.reasoning.substring(0, 200)}...`);
      }
      
      if (result.modelComparison.detailedComparison && Object.keys(result.modelComparison.detailedComparison).length > 0) {
        console.log(`      Detailed Scores:`);
        const models = MODELS_TO_TEST;
        for (const model of models) {
          const comparison = result.modelComparison.detailedComparison[model];
          if (comparison) {
            console.log(`        ${model}:`);
            if (comparison.overallScore !== undefined) {
              console.log(`          Overall Score: ${comparison.overallScore}/10`);
            }
            if (comparison.strategyScore !== undefined) {
              console.log(`          Strategy Score: ${comparison.strategyScore}/10`);
            }
            if (comparison.parameterScore !== undefined) {
              console.log(`          Parameter Score: ${comparison.parameterScore}/10`);
            }
            if (comparison.strengths && comparison.strengths.length > 0) {
              console.log(`          Strengths: ${comparison.strengths.join(', ')}`);
            }
            if (comparison.weaknesses && comparison.weaknesses.length > 0) {
              console.log(`          Weaknesses: ${comparison.weaknesses.join(', ')}`);
            }
          } else if (typeof comparison === 'number') {
            // Fallback: if detailedComparison is just scores
            console.log(`        ${model}: Score ${comparison}`);
          }
        }
      }
    }
  });

  // Save results to file
  const outputFile = path.join(process.cwd(), 'test-results.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  // Generate CSV output
  generateCSVOutput(results);

  console.log('\n' + '='.repeat(80));
  console.log('Test completed!');
  console.log('='.repeat(80));
}

/**
 * Generate CSV output with query, strategies, and parameters for each search type
 */
function generateCSVOutput(results: TestResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('Generating CSV output...');
  console.log('='.repeat(80));

  // Helper function to properly serialize values (avoid [object Object])
  const serializeValue = (value: any, indent: number = 0, maxDepth: number = 3): string => {
    if (maxDepth <= 0) {
      return '[Max depth reached]';
    }
    
    if (value === null) {
      return 'null';
    }
    
    if (value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      // Escape newlines in strings for better CSV readability
      return value.replace(/\n/g, ' ').replace(/\r/g, '');
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]';
      }
      // Check if array contains objects
      const hasObjects = value.some(item => typeof item === 'object' && item !== null && !Array.isArray(item));
      if (hasObjects) {
        return value.map((item, idx) => {
          const serialized = serializeValue(item, indent + 1, maxDepth - 1);
          const indentStr = '  '.repeat(indent);
          return `${indentStr}[${idx}]: ${serialized}`;
        }).join('\n');
      }
      // Simple array of primitives
      return value.map(v => serializeValue(v, indent, maxDepth - 1)).join(', ');
    }
    
    if (typeof value === 'object') {
      // Handle Date objects
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return '{}';
      }
      
      const indentStr = '  '.repeat(indent);
      return entries.map(([k, v]) => {
        const serialized = serializeValue(v, indent + 1, maxDepth - 1);
        return `${indentStr}${k}: ${serialized}`;
      }).join('\n');
    }
    
    // Fallback: convert to string, but avoid [object Object]
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  };

  // Helper function to escape CSV values (preserves newlines)
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = typeof value === 'string' ? value : String(value);
    // Always wrap in quotes and escape internal quotes
    // This allows newlines to be preserved in Excel
    return `"${str.replace(/"/g, '""')}"`;
  };

  // Helper function to format strategies with line breaks
  const formatStrategies = (strategies: any[] | undefined): string => {
    if (!strategies || strategies.length === 0) {
      return '';
    }
    
    // Handle case where strategies might be a single object instead of array
    const strategiesArray = Array.isArray(strategies) ? strategies : [strategies];
    
    return strategiesArray.map((s: any, index: number) => {
      if (!s || typeof s !== 'object') {
        return `Strategy ${index + 1}: [Invalid strategy data]`;
      }
      
      const label = s.label || s.id || s.name || `Strategy ${index + 1}`;
      const goal = s.goal || s.description || s.strategyText || '';
      // const whenToUse = s.whenToUse || '';
      const filterFocus = s.filterFocus || '';
      
      let strategyText = `━━━ ${label} ━━━\n`;
      if (goal && goal !== label) {
        strategyText += `Goal: ${goal}\n`;
      }
        // if (whenToUse) {
        //   strategyText += `When to use: ${whenToUse}\n`;
        // }
      if (filterFocus && filterFocus !== goal) {
        strategyText += `Focus: ${filterFocus}\n`;
      }
      
      // If we have no meaningful content, show the raw data
      if (strategyText.trim() === `━━━ ${label} ━━━`) {
        const rawData = JSON.stringify(s, null, 2);
        strategyText += `Details:\n${rawData}`;
      }
      
      return strategyText.trim();
    }).join('\n\n');
  };

  // Helper function to format parameters with proper serialization and line breaks
  const formatParameters = (parameters: any | undefined): string => {
    if (!parameters || typeof parameters !== 'object') {
      return '';
    }
    
    // Handle arrays (shouldn't happen, but defensive)
    if (Array.isArray(parameters)) {
      return parameters.map((p, idx) => {
        return `Parameter ${idx + 1}:\n${formatParameters(p)}`;
      }).join('\n\n');
    }
    
    const sections: string[] = [];
    
    // Group parameters by category for better readability
    const categories: Record<string, Array<{key: string, value: string}>> = {
      'Keywords': [],
      'Location': [],
      'Company': [],
      'Industry': [],
      'Education': [],
      'Skills': [],
      'Other': [],
    };
    
    for (const [key, value] of Object.entries(parameters)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }
      
      let category = 'Other';
      const keyLower = key.toLowerCase();
      if (keyLower.includes('keyword')) category = 'Keywords';
      else if (keyLower.includes('location')) category = 'Location';
      else if (keyLower.includes('company') || keyLower.includes('past_company')) category = 'Company';
      else if (keyLower.includes('industry')) category = 'Industry';
      else if (keyLower.includes('school') || keyLower.includes('education')) category = 'Education';
      else if (keyLower.includes('skill')) category = 'Skills';
      
      const serialized = serializeValue(value);
      if (serialized) {
        categories[category].push({ key, value: serialized });
      }
    }
    
    // Build formatted output with sections
    for (const [category, items] of Object.entries(categories)) {
      if (items.length > 0) {
        sections.push(`\n【 ${category} 】`);
        items.forEach(({key, value}) => {
          // If value is multi-line, add proper indentation
          const lines = value.split('\n');
          if (lines.length > 1) {
            sections.push(`${key}:`);
            sections.push(...lines.map(line => `  ${line}`));
          } else {
            sections.push(`${key}: ${value}`);
          }
        });
      }
    }
    
    return sections.join('\n').trim() || '[No parameters]';
  };

  // Helper function to format parameters from all strategies with line breaks
  const formatParametersFromStrategies = (strategies: any[] | undefined): string => {
    if (!strategies || strategies.length === 0) {
      return '';
    }
    return strategies.map((strategy: any, index: number) => {
      const strategyLabel = strategy.label || strategy.id || `Strategy ${index + 1}`;
      const strategyParams = formatParameters(strategy.parameters);
      return `═════ ${strategyLabel} ═════\n${strategyParams}`;
    }).join('\n\n' + '─'.repeat(60) + '\n\n');
  };

  // CSV Headers - dynamically generate based on models
  const models = MODELS_TO_TEST;
  const headers = [
    'Query',
    ...models.flatMap(model => [
      `Strategies (${model})`,
      `Parameters (${model})`,
    ]),
    'Best Model',
    'Model Comparison Analysis',
  ];

  // Build CSV rows
  const rows: string[] = [];
  rows.push(headers.map(escapeCSV).join(','));

  for (const result of results) {
    const row: string[] = [result.requirement];
    
    // Add strategies and parameters for each model
    for (const model of models) {
      const modelResults = result.resultsByModel?.[model];
      const searchType = ENABLE_SEARCH_TYPES ? 'classic' : DEFAULT_SEARCH_TYPE;
      const modelData = modelResults?.[searchType];
      
      // Get strategies
      const strategies = modelData?.strategies || result.strategies?.[model]?.strategies;
      row.push(formatStrategies(Array.isArray(strategies) ? strategies : strategies ? [strategies] : undefined));
      
      // Get parameters
      const parameters = modelData?.parameters || result.searchParameters?.[model]?.parameters;
      const strategiesForParams = modelData?.strategies || result.searchParameters?.[model]?.strategies;
      if (strategiesForParams && Array.isArray(strategiesForParams) && strategiesForParams.length > 0) {
        row.push(formatParametersFromStrategies(strategiesForParams));
      } else {
        row.push(formatParameters(parameters));
      }
    }
    
    // Add model comparison results
    row.push(result.modelComparison?.bestModel || 'N/A');
    row.push(result.modelComparison?.analysis || result.modelComparison?.reasoning || 'N/A');

    rows.push(row.map(escapeCSV).join(','));
  }

  // Write CSV file
  const csvContent = rows.join('\n');
  const csvFile = path.join(process.cwd(), 'search-parameters-comparison.csv');
  fs.writeFileSync(csvFile, csvContent, 'utf-8');
  console.log(`\n💾 CSV file saved to: ${csvFile}`);
  console.log(`   Total rows: ${rows.length - 1} (excluding header)`);

  // Also log a table preview
  console.log('\n' + '='.repeat(80));
  console.log('CSV Preview (first 3 rows):');
  console.log('='.repeat(80));
  const previewRows = rows.slice(0, Math.min(4, rows.length));
  previewRows.forEach((row, i) => {
    if (i === 0) {
      console.log('\nHeaders:');
    } else {
      console.log(`\nRow ${i}:`);
    }
    const cols = row.split(',');
    headers.forEach((header, j) => {
      const value = cols[j] || '';
      const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
      console.log(`  ${header}: ${displayValue}`);
    });
  });
  if (rows.length > 4) {
    console.log(`\n... and ${rows.length - 4} more rows`);
  }
}

// Run the test
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
