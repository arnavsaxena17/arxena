/**
 * Keyword Count Test Script
 * 
 * This script tests the countKeywordTerms function with various boolean keyword strings.
 * It validates that the counting logic correctly handles:
 * - Quoted phrases (each is 1 term)
 * - Unquoted words separated by boolean operators (AND, OR, NOT)
 * - Mixed quoted and unquoted terms
 * - Complex boolean expressions
 * 
 * Usage:
 *   export API_TOKEN=your_api_token_here
 *   export SERVER_URL=http://localhost:3000  # optional, defaults to localhost:3000
 *   npx ts-node test-keyword-count.ts
 */

import axios from 'axios';

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzhkZTU3ZC0xYzM2LTQyZmMtYTEyYy1kY2U4ZTVlM2Y1MWMiLCJ3b3Jrc3BhY2VJZCI6IjA0Nzk2ZWFkLWM0NDktNGJhOC1hY2FlLWM4YzgzNTNkZTM5ZCIsIndvcmtzcGFjZU1lbWJlcklkIjoiODNlMjYxYjYtZjk3Yy00OWI5LWFjMWEtMjM5ZDM2MGNiOTljIiwidXNlcldvcmtzcGFjZUlkIjoiNjJlMGYwN2QtNjhjMi00ZTZmLWJmMTgtYjFiNTI5ZWU0MjE3IiwiaWF0IjoxNzY4MTk1OTA0LCJleHAiOjE3NjgzNzU5MDR9.a6UGzUHR7I2O_1G6IYCmkFjB5fYNp5bogK1ogvvY-us';

// Test cases: [keyword string, expected count, description]
const testCases: Array<[string, number, string]> = [
  // Simple cases
  ['software engineer', 2, 'Two unquoted words (no operator, splits by space)'],
  ['"software engineer"', 1, 'Single quoted phrase'],
  ['software AND engineer', 2, 'Two terms with AND'],
  ['software OR engineer', 2, 'Two terms with OR'],
  ['software NOT engineer', 2, 'Two terms with NOT'],
  
  // Multiple terms
  ['software AND engineer AND developer', 3, 'Three terms with AND'],
  ['software OR engineer OR developer', 3, 'Three terms with OR'],
  ['software AND engineer OR developer', 3, 'Three terms with mixed operators'],
  
  // Quoted phrases
  ['"software engineer" AND developer', 2, 'Quoted phrase + unquoted term'],
  ['"software engineer" OR "full stack"', 2, 'Two quoted phrases'],
  ['"software engineer" AND "full stack" AND developer', 3, 'Mixed quoted and unquoted'],
  
  // Complex boolean expressions
  ['software AND engineer AND developer AND python AND "machine learning"', 5, 'Complex with quoted phrase'],
  ['"software engineer" OR "full stack developer" OR "backend engineer"', 3, 'Multiple quoted phrases with OR'],
  ['software AND (engineer OR developer) AND python', 4, 'Expression with parentheses (splits on OR inside parentheses)'],
  
  // Edge cases
  ['', 0, 'Empty string'],
  ['"software engineer"', 1, 'Single quoted phrase'],
  ['software', 1, 'Single unquoted word'],
  ['"machine learning" AND "deep learning" AND "neural networks"', 3, 'Three quoted phrases'],
  ['Java AND Python AND JavaScript AND TypeScript AND React AND Node', 6, 'Six unquoted terms'],
  
  // Real-world examples
  ['"product manager" AND SaaS AND "B2B"', 3, 'Real-world search with quoted and unquoted terms'],
  ['"data scientist" AND Python AND "machine learning"', 3, 'Real-world search with skills'],
  ['"software engineer" AND "San Francisco" AND Google', 3, 'Location and company search'],
  
  // Complex cases with 6-10+ terms
  ['Java AND Python AND JavaScript AND TypeScript AND React AND Node AND Express', 7, 'Seven unquoted terms with AND'],
  ['"software engineer" AND "full stack" AND "backend developer" AND Python AND Java AND React AND Node', 7, 'Three quoted phrases + four unquoted terms'],
  ['"machine learning" AND "deep learning" AND "neural networks" AND Python AND TensorFlow AND PyTorch AND Keras', 7, 'Three quoted phrases + four unquoted terms'],
  ['"product manager" AND "product owner" AND SaaS AND "B2B" AND "enterprise software" AND Agile AND Scrum', 7, 'Four quoted phrases + three unquoted terms'],
  ['"data scientist" AND "data engineer" AND "machine learning engineer" AND Python AND SQL AND Spark AND Hadoop AND AWS', 8, 'Three quoted phrases + five unquoted terms'],
  ['"software engineer" OR "full stack developer" OR "backend engineer" OR "frontend engineer" OR "devops engineer" OR Python OR Java', 7, 'Five quoted phrases + two unquoted terms with OR'],
  ['"software engineer" AND "San Francisco" AND (Google OR Apple OR Microsoft) AND Python AND Java AND React', 8, 'Complex with parentheses and mixed operators'],
  ['"machine learning" AND "deep learning" AND Python AND TensorFlow AND PyTorch AND Keras AND Scikit-learn AND Pandas AND NumPy', 9, 'Two quoted phrases + seven unquoted terms'],
  ['"product manager" AND "product owner" AND SaaS AND "B2B" AND "enterprise software" AND Agile AND Scrum AND Kanban AND Jira', 9, 'Four quoted phrases + five unquoted terms'],
  ['"data scientist" AND "data engineer" AND "machine learning engineer" AND Python AND SQL AND Spark AND Hadoop AND AWS AND GCP AND Azure', 10, 'Three quoted phrases + seven unquoted terms'],
  ['"software engineer" AND "full stack developer" AND "backend engineer" AND Python AND Java AND JavaScript AND TypeScript AND React AND Node AND Express AND MongoDB', 11, 'Three quoted phrases + eight unquoted terms'],
  ['"product manager" OR "product owner" OR "technical product manager" OR "senior product manager" OR SaaS OR "B2B" OR "enterprise software"', 7, 'Five quoted phrases + two unquoted terms with OR'],
  ['"machine learning" AND "deep learning" AND "neural networks" AND "computer vision" AND Python AND TensorFlow AND PyTorch AND Keras AND Scikit-learn', 9, 'Four quoted phrases + five unquoted terms'],
  ['"software engineer" AND "San Francisco" AND (Google OR Apple OR Microsoft OR Amazon) AND Python AND Java AND React AND Node AND Docker', 11, 'Complex with parentheses containing multiple ORs'],
  ['"data scientist" AND "data engineer" AND "machine learning engineer" AND "ML engineer" AND Python AND SQL AND Spark AND Hadoop AND AWS AND GCP', 10, 'Four quoted phrases + six unquoted terms'],
];

interface TestResult {
  keywords: string;
  expectedCount: number;
  actualCount: number;
  passed: boolean;
  description: string;
  error?: string;
}

/**
 * Test a single keyword string
 */
async function testKeywordCount(
  keywords: string,
  expectedCount: number,
  description: string,
): Promise<TestResult> {
  try {
    const response = await axios.post(
      `${SERVER_URL}/candidate-search/test/count-keyword-terms`,
      { keywords },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const actualCount = response.data.count;
    const passed = actualCount === expectedCount;

    return {
      keywords,
      expectedCount,
      actualCount,
      passed,
      description,
    };
  } catch (error: any) {
    return {
      keywords,
      expectedCount,
      actualCount: -1,
      passed: false,
      description,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Keyword Count Test');
  console.log('='.repeat(80));
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`API Token: ${API_TOKEN ? '***' + API_TOKEN.slice(-4) : 'NOT SET'}`);
  console.log(`Test Cases: ${testCases.length}`);
  console.log('='.repeat(80));
  console.log();

  if (!API_TOKEN) {
    console.error('\n❌ ERROR: API_TOKEN environment variable is required');
    console.error('   Set it with: export API_TOKEN=your_token_here');
    process.exit(1);
  }

  console.log('🚀 Running tests...\n');

  const results: TestResult[] = [];
  let passedCount = 0;
  let failedCount = 0;

  // Run all tests
  for (let i = 0; i < testCases.length; i++) {
    const [keywords, expectedCount, description] = testCases[i];
    const result = await testKeywordCount(keywords, expectedCount, description);
    results.push(result);

    if (result.passed) {
      passedCount++;
      console.log(`✅ [${i + 1}/${testCases.length}] PASS: ${description}`);
      console.log(`   Keywords: "${keywords}"`);
      console.log(`   Expected: ${expectedCount}, Actual: ${result.actualCount}`);
    } else {
      failedCount++;
      console.log(`❌ [${i + 1}/${testCases.length}] FAIL: ${description}`);
      console.log(`   Keywords: "${keywords}"`);
      console.log(`   Expected: ${expectedCount}, Actual: ${result.actualCount}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
    console.log();
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passedCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`Success Rate: ${((passedCount / testCases.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  // Print detailed failures
  if (failedCount > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('FAILED TESTS');
    console.log('='.repeat(80));
    results
      .filter(r => !r.passed)
      .forEach((result, index) => {
        console.log(`\n[${index + 1}] ${result.description}`);
        console.log(`   Keywords: "${result.keywords}"`);
        console.log(`   Expected: ${result.expectedCount}`);
        console.log(`   Actual: ${result.actualCount}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });
  }

  // Exit with appropriate code
  if (failedCount > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run the test
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
