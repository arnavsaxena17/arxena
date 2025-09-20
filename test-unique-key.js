// Test script to verify unique key generation
const { DataProcessingUtils } = require('./packages/twenty-server/src/engine/core-modules/candidate-sourcing/utils/data-processing.utils.ts');

// Mock candidate data similar to what we see in the logs
const testCandidates = [
  {
    name: 'Smita',
    companyName: 'ITC Infotech'
  },
  {
    name: 'VARUN BANTHIA',
    companyName: 'Tata Steel Ltd'
  },
  {
    name: 'NISHANTH MOHAN',
    companyName: 'CMA CGM Global Business Services'
  }
];

const dataProcessingUtils = new DataProcessingUtils();

console.log('Testing unique key generation:');
console.log('================================');

testCandidates.forEach((candidate, index) => {
  console.log(`\nTest ${index + 1}:`);
  console.log(`Name: "${candidate.name}"`);
  console.log(`Company: "${candidate.companyName}"`);
  
  const uniqueKey = dataProcessingUtils.generateUniqueStringKey(candidate, 'test-source');
  console.log(`Generated unique key: "${uniqueKey}"`);
});
