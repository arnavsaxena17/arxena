import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
// Keep type imports - they don't cause side effects and are needed for type checking
import {
    ClassicPeopleParameterSelection,
} from '../src/engine/core-modules/candidate-search/schemas/classic-people-search.schema';
import {
    RecruiterPeopleParameterSelection,
} from '../src/engine/core-modules/candidate-search/schemas/recruiter-people-search.schema';
import {
    SalesNavigatorPeopleParameterSelection,
} from '../src/engine/core-modules/candidate-search/schemas/sales-navigator-people-search.schema';
import {
    ClassicPeopleSearchStrategyResult,
    GeneratedSearchParameters,
    ParsedJobDescription,
    QueryUnderstanding,
    RecruiterPeopleSearchStrategyResult,
    ResultValidationResult,
    SalesNavigatorPeopleSearchStrategyResult,
} from '../src/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { LinkedInSearchResult } from '../src/engine/core-modules/candidate-search/types/linkedin-search-result.type';
import { TransformedCandidateForTable } from '../src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';

// Track script load time
const scriptLoadStartTime = Date.now();

// Global abort controller to cancel all ongoing requests when script is interrupted
let globalAbortController: AbortController | null = null;
let isInterrupted = false;
let csvPath: string | null = null;
let csvHeaders: string[] = [];
let csvRows: CSVRow[] = [];

interface CSVRow {
  [key: string]: string;
}

type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

type PeopleParameterSelection =
  | ClassicPeopleParameterSelection
  | SalesNavigatorPeopleParameterSelection
  | RecruiterPeopleParameterSelection;

interface ParameterSelectionInfo {
  strategyId: string;
  strategyLabel: string;
  parameterSelection: PeopleParameterSelection;
}

// Candidate can be either raw LinkedInSearchResult or transformed TransformedCandidateForTable
type CandidateResult = LinkedInSearchResult | TransformedCandidateForTable;

interface ProcessingResult {
  queryUnderstanding?: QueryUnderstanding;
  clarifyingQuestions?: string[];
  clarifyingAnswers?: string;
  searchStrategies?: PeopleSearchStrategyResult[];
  parameterSelections?: ParameterSelectionInfo[];
  searchParameters?: GeneratedSearchParameters;
  searchUrls?: string[];
  searchResultsPages?: Array<{
    page: number;
    candidates: CandidateResult[];
  }>;
  allResults?: CandidateResult[];
  resultValidation?: ResultValidationResult | { error: string };
  error?: string;
}

/**
 * Get formatted timestamp for logging
 */
function getTimestamp(): string {
  const now = new Date();
  return `[${now.toISOString()}]`;
}

/**
 * Log with timestamp
 */
function logWithTime(message: string): void {
  console.log(`${getTimestamp()} ${message}`);
}

/**
 * Parse CSV file into rows
 */
function parseCSV(content: string): { headers: string[]; rows: CSVRow[] } {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse headers
  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''));

  // Parse rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim()); // Add last value

  return values;
}

/**
 * Convert row back to CSV line
 */
function rowToCSVLine(row: CSVRow, headers: string[]): string {
  return headers
    .map((header) => {
      const value = row[header] || '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    })
    .join(',');
}

/**
 * Write CSV file
 */
function writeCSV(filePath: string, headers: string[], rows: CSVRow[]): void {
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(rowToCSVLine(row, headers));
  });
  writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/**
 * Create a default ParsedJobDescription
 */
function createDefaultParsedJD(): ParsedJobDescription {
  return {
    jobTitle: 'Software Engineer',
    company: 'Tech Company',
    location: 'Mumbai',
    industry: 'Technology',
    requiredSkills: [],
    preferredSkills: [],
    experienceLevel: 'mid_level',
    education: [],
    keywords: [],
    responsibilities: [],
    qualifications: [],
    benefits: [],
    employmentType: 'full_time',
    remoteWork: false,
    salaryRange: null,
  };
}

/**
 * Format query understanding as JSON string (compact format for Excel compatibility)
 */
function formatQueryUnderstanding(understanding?: QueryUnderstanding): string {
  if (!understanding) return '';
  // Use compact JSON (single line) to avoid Excel interpreting newlines as row breaks
  return JSON.stringify(understanding);
}

/**
 * Format clarifying questions
 */
function formatClarifyingQuestions(questions?: string[] | null): string {
  if (!questions || questions.length === 0) return '';
  return questions.join('; ');
}

/**
 * Format search strategies (compact format for Excel compatibility)
 */
function formatSearchStrategies(strategies?: PeopleSearchStrategyResult[]): string {
  if (!strategies || strategies.length === 0) return '';
  // Use compact JSON (single line) to avoid Excel interpreting newlines as row breaks
  return JSON.stringify(strategies);
}

/**
 * Format parameter selections (compact format for Excel compatibility)
 */
function formatParameterSelections(selections?: ParameterSelectionInfo[]): string {
  if (!selections || selections.length === 0) return '';
  // Use compact JSON (single line) to avoid Excel interpreting newlines as row breaks
  return JSON.stringify(selections);
}

/**
 * Format result validation (compact format for Excel compatibility)
 */
function formatResultValidation(validation?: ResultValidationResult | { error: string }): string {
  if (!validation) return '';
  if ('error' in validation) {
    return `Error: ${validation.error}`;
  }
  // Use compact JSON (single line) to avoid Excel interpreting newlines as row breaks
  return JSON.stringify(validation);
}

/**
 * Format search parameters (compact format for Excel compatibility)
 */
function formatSearchParameters(params?: GeneratedSearchParameters): string {
  if (!params) return '';
  // Use compact JSON (single line) to avoid Excel interpreting newlines as row breaks
  return JSON.stringify(params);
}

/**
 * Format search URLs
 */
function formatSearchUrls(urls?: string[]): string {
  if (!urls || urls.length === 0) return '';
  return urls.join(', ');
}

/**
 * Format candidate results for display (using semicolon separator for Excel compatibility)
 */
function formatCandidates(candidates: CandidateResult[]): string {
  if (!candidates || candidates.length === 0) return '';

  return candidates
    .map((candidate, index) => {
      // Handle both LinkedInSearchResult and TransformedCandidateForTable
      const name =
        candidate.name ||
        (candidate as LinkedInSearchResult).first_name ||
        candidate.headline ||
        'Unknown';
      const title =
        candidate.headline ||
        (candidate as LinkedInSearchResult).current_positions?.[0]?.role ||
        (candidate as TransformedCandidateForTable).jobTitle ||
        'N/A';
      const company =
        (candidate as LinkedInSearchResult).current_positions?.[0]?.company ||
        (candidate as TransformedCandidateForTable)?.company ||
        'N/A';
      const transformedCandidate = candidate as TransformedCandidateForTable;
      const score = transformedCandidate?.relevanceScore
        ? `${(transformedCandidate.relevanceScore * 100).toFixed(0)}%`
        : 'N/A';
      const label = transformedCandidate?.relevanceLabel || 'N/A';

      return `${index + 1}. ${name} | ${title} | ${company} | ${score} (${label})`;
    })
    .join('; '); // Use semicolon separator instead of newline for Excel compatibility
}

/**
 * Process a single prompt - can run specific steps only
 */
async function processPrompt(
  prompt: string,
  apiToken: string,
  serverUrl: string,
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
  searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
  parsedJD: ParsedJobDescription,
  searchFilterId: string,
  step: 'query-understanding' | 'strategies' | 'parameter-selection' | 'parameters' | 'search' | 'result-validation' | 'all',
  maxPages: number,
): Promise<ProcessingResult> {
  const result: ProcessingResult = {};
  const baseUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash

  // Check if interrupted before starting
  if (isInterrupted) {
    result.error = 'Script interrupted';
    return result;
  }

  try {
    let queryUnderstanding: QueryUnderstanding | undefined;

    // Step 1: Query Understanding (if needed)
    if (step === 'query-understanding' || step === 'all' || step === 'parameters' || step === 'strategies' || step === 'search' || step === 'result-validation') {
      if (isInterrupted) {
        result.error = 'Script interrupted';
        return result;
      }

      const queryUnderstandingStartTime = Date.now();
      logWithTime(`  → Calling server endpoint for query understanding...`);
      
      try {
        const response = await axios.post(
          `${baseUrl}/candidate-search/test/understand-query`,
          {
            prompt,
            rawJDText: '',
            isClarificationResponse: false,
          },
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000, // 2 minutes
            signal: globalAbortController?.signal,
          }
        );

        queryUnderstanding = response.data.queryUnderstanding;
        result.queryUnderstanding = queryUnderstanding;
        const queryUnderstandingTime = Date.now() - queryUnderstandingStartTime;
        if (queryUnderstanding?.needsClarification) {
          const questions = queryUnderstanding.clarificationQuestions || [];
          result.clarifyingQuestions = questions;
          logWithTime(`  → Clarification needed: ${questions.length} questions (${queryUnderstandingTime}ms)`);
        } else {
          logWithTime(`  → Query understanding complete (${queryUnderstandingTime}ms)`);
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || isInterrupted) {
          result.error = 'Request cancelled due to script interruption';
          return result;
        }
        if (error.response) {
          throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data) || error.message}`);
        }
        throw error;
      }
    }

    // If only query understanding step, return early
    if (step === 'query-understanding') {
      return result;
    }

    // Step 2: Generate Search Strategies (if needed)
    if (step === 'strategies' || step === 'all' || step === 'parameter-selection' || step === 'parameters' || step === 'search') {
      if (searchCategory === 'people') {
        const strategiesStartTime = Date.now();
        logWithTime(`  → Calling server endpoint for search strategies...`);
        
        try {
          const response = await axios.post(
            `${baseUrl}/candidate-search/test/generate-search-strategies`,
            {
              prompt,
              parsedJobDescription: parsedJD,
              searchType,
              searchCategory,
              queryUnderstanding,
            },
            {
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
              },
              timeout: 180000, // 3 minutes
              signal: globalAbortController?.signal,
            }
          );

          result.searchStrategies = response.data.strategies || [];
          const strategiesTime = Date.now() - strategiesStartTime;
          logWithTime(`  → Generated ${result.searchStrategies?.length || 0} search strategies (${strategiesTime}ms)`);
        } catch (error: any) {
          if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || isInterrupted) {
            result.error = 'Request cancelled due to script interruption';
            return result;
          }
          if (error.response) {
            console.error(`  → Error generating strategies: HTTP ${error.response.status}: ${JSON.stringify(error.response.data) || error.message}`);
            // Don't throw, continue with other steps
          } else {
            throw error;
          }
        }
      }
    }

    // If only strategies step, return early
    if (step === 'strategies') {
      return result;
    }

    // Step 2.5: Parameter Selection - not available as separate endpoint, skip
    if (step === 'parameter-selection') {
      console.log(`  → Note: Parameter selections are only available during strategy generation, not from stored results`);
      return result;
    }

    // Step 3: Generate Search Parameters (if needed)
    if (step === 'parameters' || step === 'all' || step === 'search') {
      if (isInterrupted) {
        result.error = 'Script interrupted';
        return result;
      }

      const parametersStartTime = Date.now();
      logWithTime(`  → Calling server endpoint for search parameters...`);
      
      try {
        const response = await axios.post(
          `${baseUrl}/candidate-search/test/generate-search-parameters`,
          {
            prompt,
            parsedJobDescription: parsedJD,
            searchType,
            searchCategory,
            queryUnderstanding,
          },
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 180000, // 3 minutes
            signal: globalAbortController?.signal,
          }
        );

        result.searchParameters = response.data.searchParameters;
        if (response.data.searchStrategies) {
          result.searchStrategies = response.data.searchStrategies;
        }
        if (response.data.searchUrls) {
          result.searchUrls = response.data.searchUrls;
        }
        const parametersTime = Date.now() - parametersStartTime;
        logWithTime(`  → Generated search parameters (${parametersTime}ms)`);
      } catch (error: any) {
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || isInterrupted) {
          result.error = 'Request cancelled due to script interruption';
          return result;
        }
        if (error.response) {
          throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data) || error.message}`);
        }
        throw error;
      }
    }

    // If only parameters step, return early
    if (step === 'parameters') {
      return result;
    }

    // Step 4: Execute Search (if needed)
    if (step === 'search' || step === 'all') {
      if (isInterrupted) {
        result.error = 'Script interrupted';
        return result;
      }

      if (!result.searchParameters) {
        throw new Error('Search parameters are required to execute search');
      }

      const searchStartTime = Date.now();
      logWithTime(`  → Calling server endpoint to execute search (max ${maxPages} pages)...`);
      
      try {
        const response = await axios.post(
          `${baseUrl}/candidate-search/test/execute-search`,
          {
            prompt,
            parsedJobDescription: parsedJD,
            searchType,
            searchCategory,
            searchParameters: result.searchParameters,
            queryUnderstanding,
            maxPages,
          },
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 300000, // 5 minutes for search execution
            signal: globalAbortController?.signal,
          }
        );

        result.searchResultsPages = response.data.searchResultsPages || [];
        result.allResults = response.data.allResults || [];
        const searchTime = Date.now() - searchStartTime;
        logWithTime(`  → Found ${result.allResults?.length || 0} total candidates (${searchTime}ms)`);
      } catch (error: any) {
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || isInterrupted) {
          result.error = 'Request cancelled due to script interruption';
          return result;
        }
        if (error.response) {
          throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data) || error.message}`);
        }
        throw error;
      }
    }

    // Step 5: Result Validation (if needed)
    if (step === 'result-validation' || step === 'all') {
      if (isInterrupted) {
        result.error = 'Script interrupted';
        return result;
      }

      if (!queryUnderstanding) {
        logWithTime(`  → Query understanding required for validation, skipping...`);
      } else if (result.allResults && result.allResults.length > 0) {
        const validationStartTime = Date.now();
        logWithTime(`  → Calling server endpoint to validate search results...`);
        
        try {
          const response = await axios.post(
            `${baseUrl}/candidate-search/test/validate-results`,
            {
              prompt,
              queryUnderstanding,
              candidates: result.allResults,
            },
            {
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
              },
              timeout: 180000, // 3 minutes
              signal: globalAbortController?.signal,
            }
          );

          result.resultValidation = response.data.validation;
          const validation = result.resultValidation;
          const quality = validation && !('error' in validation) ? validation.qualityAssessment || 'N/A' : 'N/A';
          const relevance = validation && !('error' in validation) && 'relevanceScore' in validation ? `${(validation.relevanceScore * 100).toFixed(0)}%` : 'N/A';
          const validationTime = Date.now() - validationStartTime;
          logWithTime(`  → Validation complete: ${quality} quality, ${relevance} relevance (${validationTime}ms)`);
        } catch (error: any) {
          if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || isInterrupted) {
            result.error = 'Request cancelled due to script interruption';
            return result;
          }
          console.error(`  → Validation error: ${error.message}`);
          result.resultValidation = {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      } else if (step === 'result-validation') {
        console.log(`  → No results available for validation. Run 'search' step first.`);
      }
    }
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('cancel'))) {
      result.error = 'Request cancelled due to script interruption';
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.error = errorMessage;
      console.error(`  → Error: ${errorMessage}`);
    }
  }

  return result;
}

/**
 * Save CSV and exit gracefully
 */
function saveAndExit(exitCode: number = 0): void {
  if (csvPath && csvHeaders.length > 0 && csvRows.length > 0) {
    try {
      logWithTime(`\n💾 Saving progress to CSV before exit...`);
      writeCSV(csvPath, csvHeaders, csvRows);
      logWithTime(`✅ Progress saved to: ${csvPath}`);
    } catch (error) {
      console.error(`❌ Failed to save progress: ${error}`);
    }
  }
  process.exit(exitCode);
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
  const handleInterrupt = (signal: string) => {
    if (isInterrupted) {
      // Force exit if interrupted again
      logWithTime(`\n⚠️  Force exit requested (${signal})`);
      process.exit(1);
    }

    isInterrupted = true;
    logWithTime(`\n⚠️  Script interrupted (${signal}). Cancelling all ongoing requests...`);

    // Abort all ongoing requests
    if (globalAbortController) {
      globalAbortController.abort();
      logWithTime(`✅ All ongoing requests cancelled`);
    }

    // Save progress and exit
    saveAndExit(0);
  };

  process.on('SIGINT', () => handleInterrupt('SIGINT'));
  process.on('SIGTERM', () => handleInterrupt('SIGTERM'));
}

/**
 * Main function
 */
async function main() {
  // Initialize abort controller
  globalAbortController = new AbortController();

  // Setup signal handlers
  setupSignalHandlers();

  const scriptLoadTime = Date.now() - scriptLoadStartTime;
  const scriptStartTime = Date.now();
  console.log(`${getTimestamp()} ⏱️  Script load time: ${scriptLoadTime}ms (time to parse/load modules)`);
  logWithTime('🚀 Script started');
  
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const apiToken =
    args.find((arg) => arg.startsWith('--api-token='))?.split('=')[1] ||
    process.env.API_TOKEN ||
    '';
  const columnsArg =
    args.find((arg) => arg.startsWith('--columns='))?.split('=')[1] || '';
  const searchType =
    (args
      .find((arg) => arg.startsWith('--search-type='))
      ?.split('=')[1] as 'classic' | 'sales_navigator' | 'recruiter') ||
    'classic';
  const searchCategory =
    (args
      .find((arg) => arg.startsWith('--search-category='))
      ?.split('=')[1] as 'people' | 'companies' | 'posts' | 'jobs') ||
    'people';
  const maxPages =
    parseInt(
      args.find((arg) => arg.startsWith('--max-pages='))?.split('=')[1] ||
        '7',
    ) || 7;
  const searchFilterId =
    args.find((arg) => arg.startsWith('--search-filter-id='))?.split('=')[1] ||
    process.env.SEARCH_FILTER_ID ||
    'test-search-filter-id';
  const step =
    (args
      .find((arg) => arg.startsWith('--step='))
      ?.split('=')[1] as 'query-understanding' | 'strategies' | 'parameter-selection' | 'parameters' | 'search' | 'result-validation' | 'all') ||
    'all';
  const serverUrl =
    args.find((arg) => arg.startsWith('--server-url='))?.split('=')[1] ||
    process.env.SERVER_URL ||
    'http://localhost:3000';

  if (!apiToken) {
    console.error('Error: API token is required. Use --api-token=<token> or set API_TOKEN env var');
    process.exit(1);
  }

  logWithTime(`🌐 Using HTTP mode - Server URL: ${serverUrl}`);

  // Determine which columns to output
  const allColumns = [
    'Query Understanding',
    'Clarifying Questions',
    'Clarifying Answers',
    'Search Strategies',
    'Parameter Selection',
    'Search Parameters',
    'Search URLs',
    'Search Results Page 1',
    'Search Results Page 2',
    'Search Results Page 3',
    'Search Results Page 4',
    'Search Results Page 5',
    'Search Results Page 6',
    'Search Results Page 7',
    'All Results',
    'Result Validation',
  ];

  /**
   * Get columns that correspond to a given step (including dependencies)
   */
  function getColumnsForStep(stepValue: 'query-understanding' | 'strategies' | 'parameter-selection' | 'parameters' | 'search' | 'result-validation' | 'all'): string[] {
    switch (stepValue) {
      case 'query-understanding':
        return ['Query Understanding', 'Clarifying Questions'];
      case 'strategies':
        // Strategies step also runs query-understanding
        return ['Query Understanding', 'Clarifying Questions', 'Search Strategies'];
      case 'parameter-selection':
        // Parameter selection is only available during strategy generation
        return ['Query Understanding', 'Clarifying Questions', 'Search Strategies', 'Parameter Selection'];
      case 'parameters':
        // Parameters step also runs query-understanding, and may return strategies
        return ['Query Understanding', 'Clarifying Questions', 'Search Strategies', 'Search Parameters', 'Search URLs'];
      case 'search':
        // Search step runs query-understanding, parameters, and search
        return [
          'Query Understanding',
          'Clarifying Questions',
          'Search Strategies',
          'Search Parameters',
          'Search URLs',
          'Search Results Page 1',
          'Search Results Page 2',
          'Search Results Page 3',
          'Search Results Page 4',
          'Search Results Page 5',
          'Search Results Page 6',
          'Search Results Page 7',
          'All Results',
        ];
      case 'result-validation':
        // Result validation needs query-understanding and search results
        return [
          'Query Understanding',
          'Clarifying Questions',
          'Search Strategies',
          'Search Parameters',
          'Search URLs',
          'Search Results Page 1',
          'Search Results Page 2',
          'Search Results Page 3',
          'Search Results Page 4',
          'Search Results Page 5',
          'Search Results Page 6',
          'Search Results Page 7',
          'All Results',
          'Result Validation',
        ];
      case 'all':
        return allColumns;
      default:
        return allColumns;
    }
  }

  // Auto-infer columns from step if columns arg not provided
  const columnsToOutput = columnsArg
    ? columnsArg.split(',').map((c) => c.trim())
    : getColumnsForStep(step);

  // Read CSV file - look for it in the workspace root
  const csvReadStartTime = Date.now();
  const workspaceRoot = join(__dirname, '..', '..', '..');
  csvPath = join(workspaceRoot, 'search prompts.csv');
  logWithTime(`📄 Reading CSV from: ${csvPath}`);
  const csvContent = readFileSync(csvPath, 'utf-8');
  const { headers, rows } = parseCSV(csvContent);
  csvHeaders = headers;
  csvRows = rows;
  const csvReadTime = Date.now() - csvReadStartTime;
  logWithTime(`✅ CSV read complete (${csvReadTime}ms) - Found ${rows.length} prompts`);

  console.log(`Search type: ${searchType}, Category: ${searchCategory}`);
  console.log(`Max pages: ${maxPages}`);
  console.log(`Step: ${step}`);
  console.log(`Output columns: ${columnsToOutput.join(', ')}\n`);

  const parsedJD = createDefaultParsedJD();

  // Process each row
  let successCount = 0;
  let errorCount = 0;
  logWithTime(`🔄 Starting to process ${rows.length} prompts...\n`);

  for (let i = 0; i < rows.length; i++) {
    // Check if interrupted before processing next prompt
    if (isInterrupted) {
      logWithTime(`\n⚠️  Script interrupted. Stopping at prompt ${i + 1}/${rows.length}`);
      break;
    }

    const row = rows[i];
    const prompt = row['Search Prompt'] || '';
    const promptStartTime = Date.now();

    if (!prompt.trim()) {
      logWithTime(`[${i + 1}/${rows.length}] ⏭️  Skipping empty prompt`);
      continue;
    }

    logWithTime(`[${i + 1}/${rows.length}] 📝 Processing: "${prompt.substring(0, 50)}..."`);

    try {
      const processStartTime = Date.now();
      const result = await processPrompt(
        prompt,
        apiToken,
        serverUrl,
        searchType,
        searchCategory,
        parsedJD,
        searchFilterId,
        step,
        maxPages,
      );
      const processTime = Date.now() - processStartTime;
      logWithTime(`[${i + 1}/${rows.length}] ✅ Processing complete (${processTime}ms)`);

      // Update row with results (only update columns that are in output list)
      if (columnsToOutput.includes('Query Understanding') && result.queryUnderstanding) {
        row['Query Understanding'] = formatQueryUnderstanding(
          result.queryUnderstanding,
        );
      }
      if (columnsToOutput.includes('Clarifying Questions') && result.clarifyingQuestions) {
        row['Clarifying Questions'] = formatClarifyingQuestions(
          result.clarifyingQuestions,
        );
      }
      if (columnsToOutput.includes('Clarifying Answers') && result.clarifyingAnswers) {
        row['Clarifying Answers'] = result.clarifyingAnswers;
      }
      if (columnsToOutput.includes('Search Strategies') && result.searchStrategies) {
        row['Search Strategies'] = formatSearchStrategies(
          result.searchStrategies,
        );
      }
      if (columnsToOutput.includes('Parameter Selection') && result.parameterSelections) {
        row['Parameter Selection'] = formatParameterSelections(
          result.parameterSelections,
        );
      }
      if (columnsToOutput.includes('Search Parameters') && result.searchParameters) {
        row['Search Parameters'] = formatSearchParameters(
          result.searchParameters,
        );
      }
      if (columnsToOutput.includes('Search URLs') && result.searchUrls) {
        row['Search URLs'] = formatSearchUrls(result.searchUrls);
      }

      // Add page results (only if step includes search)
      if (step === 'search' || step === 'all') {
        for (let page = 1; page <= 7; page++) {
          const columnName = `Search Results Page ${page}`;
          if (columnsToOutput.includes(columnName)) {
            const pageResult = result.searchResultsPages?.find(
              (p) => p.page === page,
            );
            row[columnName] = pageResult
              ? formatCandidates(pageResult.candidates)
              : '';
          }
        }

        if (columnsToOutput.includes('All Results')) {
          row['All Results'] = formatCandidates(result.allResults || []);
        }
      }

      if (columnsToOutput.includes('Result Validation') && result.resultValidation) {
        row['Result Validation'] = formatResultValidation(result.resultValidation);
      }

      if (result.error) {
        row['Error'] = result.error;
        errorCount++;
      } else {
        successCount++;
      }
      
      const promptTotalTime = Date.now() - promptStartTime;
      logWithTime(`[${i + 1}/${rows.length}] ⏱️  Total time: ${promptTotalTime}ms\n`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const promptTotalTime = Date.now() - promptStartTime;
      logWithTime(`[${i + 1}/${rows.length}] ❌ Fatal error: ${errorMessage} (${promptTotalTime}ms)\n`);
      row['Error'] = errorMessage;
      errorCount++;
    }
  }

  // Check if interrupted before writing
  if (isInterrupted) {
    logWithTime(`\n⚠️  Script was interrupted. Saving progress...`);
  }

  // Write results back to CSV
  const csvWriteStartTime = Date.now();
  logWithTime(`\n💾 Writing results to CSV...`);
  writeCSV(csvPath, csvHeaders, csvRows);
  const csvWriteTime = Date.now() - csvWriteStartTime;
  logWithTime(`✅ CSV write complete (${csvWriteTime}ms)`);

  // Summary
  const totalScriptTime = Date.now() - scriptStartTime;
  console.log(`\n${'='.repeat(80)}`);
  console.log('Summary');
  console.log(`${'='.repeat(80)}`);
  console.log(`Total prompts: ${csvRows.length}`);
  console.log(`Processed: ${successCount + errorCount}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  if (isInterrupted) {
    console.log(`⚠️  Script was interrupted`);
  }
  console.log(`Results written to: ${csvPath}`);
  logWithTime(`⏱️  Total script execution time: ${totalScriptTime}ms (${(totalScriptTime / 1000).toFixed(2)}s)`);
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      if (!isInterrupted) {
        console.log('\n✨ Script completed successfully!');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed!');
      console.error(error);
      // Save progress even on error
      if (csvPath && csvHeaders.length > 0 && csvRows.length > 0) {
        try {
          writeCSV(csvPath, csvHeaders, csvRows);
          console.log(`💾 Progress saved to: ${csvPath}`);
        } catch (saveError) {
          console.error(`❌ Failed to save progress: ${saveError}`);
        }
      }
      process.exit(1);
    });
}

export { main };

