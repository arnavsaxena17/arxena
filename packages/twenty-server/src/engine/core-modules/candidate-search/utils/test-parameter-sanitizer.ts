/**
 * Test script for ParameterSanitizer.formatKeywordsWithQuotes
 * Run with: npx ts-node test-parameter-sanitizer.ts
 */

import { ParameterSanitizer } from './parameter-sanitizer.util';

// Access private method for testing
const sanitizer = new ParameterSanitizer();
const formatKeywords = (sanitizer as any).formatKeywordsWithQuotes.bind(sanitizer);

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

const testCases: TestCase[] = [
  // Simple OR chains - should add quotes and brackets
  {
    name: '1. Simple OR with multi-word terms',
    input: 'Pulmonologist OR Consultant Pulmonologist OR Senior Pulmonologist',
    expected: '(Pulmonologist OR "Consultant Pulmonologist" OR "Senior Pulmonologist")',
  },
  {
    name: '2. OR chain with single and multi-word terms',
    input: 'Sales OR Sales Manager OR Business Development Executive',
    expected: '(Sales OR "Sales Manager" OR "Business Development Executive")',
  },
  {
    name: '3. Multiple OR terms with all multi-word',
    input: 'Chest Physician OR Respiratory Specialist OR Pulmonary Medicine Consultant',
    expected: '("Chest Physician" OR "Respiratory Specialist" OR "Pulmonary Medicine Consultant")',
  },
  {
    name: '4. Simple two-term OR',
    input: 'Engineer OR Software Engineer',
    expected: '(Engineer OR "Software Engineer")',
  },
  
  // Already quoted terms - should preserve quotes
  {
    name: '5. Already quoted multi-word terms',
    input: 'Pulmonologist OR "Consultant Pulmonologist" OR "Senior Pulmonologist"',
    expected: '(Pulmonologist OR "Consultant Pulmonologist" OR "Senior Pulmonologist")',
  },
  {
    name: '6. Mixed quoted and unquoted',
    input: '"Sales Manager" OR Business Development OR "Account Executive"',
    expected: '("Sales Manager" OR "Business Development" OR "Account Executive")',
  },
  
  // Expressions with parentheses - should preserve structure
  {
    name: '7. Already grouped with parentheses',
    input: '(Pulmonologist OR Consultant Pulmonologist OR Senior Pulmonologist)',
    expected: '(Pulmonologist OR "Consultant Pulmonologist" OR "Senior Pulmonologist")',
  },
  {
    name: '8. Complex nested parentheses',
    input: '(Sales AND (Manager OR Director)) OR VP Sales',
    expected: '(Sales AND (Manager OR Director)) OR "VP Sales"',
  },
  {
    name: '9. Multiple grouped expressions',
    input: '(Engineer OR Developer) AND (Python OR Java)',
    expected: '(Engineer OR Developer) AND (Python OR Java)',
  },
  
  // Complex boolean logic with AND/NOT - should preserve structure
  {
    name: '10. AND with OR',
    input: 'Sales AND (Manager OR Director OR Head of Sales)',
    expected: 'Sales AND (Manager OR Director OR "Head of Sales")',
  },
  {
    name: '11. NOT operator',
    input: 'Engineer NOT Junior Engineer',
    expected: 'Engineer NOT "Junior Engineer"',
  },
  {
    name: '12. Complex AND/OR/NOT combination',
    input: '(Sales OR Business Development) AND Manager NOT Junior',
    expected: '(Sales OR "Business Development") AND Manager NOT Junior',
  },
  
  // Edge cases
  {
    name: '13. Single term (no operators)',
    input: 'Pulmonologist',
    expected: 'Pulmonologist',
  },
  {
    name: '14. Single multi-word term',
    input: 'Consultant Pulmonologist',
    expected: '"Consultant Pulmonologist"',
  },
  {
    name: '15. Real-world example from logs',
    input: 'Pulmonologist OR Consultant Pulmonologist OR Senior Pulmonologist OR Chest Physician OR Respiratory Specialist OR Pulmonary Medicine Consultant',
    expected: '(Pulmonologist OR "Consultant Pulmonologist" OR "Senior Pulmonologist" OR "Chest Physician" OR "Respiratory Specialist" OR "Pulmonary Medicine Consultant")',
  },
  
  // Operator normalization
  {
    name: '16. Lowercase operators should be normalized',
    input: 'Sales or Manager or Director',
    expected: '(Sales OR Manager OR Director)',
  },
  {
    name: '17. Mixed case operators',
    input: 'Engineer Or Developer and Manager',
    expected: 'Engineer OR Developer AND Manager',
  },
];

function runTests() {
  console.log('🧪 Testing ParameterSanitizer.formatKeywordsWithQuotes\n');
  console.log('='.repeat(80));
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    try {
      const result = formatKeywords(testCase.input);
      const success = result === testCase.expected;
      
      if (success) {
        console.log(`✅ Test ${index + 1}: ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ Test ${index + 1}: ${testCase.name}`);
        console.log(`   Input:    ${testCase.input}`);
        console.log(`   Expected: ${testCase.expected}`);
        console.log(`   Got:      ${result}`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 Test ${index + 1}: ${testCase.name} - ERROR`);
      console.log(`   Error: ${error}`);
      failed++;
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
runTests();

